import assert from 'node:assert/strict';
import test from 'node:test';
import { HpTrail, hitFlashAlpha, otherHpLoss } from './battleFeedback';

test('回復は実際のHP増加で一度だけ始まり、同じHPや満タンでは増えない', async () => {
  const { HealingFeedback } = await import('./battleFeedback');
  assert.equal(typeof HealingFeedback, 'function');
  const effects = new HealingFeedback();
  assert.deepEqual(effects.update([{ id: 'a', hp: 50 }], 0), []);
  assert.deepEqual(effects.update([{ id: 'a', hp: 60 }], 100), [{ id: 'a', progress: 0 }]);
  assert.deepEqual(effects.update([{ id: 'a', hp: 60 }], 500), [{ id: 'a', progress: .5 }]);
  assert.deepEqual(effects.update([{ id: 'a', hp: 60 }], 900), []);
  assert.deepEqual(effects.update([{ id: 'a', hp: 60 }], 1000), []);
});

test('継続回復は演出を毎フレーム巻き戻さず、被ダメージでは開始しない', async () => {
  const { HealingFeedback } = await import('./battleFeedback');
  assert.equal(typeof HealingFeedback, 'function');
  const effects = new HealingFeedback();
  effects.update([{ id: 'a', hp: 50 }], 0);
  effects.update([{ id: 'a', hp: 60 }], 100);
  assert.deepEqual(effects.update([{ id: 'a', hp: 70 }], 500), [{ id: 'a', progress: .5 }]);
  assert.deepEqual(effects.update([{ id: 'a', hp: 40 }], 900), []);
});

test('初登場・復活・再戦を回復と扱わず、消えた対象の演出も破棄する', async () => {
  const { HealingFeedback } = await import('./battleFeedback');
  assert.equal(typeof HealingFeedback, 'function');
  const effects = new HealingFeedback();
  effects.update([{ id: 'a', hp: 50 }], 0);
  effects.update([{ id: 'a', hp: 0 }], 100);
  assert.deepEqual(effects.update([{ id: 'a', hp: 50 }], 200), []);
  effects.update([{ id: 'a', hp: 60 }], 300);
  assert.deepEqual(effects.update([], 400), []);
  assert.deepEqual(effects.update([{ id: 'a', hp: 80 }], 500), []);
  effects.clear();
  assert.deepEqual(effects.update([{ id: 'a', hp: 90 }], 600), []);
});

test('射撃分のHP減少だけを除外し、同時に受けた別のダメージを残す', () => {
  assert.equal(otherHpLoss(1000, 950, 50), 0);
  assert.equal(otherHpLoss(1000, 930, 50), 20);
  assert.equal(otherHpLoss(1000, 990, 50), 0);
  assert.equal(otherHpLoss(1000, 1030, 0), 0);
  assert.equal(otherHpLoss(1000, 980, 0), 20);
});

test('被弾発光は絵柄を残す薄さで200msかけて消え、開始前には光らない', () => {
  assert.equal(hitFlashAlpha(100, 99), 0);
  assert.equal(hitFlashAlpha(100, 100), .28);
  assert.equal(hitFlashAlpha(100, 200), .14);
  assert.equal(hitFlashAlpha(100, 300), 0);
  assert.equal(hitFlashAlpha(undefined, 100), 0);
});

test('damage trails catch up in 300ms and continue from visible HP on repeated hits', () => {
  const trail = new HpTrail();
  assert.equal(trail.sample('a', 1, 0), 1);
  assert.equal(trail.sample('a', .6, 10), 1);
  assert.equal(trail.sample('a', .6, 160), .8);
  assert.equal(trail.sample('a', .2, 160), .8);
  assert.equal(trail.sample('a', .2, 460), .2);
});

test('healing and fresh entities do not inherit damage trails', () => {
  const trail = new HpTrail();
  trail.sample('a', 1, 0);
  trail.sample('a', .2, 10);
  assert.equal(trail.sample('a', .4, 20), .4);
  assert.equal(trail.sample('b', .5, 20), .5);
  trail.clear();
  assert.equal(trail.sample('a', .1, 30), .1);
});
