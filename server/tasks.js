// 浏览器任务（扫码登录、刷新好友、发送）同一时间只跑一个：
// 一是不同时开多个 Chromium 占内存，二是同一个账号不能在两个浏览器里同时操作。

export class BusyError extends Error {}

let current = null;
let last = null;

export function taskStatus() {
  return { current, last };
}

// 在后台启动任务，立即返回；任务结果放在 last 里，页面轮询 /api/status 查看
export function startTask(name, fn) {
  if (current) throw new BusyError(`正在${current.name}，请等它结束`);
  const task = { name, startedAt: new Date().toISOString() };
  current = task;
  fn()
    .then(() => {
      last = { ...task, finishedAt: new Date().toISOString(), error: null };
    })
    .catch((err) => {
      console.error(`[${name}]`, err);
      last = { ...task, finishedAt: new Date().toISOString(), error: err.message };
    })
    .finally(() => {
      current = null;
    });
}
