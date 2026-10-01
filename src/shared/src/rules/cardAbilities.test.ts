import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBattleConfig } from '../core/battleConfig.js';
import { createDefaultBattleState } from '../core/battleState.js';
import { findCard } from '../deck/cardCatalog.js';
import * as abilities from './abilitySystem.js';
import { effectiveIntelligence, intelligenceMultiplier } from './abilityEffects.js';
import { abilityTargets } from './abilityTargets.js';

const config = createDefaultBattleConfig();
function setup(cardId: string) {
  const state = createDefaultBattleState(config);
  state.phase = 'InProgress';
  const caster = state.units[0];
  const target = state.units[3];
  caster.cardId = cardId;
  Object.assign(caster, {baseIntelligence: findCard(cardId)!.intelligence, nation: 'ScaleGuild', abilityEffects: []});
  Object.assign(target, {baseIntelligence: caster.baseIntelligence, nation: 'ScaleGuild', abilityEffects: []});
  caster.position = {x: 0, y: 0};
  target.position = {x: 0, y: 2};
  state.units = [caster, target];
  caster.abilityAp = 5;
  return {state, caster, target};
}
test('カードごとの必要APで蓄積が止まり、アビリティなしは蓄積しない', () => {
  const costs = [1,1,2,3,2,1,1,2,3,0,3,2,2,4,3,2,1,3,5,3];
  costs.forEach((cost, index) => {
    const {state, caster} = setup(`SC${String(index+1).padStart(3,'0')}`);
    caster.abilityAp = 0;
    abilities.tickAbilities(state, config, 120);
    assert.equal(caster.abilityAp, cost);
    assert.equal(caster.abilityRecoverySeconds, 0);
  });
});
test('シリカは対象INT差で時間だけを補正し攻撃力を14下げる', () => {
  const {state,caster,target} = setup('SC002');
  target.baseIntelligence = caster.baseIntelligence - 3;
  assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0), true);
  assert.equal(abilities.effectiveAttackDamage(target,state,config), target.stats.attackDamage-14);
  abilities.tickAbilities(state,config,16.8);
  assert.equal(abilities.effectiveAttackDamage(target,state,config), target.stats.attackDamage-14);
  abilities.tickAbilities(state,config,0.1);
  assert.equal(abilities.effectiveAttackDamage(target,state,config), target.stats.attackDamage);
});
test('大津波は同INTで415、差3で539.5、防御効果とは独立', () => {
  const {state,caster,target} = setup('SC015');
  caster.position.y = 1;
  target.baseIntelligence = caster.baseIntelligence - 3;
  const hp = target.currentHp;
  assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0),true);
  assert.ok(Math.abs(target.currentHp-(hp-539.5))<1e-8);
});
test('雨限定効果は晴れでAPを消費せず、雨は再使用で100秒', () => {
  const {state,caster} = setup('SC009');
  assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0),false);
  assert.equal(caster.abilityAp,5);
  caster.cardId = 'SC004';
  assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0),true);
  abilities.tickAbilities(state,config,80);
  assert.equal(state.rainRemainingSeconds,20);
  assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0),true);
  assert.equal(state.rainRemainingSeconds,100);
});
test('解除は時間制強化と弱体を消し、効果のない対象でもAPを消費', () => {
  const {state,caster,target} = setup('SC002');
  abilities.tryUseAbility(state,config,caster.unitId,0);
  caster.cardId = 'SC001'; caster.abilityAp = 1;
  assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0),true);
  assert.equal(abilities.effectiveAttackDamage(target,state,config),target.stats.attackDamage);
  caster.abilityAp = 1;
  assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0),true);
  assert.equal(caster.abilityAp,0);
});
test('ザンダーの失敗は前回吸収を維持し、再使用は累積しない', () => {
  const {state,caster,target} = setup('SC016');
  target.stats.attackDamage = 53;
  abilities.tryUseAbility(state,config,caster.unitId,0);
  assert.equal(abilities.effectiveAttackDamage(caster,state,config),caster.stats.attackDamage+26);
  assert.equal(abilities.effectiveAttackDamage(target,state,config),27);
  caster.abilityAp = 2; target.position.y = -4;
  assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0),false);
  assert.equal(abilities.effectiveAttackDamage(target,state,config),27);
  target.position.y = 2;
  assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0),true);
  assert.equal(abilities.effectiveAttackDamage(target,state,config),27);
});
test('グーは召喚ゲージを30%回復し満タンで消費しない', () => {
  const {state,caster} = setup('SC012');
  state.playerSummonGauge = 0.85;
  assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0),true);
  assert.equal(state.playerSummonGauge,1);
  caster.abilityAp = 2;
  assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0),false);
  assert.equal(caster.abilityAp,2);
});

for (const [cardId, multiplier, seconds] of [['SC005',.5,11],['SC008',.4,20],['SC011',.5,16],['SC020',.28,18]] as const) {
  test(`${cardId}は指定倍率で減速し期限後に解除する`,()=>{
    const {state,caster,target}=setup(cardId);
    assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0,()=>0),true);
    assert.equal(abilities.effectiveMoveSpeedMultiplier(state,config,target),multiplier);
    if(cardId==='SC011') assert.equal(abilities.effectiveAttackDamage(target,state,config),target.stats.attackDamage-9);
    abilities.tickAbilities(state,config,seconds);
    assert.equal(abilities.effectiveMoveSpeedMultiplier(state,config,target),1);
  });
}
for (const cardId of ['SC006','SC013']) {
  test(`${cardId}は味方の速度を10秒間1.5倍にし、死亡しても他者への効果を維持`,()=>{
    const {state,caster,target}=setup(cardId); target.team='Player';
    assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0,()=>0),true);
    caster.currentHp=0; abilities.tickAbilities(state,config,9.9);
    assert.equal(abilities.effectiveMoveSpeedMultiplier(state,config,target),1.5);
    assert.deepEqual(caster.abilityEffects,[]);
    abilities.tickAbilities(state,config,.1);
    assert.equal(abilities.effectiveMoveSpeedMultiplier(state,config,target),1);
  });
}
test('レッドアイは雨で同国味方だけを強化し、晴れても13秒の効果は継続',()=>{
 const {state,caster,target}=setup('SC009'); target.team='Player'; target.nation='Other';state.rainRemainingSeconds=1;
 assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0),true);
 abilities.tickAbilities(state,config,1);
 assert.equal(state.rainRemainingSeconds,0);
 assert.equal(abilities.effectiveMoveSpeedMultiplier(state,config,caster),1.5);
 assert.equal(abilities.effectiveMoveSpeedMultiplier(state,config,target),1);
 abilities.tickAbilities(state,config,12);
 assert.equal(abilities.effectiveMoveSpeedMultiplier(state,config,caster),1);
});
test('ローレライは雨の時だけ全域の敵効果を解除、味方は維持',()=>{
 const {state,caster,target}=setup('SC002');abilities.tryUseAbility(state,config,caster.unitId,0);
 caster.abilityEffects=[{abilityId:'SC018',sourceUnitId:caster.unitId,castId:2,kind:'intelligence',amount:3,remainingSeconds:70}];
 caster.cardId='SC017';caster.abilityAp=1;target.position={x:5,y:-4};
 assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0),false);
 state.rainRemainingSeconds=1;assert.equal(abilities.tryUseAbility(state,config,caster.unitId,0),true);
 assert.deepEqual(target.abilityEffects,[]);assert.equal(effectiveIntelligence(caster),caster.baseIntelligence+3);
});
test('ステラのINT上昇は個別期限で累積し、次のダメージに反映',()=>{
 const {state,caster,target}=setup('SC018');state.units=[caster];
 abilities.tryUseAbility(state,config,caster.unitId,0); abilities.tickAbilities(state,config,10);
 caster.abilityAp=3; abilities.tryUseAbility(state,config,caster.unitId,0);
 assert.equal(effectiveIntelligence(caster),caster.baseIntelligence+6);
 state.units.push(target);caster.cardId='SC015';caster.abilityAp=3;caster.position.y=1;target.currentHp=1000;
 abilities.tryUseAbility(state,config,caster.unitId,0); assert.ok(Math.abs(target.currentHp-336)<1e-8);
 abilities.tickAbilities(state,config,60);assert.equal(effectiveIntelligence(caster),caster.baseIntelligence+3);
 abilities.tickAbilities(state,config,10);assert.equal(effectiveIntelligence(caster),caster.baseIntelligence);
});
test('ティアーズの抽選は敵・自身を含み、プレビューは乱数を消費しない',()=>{
 const {state,caster,target}=setup('SC020');
 assert.deepEqual(abilityTargets(state,config,caster.unitId,0).unitIds,[target.unitId,caster.unitId]);
 assert.equal(abilities.canUseAbility(state,config,caster.unitId,0),true); assert.equal(state.recentAbilityEvents.length,0);
 abilities.tryUseAbility(state,config,caster.unitId,0,()=>.999);
 assert.equal(abilities.effectiveMoveSpeedMultiplier(state,config,caster),.28);
 assert.equal(state.recentAbilityEvents[0].targets[0].unitId,caster.unitId);
});
test('同じ弱体は再使用で更新、異種ATK効果は加算し下限0',()=>{
 const {state,caster,target}=setup('SC002');abilities.tryUseAbility(state,config,caster.unitId,0);
 abilities.tickAbilities(state,config,10);caster.abilityAp=1;abilities.tryUseAbility(state,config,caster.unitId,0);
 assert.equal(target.abilityEffects.length,1);assert.equal(target.abilityEffects[0].remainingSeconds,13);
 caster.cardId='SC011';caster.abilityAp=3;abilities.tryUseAbility(state,config,caster.unitId,0);
 target.stats.attackDamage=20;assert.equal(abilities.effectiveAttackDamage(target,state,config),0);
});
test('INT補正は1差10％、下限10％',()=>{
 for(const [a,b,m] of [[6,6,1],[6,3,1.3],[3,6,.7],[0,99,.1]]) assert.ok(Math.abs(intelligenceMultiplier(a,b)-m)<1e-9);
});
test('異なる減速倍率は乗算し、吸収の片側死亡は他方を解除しない',()=>{
 const {state,caster,target}=setup('SC005');abilities.tryUseAbility(state,config,caster.unitId,0);
 caster.cardId='SC008';caster.abilityAp=2;abilities.tryUseAbility(state,config,caster.unitId,0);
 assert.equal(abilities.effectiveMoveSpeedMultiplier(state,config,target),.2);
 caster.cardId='SC016';caster.abilityAp=2;abilities.tryUseAbility(state,config,caster.unitId,0);
 const atk=abilities.effectiveAttackDamage(caster,state,config);
 target.currentHp=0;abilities.tickAbilities(state,config,1);
 assert.deepEqual(target.abilityEffects,[]);assert.equal(abilities.effectiveAttackDamage(caster,state,config),atk);
});
