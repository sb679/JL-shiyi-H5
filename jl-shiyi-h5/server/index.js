import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import OSS from 'ali-oss';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  checkDatabase,
  confirmSold,
  expressInterest,
  getState,
  isDatabaseConfigured,
  loginUser,
  publishBook,
  removeBook,
  sendMessage,
  setUserPassword,
  submitEvaluation,
  submitReport,
  updateUser,
} from './database.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE || 8 * 1024 * 1024),
    files: Number(process.env.UPLOAD_MAX_FILES || 30),
  },
});

const port = Number(process.env.PORT || 8080);
const corsOrigin = process.env.CORS_ORIGIN;

app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));

// 允许较大的 JSON body（用于处理 base64 图片数据作为后备方案）
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createOssClient() {
  return new OSS({
    region: requireEnv('OSS_REGION'),
    bucket: requireEnv('OSS_BUCKET'),
    accessKeyId: requireEnv('OSS_ACCESS_KEY_ID'),
    accessKeySecret: requireEnv('OSS_ACCESS_KEY_SECRET'),
    secure: true,
  });
}

function publicUrlFor(objectName) {
  const baseUrl = process.env.OSS_PUBLIC_BASE_URL;
  if (baseUrl) return `${baseUrl.replace(/\/$/, '')}/${objectName}`;
  const bucket = requireEnv('OSS_BUCKET');
  const region = requireEnv('OSS_REGION');
  return `https://${bucket}.${region}.aliyuncs.com/${objectName}`;
}

function extensionFromMime(mimeType) {
  const known = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
  };
  return known[mimeType] || 'jpg';
}

function currentUserId(request) {
  return request.body?.userId || request.headers['x-user-id'];
}

function requireUserId(request) {
  const userId = currentUserId(request);
  if (!userId) throw Object.assign(new Error('请先登录'), { status: 401 });
  return userId;
}

function asyncRoute(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response);
    } catch (error) {
      next(error);
    }
  };
}

app.get('/api/health', asyncRoute(async (_request, response) => {
  const database = await checkDatabase().catch(() => ({ configured: isDatabaseConfigured(), ok: false }));
  response.json({ ok: true, database });
}));

app.get('/api/state', asyncRoute(async (_request, response) => {
  response.json(await getState());
}));

app.post('/api/login', asyncRoute(async (request, response) => {
  response.json({ user: await loginUser(request.body?.identifier, request.body?.password, request.body?.role) });
}));

app.post('/api/set-password', asyncRoute(async (request, response) => {
  response.json({ user: await setUserPassword(request.body?.identifier, request.body?.password) });
}));

app.put('/api/users/:userId', asyncRoute(async (request, response) => {
  if (requireUserId(request) !== request.params.userId) throw Object.assign(new Error('不能修改其他用户资料'), { status: 403 });
  await updateUser({ ...request.body, id: request.params.userId });
  response.json(await getState());
}));

app.post('/api/books', asyncRoute(async (request, response) => {
  const bookId = await publishBook(requireUserId(request), request.body?.draft || {});
  response.status(201).json({ bookId, state: await getState() });
}));

app.post('/api/books/:bookId/interests', asyncRoute(async (request, response) => {
  await expressInterest(request.params.bookId, requireUserId(request));
  response.json(await getState());
}));

app.post('/api/books/:bookId/confirm-sold', asyncRoute(async (request, response) => {
  await confirmSold(request.params.bookId, requireUserId(request), request.body?.buyerId);
  response.json(await getState());
}));

app.post('/api/books/:bookId/remove', asyncRoute(async (request, response) => {
  await removeBook(request.params.bookId, requireUserId(request));
  response.json(await getState());
}));

app.post('/api/books/:bookId/messages', asyncRoute(async (request, response) => {
  await sendMessage(request.params.bookId, requireUserId(request), request.body?.content);
  response.status(201).json(await getState());
}));

app.post('/api/books/:bookId/evaluations', asyncRoute(async (request, response) => {
  await submitEvaluation(request.params.bookId, requireUserId(request), request.body?.rating, request.body?.comment, request.body?.tags);
  response.status(201).json(await getState());
}));

app.post('/api/books/:bookId/reports', asyncRoute(async (request, response) => {
  await submitReport(request.params.bookId, requireUserId(request), request.body?.reason, request.body?.detail);
  response.status(201).json(await getState());
}));

app.post('/api/uploads/images', upload.array('images'), async (request, response) => {
  try {
    const files = request.files || [];
    if (files.length === 0) {
      response.status(400).json({ error: '请至少上传一张图片。' });
      return;
    }

    const client = createOssClient();
    const uploaded = [];

    for (const file of files) {
      if (!file.mimetype.startsWith('image/')) {
        response.status(400).json({ error: '只能上传图片文件。' });
        return;
      }

      const ext = extensionFromMime(file.mimetype);
      const objectName = `jl-shiyi/books/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
      await client.put(objectName, file.buffer, {
        headers: {
          'Content-Type': file.mimetype,
        },
      });
      uploaded.push({ url: publicUrlFor(objectName), objectName });
    }

    response.json({ images: uploaded });
  } catch (error) {
    console.error('OSS upload failed:', error instanceof Error ? error.message : error);
    response.status(500).json({ error: '图片上传失败，请稍后重试。' });
  }
});

app.use('/api', (error, _request, response, _next) => {
  console.error('API failed:', error instanceof Error ? error.message : error);
  response.status(error.status || 500).json({ error: error instanceof Error ? error.message : '服务暂时不可用，请稍后重试。' });
});

app.use(express.static(distDir));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`JL拾遗 H5 server listening on http://0.0.0.0:${port}`);
});