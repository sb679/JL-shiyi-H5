import { ChangeEvent, CompositionEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BookOpen,
  Check,
  ChevronLeft,
  CircleUserRound,
  Flag,
  Home,
  ImagePlus,
  LogIn,
  Plus,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
} from 'lucide-react';
import { campusConfig, currentUserSeed, seedData } from './mockData';
import type { AppData, Book, BookCategory, BookCondition, BookStatus, Evaluation, Report, User } from './types';

const queryClient = new QueryClient();
const GOOGLE_BOOKS_API_KEY = ((import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined) || '').trim();
const configuredUploadEndpoint = (import.meta.env.VITE_UPLOAD_ENDPOINT as string | undefined) || '';
const UPLOAD_ENDPOINT = configuredUploadEndpoint || '/api/uploads/images';
const API_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 120000;
const SESSION_STORAGE_KEY = 'jl-shiyi-session-v1';
const PUBLISH_DRAFT_STORAGE_KEY = 'jl-shiyi-publish-draft-v1';
const LAST_LOCATION_STORAGE_KEY = 'jl-shiyi-last-location-v1';
const DEFAULT_BOOK_TITLE = '未填写书名';
const DEFAULT_BOOK_AUTHOR = '未填写作者';
const CHINESE_ONLY_PATTERN = /^[\u4e00-\u9fff]*$/;
const ACCOUNT_PATTERN = /^[A-Za-z0-9\u4e00-\u9fff]{1,60}$/;
const ADMIN_IDENTIFIERS = ['admin', '兰可欣'];
const locationFieldLabels = {
  campus: '校区',
  department: '学部',
  college: '学院',
  major: '专业',
} as const;

const categoryLabels: Record<BookCategory | 'all', string> = {
  all: '全部',
  textbook: '教材',
  novel: '小说',
  reference: '教辅',
  other: '其他',
};

const conditionLabels: Record<BookCondition, string> = {
  new: '全新',
  like_new: '几乎全新',
  annotated: '有笔记',
  worn: '较旧',
};

const statusLabels: Record<BookStatus, string> = {
  available: '在售',
  reserved: '已预定',
  sold: '已售出',
  removed: '已下架',
};

const roleLabels: Record<Evaluation['fromRole'], string> = {
  buyer: '买家评价',
  seller: '卖家评价',
};

const reportStatusLabels: Record<Report['status'], string> = {
  pending: '待处理',
  reviewing: '审核中',
  resolved: '已处理',
  rejected: '已驳回',
};

type PublishDraft = {
  title: string;
  author: string;
  isbn: string;
  category: BookCategory;
  priceYuan: string;
  quantity: number;
  condition: BookCondition;
  contact: string;
  description: string;
  campus: string;
  department: string;
  college: string;
  major: string;
  imageUrls: string[];
};

type GoogleBooksResponse = {
  totalItems?: number;
  items?: Array<{
    volumeInfo?: {
      title?: string;
      authors?: string[];
      categories?: string[];
      description?: string;
      imageLinks?: {
        thumbnail?: string;
        smallThumbnail?: string;
      };
    };
  }>;
};

type SavedSession = {
  identifier: string;
  user?: User;
};

type PublishLocation = Pick<PublishDraft, 'campus' | 'department' | 'college' | 'major'>;

function readStorage<T>(key: string) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can be unavailable in private mode; the app still works without cache.
  }
}

function removeStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore cache cleanup failures.
  }
}

function localUserId(identifier: string) {
  let hash = 0;
  for (const char of identifier) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return `local_${Math.abs(hash)}`;
}

function createLocalUser(identifier: string, role: User['role'] = 'user'): User {
  return {
    ...currentUserSeed,
    id: localUserId(identifier),
    loginIdentifier: identifier,
    nickname: identifier,
    role,
  };
}

function validateAccount(identifier: string) {
  if (!identifier) throw new Error('请输入账号');
  if (!ACCOUNT_PATTERN.test(identifier)) throw new Error('账号只能使用中文、英文、数字，且不超过 60 个字符');
}

function createPublishDraft(user?: User | null): PublishDraft {
  const location = readStorage<PublishLocation>(LAST_LOCATION_STORAGE_KEY);
  return {
    title: '',
    author: '',
    isbn: '',
    category: 'textbook',
    priceYuan: '',
    quantity: 1,
    condition: 'like_new',
    contact: '',
    description: '',
    campus: location?.campus || user?.campus || '',
    department: location?.department || user?.department || '',
    college: location?.college || user?.college || '',
    major: location?.major || user?.major || '',
    imageUrls: [],
  };
}

async function requestJson<T>(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((payload as { error?: string }).error || '服务暂时不可用，请稍后重试。');
    return payload as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function formatPrice(priceCents: number) {
  return `¥${(priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function maskName(name: string) {
  return name.length <= 1 ? name : `${name.slice(0, 1)}*`;
}

function contactType(contact: string): Book['contactType'] {
  if (/^1\d{10}$/.test(contact)) return 'phone';
  if (contact.includes('@')) return 'email';
  if (/wx|wechat/i.test(contact)) return 'wechat';
  return 'other';
}

function classifyGoogleCategory(categories?: string[]): BookCategory {
  const text = (categories || []).join(' ').toLowerCase();
  if (/fiction|novel|文学|小说/.test(text)) return 'novel';
  if (/education|textbook|教材|课程/.test(text)) return 'textbook';
  if (/exam|reference|study|考试|教辅|参考/.test(text)) return 'reference';
  return 'other';
}

function normalizeGoogleImage(url?: string) {
  return url ? url.replace(/^http:/, 'https:') : undefined;
}

function keepChineseOnly(value: string) {
  return Array.from(value).filter((char) => CHINESE_ONLY_PATTERN.test(char)).join('');
}

function hasInvalidLocationField(values: Pick<PublishDraft, 'campus' | 'department' | 'college' | 'major'>) {
  return (Object.keys(locationFieldLabels) as Array<keyof typeof locationFieldLabels>).find((key) => !CHINESE_ONLY_PATTERN.test(values[key].trim()));
}

function locationPath(values: { campus?: string; department?: string; college?: string; major?: string }) {
  return [values.campus, values.department, values.college, values.major].filter(Boolean).join(' / ');
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean))) as string[];
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片读取失败')));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

async function uploadImagesToOss(files: File[], onProgress?: (text: string) => void) {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  onProgress?.(`正在上传 ${files.length} 张图片到 OSS（最多 ${UPLOAD_TIMEOUT_MS / 1000} 秒）...`);
  let response: Response;
  try {
    response = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`图片上传超时（已等待 ${UPLOAD_TIMEOUT_MS / 1000} 秒），请检查网络或减少图片数量后重试。`);
    }
    throw new Error('图片上传接口连接失败，请确认后端服务已启动，且 OSS 环境变量已配置。');
  } finally {
    window.clearTimeout(timeoutId);
  }
  const payload = await response.json().catch(() => ({})) as { images?: Array<{ url: string }>; error?: string };
  if (!response.ok) throw new Error(payload.error || '图片上传失败，请稍后重试。');
  return (payload.images || []).map((item) => item.url).filter(Boolean);
}

function useAppState() {
  const [user, setUser] = useState<User | null>(() => readStorage<SavedSession>(SESSION_STORAGE_KEY)?.user || null);
  const [data, setData] = useState<AppData>(seedData);
  const [remoteReady, setRemoteReady] = useState(false);
  const userById = (id?: string) => data.users.find((item) => item.id === id);
  const activeInterests = (bookId: string) => data.interests.filter((item) => item.bookId === bookId && item.status === 'active');
  const chosenQuantity = (bookId: string) => data.interests.filter((item) => item.bookId === bookId && item.status === 'chosen').reduce((sum, item) => sum + item.quantity, 0);
  const hasChosenInterest = (bookId: string, userId: string) => data.interests.some((item) => item.bookId === bookId && item.buyerId === userId && item.status === 'chosen');

  useEffect(() => {
    let alive = true;
    async function loadRemoteState() {
      const savedSession = readStorage<SavedSession>(SESSION_STORAGE_KEY);
      try {
        let nextData = await requestJson<AppData>('/api/state');
        let nextUser: User | null = null;
        if (savedSession?.identifier) {
          const loginResult = await requestJson<{ user: User }>('/api/login', {
            method: 'POST',
            body: JSON.stringify({ identifier: savedSession.identifier }),
          });
          nextUser = loginResult.user;
          nextData = await requestJson<AppData>('/api/state');
          writeStorage(SESSION_STORAGE_KEY, { identifier: savedSession.identifier, user: nextUser });
        }
        if (!alive) return;
        setUser(nextUser);
        setData(nextData);
        setRemoteReady(true);
      } catch {
        if (!alive) return;
        setUser(savedSession?.user || null);
        setRemoteReady(false);
      }
    }
    loadRemoteState();
    return () => { alive = false; };
  }, []);

  async function replaceWithRemoteState(nextDataPromise: Promise<AppData>) {
    const nextData = await nextDataPromise;
    setData(nextData);
  }

  async function login(identifier: string) {
    const loginIdentifier = identifier.trim();
    validateAccount(loginIdentifier);
    const requestedRole = ADMIN_IDENTIFIERS.includes(loginIdentifier) ? 'admin' as const : 'user' as const;
    if (remoteReady) {
      const result = await requestJson<{ user: User }>('/api/login', { method: 'POST', body: JSON.stringify({ identifier: loginIdentifier, role: requestedRole }) });
      const nextData = await requestJson<AppData>('/api/state');
      // 以后端返回的 role 为准（服务端可能升级老用户为 admin）
      setUser(result.user);
      setData(nextData);
      writeStorage(SESSION_STORAGE_KEY, { identifier: loginIdentifier, user: result.user });
      return;
    }
    const localUser = createLocalUser(loginIdentifier, requestedRole);
    setUser(localUser);
    setData((current) => ({
      ...current,
      users: current.users.some((item) => item.id === localUser.id) ? current.users : [...current.users, localUser],
    }));
    writeStorage(SESSION_STORAGE_KEY, { identifier: loginIdentifier, user: localUser });
  }

  async function updateUser(nextUser: User) {
    if (remoteReady) {
      await replaceWithRemoteState(requestJson<AppData>(`/api/users/${nextUser.id}`, { method: 'PUT', body: JSON.stringify({ ...nextUser, userId: nextUser.id }) }));
      setUser(nextUser);
      writeStorage(SESSION_STORAGE_KEY, { identifier: nextUser.loginIdentifier, user: nextUser });
      return;
    }
    setUser(nextUser);
    writeStorage(SESSION_STORAGE_KEY, { identifier: nextUser.loginIdentifier, user: nextUser });
    setData((current) => ({
      ...current,
      users: current.users.some((item) => item.id === nextUser.id)
        ? current.users.map((item) => (item.id === nextUser.id ? nextUser : item))
        : [...current.users, nextUser],
    }));
  }

  async function publishBook(draft: PublishDraft) {
    if (!user) throw new Error('请先登录');
    if (remoteReady) {
      const result = await requestJson<{ bookId: string; state: AppData }>('/api/books', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, draft }),
      });
      setData(result.state);
      return result.bookId;
    }
    const now = new Date().toISOString();
    const book: Book = {
      id: createId('book'),
      sellerId: user.id,
      title: draft.title.trim() || DEFAULT_BOOK_TITLE,
      author: draft.author.trim() || DEFAULT_BOOK_AUTHOR,
      isbn: draft.isbn.trim() || undefined,
      category: draft.category,
      images: draft.imageUrls.map((url) => url.trim()).filter(Boolean).map((url, index) => ({ id: createId('img'), url, sortOrder: index })),
      priceCents: Math.round(Number(draft.priceYuan || 0) * 100),
      quantity: draft.quantity,
      condition: draft.condition,
      contact: draft.contact.trim(),
      contactType: contactType(draft.contact),
      description: draft.description.trim(),
      campus: draft.campus.trim(),
      department: draft.department.trim(),
      college: draft.college.trim(),
      major: draft.major.trim(),
      buyerIds: [],
      status: 'available',
      createdAt: now,
      updatedAt: now,
    };
    setData((current) => ({ ...current, books: [book, ...current.books] }));
    return book.id;
  }

  async function expressInterest(book: Book, quantity: number) {
    if (!user) throw new Error('请先登录');
    if (remoteReady) {
      await replaceWithRemoteState(requestJson<AppData>(`/api/books/${book.id}/interests`, { method: 'POST', body: JSON.stringify({ userId: user.id, quantity }) }));
      return;
    }
    if (book.sellerId === user.id) throw new Error('不能购买自己发布的书籍');
    if (book.status !== 'available' && book.status !== 'reserved') throw new Error('这本书当前不可购买');
    if (hasChosenInterest(book.id, user.id)) throw new Error('你已经购买过这本书，不能重复下单');
    if (data.interests.some((item) => item.bookId === book.id && item.buyerId === user.id && item.status === 'active')) return;
    const totalChosen = chosenQuantity(book.id);
    const remaining = book.quantity - totalChosen;
    if (remaining <= 0) throw new Error('库存已售罄');
    const qty = Math.max(1, Math.min(quantity, remaining));
    setData((current) => ({
      ...current,
      interests: [...current.interests, { id: createId('interest'), bookId: book.id, buyerId: user.id, quantity: qty, status: 'active', createdAt: new Date().toISOString() }],
    }));
  }

  async function confirmSold(book: Book, buyerId: string) {
    if (!user || book.sellerId !== user.id) throw new Error('只有卖家可以确认成交');
    if (remoteReady) {
      await replaceWithRemoteState(requestJson<AppData>(`/api/books/${book.id}/confirm-sold`, { method: 'POST', body: JSON.stringify({ userId: user.id, buyerId }) }));
      return;
    }
    setData((current) => {
      const interest = current.interests.find((item) => item.bookId === book.id && item.buyerId === buyerId && item.status === 'active');
      const chosenQty = interest?.quantity || 1;
      const totalAlreadyChosen = current.interests.filter((item) => item.bookId === book.id && item.status === 'chosen').reduce((sum, item) => sum + item.quantity, 0);
      const remainingAfterThis = book.quantity - totalAlreadyChosen - chosenQty;
      const now = new Date().toISOString();
      return {
        ...current,
        books: current.books.map((item) => {
          if (item.id !== book.id) return item;
          return {
            ...item,
            buyerIds: [...item.buyerIds, buyerId],
            status: remainingAfterThis <= 0 ? 'sold' as const : 'available' as const,
            soldAt: remainingAfterThis <= 0 ? now : item.soldAt,
            updatedAt: now,
          };
        }),
        interests: current.interests.map((item) => {
          if (item.bookId === book.id && item.buyerId === buyerId) return { ...item, status: 'chosen' as const };
          if (item.bookId === book.id && item.status === 'active' && remainingAfterThis <= 0) return { ...item, status: 'cancelled' as const };
          return item;
        }),
      };
    });
  }

  async function removeBook(book: Book) {
    if (!user || book.sellerId !== user.id) throw new Error('只有发布者可以下架');
    if (remoteReady) {
      await replaceWithRemoteState(requestJson<AppData>(`/api/books/${book.id}/remove`, { method: 'POST', body: JSON.stringify({ userId: user.id }) }));
      return;
    }
    setData((current) => ({
      ...current,
      books: current.books.map((item) => (item.id === book.id ? { ...item, status: 'removed', updatedAt: new Date().toISOString() } : item)),
    }));
  }

  async function adminRemoveBook(book: Book) {
    if (!user || user.role !== 'admin') throw new Error('只有管理员可以强制下架');
    if (remoteReady) {
      await replaceWithRemoteState(requestJson<AppData>(`/api/books/${book.id}/remove`, { method: 'POST', body: JSON.stringify({ userId: user.id, admin: true }) }));
      return;
    }
    setData((current) => ({
      ...current,
      books: current.books.map((item) => (item.id === book.id ? { ...item, status: 'removed', updatedAt: new Date().toISOString() } : item)),
    }));
  }

  async function updateReportStatus(report: Report, status: Report['status']) {
    if (!user || user.role !== 'admin') throw new Error('只有管理员可以处理举报');
    if (remoteReady) {
      await replaceWithRemoteState(requestJson<AppData>(`/api/reports/${report.id}`, { method: 'PUT', body: JSON.stringify({ userId: user.id, status }) }));
      return;
    }
    setData((current) => ({
      ...current,
      reports: current.reports.map((item) => (item.id === report.id ? { ...item, status } : item)),
    }));
  }

  async function sendMessage(book: Book, content: string) {
    if (!user) throw new Error('请先登录');
    if (remoteReady) {
      await replaceWithRemoteState(requestJson<AppData>(`/api/books/${book.id}/messages`, { method: 'POST', body: JSON.stringify({ userId: user.id, content }) }));
      return;
    }
    const allowed = book.sellerId === user.id || data.interests.some((item) => item.bookId === book.id && item.buyerId === user.id);
    if (!allowed) throw new Error('请先表达想买，再进行留言');
    const now = new Date().toISOString();
    setData((current) => ({
      ...current,
      messages: [...current.messages, { id: createId('msg'), bookId: book.id, fromUserId: user.id, content, createdAt: now }],
      books: current.books.map((item) => (item.id === book.id ? { ...item, lastMessageAt: now } : item)),
    }));
  }

  async function submitEvaluation(book: Book, rating: number, comment: string, tags: string[]) {
    if (!user || book.status !== 'sold') throw new Error('只有已成交订单可以评价');
    if (remoteReady) {
      await replaceWithRemoteState(requestJson<AppData>(`/api/books/${book.id}/evaluations`, { method: 'POST', body: JSON.stringify({ userId: user.id, rating, comment, tags }) }));
      return;
    }
    const isSeller = book.sellerId === user.id;
    const isBuyer = data.interests.some((item) => item.bookId === book.id && item.buyerId === user.id && item.status === 'chosen');
    if (!isSeller && !isBuyer) throw new Error('只有交易双方可以评价');
    if (data.evaluations.some((item) => item.bookId === book.id && item.fromUserId === user.id)) throw new Error('你已经评价过这笔交易');
    setData((current) => ({
      ...current,
      evaluations: [
        ...current.evaluations,
        {
          id: createId('eval'),
          bookId: book.id,
          fromUserId: user.id,
          toUserId: isSeller ? '' : book.sellerId,
          fromRole: isSeller ? 'seller' : 'buyer',
          rating,
          comment,
          tags,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  }

  async function submitReport(book: Book, reason: string, detail: string) {
    if (!user) throw new Error('请先登录');
    if (remoteReady) {
      await replaceWithRemoteState(requestJson<AppData>(`/api/books/${book.id}/reports`, { method: 'POST', body: JSON.stringify({ userId: user.id, reason, detail }) }));
      return;
    }
    setData((current) => ({
      ...current,
      reports: [...current.reports, { id: createId('report'), targetType: 'book', targetId: book.id, reporterId: user.id, reason, detail, status: 'pending', createdAt: new Date().toISOString() }],
    }));
  }

  async function refreshData() {
    if (!remoteReady) return;
    try {
      const nextData = await requestJson<AppData>('/api/state');
      setData(nextData);
    } catch {
      // 静默失败，保持当前数据
    }
  }

  return { user, data, userById, activeInterests, login, updateUser, publishBook, expressInterest, confirmSold, removeBook, adminRemoveBook, updateReportStatus, sendMessage, submitEvaluation, submitReport, refreshData };
}

type AppState = ReturnType<typeof useAppState>;

function UserAvatar({ user, size = 20 }: { user?: User | null; size?: number }) {
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.nickname} className="avatar-img" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  }
  return <CircleUserRound size={size} />;
}

function Shell({ state }: { state: AppState }) {
  const isAdmin = state.user?.role === 'admin';
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/books" className="brand" aria-label="返回书城"><BookOpen size={24} /><span>JL拾遗</span></Link>
        <div className="topbar-actions">
          <Link className="icon-button" to="/publish" aria-label="发布书籍" title="发布书籍"><Plus size={20} /></Link>
          {isAdmin && <Link className="profile-chip" to="/admin" title="管理面板"><Settings size={18} /><span>管理</span></Link>}
          <Link className="profile-chip" to="/me/books"><UserAvatar user={state.user} size={18} /><span>{state.user?.role === 'admin' ? `admin → 管理` : state.user?.nickname || '去登录'}</span></Link>
        </div>
      </header>
      <main className="content-wrap">
        <Routes>
          <Route path="/" element={<MallPage state={state} />} />
          <Route path="/books" element={<MallPage state={state} />} />
          <Route path="/books/:bookId" element={<DetailPage state={state} />} />
          <Route path="/publish" element={<PublishPage state={state} />} />
          <Route path="/admin" element={<AdminPage state={state} />} />
          <Route path="/me/books" element={<MyBooksPage state={state} />} />
          <Route path="/me/profile" element={<ProfilePage state={state} />} />
          <Route path="/login" element={<LoginPage state={state} />} />
        </Routes>
      </main>
      <nav className="bottom-nav">
        <NavLink to="/books"><Home size={20} /><span>书城</span></NavLink>
        <NavLink to="/publish"><Plus size={20} /><span>发布</span></NavLink>
        {isAdmin && <NavLink to="/admin"><Settings size={20} /><span>管理</span></NavLink>}
        <NavLink to="/me/books"><UserRound size={20} /><span>我的</span></NavLink>
      </nav>
    </div>
  );
}

function AdminPage({ state }: { state: AppState }) {
  const [tab, setTab] = useState<'reports' | 'books'>('reports');
  const [notice, setNotice] = useState('');
  const user = state.user;
  if (!user || user.role !== 'admin') {
    return <div className="empty-state"><ShieldAlert size={36} /><h2>需要管理员权限</h2><p>请使用管理员账号登录后访问此页面。</p><Link className="primary-button" to="/login">去登录</Link></div>;
  }
  const pendingReports = state.data.reports.filter((r) => r.status === 'pending');
  const allReports = state.data.reports;
  const allBooks = [...state.data.books].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  async function run(action: () => void | Promise<void>, ok: string) {
    try { await action(); setNotice(ok); } catch (error) { setNotice(error instanceof Error ? error.message : '操作失败'); }
  }
  return (
    <section className="page-stack">
      <div className="section-head compact-head"><div><p className="eyebrow">管理面板</p><h1>举报审核 & 全站书籍管理</h1></div></div>
      {notice && <div className="toast">{notice}<button onClick={() => setNotice('')} type="button">关闭</button></div>}
      <div className="segmented"><button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')} type="button"><Flag size={16} /> 举报管理{pendingReports.length > 0 && <span className="admin-badge">{pendingReports.length}</span>}</button><button className={tab === 'books' ? 'active' : ''} onClick={() => setTab('books')} type="button"><BookOpen size={16} /> 全站书籍</button></div>
      {tab === 'reports' && (
        <div className="page-stack">
          <div className="admin-table surface-panel">
            <div className="admin-table-header"><h2>待处理举报 ({pendingReports.length})</h2></div>
            {pendingReports.length === 0 && <p className="subtle admin-empty">暂无待处理举报。</p>}
            {pendingReports.map((report) => {
              const reporter = state.userById(report.reporterId);
              const book = state.data.books.find((b) => b.id === report.targetId);
              return (
                <div key={report.id} className="admin-row">
                  <div className="admin-row-info"><strong>举报人：{reporter?.nickname || '未知用户'}</strong><span>被举报书籍：{book?.title || '已删除'}</span><span>原因：{report.reason}</span><span>详情：{report.detail}</span><span className="subtle">{formatDate(report.createdAt)}</span></div>
                  <div className="admin-row-actions">
                    <button className="secondary-button" onClick={() => run(() => state.updateReportStatus(report, 'resolved'), '已标记为已处理')} type="button"><Check size={16} /> 标记已处理</button>
                    <button className="ghost-button" onClick={() => run(() => state.updateReportStatus(report, 'rejected'), '已驳回该举报')} type="button">驳回</button>
                  </div>
                </div>
              );
            })}
          </div>
          {allReports.length > 0 && (
            <div className="admin-table surface-panel">
              <div className="admin-table-header"><h2>全部举报记录 ({allReports.length})</h2></div>
              {allReports.map((report) => {
                const reporter = state.userById(report.reporterId);
                const book = state.data.books.find((b) => b.id === report.targetId);
                return (
                  <div key={`all-${report.id}`} className="admin-row">
                    <div className="admin-row-info"><strong>举报人：{reporter?.nickname || '未知'}</strong><span>书籍：{book?.title || '已删除'}</span><span>{report.detail}</span><span className="subtle">{formatDate(report.createdAt)}</span></div>
                    <span className={`status-badge ${report.status}`}>{reportStatusLabels[report.status]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {tab === 'books' && (
        <div className="admin-table surface-panel">
          <div className="admin-table-header"><h2>全站书籍 ({allBooks.length})</h2></div>
          {allBooks.length === 0 && <p className="subtle admin-empty">暂无书籍。</p>}
          {allBooks.map((book) => {
            const seller = state.userById(book.sellerId);
            return (
              <div key={book.id} className="admin-row">
                <div className="admin-row-info"><strong>{book.title}</strong><span>作者：{book.author} · {formatPrice(book.priceCents)}</span><span>发布者：{seller?.nickname || '未知'} · {locationPath(book)}</span><span className="subtle">{formatDate(book.createdAt)}</span></div>
                <span className={`status-badge ${book.status}`}>{statusLabels[book.status]}</span>
                {book.status !== 'removed' && <button className="text-danger admin-remove-btn" onClick={() => run(() => state.adminRemoveBook(book), '已强制下架书籍')} type="button"><Trash2 size={16} /> 强制下架</button>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MallPage({ state }: { state: AppState }) {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<BookCategory | 'all'>('all');
  const [sort, setSort] = useState('latest');
  const [saleStatus, setSaleStatus] = useState<BookStatus | 'all'>('available');
  const [campus, setCampus] = useState('all');
  const [department, setDepartment] = useState('all');
  const [college, setCollege] = useState('all');
  const [major, setMajor] = useState('all');
  const locationOptions = useMemo(() => {
    const campuses = Array.from(new Set(state.data.books.map((book) => book.campus).filter(Boolean))) as string[];
    const departments = Array.from(new Set(state.data.books.filter((book) => campus === 'all' || book.campus === campus).map((book) => book.department).filter(Boolean))) as string[];
    const colleges = Array.from(new Set(state.data.books.filter((book) => (campus === 'all' || book.campus === campus) && (department === 'all' || book.department === department)).map((book) => book.college).filter(Boolean))) as string[];
    const majors = Array.from(new Set(state.data.books.filter((book) => (campus === 'all' || book.campus === campus) && (department === 'all' || book.department === department) && (college === 'all' || book.college === college)).map((book) => book.major).filter(Boolean))) as string[];
    return { campuses, departments, colleges, majors };
  }, [campus, department, college, state.data.books]);
  const books = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const statusValues: BookStatus[] = saleStatus === 'all' ? ['available', 'reserved', 'sold'] : [saleStatus as BookStatus];
    return state.data.books
      .filter((book) => statusValues.includes(book.status))
      .filter((book) => category === 'all' || book.category === category)
      .filter((book) => campus === 'all' || book.campus === campus)
      .filter((book) => department === 'all' || book.department === department)
      .filter((book) => college === 'all' || book.college === college)
      .filter((book) => major === 'all' || book.major === major)
      .filter((book) => !q || [book.title, book.author, book.isbn].some((value) => value?.toLowerCase().includes(q)))
      .sort((a, b) => (sort === 'price' ? a.priceCents - b.priceCents : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, [campus, category, department, college, keyword, major, sort, saleStatus, state.data.books]);
  function clearLocation() {
    setCampus('all');
    setDepartment('all');
    setCollege('all');
    setMajor('all');
  }
  return (
    <section className="page-stack">
      <div className="section-head compact-head"><div><p className="eyebrow">校园二手书</p><h1>找到课程用书，也把闲置书传下去</h1></div><Link className="primary-button desktop-only" to="/publish"><Plus size={18} /> 发布书籍</Link></div>
      <div className="toolbar surface-panel">
        <label className="search-box"><Search size={18} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索书名、作者或 ISBN" /></label>
        <div className="filter-row"><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="排序方式"><option value="latest">最新发布</option><option value="price">价格最低</option></select></div>
        <div className="segmented">{(Object.keys(categoryLabels) as Array<BookCategory | 'all'>).map((key) => <button key={key} className={category === key ? 'active' : ''} onClick={() => setCategory(key)} type="button">{categoryLabels[key]}</button>)}</div>
        <div className="segmented status-segmented"><button className={saleStatus === 'available' ? 'active' : ''} onClick={() => setSaleStatus('available')} type="button">在售</button><button className={saleStatus === 'reserved' ? 'active' : ''} onClick={() => setSaleStatus('reserved')} type="button">等待确认</button><button className={saleStatus === 'sold' ? 'active' : ''} onClick={() => setSaleStatus('sold')} type="button">已售出</button></div>
        <div className="location-filters">
          <select value={campus} onChange={(event) => { setCampus(event.target.value); setDepartment('all'); setCollege('all'); setMajor('all'); }} aria-label="校区筛选"><option value="all">全部校区</option>{locationOptions.campuses.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={department} onChange={(event) => { setDepartment(event.target.value); setCollege('all'); setMajor('all'); }} aria-label="学部筛选"><option value="all">全部学部</option>{locationOptions.departments.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={college} onChange={(event) => { setCollege(event.target.value); setMajor('all'); }} aria-label="学院筛选"><option value="all">全部学院</option>{locationOptions.colleges.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={major} onChange={(event) => setMajor(event.target.value)} aria-label="专业筛选"><option value="all">全部专业</option>{locationOptions.majors.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <button className="ghost-button" type="button" onClick={clearLocation}>清空校区筛选</button>
        </div>
      </div>
      <div className="book-grid">{books.map((book) => <BookCard key={book.id} book={book} state={state} view="mall" />)}</div>
      {books.length === 0 && <EmptyState title="没有找到符合条件的书" text="换个关键词、分类、校区、学部、学院或专业再试试。" />}
    </section>
  );
}

function BookCard({ book, state, mine, onRemove, view }: { book: Book; state: AppState; mine?: boolean; onRemove?: () => void; view?: 'mall' | 'mine' }) {
  const seller = state.userById(book.sellerId);
  const chosenBuyers = state.data.interests.filter((item) => item.bookId === book.id && item.status === 'chosen');
  const totalChosen = chosenBuyers.reduce((sum, item) => sum + item.quantity, 0);
  const activeCount = state.activeInterests(book.id).length;
  const extraImages = Math.max(book.images.length - 1, 0);
  const isMall = view === 'mall' || (!mine && !view);
  let cardMetaRight: React.ReactNode;
  if (mine) {
    cardMetaRight = <span>{formatDate(book.updatedAt)}</span>;
  } else if (isMall && book.status === 'sold') {
    cardMetaRight = <span>成交于 {formatDate(book.soldAt || book.updatedAt)} · {totalChosen}本</span>;
  } else if (isMall && book.status === 'reserved') {
    cardMetaRight = <span className="interest-highlight">{activeCount} 人想买</span>;
  } else {
    cardMetaRight = <span>{maskName(seller?.nickname || '同学')}</span>;
  }
  return (
    <article className="book-card">
      <Link to={`/books/${book.id}`} className="book-card-main">
        <div className="book-cover-wrap">{book.images[0]?.url ? <img src={book.images[0].url} alt={book.title} /> : <div className="no-cover"><BookOpen size={26} /><span>无图片</span></div>}{extraImages > 0 && <span className="image-count">+{extraImages}</span>}</div>
        <div className="book-card-body"><div className="card-title-line"><h2>{book.title}</h2><span className={`status-badge ${book.status}`}>{statusLabels[book.status]}</span></div><p>{book.author}</p><div className="tag-row"><span>{categoryLabels[book.category]}</span><span>{conditionLabels[book.condition]}</span>{book.campus && <span>{book.campus}</span>}{book.department && <span>{book.department}</span>}</div>{book.status !== 'sold' && isMall && <div className="stock-mini">剩余 {book.quantity - totalChosen} 本 / 共 {book.quantity} 本</div>}<div className="card-meta"><strong>{formatPrice(book.priceCents)}</strong><span>{activeCount} 人想买</span>{cardMetaRight}</div>{book.lastMessageAt && <div className="message-hint">最近留言 {formatDate(book.lastMessageAt)}</div>}</div>
      </Link>
      {onRemove && <button className="text-danger card-action" onClick={onRemove} type="button"><Trash2 size={16} /> 下架</button>}
    </article>
  );
}

function DetailPage({ state }: { state: AppState }) {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [notice, setNotice] = useState('');
  const [showContact, setShowContact] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const book = state.data.books.find((item) => item.id === bookId);
  if (!book) return <EmptyState title="没有找到这本书" text="链接可能已经失效。" />;
  const user = state.user;
  const seller = state.userById(book.sellerId);
  const isOwner = user?.id === book.sellerId;
  const hasInterest = Boolean(user && state.data.interests.some((item) => item.bookId === book.id && item.buyerId === user.id && item.status === 'active'));
  const hasEverBought = Boolean(user && state.data.interests.some((item) => item.bookId === book.id && item.buyerId === user.id && item.status === 'chosen'));
  const interests = state.activeInterests(book.id);
  const chosenBuyers = state.data.interests.filter((item) => item.bookId === book.id && item.status === 'chosen');
  const messages = state.data.messages.filter((item) => item.bookId === book.id);
  const evaluations = state.data.evaluations.filter((item) => item.bookId === book.id);
  const canReview = Boolean(user && book.status === 'sold' && (book.sellerId === user.id || chosenBuyers.some((item) => item.buyerId === user.id)));
  const remainingStock = book.quantity - chosenBuyers.reduce((sum, item) => sum + item.quantity, 0);
  function handleBuyClick() { setBuyQuantity(1); setShowQuantityModal(true); }
  function confirmBuy() { void run(() => state.expressInterest(book!, buyQuantity), '已记录想买，联系方式已解锁').then(() => { setShowQuantityModal(false); setShowContact(true); }); }
  const activeBook = book;
  const currentImage = book.images[selectedImage]?.url || book.images[0]?.url;
  async function run(action: () => void | Promise<void>, ok: string) {
    try { await action(); setNotice(ok); } catch (error) { setNotice(error instanceof Error ? error.message : '操作失败'); }
  }
  function handleMessage(event: FormEvent) {
    event.preventDefault();
    if (message.trim()) void run(() => state.sendMessage(activeBook, message.trim()), '留言已发送').then(() => setMessage(''));
  }
  function handleReview(event: FormEvent) {
    event.preventDefault();
    void run(() => state.submitEvaluation(activeBook, rating, comment, ['沟通顺畅']), '评价已提交').then(() => setComment(''));
  }
  function handleReport(event: FormEvent) {
    event.preventDefault();
    void run(() => state.submitReport(activeBook, '用户举报', reportDetail), '举报已提交，等待管理员处理').then(() => setReportDetail(''));
  }
  return (
    <section className="detail-layout">
      <button className="ghost-button back-button" onClick={() => navigate(-1)} type="button"><ChevronLeft size={18} /> 返回</button>
      {notice && <div className="toast">{notice}<button onClick={() => setNotice('')} type="button">关闭</button></div>}
      <div className="detail-media surface-panel">{currentImage ? <img src={currentImage} alt={book.title} /> : <div className="no-cover large"><BookOpen size={40} /><span>暂无图片</span></div>}{book.images.length > 1 && <div className="thumb-row">{book.images.map((image, index) => <button className={selectedImage === index ? 'active' : ''} key={image.id} onClick={() => setSelectedImage(index)} type="button"><img src={image.url} alt={`${book.title} 图片 ${index + 1}`} /></button>)}</div>}</div>
      <div className="detail-main page-stack">
        <section className="surface-panel detail-summary"><div className="card-title-line"><span className={`status-badge ${book.status}`}>{statusLabels[book.status]}</span><span className="subtle">{formatDate(book.createdAt)}</span></div><h1>{book.title}</h1><p className="lead-text">{book.author}{book.isbn ? ` · ISBN ${book.isbn}` : ''}</p><div className="price-line">{formatPrice(book.priceCents)}</div><div className="tag-row"><span>{categoryLabels[book.category]}</span><span>{conditionLabels[book.condition]}</span><span>{interests.length} 人想买</span></div><p className="book-description">{book.description}</p><div className="seller-box"><UserAvatar user={seller} size={32} /><div><strong>{seller?.nickname || '同学'}</strong><span>{locationPath(book)}</span></div></div></section>
<section className="surface-panel action-panel"><h2>交易操作</h2><div className="stock-display">剩余 {remainingStock} 本 / 共 {book.quantity} 本</div>{user && !isOwner && !hasInterest && !hasEverBought && (book.status === 'available' || book.status === 'reserved') && remainingStock > 0 && <button className="primary-button full-width" onClick={handleBuyClick} type="button"><Check size={18} /> 我想买</button>}{user && !isOwner && hasInterest && <button className="secondary-button full-width" onClick={() => setShowContact(true)} type="button"><ShieldCheck size={18} /> 查看联系方式</button>}{user && hasEverBought && <div className="info-banner"><Check size={18} /><span>你已购买此书</span></div>}{!user && <Link className="primary-button full-width" to="/login"><LogIn size={18} /> 登录后联系卖家</Link>}{book.status === 'sold' && book.soldAt && chosenBuyers.length > 0 && <div className="info-banner"><Check size={18} /><span>所有库存已于 {formatDate(book.soldAt)} 全部成交</span></div>}{isOwner && book.status !== 'sold' && interests.map((interest) => <div key={interest.id} className="interest-row"><UserAvatar user={state.userById(interest.buyerId)} size={24} /><button className="secondary-button" onClick={() => void run(() => state.confirmSold(book, interest.buyerId), '已确认成交')} type="button">确认卖给 {state.userById(interest.buyerId)?.nickname || '买家'} {interest.quantity} 本</button><span className="subtle">想买于 {formatDate(interest.createdAt)}</span></div>)}{chosenBuyers.length > 0 && <div className="chosen-buyers-section"><h3>已成交买家</h3>{chosenBuyers.map((item) => <div key={item.id} className="chosen-buyer-row"><UserAvatar user={state.userById(item.buyerId)} size={24} /><span>{state.userById(item.buyerId)?.nickname || '同学'} · {item.quantity} 本</span></div>)}</div>}{(showContact || isOwner) && user && (hasInterest || isOwner) && <div className="contact-box"><ShieldCheck size={18} /><div><span>已授权查看联系方式</span><strong>{book.contact}</strong></div></div>}{showQuantityModal && <div className="modal-overlay" onClick={() => setShowQuantityModal(false)}><div className="modal-content" onClick={(e) => e.stopPropagation()}><h3>选择购买数量</h3><p>剩余 {remainingStock} 本 / 共 {book.quantity} 本</p><div className="quantity-picker"><button type="button" onClick={() => setBuyQuantity(Math.max(1, buyQuantity - 1))} disabled={buyQuantity <= 1}>−</button><span className="qty-value">{buyQuantity}</span><button type="button" onClick={() => setBuyQuantity(Math.min(remainingStock, buyQuantity + 1))} disabled={buyQuantity >= remainingStock}>+</button></div><div className="modal-actions"><button className="secondary-button" onClick={() => setShowQuantityModal(false)} type="button">取消</button><button className="primary-button" onClick={confirmBuy} type="button">确认购买 {buyQuantity} 本</button></div></div></div>}</section>
        {(isOwner || hasInterest) && <section className="surface-panel message-panel"><h2>留言沟通</h2><div className="message-list">{messages.map((item) => <div key={item.id} className={`message-bubble ${item.fromUserId === user?.id ? 'mine' : ''}`}><p>{item.content}</p><span>{formatDate(item.createdAt)}</span></div>)}</div>{book.status !== 'sold' && <form className="inline-form" onSubmit={handleMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="询问书况、交易地点或时间" /><button className="icon-button solid" type="submit" aria-label="发送留言"><Send size={18} /></button></form>}</section>}
        <section className="surface-panel review-panel"><h2>交易评价</h2>{evaluations.length === 0 && <p className="subtle">暂无评价。</p>}{evaluations.map((item) => <ReviewItem key={item.id} evaluation={item} />)}{canReview && <form className="review-form" onSubmit={handleReview}><label>评分<input type="range" min="1" max="5" value={rating} onChange={(event) => setRating(Number(event.target.value))} /><span>{rating} 星</span></label><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="写下这次交易体验" /><button className="secondary-button" type="submit"><Star size={16} /> 提交评价</button></form>}</section>
        <section className="surface-panel report-panel"><h2><Flag size={18} /> 举报</h2><form className="compact-form" onSubmit={handleReport}><textarea value={reportDetail} onChange={(event) => setReportDetail(event.target.value)} placeholder="可补充虚假信息、骚扰或其他问题" /><button className="ghost-button" type="submit">提交举报</button></form></section>
      </div>
    </section>
  );
}

function ReviewItem({ evaluation }: { evaluation: Evaluation }) {
  return <div className="review-item"><div className="stars">{'★'.repeat(evaluation.rating)}{'☆'.repeat(5 - evaluation.rating)}</div><strong>{roleLabels[evaluation.fromRole]}</strong><p>{evaluation.comment || '未填写文字评价'}</p><div className="tag-row">{evaluation.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><span className="subtle">{formatDate(evaluation.createdAt)}</span></div>;
}

function PublishPage({ state }: { state: AppState }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<PublishDraft>(() => readStorage<PublishDraft>(PUBLISH_DRAFT_STORAGE_KEY) || createPublishDraft(state.user));
  const [note, setNote] = useState('');
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [, setComposingLocationField] = useState<keyof Pick<PublishDraft, 'campus' | 'department' | 'college' | 'major'> | null>(null);
  const composingRef = useRef(false);
  useEffect(() => {
    writeStorage(PUBLISH_DRAFT_STORAGE_KEY, draft);
  }, [draft]);
  if (!state.user) return <LoginRequired />;
  const lastLocation = readStorage<PublishLocation>(LAST_LOCATION_STORAGE_KEY);
  const locationSuggestions = {
    campuses: uniqueValues([draft.campus, lastLocation?.campus, ...state.data.books.map((book) => book.campus), ...state.data.users.map((item) => item.campus), ...campusConfig.campuses.map((item) => item.name)]),
    departments: uniqueValues([draft.department, lastLocation?.department, ...state.data.books.map((book) => book.department), ...state.data.users.map((item) => item.department), ...campusConfig.campuses.flatMap((campus) => campus.departments.map((department) => department.name))]),
    colleges: uniqueValues([draft.college, lastLocation?.college, ...state.data.books.map((book) => book.college), ...state.data.users.map((item) => item.college), ...campusConfig.campuses.flatMap((campus) => campus.departments.flatMap((department) => department.colleges.map((college) => college.name)))]),
    majors: uniqueValues([draft.major, lastLocation?.major, ...state.data.books.map((book) => book.major), ...state.data.users.map((item) => item.major), ...campusConfig.campuses.flatMap((campus) => campus.departments.flatMap((department) => department.colleges.flatMap((college) => college.majors)))]),
  };
  function setField<K extends keyof PublishDraft>(key: K, value: PublishDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function lookupIsbn() {
    const isbn = draft.isbn.trim();
    if (!isbn) { setNote('请先输入 ISBN。'); return; }
    if (!GOOGLE_BOOKS_API_KEY) { setNote('尚未读取到 Google Books API Key。请确认 .env.local 位于 jl-shiyi-h5 根目录，并在保存后重启 npm run dev。'); return; }
    setIsbnLoading(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);
    try {
      const params = new URLSearchParams({ q: `isbn:${isbn}`, key: GOOGLE_BOOKS_API_KEY });
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`, { signal: controller.signal });
      if (!response.ok) throw new Error('接口请求失败');
      const result = (await response.json()) as GoogleBooksResponse;
      const volume = result.items?.[0]?.volumeInfo;
      if (!result.totalItems || !volume?.title) { setNote('未查询到这本书，请手动填写；系统不会自动添加默认内容。'); return; }
      const image = normalizeGoogleImage(volume.imageLinks?.thumbnail || volume.imageLinks?.smallThumbnail);
      setDraft((current) => ({ ...current, title: volume.title || current.title, author: volume.authors?.join('、') || current.author, category: classifyGoogleCategory(volume.categories), description: current.description || volume.description || '', imageUrls: image ? [image, ...current.imageUrls.filter((url) => url !== image)] : current.imageUrls }));
      setNote('ISBN 查询成功，请继续补充价格、联系方式和书况。');
    } catch { setNote('ISBN 查询失败，请稍后重试或手动填写；系统不会自动添加默认内容。'); }
    finally { window.clearTimeout(timeoutId); setIsbnLoading(false); }
  }
  async function handleLocalImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length !== files.length) setNote('已跳过非图片文件。');
    event.target.value = '';
    if (imageFiles.length === 0) return;
    setNote('正在上传图片到阿里云 OSS...');
    try {
      const urls = await uploadImagesToOss(imageFiles);
      setDraft((current) => ({ ...current, imageUrls: [...current.imageUrls, ...urls] }));
      setNote(`已上传 ${urls.length} 张图片到 OSS。`);
    } catch (error) {
      try {
        const localUrls = await Promise.all(imageFiles.map(readFileAsDataUrl));
        setDraft((current) => ({ ...current, imageUrls: [...current.imageUrls, ...localUrls] }));
        const reason = error instanceof Error ? error.message : '图片上传失败';
        setNote(`${reason} 已先加入本地预览，仍可继续发布。`);
      } catch { setNote(error instanceof Error ? error.message : '图片上传失败，请稍后重试。'); }
    }
  }
  function updateImageUrl(index: number, value: string) { setDraft((current) => ({ ...current, imageUrls: current.imageUrls.map((url, itemIndex) => (itemIndex === index ? value : url)) })); }
  function removeImage(index: number) { setDraft((current) => ({ ...current, imageUrls: current.imageUrls.filter((_, itemIndex) => itemIndex !== index) })); }
  function addImageUrl() { setDraft((current) => ({ ...current, imageUrls: [...current.imageUrls, ''] })); }
  function updateLocationField(key: keyof Pick<PublishDraft, 'campus' | 'department' | 'college' | 'major'>, value: string) { setField(key, composingRef.current ? value : keepChineseOnly(value)); }
  function finishLocationComposition(key: keyof Pick<PublishDraft, 'campus' | 'department' | 'college' | 'major'>, event: CompositionEvent<HTMLInputElement>) { composingRef.current = false; setComposingLocationField(null); setField(key, keepChineseOnly(event.currentTarget.value)); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (publishing) return;
    const imageUrls = draft.imageUrls.map((url) => url.trim()).filter(Boolean);
    const invalidLocation = hasInvalidLocationField(draft);
    if (!Number.isFinite(draft.quantity) || draft.quantity < 1) { setNote('请填写大于 0 的数量。'); return; }
    if (invalidLocation) { setNote(`${locationFieldLabels[invalidLocation]}只能输入中文。`); return; }
    setPublishing(true);
    setNote('正在发布书籍，请稍候...');
    try {
      const bookId = await state.publishBook({ ...draft, imageUrls });
      setNote('发布成功！正在跳转...');
      writeStorage(LAST_LOCATION_STORAGE_KEY, { campus: draft.campus, department: draft.department, college: draft.college, major: draft.major });
      removeStorage(PUBLISH_DRAFT_STORAGE_KEY);
      navigate(`/books/${bookId}`);
    } catch (error) { setNote(error instanceof Error ? error.message : '发布失败，请稍后重试。'); }
    finally { setPublishing(false); }
  }
  return (
    <section className="page-stack narrow-page"><div className="section-head"><div><p className="eyebrow">发布书籍</p><h1>把闲置书放进书城</h1></div></div>{note && <div className="inline-alert">{note}</div>}<form className="surface-panel publish-form" onSubmit={submit}><div className="isbn-row"><label>ISBN<input value={draft.isbn} onChange={(event) => setField('isbn', event.target.value)} placeholder="输入 ISBN 后查询" /></label><button className="secondary-button" disabled={isbnLoading} type="button" onClick={lookupIsbn}><Search size={16} /> {isbnLoading ? '查询中' : '查询'}</button></div><label>书名<input value={draft.title} onChange={(event) => setField('title', event.target.value)} /></label><label>作者<input value={draft.author} onChange={(event) => setField('author', event.target.value)} /></label><div className="form-grid"><label>分类<select value={draft.category} onChange={(event) => setField('category', event.target.value as BookCategory)}>{(['textbook', 'novel', 'reference', 'other'] as BookCategory[]).map((item) => <option key={item} value={item}>{categoryLabels[item]}</option>)}</select></label><label>新旧程度<select value={draft.condition} onChange={(event) => setField('condition', event.target.value as BookCondition)}>{(Object.keys(conditionLabels) as BookCondition[]).map((item) => <option key={item} value={item}>{conditionLabels[item]}</option>)}</select></label><label>价格<input type="number" min="0" step="0.5" value={draft.priceYuan} onChange={(event) => setField('priceYuan', event.target.value)} /></label><label>数量<input type="number" min="1" max="9" value={draft.quantity} onChange={(event) => setField('quantity', Number(event.target.value))} /></label></div><div className="form-grid"><label>校区<input list="campus-options" value={draft.campus} onCompositionStart={() => { setComposingLocationField('campus'); composingRef.current = true; }} onCompositionEnd={(event) => finishLocationComposition('campus', event)} onChange={(event) => updateLocationField('campus', event.target.value)} placeholder="可选择或输入中文" /></label><label>学部<input list="department-options" value={draft.department} onCompositionStart={() => { setComposingLocationField('department'); composingRef.current = true; }} onCompositionEnd={(event) => finishLocationComposition('department', event)} onChange={(event) => updateLocationField('department', event.target.value)} placeholder="可选择或输入中文" /></label><label>学院<input list="college-options" value={draft.college} onCompositionStart={() => { setComposingLocationField('college'); composingRef.current = true; }} onCompositionEnd={(event) => finishLocationComposition('college', event)} onChange={(event) => updateLocationField('college', event.target.value)} placeholder="可选择或输入中文" /></label><label>专业<input list="major-options" value={draft.major} onCompositionStart={() => { setComposingLocationField('major'); composingRef.current = true; }} onCompositionEnd={(event) => finishLocationComposition('major', event)} onChange={(event) => updateLocationField('major', event.target.value)} placeholder="可选择或输入中文" /></label></div><datalist id="campus-options">{locationSuggestions.campuses.map((item) => <option key={item} value={item} />)}</datalist><datalist id="department-options">{locationSuggestions.departments.map((item) => <option key={item} value={item} />)}</datalist><datalist id="college-options">{locationSuggestions.colleges.map((item) => <option key={item} value={item} />)}</datalist><datalist id="major-options">{locationSuggestions.majors.map((item) => <option key={item} value={item} />)}</datalist><label>联系方式<input value={draft.contact} onChange={(event) => setField('contact', event.target.value)} placeholder="微信号、手机号或邮箱" /></label><div className="privacy-note"><ShieldCheck size={16} /> 联系方式只会在买家表达想买后展示。</div><div className="image-tools"><label className="upload-button"><ImagePlus size={18} /> 选择本地图片<input multiple type="file" accept="image/*" onChange={handleLocalImages} /></label><button className="ghost-button" type="button" onClick={addImageUrl}>添加图片链接</button></div><div className="image-list">{draft.imageUrls.map((url, index) => <div className="image-editor" key={`${index}-${url.slice(0, 24)}`}><img src={url || 'https://placehold.co/240x240?text=Book'} alt={`书籍图片 ${index + 1}`} /><label>图片 {index + 1}<input value={url.startsWith('data:') ? '已选择本地图片' : url} onChange={(event) => updateImageUrl(index, event.target.value)} disabled={url.startsWith('data:')} /></label><button className="text-danger" type="button" onClick={() => removeImage(index)}>删除</button></div>)}</div><div className="upload-preview"><ImagePlus size={18} /><span>照片数量不做前端上限限制；选择本地图片后会上传到阿里云 OSS，并保存返回的图片地址。</span></div><label>描述<textarea value={draft.description} onChange={(event) => setField('description', event.target.value)} placeholder="写明书况、笔记、缺页、交易地点偏好等" /></label><button className="primary-button full-width" disabled={publishing} type="submit">{publishing ? '发布中...' : '立即发布'}</button></form></section>
  );
}

function MyBooksPage({ state }: { state: AppState }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<BookStatus>('available');
  if (!state.user) return <LoginRequired />;
  const myBooks = state.data.books.filter((book) => book.sellerId === state.user?.id && book.status === status);
  return <section className="page-stack"><div className="profile-panel surface-panel"><UserAvatar user={state.user} size={44} /><div><h1>{state.user.nickname}</h1><p>{locationPath(state.user)}</p></div><button className="secondary-button" onClick={() => navigate('/me/profile')} type="button">编辑资料</button></div><div className="segmented sticky-tabs">{(['available', 'sold', 'removed'] as BookStatus[]).map((item) => <button key={item} className={status === item ? 'active' : ''} onClick={() => setStatus(item)} type="button">{statusLabels[item]}</button>)}</div><div className="book-grid">{myBooks.map((book) => <BookCard key={book.id} book={book} state={state} mine onRemove={book.status !== 'sold' ? () => { void state.removeBook(book); } : undefined} />)}</div>{myBooks.length === 0 && <EmptyState title="这里还没有书" text="发布一本闲置书后会出现在这里。" />}</section>;
}

function ProfilePage({ state }: { state: AppState }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<User | null>(state.user);
  const [avatarNote, setAvatarNote] = useState('');
  const [, setComposingLocationField] = useState<keyof Pick<PublishDraft, 'campus' | 'department' | 'college' | 'major'> | null>(null);
  const composingRef = useRef(false);
  if (!draft) return <LoginRequired />;
  const locationSuggestions = {
    campuses: uniqueValues([draft.campus, ...state.data.books.map((book) => book.campus), ...campusConfig.campuses.map((item) => item.name)]),
    departments: uniqueValues([draft.department, ...state.data.books.map((book) => book.department), ...campusConfig.campuses.flatMap((campus) => campus.departments.map((department) => department.name))]),
    colleges: uniqueValues([draft.college, ...state.data.books.map((book) => book.college), ...campusConfig.campuses.flatMap((campus) => campus.departments.flatMap((department) => department.colleges.map((college) => college.name)))]),
    majors: uniqueValues([draft.major, ...state.data.books.map((book) => book.major), ...campusConfig.campuses.flatMap((campus) => campus.departments.flatMap((department) => department.colleges.flatMap((college) => college.majors)))]),
  };
  function updateLocationField(key: keyof Pick<PublishDraft, 'campus' | 'department' | 'college' | 'major'>, value: string) { setDraft((current) => current && { ...current, [key]: composingRef.current ? value : keepChineseOnly(value) }); }
  function finishLocationComposition(key: keyof Pick<PublishDraft, 'campus' | 'department' | 'college' | 'major'>, event: CompositionEvent<HTMLInputElement>) { composingRef.current = false; setComposingLocationField(null); setDraft((current) => current && { ...current, [key]: keepChineseOnly(event.currentTarget.value) }); }
  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const imageFile = files.find((file) => file.type.startsWith('image/'));
    if (!imageFile) { setAvatarNote('请选择图片文件。'); return; }
    event.target.value = '';
    setAvatarNote('正在上传头像...');
    try {
      const urls = await uploadImagesToOss([imageFile]);
      if (urls.length > 0) { setDraft((current) => current && { ...current, avatarUrl: urls[0] }); setAvatarNote('头像上传成功，保存后生效。'); }
    } catch (error) {
      try {
        const dataUrl = await readFileAsDataUrl(imageFile);
        setDraft((current) => current && { ...current, avatarUrl: dataUrl });
        const reason = error instanceof Error ? error.message : '头像上传失败';
        setAvatarNote(`${reason} 已先使用本地预览，仍可保存。`);
      } catch { setAvatarNote(error instanceof Error ? error.message : '头像上传失败，请稍后重试。'); }
    }
  }
  return <section className="page-stack narrow-page"><div className="section-head"><h1>个人资料</h1></div><form className="surface-panel publish-form" onSubmit={(event) => { event.preventDefault(); void state.updateUser(draft).then(() => navigate('/me/books')); }}><div className="profile-avatar-section"><UserAvatar user={draft} size={64} /><label className="avatar-upload-label"><ImagePlus size={16} /> 更换头像<input type="file" accept="image/*" onChange={handleAvatarUpload} /></label>{draft.avatarUrl && <button className="text-danger avatar-delete-btn" type="button" onClick={() => { setDraft((current) => current && { ...current, avatarUrl: undefined }); setAvatarNote('头像已移除，保存后生效。'); }}><Trash2 size={14} /> 删除头像</button>}{avatarNote && <span className="note-text">{avatarNote}</span>}</div><label>昵称<input value={draft.nickname} onChange={(event) => setDraft({ ...draft, nickname: event.target.value })} /></label><label>校区<input list="profile-campus-options" value={draft.campus || ''} onCompositionStart={() => { setComposingLocationField('campus'); composingRef.current = true; }} onCompositionEnd={(event) => finishLocationComposition('campus', event)} onChange={(event) => updateLocationField('campus', event.target.value)} placeholder="可选择或输入中文" /></label><label>学部<input list="profile-department-options" value={draft.department || ''} onCompositionStart={() => { setComposingLocationField('department'); composingRef.current = true; }} onCompositionEnd={(event) => finishLocationComposition('department', event)} onChange={(event) => updateLocationField('department', event.target.value)} placeholder="可选择或输入中文" /></label><label>学院<input list="profile-college-options" value={draft.college || ''} onCompositionStart={() => { setComposingLocationField('college'); composingRef.current = true; }} onCompositionEnd={(event) => finishLocationComposition('college', event)} onChange={(event) => updateLocationField('college', event.target.value)} placeholder="可选择或输入中文" /></label><label>专业<input list="profile-major-options" value={draft.major || ''} onCompositionStart={() => { setComposingLocationField('major'); composingRef.current = true; }} onCompositionEnd={(event) => finishLocationComposition('major', event)} onChange={(event) => updateLocationField('major', event.target.value)} placeholder="可选择或输入中文" /></label><datalist id="profile-campus-options">{locationSuggestions.campuses.map((item) => <option key={item} value={item} />)}</datalist><datalist id="profile-department-options">{locationSuggestions.departments.map((item) => <option key={item} value={item} />)}</datalist><datalist id="profile-college-options">{locationSuggestions.colleges.map((item) => <option key={item} value={item} />)}</datalist><datalist id="profile-major-options">{locationSuggestions.majors.map((item) => <option key={item} value={item} />)}</datalist><button className="primary-button full-width" type="submit">保存资料</button></form></section>;
}

function LoginPage({ state }: { state: AppState }) {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(() => readStorage<SavedSession>(SESSION_STORAGE_KEY)?.identifier || '');
  return <section className="login-page surface-panel"><div className="login-icon"><BookOpen size={36} /></div><h1>登录 JL拾遗</h1><p>输入自定义账号后进入书城。</p><form onSubmit={(event) => { event.preventDefault(); void state.login(identifier).then(() => navigate('/books')); }}><label>账号<input value={identifier} maxLength={60} onChange={(event) => setIdentifier(event.target.value)} placeholder="中文、英文或数字，最多 60 个" /></label><button className="primary-button full-width" type="submit">登录</button></form></section>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><BookOpen size={36} /><h2>{title}</h2><p>{text}</p></div>;
}

function LoginRequired() {
  return <div className="empty-state"><LogIn size={36} /><h2>需要先登录</h2><p>登录后可以发布书籍、留言沟通和提交评价。</p><Link className="primary-button" to="/login">去登录</Link></div>;
}

function App() {
  const state = useAppState();
  return <QueryClientProvider client={queryClient}><BrowserRouter><Shell state={state} /></BrowserRouter></QueryClientProvider>;
}

export default App;