import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultBattleConfig } from '../core/battleConfig.js';
import { createDefaultBattleState, findLeader, findUnit } from '../core/battleState.js';
import { tickCombat } from './unitSystem.js';
import { tickSummonedUnits, tryExecuteSummon } from './summonSystem.js';

for (const attackerType of ['Melee', 'Speed', 'raphael', 'bahamut', 'dullahan', 'leviathan'] as const) {
  for (const targetType of ['Unit', 'Elemental', 'SummonedUnit', 'Leader'] as const) {
    test(`${attackerType}の近接攻撃は${targetType}の中心間0.63まで届き、境界外には届かない`, () => {
      const config = createDefaultBattleConfig();
      const state = createDefaultBattleState(config);
      const unit = findUnit(state, attackerType === 'Speed' ? 'PlayerSpeed' : 'PlayerMelee');
      const enemy = findUnit(state, 'CpuMelee');
      const isUnit = attackerType === 'Melee' || attackerType === 'Speed';
      state.playerSummonId = isUnit ? 'raphael' : attackerType;
      state.playerSummonGauge = 1;
      assert.equal(tryExecuteSummon(state, config, 'Player'), true);
      const summon = state.summonedUnits[0];
      summon.moveSpeed = 0;
      summon.healthDecayPerSecond = 0;
      summon.specialAttackTimerSeconds = 100;
      const attacker = isUnit ? unit : summon;
      attacker.position = { x: 0, y: 0 };
      attacker.destination = { ...attacker.position };
      state.units = isUnit ? [unit] : [];
      state.summonedUnits = isUnit ? [] : [summon];
      state.elementals = [];
      state.recentSummonAttackEvents = [];
      const position = { x: 0.630001, y: 0 };
      let target: { position: typeof position; currentHp: number };
      if (targetType === 'Unit') {
        enemy.position = position;
        enemy.destination = { ...position };
        enemy.attackTimerSeconds = 100;
        state.units.push(enemy);
        target = enemy;
      } else if (targetType === 'Elemental') {
        const elemental = { elementalId: 'Elemental1' as const, team: 'Cpu' as const, position, maxHp: 1000, currentHp: 1000, isComplete: true };
        state.elementals.push(elemental);
        target = elemental;
      } else if (targetType === 'SummonedUnit') {
        const other = { ...summon, summonedUnitId: summon.summonedUnitId + 1, team: 'Cpu' as const, position, attackTimerSeconds: 100 };
        state.summonedUnits.push(other);
        target = other;
      } else {
        target = findLeader(state, 'Cpu');
        target.position = position;
      }
      const initialHp = target.currentHp;
      const tick = () => isUnit ? tickCombat(state, config, 2) : tickSummonedUnits(state, config, summon.leaderAttackIntervalSeconds);
      tick();
      assert.equal(target.currentHp, initialHp);
      assert.equal(state.recentAttackEvents.length, 0);
      assert.equal(state.recentSummonAttackEvents.length, 0);

      target.position.x = 0.63;
      tick();
      assert.ok(target.currentHp < initialHp);
      const events = isUnit ? state.recentAttackEvents : state.recentSummonAttackEvents;
      assert.equal(events.length, 1);
    });
  }
}

test('近接召喚獣は旧接触距離で停止せず、召喚士への射程0.63まで進む', () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.playerSummonGauge = 1;
  assert.equal(tryExecuteSummon(state, config, 'Player'), true);
  state.units = [];
  const summon = state.summonedUnits[0];
  const leader = findLeader(state, 'Cpu');
  leader.position = { x: 0, y: 0 };
  summon.position = { x: 0.8, y: 0 };
  summon.moveSpeed = 0.2;
  summon.healthDecayPerSecond = 0;

  tickSummonedUnits(state, config, 1);
  assert.ok(summon.position.x < 0.63);
  const arrivedPosition = { ...summon.position };
  const hp = leader.currentHp;
  tickSummonedUnits(state, config, summon.leaderAttackIntervalSeconds);
  assert.deepEqual(summon.position, arrivedPosition);
  assert.equal(leader.currentHp, hp - summon.leaderAttackDamage);
});
