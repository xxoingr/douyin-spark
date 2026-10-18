// 阶段 0 验证：拉取好友列表并打印。用法：npm run friends
import { openBrowser, openChatPage, saveCookies } from '../server/douyin/browser.js';
import { fetchFriends } from '../server/douyin/friends.js';

const STATE_PATH = 'data/state.json';

const { browser, context, page } = await openBrowser(STATE_PATH);
try {
  console.log('打开私信页，等待会话同步（约 35 秒）…');
  await openChatPage(page);
  const { selfUid, friends } = await fetchFriends(page);
  await saveCookies(context, STATE_PATH);

  console.log(`当前账号 uid: ${selfUid}，私聊好友 ${friends.length} 个\n`);
  friends
    .sort((a, b) => (b.flame?.days ?? -1) - (a.flame?.days ?? -1))
    .forEach((f) => {
      const flame = f.flame
        ? `🔥 ${String(f.flame.days).padStart(4)} 天 ${f.flame.doneToday ? '今天已续' : '今天未续'}  ${f.flame.text}`
        : '   无火花';
      console.log(`${flame.padEnd(28)} ${f.title}  (uid ${f.uid})`);
    });
} finally {
  await browser.close();
}
