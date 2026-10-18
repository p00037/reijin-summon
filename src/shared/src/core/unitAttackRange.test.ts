import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultBattleConfig } from './battleConfig.js';
import { createDefaultBattleState } from './battleState.js';
import { createDeckBattleState, createOnlineBattleState } from './deckBattleState.js';
import { tickCombat } from '../rules/unitSystem.js';

const rangedCards = [
  ['SC002', 1, 2.25],
  ['SC001', 2, 2.41875],
  ['SC013', 3, 2.5875],
  ['SC011', 4, 2.75625],
  ['SC017', 5, 2.925]
] as const;

for (const [cardId, level, range] of rangedCards) {
  for (const team of ['Player', 'Cpu'] as const) {
    test(`${team}のLV${level}マスターは指定射程の境界まで攻撃し、境界外には届かない`, () => {
      const config = createDefaultBattleConfig();
      const state = createDeckBattleState(config, [cardId], [cardId]);
      state.phase = 'InProgress';
      const attacker = state.units.find(unit => unit.team === team)!;
      const target = state.units.find(unit => unit.team !== team)!;
      attacker.position = { x: 0, y: 0 };
      attacker.destination = { ...attacker.position };
      target.position = { x: range + 0.000001, y: 0 };
      target.destination = { ...target.position };
      target.attackTimerSeconds = 100;

      tickCombat(state, config, 0);

      assert.equal(target.currentHp, target.stats.maxHp);
      assert.equal(state.recentAttackEvents.length, 0);

      target.position.x = range;
      target.destination = { ...target.position };
      tickCombat(state, config, 0);

      assert.equal(target.currentHp, target.stats.maxHp - attacker.stats.attackDamage);
      assert.equal(state.recentAttackEvents[0]?.attackerUnitId, attacker.unitId);
    });
  }
}

test('カード縦寸法を変更すると両陣営のLV別射程も追従する', () => {
  const config = createDefaultBattleConfig();
  config.unitCardWorldHeight = 3;
  const state = createDeckBattleState(config, ['SC002', 'SC017'], ['SC002', 'SC017']);

  assert.deepEqual(state.units.map(unit => unit.stats.attackRange), [3, 3.9, 3, 3.9]);
});

test('オンライン対戦も両陣営のカードLVに応じた射程を使用する', () => {
  const state = createOnlineBattleState(createDefaultBattleConfig(), {
    Player: { cardIds: ['SC002', 'SC011'], summonId: 'raphael' },
    Cpu: { cardIds: ['SC001', 'SC017'], summonId: 'dullahan' }
  });

  assert.deepEqual(state.units.map(unit => unit.stats.attackRange), [2.25, 2.75625, 2.41875, 2.925]);
});

test('既定のLV3マスターにもLV別射程を適用する', () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  assert.deepEqual(state.units.filter(unit => unit.unitType === 'Ranged').map(unit => unit.stats.attackRange), [2.5875, 2.5875]);
});

test('キーパーとシーカーの射程はカードLVによらず維持する', () => {
  const state = createDeckBattleState(createDefaultBattleConfig(), ['SC010', 'SC015'], ['SC007', 'SC019']);
  assert.deepEqual(state.units.map(unit => unit.stats.attackRange), [0.63, 0.63, 0.63, 0.63]);
});
