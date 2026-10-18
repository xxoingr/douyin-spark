import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentFlame } from '../server/douyin/friends.js';

// 结构取自抖音真实返回的 a:consecutive_chat_data（时间是虚构的整点，单位秒）
const DAY = 86_400;
const T0 = 1_792_252_800;
const raw = JSON.stringify({
  expire_time: T0 + 2 * DAY,
  flame_infos: [
    { start: T0 - 3_600, end: T0, state: 1, level: 'normal|normal', days: 386, text: '386' },
    { start: T0, end: T0 + DAY, state: 2, level: 'gray|normal', days: 386, text: '386' },
    { start: T0 + DAY, end: T0 + 2 * DAY, state: 3, level: 'to_recover|normal', days: 386, text: '6 天后消失' },
  ],
});
const at = (seconds) => seconds * 1000;

test('取当前时间所在的那一段：今天还没续', () => {
  assert.deepEqual(currentFlame(raw, at(T0 + 3_600)), { days: 386, text: '386', level: 'gray', doneToday: false });
});

test('今天已续', () => {
  assert.equal(currentFlame(raw, at(T0 - 60)).doneToday, true);
});

test('已断开时显示倒计时文字', () => {
  assert.deepEqual(currentFlame(raw, at(T0 + DAY + 60)), { days: 386, text: '6 天后消失', level: 'to_recover', doneToday: false });
});

test('超出时间表说明火花已经消失', () => {
  assert.equal(currentFlame(raw, at(T0 + 3 * DAY)), null);
});

test('本机时间略早于第一段时取第一段', () => {
  assert.equal(currentFlame(raw, at(T0 - 2 * 3_600)).text, '386');
});

test('没有火花数据或格式不对', () => {
  assert.equal(currentFlame(undefined), null);
  assert.equal(currentFlame('not json'), null);
  assert.equal(currentFlame('{}'), null);
});
