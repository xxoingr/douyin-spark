import { getSetting, setSetting, today } from './db.js';
import { runOnce } from './jobs.js';
import { afterRun, nextAction, planTime } from './plan.js';
import { startTask, taskStatus } from './tasks.js';

// 每天在设定的时间窗口里随机挑一个时刻发送；那个时刻电脑没开机的话，开机后当天补发。
// 有好友发送失败（或整次出错）时，30 分钟后再发一次，每天最多补发 2 次。
// 已经发成功的好友不会重复发（runOnce 会跳过今天发过的）。

const TICK_MS = 60_000;
const DEFAULT_SCHEDULE = { enabled: false, windowStart: '07:55', windowEnd: '08:05' };

export function getSchedule() {
  return { ...DEFAULT_SCHEDULE, ...getSetting('schedule') };
}

export function saveSchedule({ enabled, windowStart, windowEnd }) {
  if (!/^\d\d:\d\d$/.test(windowStart) || !/^\d\d:\d\d$/.test(windowEnd) || windowEnd < windowStart) {
    throw new Error('时间段格式不对，结束时间不能早于开始时间');
  }
  setSetting('schedule', { enabled: Boolean(enabled), windowStart, windowEnd });
  // 今天还没发的话，按新的时间段重新挑时刻
  const plan = getSetting('plan');
  if (plan && plan.day === today() && !plan.done) setSetting('plan', null);
}

// 今天的计划，没有就新建一个
function todayPlan() {
  const plan = getSetting('plan');
  if (plan?.day === today()) return plan;
  const { windowStart, windowEnd } = getSchedule();
  const fresh = { day: today(), at: planTime(today(), windowStart, windowEnd), done: false, retries: 0, retryAt: null };
  setSetting('plan', fresh);
  return fresh;
}

export function scheduleStatus() {
  const schedule = getSchedule();
  return { ...schedule, plan: schedule.enabled ? todayPlan() : null };
}

function check() {
  if (!getSchedule().enabled || taskStatus().current) return;
  const action = nextAction(todayPlan(), Date.now());
  if (!action) return;
  startTask(action === 'run' ? '定时发送' : '补发', async () => {
    let ok = false;
    try {
      ok = (await runOnce()) === 0;
    } finally {
      setSetting('plan', afterRun(todayPlan(), Date.now(), ok));
    }
  });
}

export function startScheduler() {
  const tick = () => {
    try {
      check();
    } catch (err) {
      console.error('[定时]', err);
    }
  };
  tick();
  setInterval(tick, TICK_MS);
}
