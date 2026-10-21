import { CONVERSATION_ITEM, CONVERSATION_TITLE } from './selectors.js';

// 会话列表是虚拟滚动的，只渲染看得见的几行，所以要边滚动边收集。
const MAX_SCROLL_ROUNDS = 200;

// 在页面里运行：读出当前渲染的每一行会话。
// 会话对象挂在行 DOM 的 React 属性上（memoizedProps.conversation），
// 火花数据在它的 ext['a:consecutive_chat_data'] 里。
function readRenderedRows([itemSelector, titleSelector]) {
  return [...document.querySelectorAll(itemSelector)].map((row) => {
    const fiberKey = Object.keys(row).find((key) => key.startsWith('__reactFiber$'));
    let fiber = fiberKey ? row[fiberKey] : null;
    while (fiber && !fiber.memoizedProps?.conversation) fiber = fiber.return;
    const conversation = fiber?.memoizedProps.conversation;
    if (!conversation) return null;
    return {
      // uid 超过 JS 安全整数范围，只能从会话 id 字符串里取，不能用数字字段
      conversationId: String(conversation.id),
      type: conversation.type,
      secUid: conversation.toParticipantSecUserId || '',
      title: row.querySelector(titleSelector)?.textContent.trim() || '',
      avatar: row.querySelector('.semi-avatar img')?.src || '',
      flameData: conversation.ext?.['a:consecutive_chat_data'],
    };
  }).filter(Boolean);
}

// 抖音给的火花数据是一张按天排好的时间表：每一段 [start, end) 是那一天要显示的状态，
// 例如今天显示“386”（灰色，今天还没续），明天起显示“6 天后消失”。取当前时间所在的那一段。
// level 是火花颜色：gray（灰色，今天还没续）、to_recover（已断开，待重燃）表示今天还要发；
// normal、recover_normal（重燃中且今天已聊）、blue 等其他颜色都是点亮的火花——抖音会按互动方式换颜色。
const NOT_DONE_LEVELS = new Set(['gray', 'to_recover']);

export function currentFlame(raw, now = Date.now()) {
  let entries;
  try {
    entries = JSON.parse(raw).flame_infos;
  } catch {
    return null;
  }
  if (!Array.isArray(entries) || !entries.length) return null;
  const seconds = now / 1000;
  // 本机时钟可能比抖音服务器略慢，还没到第一段时按第一段算；超出最后一段说明火花已消失
  const entry = seconds < entries[0].start ? entries[0] : entries.find((e) => e.start <= seconds && seconds < e.end);
  if (!entry) return null;
  const level = String(entry.level).split('|')[0];
  return { days: entry.days, text: entry.text, level, doneToday: !NOT_DONE_LEVELS.has(level) };
}

// 在页面里运行：把会话列表往下滚一屏，返回是否真的滚动了。
export function scrollListOnce(itemSelector) {
  let box = document.querySelector(itemSelector);
  while (box && !(box.scrollHeight > box.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(box).overflowY))) {
    box = box.parentElement;
  }
  if (!box) return false;
  const before = box.scrollTop;
  box.scrollTop += Math.floor(box.clientHeight * 0.8);
  return box.scrollTop > before;
}

// 私聊会话 id 形如 "0:1:<uidA>:<uidB>"，两个 uid 里出现在每个会话中的那个是自己。
function splitUids(conversations) {
  const counts = new Map();
  for (const { conversationId } of conversations) {
    for (const uid of conversationId.split(':').slice(2)) counts.set(uid, (counts.get(uid) || 0) + 1);
  }
  const selfUid = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { selfUid, peerOf: (id) => id.split(':').slice(2).find((uid) => uid !== selfUid) };
}

// 先调用 openChatPage 等会话列表加载完，再调用这个。
// 返回私聊好友（不含群聊）：uid、secUid、显示名、头像、火花信息。
export async function fetchFriends(page) {
  const conversations = new Map();
  for (let round = 0; round < MAX_SCROLL_ROUNDS; round++) {
    for (const row of await page.evaluate(readRenderedRows, [CONVERSATION_ITEM, CONVERSATION_TITLE])) {
      conversations.set(row.conversationId, row);
    }
    if (!(await page.evaluate(scrollListOnce, CONVERSATION_ITEM))) break;
    await page.waitForTimeout(400);
  }

  const privateChats = [...conversations.values()].filter((c) => c.type === 1);
  const { selfUid, peerOf } = splitUids(privateChats);
  return {
    selfUid,
    friends: privateChats.map(({ type, flameData, ...c }) => ({ uid: peerOf(c.conversationId), ...c, flame: currentFlame(flameData) })),
  };
}
