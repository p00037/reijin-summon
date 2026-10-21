import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultBattleConfig } from '../core/battleConfig.js';
import { createDefaultBattleState, findLeader, findUnit } from '../core/battleState.js';
import { tickMovement } from './unitSystem.js';
import { tickSummonedUnits, tryExecuteSummon } from './summonSystem.js';

for (const moverKind of ['Unit', 'SummonedUnit'] as const) {
  for (const targetKind of ['Unit', 'SummonedUnit', 'Elemental'] as const) {
    for (const distance of [0.85, 0.850001]) {
      test(`${moverKind}対${targetKind}のZOCは中心間${distance}で${distance === 0.85 ? '減速する' : '減速しない'}`, () => {
        const config = createDefaultBattleConfig();
        const state = createDefaultBattleState(config);
        const unit = findUnit(state, 'PlayerMelee');
        const enemy = findUnit(state, 'CpuMelee');
        state.playerSummonGauge = 1;
        assert.equal(tryExecuteSummon(state, config, 'Player'), true);
        const summon = state.summonedUnits[0];
        const mover = moverKind === 'Unit' ? unit : summon;
        mover.position = { x: 0, y: 0 };
        mover.destination = { x: 3, y: 0 };
        if (moverKind === 'Unit') unit.stats.moveSpeed = 1;
        summon.moveSpeed = moverKind === 'SummonedUnit' ? 1 : 0;
        summon.healthDecayPerSecond = 0;
        summon.attackTimerSeconds = 100;
        state.units = moverKind === 'Unit' ? [unit] : [];
        state.summonedUnits = moverKind === 'SummonedUnit' ? [summon] : [];
        state.elementals = [];
        findLeader(state, 'Cpu').position = { x: 3, y: 0 };
        const position = { x: distance, y: 0 };
        if (targetKind === 'Unit') {
          enemy.position = position;
          enemy.destination = { ...position };
          state.units.push(enemy);
        } else if (targetKind === 'SummonedUnit') {
          state.summonedUnits.push({ ...summon, team: 'Cpu', summonedUnitId: 2, position, moveSpeed: 0 });
        } else {
          state.elementals.push({ elementalId: 'Elemental1', team: 'Cpu', position, maxHp: 1000, currentHp: 1000, isComplete: true });
        }

        if (moverKind === 'Unit') tickMovement(state, config, 0.1);
        else tickSummonedUnits(state, config, 0.1);
        const expected = 0.1 * (distance === 0.85 ? config.contactSlowMultiplier : 1);
        assert.ok(Math.abs(mover.position.x - expected) < 1e-12);
      });
    }
  }
}
