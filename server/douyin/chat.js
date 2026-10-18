import { CHAT_HEADER, CONVERSATION_ITEM } from './selectors.js';
import { scrollListOnce } from './friends.js';

const MAX_SCROLL_ROUNDS = 200;
const CONFIRM_TIMEOUT_MS = 10_000;

// 在页面里运行：右侧打开的是不是指定会话（看聊天头部 React 属性里的 curConversation）。
function isCurrentConversation([headerSelector, conversationId]) {
  const header = document.querySelector(headerSelector);
  const fiberKey = header && Object.keys(header).find((key) => key.startsWith('__reactFiber$'));
  for (let fiber = fiberKey ? header[fiberKey] : null, depth = 0; fiber && depth < 4; fiber = fiber.return, depth++) {
    const current = fiber.memoizedProps?.curConversation;
    if (current) return String(current.id) === conversationId;
  }
  return false;
}

// 在页面里运行：把会话列表滚回顶部。
function scrollListToTop(itemSelector) {
  let box = document.querySelector(itemSelector);
  while (box && !(box.scrollHeight > box.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(box).overflowY))) {
    box = box.parentElement;
  }
  if (box) box.scrollTop = 0;
}

// 在页面里运行：在已渲染的行里找指定会话，找到就打上标记以便 Playwright 点击。
function markRow([itemSelector, conversationId]) {
  document.querySelectorAll('[data-spark-target]').forEach((el) => el.removeAttribute('data-spark-target'));
  for (const row of document.querySelectorAll(itemSelector)) {
    const fiberKey = Object.keys(row).find((key) => key.startsWith('__reactFiber$'));
    let fiber = fiberKey ? row[fiberKey] : null;
    while (fiber && !fiber.memoizedProps?.conversation) fiber = fiber.return;
    if (fiber && String(fiber.memoizedProps.conversation.id) === conversationId) {
      row.setAttribute('data-spark-target', '1');
      return true;
    }
  }
  return false;
}

// 按会话 id 打开聊天（会话 id 来自 fetchFriends），并确认右侧打开的就是这个人。
export async function openChat(page, conversationId) {
  await page.evaluate(scrollListToTop, CONVERSATION_ITEM);
  // 虚拟列表要等滚动事件处理完才重新渲染，立刻检查会看到旧的行
  await page.waitForTimeout(500);
  for (let round = 0; round < MAX_SCROLL_ROUNDS; round++) {
    if (await page.evaluate(markRow, [CONVERSATION_ITEM, conversationId])) {
      await page.locator('[data-spark-target]').click();
      try {
        await page.waitForFunction(isCurrentConversation, [CHAT_HEADER, conversationId], { timeout: CONFIRM_TIMEOUT_MS });
      } catch {
        throw new Error(`点击后右侧打开的不是目标会话: ${conversationId}`);
      }
      return;
    }
    if (!(await page.evaluate(scrollListOnce, CONVERSATION_ITEM))) break;
    await page.waitForTimeout(300);
  }
  throw new Error(`会话列表里找不到这个好友: ${conversationId}`);
}
