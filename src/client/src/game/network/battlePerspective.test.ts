import test from 'node:test';
import assert from 'node:assert/strict';

test('潜在の対象・発動位置・引き寄せ元を後攻視点へ変換する', () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.recentSummonPotentialEvents = [{ eventId: 1, summonedUnitId: 7, summonId: 'bahamut', team: 'Cpu', origin: { x: 2, y: 3 }, targets: [{ x: 4, y: -1 }] }];
  state.units[0].abilityEffects = [{ abilityId: 'potential:bahamut', sourceUnitId: '', sourceSummonedUnitId: 7, sourcePosition: { x: 2, y: 3 }, castId: 7, kind: 'pull', amount: .41, remainingSeconds: 12 }];
  const local = toLocalState(state, 'Cpu');
  assert.equal(local.recentSummonPotentialEvents[0].team, 'Player');
  assert.deepEqual(local.recentSummonPotentialEvents[0].origin, { x: -2, y: -3 });
  assert.deepEqual(local.recentSummonPotentialEvents[0].targets, [{ x: -4, y: 1 }]);
  assert.equal(local.units[0].abilityEffects[0].sourceUnitId, '');
  assert.equal(local.units[0].abilityEffects[0].sourceSummonedUnitId, 7);
  assert.deepEqual(local.units[0].abilityEffects[0].sourcePosition, { x: -2, y: -3 });
});
import { perspectivePoint, toLocalState, toServerCommand } from './battlePerspective';
import { createDefaultBattleConfig } from '../core/battleConfig';
import { createDefaultBattleState } from '../core/battleState';

test('死亡スキルの発動位置と回復対象を後攻視点へ変換し、カードと回復量を保つ', () => {
 const state = createDefaultBattleState(createDefaultBattleConfig());
 state.recentSkillEvents = [{eventId: 2, sourceUnitId: 'CpuMelee', cardId: 'SC006', position: {x: 1, y: 2}, resource: 'hp', amount: 400, targets: [{unitId: 'CpuRanged', position: {x: 3, y: 4}}]}];
 assert.deepEqual(toLocalState(state, 'Cpu').recentSkillEvents, [{eventId: 2, sourceUnitId: 'PlayerMelee', cardId: 'SC006', position: {x: -1, y: -2}, resource: 'hp', amount: 400, targets: [{unitId: 'PlayerRanged', position: {x: -3, y: -4}}]}]);
});

test('後攻視点はエンチャント実対象のIDを維持し発動時位置を反転する', () => {
 const state = createDefaultBattleState(createDefaultBattleConfig());
 state.recentAbilityEvents = [{eventId: 1, sourceUnitId: 'CpuRanged', abilityId: 'SC003', targets: [], elementalTargets: [
   {elementalId: 'Elemental1', position: {x: 2, y: 1}},
   {elementalId: 'Elemental2', position: {x: -1, y: 2}}
 ]}];
 const local = toLocalState(state, 'Cpu');
 assert.deepEqual(local.recentAbilityEvents[0].elementalTargets, [
   {elementalId: 'Elemental1', position: {x: -2, y: -1}},
   {elementalId: 'Elemental2', position: {x: 1, y: -2}}
 ]);
 assert.equal(local.recentAbilityEvents[0].sourceUnitId, 'PlayerRanged');
});

test('後攻視点は効果の発動元と実対象を反転し、効果IDと連番を保持',()=>{
 const state=createDefaultBattleState(createDefaultBattleConfig());
 state.units[0].abilityEffects=[{abilityId:'SC002',sourceUnitId:'CpuRanged',castId:7,kind:'attack',amount:-14,remainingSeconds:13}];
 state.recentAbilityEvents=[{eventId:7,sourceUnitId:'CpuRanged',abilityId:'SC002',targets:[{unitId:'PlayerMelee',position:{x:1,y:2}}],elementalTargets:[]}];
 const local=toLocalState(state,'Cpu');
 assert.equal(local.units[0].abilityEffects[0].sourceUnitId,'PlayerRanged');
 assert.deepEqual(local.recentAbilityEvents,[{eventId:7,sourceUnitId:'PlayerRanged',abilityId:'SC002',targets:[{unitId:'CpuMelee',position:{x:-1,y:-2}}],elementalTargets:[]}]);
 assert.equal(local.units[0].nation,'ScaleGuild');
});
test('後参加者の画面座標と入力が対称になる', () => { assert.deepEqual(perspectivePoint({ x: 2, y: -3 }, 'Cpu'), { x: -2, y: 3 }); const s = createDefaultBattleState(createDefaultBattleConfig()); s.cpuMp = 7; s.playerMp = 2; const local = toLocalState(s, 'Cpu'); assert.equal(local.playerMp, 7); assert.equal(local.units.find(u => u.unitId === 'PlayerMelee')?.team, 'Player'); const c = toServerCommand({ commandType: 'MoveUnit', team: 'Player', unitId: 'PlayerMelee', targetPosition: { x: 2, y: -3 } }, 'Cpu'); assert.deepEqual(c, { commandType: 'MoveUnit', team: 'Cpu', unitId: 'CpuMelee', targetPosition: { x: -2, y: 3 } }); });
