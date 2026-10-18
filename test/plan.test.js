import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterRun, nextAction, planTime, RETRY_DELAY_MS } from '../server/plan.js';

const local = (text) => new Date(text).getTime(); // 不带时区的时间按本地时间解析

test('在时间窗口里挑发送时刻', () => {
  assert.equal(planTime('2026-10-19', '07:55', '08:05', () => 0), local('2026-10-19T07:55:00'));
  assert.equal(planTime('2026-10-19', '07:55', '08:05', () => 0.999999), local('2026-10-19T08:05:00'));
});

const plan = { day: '2026-10-19', at: local('2026-10-19T08:00:00'), done: false, retries: 0, retryAt: null };

test('还没到时间不发，到了就发', () => {
  assert.equal(nextAction(plan, local('2026-10-19T07:59:00')), null);
  assert.equal(nextAction(plan, local('2026-10-19T08:00:00')), 'run');
});

test('电脑在计划时间没开机，开机后补发', () => {
  assert.equal(nextAction(plan, local('2026-10-19T21:30:00')), 'run');
});

test('全部成功后当天不再发', () => {
  const done = afterRun(plan, local('2026-10-19T08:01:00'), true);
  assert.equal(done.retryAt, null);
  assert.equal(nextAction(done, local('2026-10-19T23:00:00')), null);
});

test('有失败时 30 分钟后补发，最多补 2 次', () => {
  const t = local('2026-10-19T08:01:00');
  const first = afterRun(plan, t, false);
  assert.equal(first.retryAt, t + RETRY_DELAY_MS);
  assert.equal(nextAction(first, t + RETRY_DELAY_MS - 1), null);
  assert.equal(nextAction(first, t + RETRY_DELAY_MS), 'retry');

  const second = afterRun(first, t + RETRY_DELAY_MS, false);
  assert.equal(second.retries, 1);
  assert.equal(nextAction(second, second.retryAt), 'retry');

  const third = afterRun(second, second.retryAt, false);
  assert.equal(third.retries, 2);
  assert.equal(third.retryAt, null);
  assert.equal(nextAction(third, local('2026-10-19T23:00:00')), null);
});
