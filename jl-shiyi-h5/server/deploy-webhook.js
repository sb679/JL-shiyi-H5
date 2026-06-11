import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

// 为什么在 ECS 上 webhook 用 dotenv 而不是 secrets 管理器：ECS 是单机 Windows Server，
// 用 .env 部署简单、可审计，且 token 不进入仓库历史。生产环境应迁移到 AWS Secrets Manager。
dotenv.config();

const PORT = Number(process.env.DEPLOY_WEBHOOK_PORT || 9000);
const SECRET = process.env.DEPLOY_WEBHOOK_SECRET;

// 为什么严格校验 SECRET：webhook 端口对公网开放（ECS 安全组放行），缺少 token 校验等于
// 任意人能触发 git pull + 重启，极不安全。启动失败优于裸奔。
if (!SECRET) {
  console.error('FATAL: DEPLOY_WEBHOOK_SECRET environment variable is required');
  process.exit(1);
}

// ====== 关键路径配置 ======
// 为什么硬编码 INSTALL_DIR 而不是依赖 process.cwd()：ECS 上 webhook 可能从任意目录启动
// （计划任务、手动 powershell 等都可能改变 cwd），必须固定主项目目录为 Gitee 版目录。
// C:\jl-shiyi-h5 是旧 GitHub 目录（已废弃），C:\jl-shiyi-h5-gitee 是当前实际主目录。
const INSTALL_DIR = process.env.INSTALL_DIR || 'C:/jl-shiyi-h5-gitee';

// 为什么需要同步 wwwroot：ECS 历史上绑了 IIS/Nginx 从 C:\wwwroot\JL-shiyi-H5 读静态文件，
// webhook 构建完 dist/ 后必须把产物推送到 wwwroot，否则外部页面不变。
const WWWROOT_DIR = process.env.WWWROOT_DIR || 'C:/wwwroot/JL-shiyi-H5';

// 为什么用 Windows Scheduled Task 而不是 pm2 管理服务进程：ECS 未安装 pm2（npm 全局工具），
// 实际通过计划任务 "JL拾遗 H5 Server" 调用 start-server.ps1 实现开机自启 + 进程守护。
const SCHEDULED_TASK_NAME = process.env.SCHEDULED_TASK_NAME || 'JL拾遗 H5 Server';

function nowISO() {
  return new Date().toISOString();
}

function logDeployStep(msg) {
  const timestamp = nowISO();
  console.log(`[${timestamp}] DEPLOY ${msg}`);
  // 为什么落盘审计日志：ECS 上没有 GitHub Actions 运行记录，只能靠文件追溯历史部署
  fs.appendFileSync(
    path.join(INSTALL_DIR, 'deploy-audit.log'),
    `[${timestamp}] ${msg}\n`
  );
}

function syncWwwroot(sourceDistDir) {
  if (!fs.existsSync(WWWROOT_DIR)) {
    logDeployStep('wwwroot mirror directory not found, skipping (WWWROOT_DIR=' + WWWROOT_DIR + ')');
    return;
  }
  if (!fs.existsSync(sourceDistDir)) {
    throw new Error(`Build output not found: ${sourceDistDir}`);
  }

  const targetDist = path.join(WWWROOT_DIR, 'dist');
  const sourceAssets = path.join(sourceDistDir, 'assets');

  // 为什么先删后拷而不是覆盖：覆盖容易残留旧文件（如被删除的 chunk），导致缓存不一致
  if (fs.existsSync(targetDist)) {
    fs.rmSync(targetDist, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDist, { recursive: true });

  // 复制 dist/*
  const entries = fs.readdirSync(sourceDistDir);
  for (const entry of entries) {
    const src = path.join(sourceDistDir, entry);
    const dst = path.join(targetDist, entry);
    fs.cpSync(src, dst, { recursive: true });
  }

  // 复制 index.html 到 wwwroot 根目录
  const sourceIndex = path.join(sourceDistDir, 'index.html');
  if (fs.existsSync(sourceIndex)) {
    fs.copyFileSync(sourceIndex, path.join(WWWROOT_DIR, 'index.html'));
  }

  // 同步 assets 到 wwwroot 根
  if (fs.existsSync(sourceAssets)) {
    const targetAssets = path.join(WWWROOT_DIR, 'assets');
    if (fs.existsSync(targetAssets)) {
      fs.rmSync(targetAssets, { recursive: true, force: true });
    }
    fs.cpSync(sourceAssets, targetAssets, { recursive: true });
  }

  logDeployStep('wwwroot mirror synced to ' + targetDist);
}

const server = http.createServer((req, res) => {
  // 为什么只收 POST /deploy：限制攻击面，GET 请求不暴露任何信息
  if (req.method !== 'POST' || req.url !== '/deploy') {
    res.writeHead(404);
    res.end();
    return;
  }

  // 为什么用 Bearer token 而非 IP 白名单：GitHub Actions 的出口 IP 是动态的，IP 白名单不现实
  const auth = req.headers['authorization'] || '';
  const expectedAuth = `Bearer ${SECRET}`;
  if (auth !== expectedAuth) {
    console.warn(`[${nowISO()}] Deploy webhook: unauthorized request`);
    res.writeHead(401);
    res.end('Unauthorized');
    return;
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const deployTime = nowISO();
    logDeployStep('triggered | payload: ' + body.slice(0, 300));

    try {
      // 为什么所有 execSync 必须显式传入 cwd: INSTALL_DIR：不能依赖 process.cwd()，
      // webhook 进程可能从任意目录启动，必须固定在 C:\jl-shiyi-h5-gitee
      logDeployStep('git pull origin main');
      execSync('git pull origin main', { cwd: INSTALL_DIR, stdio: 'inherit' });

      logDeployStep('npm ci');
      execSync('npm ci', { cwd: INSTALL_DIR, stdio: 'inherit' });

      logDeployStep('npm run build');
      execSync('npm run build', { cwd: INSTALL_DIR, stdio: 'inherit' });

      // 为什么 webhook 内做 wwwroot 同步而不依赖外部计划任务：
      // 去掉 5 分钟轮询后，wwwroot 再无人更新。webhook 是唯一的更新触发点。
      const sourceDist = path.join(INSTALL_DIR, 'dist');
      syncWwwroot(sourceDist);

      // 为什么用 Windows Scheduled Task 重启服务而非 pm2：ECS 未安装 pm2，
      // 实际通过计划任务 "JL拾遗 H5 Server" 管理 Node 进程。先停后启确保完整重启。
      logDeployStep('restart service via Scheduled Task: ' + SCHEDULED_TASK_NAME);
      try {
        execSync('powershell -Command "Stop-ScheduledTask -TaskName \'' + SCHEDULED_TASK_NAME + '\' -ErrorAction SilentlyContinue"', { stdio: 'inherit' });
      } catch (_) {
        // 停止任务本身可能失败（任务未运行），忽略继续
      }
      execSync('powershell -Command "Stop-Process -Name node -Force -ErrorAction SilentlyContinue"', { stdio: 'inherit' });
      execSync('powershell -Command "Start-ScheduledTask -TaskName \'' + SCHEDULED_TASK_NAME + '\'"', { stdio: 'inherit' });

      logDeployStep('deploy completed successfully');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'deployed', timestamp: deployTime }));
    } catch (error) {
      logDeployStep('deploy failed: ' + error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'failed', error: error.message, timestamp: deployTime }));
    }
  });
});

// 为什么监听 0.0.0.0 而不是 127.0.0.1：ECS 安全组只对必要端口开放入站，
// 监听 0.0.0.0 允许 GitHub Actions（外网）通过公网 IP:9000 命中 webhook
server.listen(PORT, '0.0.0.0', () => {
  logDeployStep('webhook started on 0.0.0.0:' + PORT);
});
