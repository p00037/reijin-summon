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

test('スキルの条件成立と死亡・撃破時の発動条件を選択カードに合わせて表示する', () => {
 const state = createDefaultBattleState(createDefaultBattleConfig()); state.phase = 'InProgress';
 const unit = state.units[0]; unit.cardId = 'SC012'; state.remainingSeconds = 101;
 let model = createBattleHudModel(state, 'PlayerMelee', false, false);
 assert.equal(model.skillName, '不屈の精神'); assert.equal(model.skillStatus, '条件待ち');
 assert.ok(model.skillDescription.includes('20%'));
 state.remainingSeconds = 100;
 assert.equal(createBattleHudModel(state, 'PlayerMelee', false, false).skillStatus, '発動中');
 unit.cardId = 'SC006';
 assert.equal(createBattleHudModel(state, 'PlayerMelee', false, false).skillStatus, '死亡時');
 unit.cardId = 'SC008';
 assert.equal(createBattleHudModel(state, 'PlayerMelee', false, false).skillStatus, '撃破時');
 unit.cardId = 'SC010';
 model = createBattleHudModel(state, 'PlayerMelee', false, false);
 assert.equal(model.skillName, 'スキルなし'); assert.equal(model.skillDescription, '');
 assert.equal(createBattleHudModel(state, null, false, false).skillStatus, '');
});
