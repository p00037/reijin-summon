import test from 'node:test';
import assert from 'node:assert/strict';
import { perspectivePoint, toLocalState, toServerCommand } from './battlePerspective';
import { createDefaultBattleConfig } from '../core/battleConfig';
import { createDefaultBattleState } from '../core/battleState';

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
