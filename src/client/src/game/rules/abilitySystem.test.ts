import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBattleConfig } from '../core/battleConfig';
import { createDefaultBattleState } from '../core/battleState';
import { abilityApCost, canUseAbility, tryUseAbility, tickAbilities, resetUnitAbilityState } from './abilitySystem';

test('クライアントもカード別APと共通の発動処理を使用する',()=>{
 const config=createDefaultBattleConfig(),state=createDefaultBattleState(config);state.phase='InProgress';
 const unit=state.units[0];unit.cardId='SC004';
 assert.equal(abilityApCost(unit),3); tickAbilities(state,config,60);
 assert.equal(canUseAbility(state,config,unit.unitId,0),true);
 assert.equal(tryUseAbility(state,config,unit.unitId,0),true);
 assert.equal(state.rainRemainingSeconds,100);assert.equal(unit.abilityAp,0);
});
test('CPUも手動コマンドで同じ効果を使用する',()=>{
 const config=createDefaultBattleConfig(),state=createDefaultBattleState(config);state.phase='InProgress';
 const unit=state.units[3];unit.cardId='SC004';unit.abilityAp=3;
 assert.equal(tryUseAbility(state,config,unit.unitId,0),true);assert.equal(state.rainRemainingSeconds,100);
});
test('不正入力と対象なしでは状態変更せず、プレビューは乱数を消費しない',()=>{
 const config=createDefaultBattleConfig(),state=createDefaultBattleState(config);state.phase='InProgress';
 const unit=state.units[0];unit.cardId='SC002';unit.abilityAp=1;
 const before=structuredClone(state);
 for(const id of [unit.unitId,'UnknownUnit']) for(const rotation of [0,NaN,Infinity]) {
  assert.equal(canUseAbility(state,config,id,rotation),false);
  assert.equal(tryUseAbility(state,config,id,rotation,()=>{throw Error('抽選不可');}),false);
 }
 assert.deepEqual(state,before);
});
test('リセットはAP・回復進捗・時間制効果を消す',()=>{
 const state=createDefaultBattleState(createDefaultBattleConfig()),unit=state.units[0];
 unit.abilityAp=3;unit.abilityRecoverySeconds=5;
 unit.abilityEffects=[{abilityId:'SC018',sourceUnitId:unit.unitId,castId:1,kind:'intelligence',amount:3,remainingSeconds:70}];
 resetUnitAbilityState(unit);assert.equal(unit.abilityAp,0);assert.equal(unit.abilityRecoverySeconds,0);assert.deepEqual(unit.abilityEffects,[]);
});
