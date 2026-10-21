import fs from 'node:fs';
import express from 'express';
import { db } from './db.js';
import { login, refreshFriends, runOnce, STATE_PATH } from './jobs.js';
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
function accountStatus() {
  if (!fs.existsSync(STATE_PATH)) return { loggedIn: false };
  const { cookies } = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  const session = cookies.find((c) => c.name === 'sessionid' && c.value);
  const expiresAt = session ? new Date(session.expires * 1000).toISOString() : null;
  return { loggedIn: Boolean(session) && session.expires * 1000 > Date.now(), expiresAt };
}

app.get('/api/status', (req, res) => {
  res.json({ account: accountStatus(), ...taskStatus() });
});

app.post('/api/login', (req, res) => {
  startTask('扫码登录', login);
  res.status(202).end();
});

app.post('/api/friends/refresh', (req, res) => {
  startTask('刷新好友', refreshFriends);
  res.status(202).end();
});

app.get('/api/friends', (req, res) => {
  res.json(db.prepare('SELECT * FROM friends ORDER BY flame_days IS NULL, flame_days DESC, title').all());
});

app.patch('/api/friends/:uid', (req, res) => {
  db.prepare('UPDATE friends SET enabled = ? WHERE uid = ?').run(req.body.enabled ? 1 : 0, req.params.uid);
  res.status(204).end();
});

app.get('/api/messages', (req, res) => {
  res.json(db.prepare('SELECT * FROM messages ORDER BY id').all());
});

app.post('/api/messages', (req, res) => {
  const content = String(req.body.content ?? '').trim();
  if (!content) return res.status(400).json({ error: '消息内容不能为空' });
  db.prepare('INSERT INTO messages (content) VALUES (?)').run(content);
  res.status(201).end();
});

app.delete('/api/messages/:id', (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

app.post('/api/runs', (req, res) => {
  startTask('发送', runOnce);
  res.status(202).end();
});

// 最近 20 次运行，每次带上发送明细
app.get('/api/runs', (req, res) => {
  const runs = db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 20').all();
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
