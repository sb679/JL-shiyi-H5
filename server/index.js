import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import OSS from 'ali-oss';
import cors from 'cors';
import dotenv from 'dotenv';

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

const port = Number(process.env.PORT || 3000);
const corsOrigin = process.env.CORS_ORIGIN;

app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));

app.use(express.json());

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

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

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

app.use(express.static(distDir));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`JL拾遗 H5 server listening on http://0.0.0.0:${port}`);
});
