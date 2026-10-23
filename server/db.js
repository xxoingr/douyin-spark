import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

fs.mkdirSync('data/accounts', { recursive: true });
export const db = new DatabaseSync('data/app.db');

// 单账号版本的登录文件；升级后它属于账号 1，新加的账号放在 data/accounts/<id>.json
const LEGACY_STATE_PATH = 'data/state.json';

const FRIENDS_TABLE = `
  CREATE TABLE IF NOT EXISTS friends (
    account_id INTEGER NOT NULL,
    uid TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    title TEXT NOT NULL,
    avatar TEXT,
    flame_days INTEGER,
    flame_text TEXT,
    my_sent_at INTEGER,  -- 自己最后一次给 TA 发消息的时间（毫秒），含手机上手动发的
    enabled INTEGER NOT NULL DEFAULT 0,  -- 是否续火花，由用户在页面上勾选
    updated_at TEXT NOT NULL,
    PRIMARY KEY (account_id, uid)  -- 同一个好友可能同时是几个账号的好友
  )`;

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY,
    uid TEXT UNIQUE,  -- 抖音 uid，扫码时用来判断是不是已经添加过的账号
    nickname TEXT,
    avatar TEXT,
    state_path TEXT NOT NULL,  -- 这个账号的登录状态文件
    created_at TEXT NOT NULL
  );
  ${FRIENDS_TABLE};
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL,
    content TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,  -- running / done / failed
    error TEXT
  );
  CREATE TABLE IF NOT EXISTS sends (
    id INTEGER PRIMARY KEY,
    run_id INTEGER NOT NULL,
    friend_uid TEXT NOT NULL,
    friend_title TEXT NOT NULL,
    day TEXT NOT NULL,     -- 本地日期 YYYY-MM-DD，用来判断今天发过没有
    content TEXT,
    status TEXT NOT NULL,  -- success / failed / skipped
    detail TEXT,
    created_at TEXT NOT NULL
  );
`);

const now = () => new Date().toISOString();
const columns = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

// 单账号版本的数据库没有 account_id：把原来的好友、消息、运行记录都归到账号 1。
// 好友表的主键要改成 (account_id, uid)，SQLite 改不了主键，只能重建表。
if (!columns('friends').includes('account_id')) {
  const keep = ['uid', 'conversation_id', 'title', 'avatar', 'flame_days', 'flame_text', 'my_sent_at', 'enabled', 'updated_at']
    .filter((column) => columns('friends').includes(column))
    .join(', ');
  db.exec(`
    BEGIN;
    ALTER TABLE friends RENAME TO friends_single;
    ${FRIENDS_TABLE};
    INSERT INTO friends (account_id, ${keep}) SELECT 1, ${keep} FROM friends_single;
    DROP TABLE friends_single;
    ALTER TABLE messages ADD COLUMN account_id INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE runs ADD COLUMN account_id INTEGER NOT NULL DEFAULT 1;
    COMMIT;
  `);
  if (fs.existsSync(LEGACY_STATE_PATH)) {
    db.prepare('INSERT INTO accounts (id, state_path, created_at) VALUES (1, ?, ?)').run(LEGACY_STATE_PATH, now());
  }
}

// 本地日期，例如 2026-10-19（sv-SE 格式正好是 YYYY-MM-DD）
export const today = () => new Date().toLocaleDateString('sv-SE');

// 服务器在发送途中被关掉时，那次运行会一直停在 running，启动时把它标记为出错
db.prepare("UPDATE runs SET status = 'failed', error = ?, finished_at = ? WHERE status = 'running'")
  .run('服务器中途停止，这次没有发完', now());

export function listAccounts() {
  return db.prepare('SELECT * FROM accounts ORDER BY id').all();
}

export function getAccount(id) {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!account) throw new Error('账号不存在');
  return account;
}

export function updateAccountProfile(id, { uid, nickname, avatar }) {
  db.prepare('UPDATE accounts SET uid = ?, nickname = ?, avatar = ? WHERE id = ?').run(uid, nickname, avatar, id);
}

// 新建账号，返回它的登录状态文件路径
export function addAccount({ uid, nickname, avatar }) {
  const id = Number(db.prepare('INSERT INTO accounts (uid, nickname, avatar, state_path, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(uid, nickname, avatar, '', now()).lastInsertRowid);
  const statePath = `data/accounts/${id}.json`;
  db.prepare('UPDATE accounts SET state_path = ? WHERE id = ?').run(statePath, id);
  return statePath;
}

// 删除账号和它的所有数据，返回登录状态文件路径（由调用方删除文件）
export function deleteAccount(id) {
  const { state_path: statePath } = getAccount(id);
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM sends WHERE run_id IN (SELECT id FROM runs WHERE account_id = ?)').run(id);
    for (const table of ['runs', 'messages', 'friends']) db.prepare(`DELETE FROM ${table} WHERE account_id = ?`).run(id);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return statePath;
}

// 拉取到的好友写入数据库；已有的好友只更新信息，保留用户勾选的状态
export function saveFriends(accountId, friends) {
  const upsert = db.prepare(`
    INSERT INTO friends (account_id, uid, conversation_id, title, avatar, flame_days, flame_text, my_sent_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, uid) DO UPDATE SET
      conversation_id = excluded.conversation_id, title = excluded.title, avatar = excluded.avatar,
      flame_days = excluded.flame_days, flame_text = excluded.flame_text,
      my_sent_at = excluded.my_sent_at, updated_at = excluded.updated_at
  `);
  for (const f of friends) {
    upsert.run(accountId, f.uid, f.conversationId, f.title, f.avatar, f.flame?.days ?? null, f.flame?.text ?? null,
      f.mySentAt, now());
  }
}

export function startRun(accountId) {
  return Number(db.prepare('INSERT INTO runs (account_id, started_at, status) VALUES (?, ?, ?)')
    .run(accountId, now(), 'running').lastInsertRowid);
}

export function finishRun(runId, error) {
  db.prepare('UPDATE runs SET finished_at = ?, status = ?, error = ? WHERE id = ?')
    .run(now(), error ? 'failed' : 'done', error ?? null, runId);
}

export function recordSend(runId, friend, status, content, detail) {
  db.prepare(`INSERT INTO sends (run_id, friend_uid, friend_title, day, content, status, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(runId, friend.uid, friend.title, today(), content ?? null, status, detail ?? null, now());
  // 页面上马上显示“今天已发”，不用等下次刷新好友
  if (status === 'success') {
    db.prepare('UPDATE friends SET my_sent_at = ? WHERE uid = ? AND account_id = (SELECT account_id FROM runs WHERE id = ?)')
      .run(Date.now(), friend.uid, runId);
  }
}
