// 阶段 0 验证：给一个好友发一条文字。用法：npm run send -- <好友uid> <消息>
// 好友 uid 可以用 npm run friends 查看。
import { openBrowser, openChatPage, saveCookies } from '../server/douyin/browser.js';
import { fetchFriends } from '../server/douyin/friends.js';
import { openChat, sendText } from '../server/douyin/chat.js';

const STATE_PATH = 'data/state.json';
const [uid, text] = process.argv.slice(2);
if (!uid || !text) {
  console.error('用法：npm run send -- <好友uid> <消息>');
  process.exit(2);
}

const { browser, context, page } = await openBrowser(STATE_PATH);
try {
  console.log('打开私信页，等待会话同步（约 35 秒）…');
  await openChatPage(page);
  const { friends } = await fetchFriends(page);
  const friend = friends.find((f) => f.uid === uid);
  if (!friend) throw new Error(`好友列表里没有 uid 为 ${uid} 的人`);

  await openChat(page, friend.conversationId);
  await sendText(page, friend.conversationId, text);
  await saveCookies(context, STATE_PATH);
  console.log(`已发送给「${friend.title}」，服务器已确认`);
} finally {
  await browser.close();
}
