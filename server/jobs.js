import { openBrowser, openChatPage, saveCookies } from './douyin/browser.js';
import { fetchFriends } from './douyin/friends.js';
import { openChat, sendText } from './douyin/chat.js';
import { loginByQrCode } from './douyin/login.js';
import { db, finishRun, recordSend, saveFriends, sentToday, startRun } from './db.js';

export const STATE_PATH = 'data/state.json';

// 两个好友之间随机等几秒，避免发送节奏太机械
const PAUSE_MIN_MS = 3_000;
const PAUSE_MAX_MS = 8_000;

export function login() {
  return loginByQrCode(STATE_PATH);
}

// 打开浏览器 → 进私信页 → 拉取好友 → 执行 work → 写回续期后的 Cookie → 关浏览器
async function withFriends(work) {
  const { browser, context, page } = await openBrowser(STATE_PATH);
  try {
    await openChatPage(page);
    const { friends } = await fetchFriends(page);
    saveFriends(friends);
    await work(page, friends);
    await saveCookies(context, STATE_PATH);
  } finally {
    await browser.close();
  }
}

export function refreshFriends() {
  return withFriends(async () => {});
}

// 给所有勾选的好友各发一条随机消息。今天已经发过、或者今天火花已经续上的会跳过。
// 返回发送失败的好友数。
export async function runOnce() {
  const messages = db.prepare('SELECT content FROM messages').all().map((m) => m.content);
  if (!messages.length) throw new Error('还没有消息模板，请先在“消息”页添加');
  const enabled = db.prepare('SELECT uid, title FROM friends WHERE enabled = 1').all();
  if (!enabled.length) throw new Error('还没有勾选要续火花的好友');

  const runId = startRun();
  let failed = 0;
  try {
    await withFriends(async (page, friends) => {
      let sentBefore = false;
      for (const target of enabled) {
        const friend = friends.find((f) => f.uid === target.uid);
        if (!friend) {
          recordSend(runId, target, 'failed', null, '会话列表里找不到这个好友');
          failed++;
          continue;
        }
        if (sentToday(friend.uid)) {
          recordSend(runId, friend, 'skipped', null, '今天已经发过');
          continue;
        }
        if (friend.flame?.doneToday) {
          recordSend(runId, friend, 'skipped', null, '今天火花已经续上');
          continue;
        }

        if (sentBefore) await page.waitForTimeout(PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS));
        const content = messages[Math.floor(Math.random() * messages.length)];
        try {
          await openChat(page, friend.conversationId);
          await sendText(page, friend.conversationId, content);
          recordSend(runId, friend, 'success', content);
        } catch (err) {
          recordSend(runId, friend, 'failed', content, err.message);
          failed++;
        }
        sentBefore = true;
      }
    });
    finishRun(runId);
    return failed;
  } catch (err) {
    finishRun(runId, err.message);
    throw err;
  }
}
