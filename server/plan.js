// 定时发送的计划计算，纯函数，不碰数据库和时钟，方便测试。

export const RETRY_DELAY_MS = 30 * 60_000;
const MAX_RETRIES = 2;

// 当天的发送时刻（毫秒时间戳），在 [windowStart, windowEnd] 里随机
export function planTime(day, windowStart, windowEnd, random = Math.random) {
  const at = (hhmm) => new Date(`${day}T${hhmm}:00`).getTime(); // 不带时区，按本地时间
  const start = at(windowStart);
  return start + Math.floor(random() * (at(windowEnd) - start + 1));
}

// 现在该做什么：'run'（当天第一次发送）、'retry'（补发）或 null
export function nextAction(plan, now) {
  if (!plan.done) return now >= plan.at ? 'run' : null;
  if (plan.retryAt && now >= plan.retryAt && plan.retries < MAX_RETRIES) return 'retry';
  return null;
}

// 一次发送结束后更新计划：没全部成功就安排补发
export function afterRun(plan, now, ok) {
  const retries = plan.done ? plan.retries + 1 : plan.retries;
  return { ...plan, done: true, retries, retryAt: !ok && retries < MAX_RETRIES ? now + RETRY_DELAY_MS : null };
}
