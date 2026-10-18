import fs from 'node:fs';
import { chromium } from 'playwright';
import { CHAT_URL, CONVERSATION_ITEM } from './selectors.js';

// 私信页打开后，IM SDK 要分页同步完会话才渲染列表，全新登录环境实测约 35 秒。
const CONVERSATION_LIST_TIMEOUT_MS = 60_000;

export async function openBrowser(statePath, { headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    storageState: statePath,
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  return { browser, context, page };
}

export async function openChatPage(page) {
  await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.locator(CONVERSATION_ITEM).first().waitFor({ state: 'visible', timeout: CONVERSATION_LIST_TIMEOUT_MS });
}

// 抖音每次访问都会给登录 Cookie 续期，运行后写回就不会到期失效。
// 只写 Cookie：localStorage 里存着 IM 同步进度，写回后下次只会同步最近活跃的会话，
// 较早的好友就拉不到了。
export async function saveCookies(context, statePath) {
  const { cookies } = await context.storageState();
  const temporary = `${statePath}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ cookies, origins: [] }));
  fs.renameSync(temporary, statePath);
}
