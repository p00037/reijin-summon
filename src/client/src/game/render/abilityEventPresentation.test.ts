import test from 'node:test';
import assert from 'node:assert/strict';
import type { AbilityEvent } from '@reijin-summon/shared';
import { consumeAbilityEvents, abilityEventTargetPositions } from './abilityEventPresentation';

test('エンチャントは発動元でなく付与された全エレメントの位置を強調する', () => {
 const event: AbilityEvent = {eventId: 1, sourceUnitId: 'PlayerMelee', abilityId: 'SC003', targets: [], elementalTargets: [
   {elementalId: 'Elemental1', position: {x: 2, y: 0}},
   {elementalId: 'Elemental2', position: {x: -1, y: 1}}
 ]};
 assert.deepEqual(abilityEventTargetPositions(event, {x: 0, y: 0}), [{x: 2, y: 0}, {x: -1, y: 1}]);
});

test('ユニット対象と対象なしの天候発動も強調表示できる', () => {
 const event: AbilityEvent = {eventId: 1, sourceUnitId: 'PlayerMelee', abilityId: 'SC002', targets: [{unitId: 'CpuMelee', position: {x: 1, y: 2}}], elementalTargets: []};
 assert.deepEqual(abilityEventTargetPositions(event, {x: 0, y: 0}), [{x: 1, y: 2}]);
 assert.deepEqual(abilityEventTargetPositions({...event, targets: []}, {x: 0, y: 0}), [{x: 0, y: 0}]);
 assert.deepEqual(abilityEventTargetPositions({...event, targets: []}), []);
});
test('重複スナップショットは再生せず、新しい対戦で連番を初期化する',()=>{
 const events=[{eventId:1,sourceUnitId:'PlayerMelee' as const,abilityId:'SC002',targets:[],elementalTargets:[]}];
 const first=consumeAbilityEvents(events,0);assert.equal(first.events.length,1);
 assert.equal(consumeAbilityEvents(events,first.lastSeen).events.length,0);
 assert.equal(consumeAbilityEvents(events,0).events.length,1);
});
