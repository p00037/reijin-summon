import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeAbilityEvents } from './abilityEventPresentation';
test('重複スナップショットは再生せず、新しい対戦で連番を初期化する',()=>{
 const events=[{eventId:1,sourceUnitId:'PlayerMelee' as const,abilityId:'SC002',targets:[]}];
 const first=consumeAbilityEvents(events,0);assert.equal(first.events.length,1);
 assert.equal(consumeAbilityEvents(events,first.lastSeen).events.length,0);
 assert.equal(consumeAbilityEvents(events,0).events.length,1);
});
