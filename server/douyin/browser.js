import fs from 'node:fs';
import { chromium } from 'playwright';
import { CHAT_URL, CONVERSATION_ITEM } from './selectors.js';

// 私信页打开后，IM SDK 分批同步会话：有时 35 秒后一次性出现，有时几秒内陆续出现。
// 所以等第一行出现后，还要等列表总高度连续一段时间不变，才算同步完。
const CONVERSATION_LIST_TIMEOUT_MS = 60_000;
const LIST_SETTLE_MS = 8_000;

// 在页面里运行：会话列表滚动容器的总高度（虚拟列表按会话总数撑开高度）
function listHeight(itemSelector) {
  let box = document.querySelector(itemSelector);
  while (box && !(box.scrollHeight > box.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(box).overflowY))) {
    box = box.parentElement;
  }
  return box ? box.scrollHeight : 0;
}

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

  // 超过上限还在增长就不再等了，按已经同步到的会话继续
  const deadline = Date.now() + CONVERSATION_LIST_TIMEOUT_MS;
  let height = -1;
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    const current = await page.evaluate(listHeight, CONVERSATION_ITEM);
    if (current !== height) {
      height = current;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= LIST_SETTLE_MS) {
      return;
    }
    await page.waitForTimeout(500);
  }
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
