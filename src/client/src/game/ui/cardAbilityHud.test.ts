import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBattleConfig, createDefaultBattleState } from '@reijin-summon/shared';
import { createBattleHudModel } from './battleHudModel';
test('能力なしは無効と比率0、AP5の固有名・説明・雨を表示',()=>{
 const state=createDefaultBattleState(createDefaultBattleConfig());state.phase='InProgress';
 const unit=state.units[0];unit.cardId='SC010';
 let model=createBattleHudModel(state,'PlayerMelee',false,true);
 assert.equal(model.abilityName,'アビリティなし');assert.equal(model.abilityGauge.ratio,0);assert.equal(model.canUseAbility,false);
 unit.cardId='SC019'; unit.abilityAp=3; state.rainRemainingSeconds=100;
 model=createBattleHudModel(state,'PlayerMelee',false,true);
 assert.equal(model.abilityGauge.text,'AP 3 / 5');assert.equal(model.abilityName,'シャコ貝の召喚');
 assert.ok(model.abilityDescription.includes('ATK−11'));assert.equal(model.weatherText,'雨');
});
