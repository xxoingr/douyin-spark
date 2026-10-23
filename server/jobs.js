import fs from 'node:fs';
import { openBrowser, openChatPage, saveCookies } from './douyin/browser.js';
import { fetchFriends } from './douyin/friends.js';
import { openChat, sendText } from './douyin/chat.js';
import { loginByQrCode } from './douyin/login.js';
import { fetchProfile } from './douyin/profile.js';
import {
  addAccount, db, finishRun, getAccount, listAccounts, recordSend, saveFriends, startRun, updateAccountProfile,
} from './db.js';

// 扫码时先存到这里，认出是哪个账号后再移到该账号自己的文件
const NEW_LOGIN_PATH = 'data/accounts/new.json';

// 两个好友之间随机等几秒，避免发送节奏太机械
const PAUSE_MIN_MS = 3_000;
const PAUSE_MAX_MS = 8_000;

export const accountName = (account) => account.nickname || `账号 ${account.id}`;

// 补全还没有 uid 和昵称的账号（从单账号版本升级来的账号 1）。登录已失效的读不到，先跳过。
export async function fillMissingProfiles() {
  for (const account of listAccounts().filter((a) => !a.uid)) {
    try {
      updateAccountProfile(account.id, await fetchProfile(account.state_path));
    } catch {
      // 下次再补
    }
  }
}

// 扫码登录：扫的是已经添加过的账号就只更新它的登录状态，否则新建账号
export async function login() {
  await loginByQrCode(NEW_LOGIN_PATH);
  const profile = await fetchProfile(NEW_LOGIN_PATH);
  await fillMissingProfiles(); // 老账号补上 uid 才能判断是不是重复添加
  const existing = listAccounts().find((a) => a.uid === profile.uid);
  if (existing) updateAccountProfile(existing.id, profile);
  fs.renameSync(NEW_LOGIN_PATH, existing ? existing.state_path : addAccount(profile));
}

// 打开浏览器 → 进私信页 → 拉取好友 → 执行 work → 写回续期后的 Cookie → 关浏览器
async function withFriends(account, work) {
  const { browser, context, page } = await openBrowser(account.state_path);
  try {
    await openChatPage(page);
    const { friends } = await fetchFriends(page);
    saveFriends(account.id, friends);
    await work(page, friends);
    await saveCookies(context, account.state_path);
  } finally {
    await browser.close();
  }
}

export function refreshFriends(accountId) {
  return withFriends(getAccount(accountId), async () => {});
}

// 给这个账号勾选的好友各发一条随机消息。不管今天发没发过，每次都发。
async function runAccount(account) {
  const messages = db.prepare('SELECT content FROM messages WHERE account_id = ?').all(account.id).map((m) => m.content);
  if (!messages.length) throw new Error('还没有消息模板，请先在“消息”页添加');
  const enabled = db.prepare('SELECT uid, title FROM friends WHERE account_id = ? AND enabled = 1').all(account.id);

  const runId = startRun(account.id);
  try {
    await withFriends(account, async (page, friends) => {
      let sentBefore = false;
      for (const target of enabled) {
        const friend = friends.find((f) => f.uid === target.uid);
        if (!friend) {
          recordSend(runId, target, 'failed', null, '会话列表里找不到这个好友');
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
        }
        sentBefore = true;
      }
    });
    finishRun(runId);
  } catch (err) {
    finishRun(runId, err.message);
    throw err;
  }
}

// 所有账号依次发送，同一时间只开一个浏览器。没勾选好友的账号跳过；
// 某个账号出错（比如登录失效）不影响其他账号，最后汇总报错。
export async function runAll() {
  const accounts = listAccounts().filter((a) => db.prepare('SELECT 1 FROM friends WHERE account_id = ? AND enabled = 1').get(a.id));
  if (!accounts.length) throw new Error('还没有勾选要续火花的好友');
  const errors = [];
  for (const account of accounts) {
    try {
      await runAccount(account);
    } catch (err) {
      errors.push(`${accountName(account)}：${err.message}`);
    }
  }
  if (errors.length) throw new Error(errors.join('；'));
}
