import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

fs.mkdirSync('data', { recursive: true });
export const db = new DatabaseSync('data/app.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS friends (
    uid TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    title TEXT NOT NULL,
    avatar TEXT,
    flame_days INTEGER,
    flame_text TEXT,
    flame_done_today INTEGER,
    enabled INTEGER NOT NULL DEFAULT 0,  -- 是否续火花，由用户在页面上勾选
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    content TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY,
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
// 本地日期，例如 2026-10-19（sv-SE 格式正好是 YYYY-MM-DD）
export const today = () => new Date().toLocaleDateString('sv-SE');

// 服务器在发送途中被关掉时，那次运行会一直停在 running，启动时把它标记为出错
db.prepare("UPDATE runs SET status = 'failed', error = ?, finished_at = ? WHERE status = 'running'")
  .run('服务器中途停止，这次没有发完，再点一次“立即发送”会补发剩下的好友', now());

// 拉取到的好友写入数据库；已有的好友只更新信息，保留用户勾选的状态
export function saveFriends(friends) {
  const upsert = db.prepare(`
    INSERT INTO friends (uid, conversation_id, title, avatar, flame_days, flame_text, flame_done_today, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET
      conversation_id = excluded.conversation_id, title = excluded.title, avatar = excluded.avatar,
      flame_days = excluded.flame_days, flame_text = excluded.flame_text,
      flame_done_today = excluded.flame_done_today, updated_at = excluded.updated_at
  `);
  for (const f of friends) {
    upsert.run(f.uid, f.conversationId, f.title, f.avatar, f.flame?.days ?? null, f.flame?.text ?? null,
      f.flame ? Number(f.flame.doneToday) : null, now());
  }
}

export function startRun() {
  return Number(db.prepare('INSERT INTO runs (started_at, status) VALUES (?, ?)').run(now(), 'running').lastInsertRowid);
}

export function finishRun(runId, error) {
  db.prepare('UPDATE runs SET finished_at = ?, status = ?, error = ? WHERE id = ?')
    .run(now(), error ? 'failed' : 'done', error ?? null, runId);
}

export function recordSend(runId, friend, status, content, detail) {
  db.prepare(`INSERT INTO sends (run_id, friend_uid, friend_title, day, content, status, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(runId, friend.uid, friend.title, today(), content ?? null, status, detail ?? null, now());
}

export function sentToday(uid) {
  return Boolean(db.prepare("SELECT 1 FROM sends WHERE friend_uid = ? AND day = ? AND status = 'success'").get(uid, today()));
}
