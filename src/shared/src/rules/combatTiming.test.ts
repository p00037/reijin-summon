import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBattleConfig } from '../core/battleConfig.js';
import { createDefaultBattleState, findLeader, findUnit } from '../core/battleState.js';
import { GameSession } from './gameSession.js';
import { tickCombat, tickUnitHealing } from './unitSystem.js';
import { tickSummonedUnits, tryExecuteSummon } from './summonSystem.js';

function keeperFixture() {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const keeper = findUnit(state, 'PlayerMelee');
  const master = findUnit(state, 'CpuRanged');
  state.units = [keeper, master];
  state.phase = 'InProgress';
  keeper.position = { x: 0, y: 0 };
  keeper.destination = { ...keeper.position };
  keeper.currentHp = 500;
  master.position = { x: 3, y: 0 };
  master.destination = { ...master.position };
  return { config, state, keeper, master };
}

for (const [summonId, interval, damage] of [
  ['raphael', 2, 300],
  ['bahamut', 2, 300],
  ['dullahan', 2, 300],
  ['leviathan', 9, 1500]
] as const) {
  test(`${summonId}は移動時間にかかわらず召喚士到着後に攻撃間隔を待つ`, () => {
    const config = createDefaultBattleConfig();
    const state = createDefaultBattleState(config);
    state.units = [];
    state.playerSummonId = summonId;
    state.playerSummonGauge = 1;
    assert.equal(tryExecuteSummon(state, config, 'Player'), true);
    const summoned = state.summonedUnits[0];
    const leader = findLeader(state, 'Cpu');
    const initialHp = leader.currentHp;
    summoned.position = { x: leader.position.x, y: leader.position.y - 2 };
    summoned.moveSpeed = 0.2;
    summoned.healthDecayPerSecond = 0;
    summoned.specialAttackTimerSeconds = 60;

    tickSummonedUnits(state, config, 10);
    tickSummonedUnits(state, config, 0);
    assert.equal(leader.currentHp, initialHp);
    tickSummonedUnits(state, config, interval - 0.01);
    assert.equal(leader.currentHp, initialHp);
    tickSummonedUnits(state, config, 0.01);
    assert.equal(leader.currentHp, initialHp - damage);
    tickSummonedUnits(state, config, interval * 2);
    assert.equal(leader.currentHp, initialHp - damage * 3);
  });
}

test('マスターは通常対象に0.7秒間隔で遠距離攻撃する', () => {
  const { config, state, keeper } = keeperFixture();
  tickCombat(state, config, 0);
  assert.equal(keeper.currentHp, 464);
  tickCombat(state, config, 0.5);
  assert.equal(keeper.currentHp, 464);
  tickCombat(state, config, 0.19);
  assert.equal(keeper.currentHp, 464);
  tickCombat(state, config, 0.01);
  assert.equal(keeper.currentHp, 428);
});

test('キーパーは近接戦闘中に停止回復せず回復タイマーをリセットする', () => {
  const { config, state, keeper, master } = keeperFixture();
  master.position = { x: 1, y: 0 };
  master.destination = { ...master.position };
  keeper.restHealingElapsedSeconds = 1.49;

  tickUnitHealing(state, config, 1.5);
  assert.equal(keeper.currentHp, 500);
  assert.equal(keeper.restHealingElapsedSeconds, 0);
  master.position = { x: 6, y: 0 };
  master.destination = { ...master.position };
  tickUnitHealing(state, config, 1.49);
  assert.equal(keeper.currentHp, 500);
  tickUnitHealing(state, config, 0.01);
  assert.equal(keeper.currentHp, 560);
});

test('キーパーはマスターの射程内で攻撃対象になっている間は停止回復しない', () => {
  const { config, state, keeper, master } = keeperFixture();
  master.attackTimerSeconds = 0.7;
  keeper.restHealingElapsedSeconds = 1.49;
  tickUnitHealing(state, config, 1.5);
  assert.equal(keeper.currentHp, 500);
  assert.equal(keeper.restHealingElapsedSeconds, 0);
});

test('実際の戦闘更新でも遠距離攻撃中のキーパーは停止回復しない', () => {
  const { config, state, keeper } = keeperFixture();
  const session = new GameSession(config, state);
  keeper.restHealingElapsedSeconds = 1.49;
  session.tick(2);
  assert.equal(keeper.currentHp, 392);
  assert.equal(keeper.restHealingElapsedSeconds, 0);
});

test('射程内でも移動中で攻撃できないマスターはキーパーの停止回復を妨げない', () => {
  const { config, state, keeper, master } = keeperFixture();
  master.destination = { x: 6, y: 0 };
  tickUnitHealing(state, config, 1.5);
  assert.equal(keeper.currentHp, 560);
});

test('マスターが別の味方を狙っている場合はキーパーが停止回復できる', () => {
  const { config, state, keeper } = keeperFixture();
  const ally = { ...keeper, unitId: 'PlayerSpeed' as const, position: { x: 2, y: 0 }, destination: { x: 2, y: 0 } };
  state.units.push(ally);
  tickUnitHealing(state, config, 1.5);
  assert.equal(keeper.currentHp, 560);
});

test('召喚士を攻撃しているキーパーは停止回復しない', () => {
  const { config, state, keeper } = keeperFixture();
  state.units = [keeper];
  findLeader(state, 'Cpu').position = { x: 1, y: 0 };
  tickUnitHealing(state, config, 1.5);
  assert.equal(keeper.currentHp, 500);
});

test('戦闘中のキーパーでも召喚士の回復エリアでは回復する', () => {
  const { config, state, keeper } = keeperFixture();
  findLeader(state, 'Player').position = { ...keeper.position };
  tickUnitHealing(state, config, 2);
  assert.equal(keeper.currentHp, 610);
});

for (const summonId of ['raphael', 'jackpot', 'yggdrasil'] as const) {
  test(`${summonId}の攻撃を受けるキーパーは停止回復しない`, () => {
    const { config, state, keeper } = keeperFixture();
    state.units = [keeper];
    state.cpuSummonId = summonId;
    state.cpuSummonGauge = 1;
    state.elementals = [
      { elementalId: 'Elemental1', team: 'Cpu', position: { x: -5, y: 3 }, maxHp: 1000, currentHp: 1000, isComplete: true },
      { elementalId: 'Elemental2', team: 'Cpu', position: { x: 5, y: 3 }, maxHp: 1000, currentHp: 1000, isComplete: true }
    ];
    assert.equal(tryExecuteSummon(state, config, 'Cpu'), true);
    const summoned = state.summonedUnits[0];
    if (summonId === 'raphael') summoned.position = { x: 1.6, y: 0 };
    summoned.moveSpeed = 0;
    summoned.healthDecayPerSecond = 0;
    keeper.currentHp = 500;
    keeper.restHealingElapsedSeconds = 1.49;

    new GameSession(config, state).tick(1.5);
    const damage = { raphael: 297, jackpot: 156, yggdrasil: 10 }[summonId];
    assert.equal(keeper.currentHp, 500 - damage);
    assert.equal(keeper.restHealingElapsedSeconds, 0);
  });
}
