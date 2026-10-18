// 阶段 0 验证：扫码登录并保存到 data/state.json。用法：npm run login
import { loginByQrCode } from '../server/douyin/login.js';
import { openBrowser, openChatPage } from '../server/douyin/browser.js';

const STATE_PATH = 'data/state.json';

console.log('浏览器窗口弹出后，用手机抖音扫码登录（5 分钟内有效）…');
await loginByQrCode(STATE_PATH);
console.log('登录成功，用新的登录状态打开私信页验证（约 35 秒）…');

const { browser, page } = await openBrowser(STATE_PATH);
try {
  await openChatPage(page);
  console.log('验证通过：私信页会话列表已加载');
} finally {
  await browser.close();
}
