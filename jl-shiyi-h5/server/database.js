import mysql from 'mysql2/promise';
import crypto from 'node:crypto';

let pool;
let initialized = false;
const ACCOUNT_PATTERN = /^[A-Za-z0-9\u4e00-\u9fff]{1,60}$/;

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function databaseConfig() {
  const url = env('DATABASE_URL');
  if (url) return url;

  const host = env('MYSQL_HOST', env('DB_HOST'));
  const database = env('MYSQL_DATABASE', env('DB_NAME'));
  const user = env('MYSQL_USER', env('DB_USER'));
  const password = env('MYSQL_PASSWORD', env('DB_PASSWORD'));

  if (!host || !database || !user || !password) return null;

  return {
    host,
    port: Number(env('MYSQL_PORT', env('DB_PORT', '3306'))),
    database,
    user,
    password,
    waitForConnections: true,
    connectionLimit: Number(env('MYSQL_CONNECTION_LIMIT', '10')),
    charset: 'utf8mb4',
    timezone: 'Z',
  };
}

export function isDatabaseConfigured() {
  return Boolean(databaseConfig());
}

function getPool() {
  if (pool) return pool;
  const config = databaseConfig();
  if (!config) throw new Error('Database is not configured');
  pool = typeof config === 'string'
    ? mysql.createPool({ uri: config, waitForConnections: true, connectionLimit: Number(env('MYSQL_CONNECTION_LIMIT', '10')), charset: 'utf8mb4', timezone: 'Z' })
    : mysql.createPool(config);
  return pool;
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function optional(value) {
  return value === undefined || value === null || value === '' ? null : value;
}

function contactType(contact) {
  if (/^1\d{10}$/.test(contact)) return 'phone';
  if (contact.includes('@')) return 'email';
  if (/wx|wechat/i.test(contact)) return 'wechat';
  return 'other';
}

function validateAccount(identifier) {
  if (!identifier) throw Object.assign(new Error('请输入账号'), { status: 400 });
  if (!ACCOUNT_PATTERN.test(identifier)) throw Object.assign(new Error('账号只能使用中文、英文、数字，且不超过 60 个字符'), { status: 400 });
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function validatePassword(password) {
  if (!password || password.length < 6) throw Object.assign(new Error('密码至少需要 6 个字符'), { status: 400 });
}

function rowToUser(row) {
  return {
    id: row.id,
    loginIdentifier: row.login_identifier,
    nickname: row.nickname,
    avatarUrl: row.avatar_url || undefined,
    campus: row.campus || undefined,
    department: row.department || undefined,
    college: row.college || undefined,
    major: row.major || undefined,
    role: row.role,
  };
}

function rowToBook(row, images) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    title: row.title,
    author: row.author,
    isbn: row.isbn || undefined,
    category: row.category,
    images: images.get(row.id) || [],
    priceCents: Number(row.price_cents),
    quantity: Number(row.quantity),
    condition: row.book_condition,
    contact: row.contact,
    contactType: row.contact_type,
    description: row.description || undefined,
    campus: row.campus || undefined,
    department: row.department || undefined,
    college: row.college || undefined,
    major: row.major || undefined,
    status: row.status,
    buyerId: row.buyer_id || undefined,
    soldAt: row.sold_at ? toIso(row.sold_at) : undefined,
    lastMessageAt: row.last_message_at ? toIso(row.last_message_at) : undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function ensureInitialized() {
  if (initialized) return;
  const db = getPool();
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      login_identifier VARCHAR(191) NOT NULL UNIQUE,
      nickname VARCHAR(100) NOT NULL,
      avatar_url TEXT NULL,
      campus VARCHAR(100) NULL,
      department VARCHAR(100) NULL,
      college VARCHAR(100) NULL,
      major VARCHAR(100) NULL,
      role ENUM('user','admin') NOT NULL DEFAULT 'user',
      password_hash VARCHAR(255) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS books (
      id VARCHAR(64) PRIMARY KEY,
      seller_id VARCHAR(64) NOT NULL,
      title VARCHAR(200) NOT NULL,
      author VARCHAR(200) NOT NULL,
      isbn VARCHAR(32) NULL,
      category ENUM('textbook','novel','reference','other') NOT NULL,
      price_cents INT NOT NULL DEFAULT 0,
      quantity INT NOT NULL DEFAULT 1,
      book_condition ENUM('new','like_new','annotated','worn') NOT NULL,
      contact VARCHAR(191) NOT NULL,
      contact_type ENUM('wechat','phone','email','other') NOT NULL,
      description TEXT NULL,
      campus VARCHAR(100) NULL,
      department VARCHAR(100) NULL,
      college VARCHAR(100) NULL,
      major VARCHAR(100) NULL,
      status ENUM('available','reserved','sold','removed') NOT NULL DEFAULT 'available',
      buyer_id VARCHAR(64) NULL,
      sold_at DATETIME(3) NULL,
      last_message_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_books_status_created (status, created_at),
      INDEX idx_books_category_status_created (category, status, created_at),
      INDEX idx_books_seller_status_created (seller_id, status, created_at),
      INDEX idx_books_isbn (isbn),
      CONSTRAINT fk_books_seller FOREIGN KEY (seller_id) REFERENCES users(id),
      CONSTRAINT fk_books_buyer FOREIGN KEY (buyer_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS book_images (
      id VARCHAR(64) PRIMARY KEY,
      book_id VARCHAR(64) NOT NULL,
      url TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_book_images_book_sort (book_id, sort_order),
      CONSTRAINT fk_book_images_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS book_interests (
      id VARCHAR(64) PRIMARY KEY,
      book_id VARCHAR(64) NOT NULL,
      buyer_id VARCHAR(64) NOT NULL,
      status ENUM('active','cancelled','chosen') NOT NULL DEFAULT 'active',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uniq_book_buyer (book_id, buyer_id),
      INDEX idx_interests_book_status (book_id, status),
      CONSTRAINT fk_interests_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      CONSTRAINT fk_interests_buyer FOREIGN KEY (buyer_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(64) PRIMARY KEY,
      book_id VARCHAR(64) NOT NULL,
      from_user_id VARCHAR(64) NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_messages_book_created (book_id, created_at),
      CONSTRAINT fk_messages_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      CONSTRAINT fk_messages_user FOREIGN KEY (from_user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS evaluations (
      id VARCHAR(64) PRIMARY KEY,
      book_id VARCHAR(64) NOT NULL,
      from_user_id VARCHAR(64) NOT NULL,
      to_user_id VARCHAR(64) NOT NULL,
      from_role ENUM('buyer','seller') NOT NULL,
      rating INT NOT NULL,
      comment TEXT NULL,
      tags_json TEXT NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uniq_eval_book_user (book_id, from_user_id),
      CONSTRAINT fk_evaluations_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      CONSTRAINT fk_evaluations_from FOREIGN KEY (from_user_id) REFERENCES users(id),
      CONSTRAINT fk_evaluations_to FOREIGN KEY (to_user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS reports (
      id VARCHAR(64) PRIMARY KEY,
      target_type ENUM('book','user') NOT NULL,
      target_id VARCHAR(64) NOT NULL,
      reporter_id VARCHAR(64) NOT NULL,
      reason VARCHAR(200) NOT NULL,
      detail TEXT NULL,
      status ENUM('pending','reviewing','resolved','rejected') NOT NULL DEFAULT 'pending',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uniq_report_target_user (target_type, target_id, reporter_id),
      CONSTRAINT fk_reports_user FOREIGN KEY (reporter_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];

  for (const statement of statements) {
    await db.execute(statement);
  }

  // 兼容：为已有表动态添加 password_hash 列（如果不存在）
  try {
    await db.execute('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER role');
  } catch (e) {
    // 列已存在则忽略
  }

  initialized = true;
}

export async function checkDatabase() {
  if (!isDatabaseConfigured()) return { configured: false, ok: false };
  await ensureInitialized();
  await getPool().query('SELECT 1');
  return { configured: true, ok: true };
}

export async function getState() {
  await ensureInitialized();
  const db = getPool();
  const [userRows] = await db.query('SELECT * FROM users ORDER BY created_at ASC');
  const [bookRows] = await db.query('SELECT * FROM books ORDER BY created_at DESC');
  const [imageRows] = await db.query('SELECT * FROM book_images ORDER BY book_id ASC, sort_order ASC');
  const [interestRows] = await db.query('SELECT * FROM book_interests ORDER BY created_at ASC');
  const [messageRows] = await db.query('SELECT * FROM messages ORDER BY created_at ASC');
  const [evaluationRows] = await db.query('SELECT * FROM evaluations ORDER BY created_at ASC');
  const [reportRows] = await db.query('SELECT * FROM reports ORDER BY created_at ASC');

  const imagesByBook = new Map();
  for (const image of imageRows) {
    const list = imagesByBook.get(image.book_id) || [];
    list.push({ id: image.id, url: image.url, sortOrder: Number(image.sort_order) });
    imagesByBook.set(image.book_id, list);
  }

  return {
    users: userRows.map(rowToUser),
    books: bookRows.map((row) => rowToBook(row, imagesByBook)),
    interests: interestRows.map((row) => ({ id: row.id, bookId: row.book_id, buyerId: row.buyer_id, status: row.status, createdAt: toIso(row.created_at) })),
    messages: messageRows.map((row) => ({ id: row.id, bookId: row.book_id, fromUserId: row.from_user_id, content: row.content, createdAt: toIso(row.created_at) })),
    evaluations: evaluationRows.map((row) => ({ id: row.id, bookId: row.book_id, fromUserId: row.from_user_id, toUserId: row.to_user_id, fromRole: row.from_role, rating: Number(row.rating), comment: row.comment || undefined, tags: JSON.parse(row.tags_json || '[]'), createdAt: toIso(row.created_at) })),
    reports: reportRows.map((row) => ({ id: row.id, targetType: row.target_type, targetId: row.target_id, reporterId: row.reporter_id, reason: row.reason, detail: row.detail || undefined, status: row.status, createdAt: toIso(row.created_at) })),
  };
}

// Server-side admin identifiers — the authoritative source of truth.
// The frontend ADMIN_IDENTIFIERS is for optimistic UI only.
const ADMIN_IDENTIFIERS = ['admin'];

export async function loginUser(identifier, password, requestedRole) {
  await ensureInitialized();
  const db = getPool();
  const loginIdentifier = String(identifier || '').trim();
  validateAccount(loginIdentifier);

  const [existing] = await db.execute('SELECT * FROM users WHERE login_identifier = ? LIMIT 1', [loginIdentifier]);

  if (existing.length > 0) {
    const row = existing[0];
    const existingUser = rowToUser(row);

    // 校验密码
    if (row.password_hash) {
      validatePassword(password);
      if (hashPassword(password) !== row.password_hash) {
        throw Object.assign(new Error('密码错误'), { status: 401 });
      }
    }

    // 服务器端判定：ADMIN_IDENTIFIERS 成员 → admin，否则保持数据库现有角色
    const serverRole = ADMIN_IDENTIFIERS.includes(loginIdentifier) ? 'admin' : 'user';
    if (serverRole === 'admin' && existingUser.role !== 'admin') {
      await db.execute('UPDATE users SET role = ? WHERE id = ?', ['admin', existingUser.id]);
      existingUser.role = 'admin';
    }
    return existingUser;
  }

  // 新用户：需要设置密码，管理员由服务器端 ADMIN_IDENTIFIERS 判定
  validatePassword(password);
  const role = ADMIN_IDENTIFIERS.includes(loginIdentifier) ? 'admin' : 'user';
  const user = {
    id: id('user'),
    loginIdentifier,
    nickname: loginIdentifier,
    role,
  };
  await db.execute(
    'INSERT INTO users (id, login_identifier, nickname, role, password_hash) VALUES (?, ?, ?, ?, ?)',
    [user.id, user.loginIdentifier, user.nickname, user.role, hashPassword(password)],
  );
  return user;
}

export async function setUserPassword(identifier, password) {
  await ensureInitialized();
  const db = getPool();
  const loginIdentifier = String(identifier || '').trim();
  validateAccount(loginIdentifier);
  validatePassword(password);

  const [existing] = await db.execute('SELECT * FROM users WHERE login_identifier = ? LIMIT 1', [loginIdentifier]);
  if (existing.length === 0) {
    throw Object.assign(new Error('账号不存在'), { status: 404 });
  }

  await db.execute('UPDATE users SET password_hash = ? WHERE login_identifier = ?', [hashPassword(password), loginIdentifier]);
  return rowToUser(existing[0]);
}

export async function updateUser(user) {
  await ensureInitialized();
  await getPool().execute(
    `UPDATE users SET nickname = ?, avatar_url = ?, campus = ?, department = ?, college = ?, major = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
    [user.nickname, optional(user.avatarUrl), optional(user.campus), optional(user.department), optional(user.college), optional(user.major), user.id],
  );
  return getState();
}

export async function publishBook(userId, draft) {
  await ensureInitialized();
  const db = getPool();
  const connection = await db.getConnection();
  const bookId = id('book');
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO books (id, seller_id, title, author, isbn, category, price_cents, quantity, book_condition, contact, contact_type, description, campus, department, college, major, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
      [
        bookId,
        userId,
        String(draft.title || '').trim() || '未填写书名',
        String(draft.author || '').trim() || '未填写作者',
        optional(String(draft.isbn || '').trim()),
        draft.category || 'other',
        Math.round(Number(draft.priceYuan || 0) * 100),
        Math.max(1, Number(draft.quantity || 1)),
        draft.condition || 'like_new',
        String(draft.contact || '').trim(),
        contactType(String(draft.contact || '').trim()),
        optional(String(draft.description || '').trim()),
        optional(String(draft.campus || '').trim()),
        optional(String(draft.department || '').trim()),
        optional(String(draft.college || '').trim()),
        optional(String(draft.major || '').trim()),
      ],
    );

    const imageUrls = Array.isArray(draft.imageUrls) ? draft.imageUrls.map((url) => String(url || '').trim()).filter(Boolean) : [];
    for (const [index, url] of imageUrls.entries()) {
      await connection.execute('INSERT INTO book_images (id, book_id, url, sort_order) VALUES (?, ?, ?, ?)', [id('img'), bookId, url, index]);
    }

    await connection.commit();
    return bookId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function expressInterest(bookId, userId) {
  await ensureInitialized();
  const db = getPool();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[book]] = await connection.execute('SELECT * FROM books WHERE id = ? FOR UPDATE', [bookId]);
    if (!book) throw Object.assign(new Error('没有找到这本书'), { status: 404 });
    if (book.seller_id === userId) throw Object.assign(new Error('不能购买自己发布的书籍'), { status: 400 });
    if (book.status !== 'available') throw Object.assign(new Error('这本书当前不可购买'), { status: 400 });

    await connection.execute('INSERT IGNORE INTO book_interests (id, book_id, buyer_id, status) VALUES (?, ?, ?, \'active\')', [id('interest'), bookId, userId]);
    const [[{ active_count: activeCount }]] = await connection.execute('SELECT COUNT(*) AS active_count FROM book_interests WHERE book_id = ? AND status = \'active\'', [bookId]);
    const nextStatus = Number(activeCount) >= Number(book.quantity) ? 'reserved' : 'available';
    await connection.execute('UPDATE books SET status = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [nextStatus, bookId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function confirmSold(bookId, sellerId, buyerId) {
  await ensureInitialized();
  const db = getPool();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[book]] = await connection.execute('SELECT * FROM books WHERE id = ? FOR UPDATE', [bookId]);
    if (!book) throw Object.assign(new Error('没有找到这本书'), { status: 404 });
    if (book.seller_id !== sellerId) throw Object.assign(new Error('只有卖家可以确认成交'), { status: 403 });
    await connection.execute('UPDATE books SET status = \'sold\', buyer_id = ?, sold_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [buyerId, bookId]);
    await connection.execute('UPDATE book_interests SET status = IF(buyer_id = ?, \'chosen\', status) WHERE book_id = ?', [buyerId, bookId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function removeBook(bookId, userId) {
  await ensureInitialized();
  const [result] = await getPool().execute('UPDATE books SET status = \'removed\', updated_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND seller_id = ?', [bookId, userId]);
  if (result.affectedRows === 0) throw Object.assign(new Error('只有发布者可以下架'), { status: 403 });
}

export async function sendMessage(bookId, userId, content) {
  await ensureInitialized();
  const db = getPool();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[book]] = await connection.execute('SELECT * FROM books WHERE id = ? FOR UPDATE', [bookId]);
    if (!book) throw Object.assign(new Error('没有找到这本书'), { status: 404 });
    const [[interest]] = await connection.execute('SELECT id FROM book_interests WHERE book_id = ? AND buyer_id = ? LIMIT 1', [bookId, userId]);
    if (book.seller_id !== userId && !interest) throw Object.assign(new Error('请先表达想买，再进行留言'), { status: 403 });
    await connection.execute('INSERT INTO messages (id, book_id, from_user_id, content) VALUES (?, ?, ?, ?)', [id('msg'), bookId, userId, String(content || '').trim()]);
    await connection.execute('UPDATE books SET last_message_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [bookId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function submitEvaluation(bookId, userId, rating, comment, tags) {
  await ensureInitialized();
  const db = getPool();
  const [[book]] = await db.execute('SELECT * FROM books WHERE id = ?', [bookId]);
  if (!book || book.status !== 'sold') throw Object.assign(new Error('只有已成交订单可以评价'), { status: 400 });
  const isSeller = book.seller_id === userId;
  const isBuyer = book.buyer_id === userId;
  if (!isSeller && !isBuyer) throw Object.assign(new Error('只有交易双方可以评价'), { status: 403 });
  await db.execute(
    'INSERT INTO evaluations (id, book_id, from_user_id, to_user_id, from_role, rating, comment, tags_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id('eval'), bookId, userId, isSeller ? book.buyer_id : book.seller_id, isSeller ? 'seller' : 'buyer', Number(rating), optional(comment), JSON.stringify(Array.isArray(tags) ? tags : [])],
  );
}

export async function submitReport(bookId, userId, reason, detail) {
  await ensureInitialized();
  await getPool().execute(
    'INSERT IGNORE INTO reports (id, target_type, target_id, reporter_id, reason, detail, status) VALUES (?, \'book\', ?, ?, ?, ?, \'pending\')',
    [id('report'), bookId, userId, String(reason || '用户举报').trim(), optional(String(detail || '').trim())],
  );
}