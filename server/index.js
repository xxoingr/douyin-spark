import fs from 'node:fs';
import express from 'express';
import { db, deleteAccount, getAccount, listAccounts } from './db.js';
import { fillMissingProfiles, login, refreshFriends, runAll } from './jobs.js';
import { BusyError, startTask, taskStatus } from './tasks.js';

const PORT = 6688;
const IDLE_EXIT_MS = 10 * 60_000;
const app = express();
app.use(express.json());

// 从桌面快捷方式启动时带 --exit-when-idle：页面关掉 10 分钟后自动退出，平时不占内存。
// 页面开着时会不停请求 /api/status（后台标签页也至少每分钟一次），所以开着就不会退出。
if (process.argv.includes('--exit-when-idle')) {
  let lastRequestAt = Date.now();
  app.use((req, res, next) => {
    lastRequestAt = Date.now();
    next();
  });
  setInterval(() => {
    if (Date.now() - lastRequestAt > IDLE_EXIT_MS && !taskStatus().current) process.exit(0);
  }, 60_000);
}

// 登录状态：看保存的 Cookie 里 sessionid 有没有过期
function loginStatus(statePath) {
  if (!fs.existsSync(statePath)) return { loggedIn: false, expiresAt: null };
  const { cookies } = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const session = cookies.find((c) => c.name === 'sessionid' && c.value);
  const expiresAt = session ? new Date(session.expires * 1000).toISOString() : null;
  return { loggedIn: Boolean(session) && session.expires * 1000 > Date.now(), expiresAt };
}

app.get('/api/status', (req, res) => {
  res.json(taskStatus());
});

app.get('/api/accounts', (req, res) => {
  res.json(listAccounts().map(({ id, nickname, avatar, state_path: statePath }) => ({ id, nickname, avatar, ...loginStatus(statePath) })));
});

// 添加账号或重新登录：扫到哪个账号就是哪个
app.post('/api/accounts/login', (req, res) => {
  startTask('扫码登录', login);
  res.status(202).end();
});

app.delete('/api/accounts/:id', (req, res) => {
  if (taskStatus().current) throw new BusyError(`正在${taskStatus().current.name}，请等它结束再删除账号`);
  fs.rmSync(deleteAccount(Number(req.params.id)), { force: true });
  res.status(204).end();
});

app.post('/api/accounts/:id/friends/refresh', (req, res) => {
  const accountId = getAccount(Number(req.params.id)).id;
  startTask('刷新好友', () => refreshFriends(accountId));
  res.status(202).end();
});

app.get('/api/accounts/:id/friends', (req, res) => {
  res.json(db.prepare('SELECT * FROM friends WHERE account_id = ? ORDER BY flame_days IS NULL, flame_days DESC, title').all(req.params.id));
});

app.patch('/api/accounts/:id/friends/:uid', (req, res) => {
  db.prepare('UPDATE friends SET enabled = ? WHERE account_id = ? AND uid = ?').run(req.body.enabled ? 1 : 0, req.params.id, req.params.uid);
  res.status(204).end();
});

app.get('/api/accounts/:id/messages', (req, res) => {
  res.json(db.prepare('SELECT * FROM messages WHERE account_id = ? ORDER BY id').all(req.params.id));
});

app.post('/api/accounts/:id/messages', (req, res) => {
  const content = String(req.body.content ?? '').trim();
  if (!content) return res.status(400).json({ error: '消息内容不能为空' });
  db.prepare('INSERT INTO messages (account_id, content) VALUES (?, ?)').run(getAccount(Number(req.params.id)).id, content);
  res.status(201).end();
});

app.delete('/api/messages/:id', (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// 所有账号依次发送
app.post('/api/runs', (req, res) => {
  startTask('发送', runAll);
  res.status(202).end();
});

// 这个账号最近 20 次运行，每次带上发送明细
app.get('/api/accounts/:id/runs', (req, res) => {
  const runs = db.prepare('SELECT * FROM runs WHERE account_id = ? ORDER BY id DESC LIMIT 20').all(req.params.id);
  const sends = db.prepare('SELECT * FROM sends WHERE run_id = ? ORDER BY id');
  res.json(runs.map((run) => ({ ...run, sends: sends.all(run.id) })));
});

app.use(express.static('dist'));

app.use((err, req, res, next) => {
  if (err instanceof BusyError) return res.status(409).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: err.message });
});

// 只监听本机，局域网里的其他设备访问不到
app.listen(PORT, '127.0.0.1', () => {
  console.log(`douyin-spark 已启动：http://localhost:${PORT}`);
});

// 从单账号版本升级来的账号还没有昵称和头像，后台补上
fillMissingProfiles();
