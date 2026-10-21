import { chromium } from 'playwright';
import { saveCookies } from './browser.js';

const HOME_URL = 'https://www.douyin.com/';
const LOGIN_TIMEOUT_MS = 5 * 60_000;

// 弹出一个看得见的浏览器窗口让用户扫码。
// 未登录时没有 sessionid Cookie，扫码成功后才会出现，以此判断登录完成。
export async function loginByQrCode(statePath) {
  const browser = await chromium.launch({ headless: false });
  let windowClosed = false;
  browser.on('disconnected', () => (windowClosed = true));
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'zh-CN' });
    const page = await context.newPage();
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    // 登录弹窗没有自动出现时帮忙点一下“登录”；点不到也没关系，用户可以自己点
    await page.getByText('登录', { exact: true }).first().click({ timeout: 10_000 }).catch(() => {});

    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const cookies = await context.cookies(HOME_URL);
      if (cookies.some((cookie) => cookie.name === 'sessionid' && cookie.value)) {
        // 登录后页面还会跳转并写入其余 Cookie，稍等再保存
        await page.waitForTimeout(3_000);
        await saveCookies(context, statePath);
        return;
      }
      await page.waitForTimeout(2_000);
    }
    throw new Error('5 分钟内没有完成扫码登录');
  } catch (err) {
    // 用户提前关掉了扫码窗口，Playwright 的原始报错看不懂，换成直白的说法
    if (windowClosed || /closed/i.test(err.message)) throw new Error('扫码窗口被关掉了，这次没有登录');
    throw err;
  } finally {
    await browser.close();
  }
}
