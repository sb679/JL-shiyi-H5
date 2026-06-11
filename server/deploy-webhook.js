import http from 'node:http';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.DEPLOY_WEBHOOK_PORT || 9000);
const SECRET = process.env.DEPLOY_WEBHOOK_SECRET;

if (!SECRET) {
  console.error('FATAL: DEPLOY_WEBHOOK_SECRET environment variable is required');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/deploy') {
    res.writeHead(404);
    res.end();
    return;
  }

  const auth = req.headers['authorization'] || '';
  const expectedAuth = `Bearer ${SECRET}`;
  if (auth !== expectedAuth) {
    console.warn('Deploy webhook: unauthorized request');
    res.writeHead(401);
    res.end('Unauthorized');
    return;
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    console.log(`Deploy webhook triggered at ${new Date().toISOString()}:`, body.slice(0, 200));

    try {
      // Pull latest code and restart
      console.log('Pulling latest code...');
      execSync('git pull origin main', { cwd: process.cwd(), stdio: 'inherit' });

      console.log('Installing dependencies...');
      execSync('npm ci --production', { cwd: process.cwd(), stdio: 'inherit' });

      console.log('Building production bundle...');
      execSync('npm run build', { cwd: process.cwd(), stdio: 'inherit' });

      console.log('Restarting server via PM2...');
      execSync('pm2 restart jl-shiyi-h5 || pm2 start npm --name jl-shiyi-h5 -- start', { cwd: process.cwd(), stdio: 'inherit' });

      console.log('Deploy completed successfully');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'deployed', timestamp: new Date().toISOString() }));
    } catch (error) {
      console.error('Deploy failed:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'failed', error: error.message }));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Deploy webhook listening on http://127.0.0.1:${PORT}`);
});