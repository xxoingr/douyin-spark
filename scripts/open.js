// 桌面快捷方式“续火花”运行的就是这个脚本：
// 服务器没在运行就在后台启动它（页面关掉 10 分钟后自动退出），然后用默认浏览器打开页面。
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const URL = 'http://localhost:6688';
const isUp = () => fetch(`${URL}/api/status`).then((res) => res.ok, () => false);

if (!(await isUp())) {
  fs.mkdirSync('data', { recursive: true });
  const log = fs.openSync('data/server.log', 'a');
  spawn(process.execPath, ['server/index.js', '--exit-when-idle'], {
    detached: true, // 这个脚本退出后服务器继续运行
    stdio: ['ignore', log, log],
    windowsHide: true,
  }).unref();
  // 最多等 10 秒；还没起来也照样打开页面，出错原因在 data/server.log 里
  for (let i = 0; i < 40 && !(await isUp()); i++) await new Promise((resolve) => setTimeout(resolve, 250));
}

spawn('cmd.exe', ['/c', 'start', '', URL], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
