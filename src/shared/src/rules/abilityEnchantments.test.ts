import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBattleConfig } from '../core/battleConfig.js';
import { createDefaultBattleState } from '../core/battleState.js';
import { tryUseAbility, tickAbilities, effectiveMoveSpeedMultiplier, effectiveAttackDamage } from './abilitySystem.js';
import { tryExecuteSummon } from './summonSystem.js';
import { removeDestroyedElementals, tickElementalBuilds } from './elementalSystem.js';

const config = createDefaultBattleConfig();
function setup(cardId: string) {
  const state = createDefaultBattleState(config); state.phase = 'InProgress';
  const unit = state.units[0]; unit.cardId = cardId; unit.abilityAp = 5;
  state.units = [unit]; unit.position = {x:0,y:0};
  state.elementals = [1,2].map(n => ({elementalId: `Elemental${n}` as 'Elemental1'|'Elemental2',team:'Player',nation:'ScaleGuild',position:{x:0,y:0},maxHp:100,currentHp:100,isComplete:true,enchantments:[]}));
  return {state,unit};
}
test('速度オーラは固定加算・非重複、異種付与は併存しシャコ貝は基数加算', () => {
  const {state,unit} = setup('SC003');
  assert.equal(tryUseAbility(state,config,unit.unitId,0),true);
  unit.stats.moveSpeed = 1;
  assert.equal(effectiveMoveSpeedMultiplier(state,config,unit),1+config.statsByType.Melee.moveSpeed/2);
  unit.cardId='SC019'; unit.abilityAp=5;
  assert.equal(tryUseAbility(state,config,unit.unitId,0),true);
  unit.team='Cpu';
  assert.equal(effectiveAttackDamage(unit,state,config),unit.stats.attackDamage-22);
  assert.equal(state.elementals[0].enchantments!.length,2);
  state.elementals[0].currentHp=0;
  assert.equal(effectiveAttackDamage(unit,state,config),unit.stats.attackDamage-11);
  unit.position.x=5;
  assert.equal(effectiveAttackDamage(unit,state,config),unit.stats.attackDamage);
});
test('召喚中の周期は持ち越さず、グーはAPを保持する',()=>{
 const {state,unit}=setup('SC014');
 tryUseAbility(state,config,unit.unitId,0);state.playerSummonGauge=1;
 assert.equal(tryExecuteSummon(state,config,'Player'),true);
 tickAbilities(state,config,20);assert.equal(state.playerSummonGauge,0);
 unit.cardId='SC012';unit.abilityAp=2;
 assert.equal(tryUseAbility(state,config,unit.unitId,0),false);assert.equal(unit.abilityAp,2);
 state.summonedUnits=[];tickAbilities(state,config,19);assert.equal(state.playerSummonGauge,0);
 tickAbilities(state,config,1);assert.ok(Math.abs(state.playerSummonGauge-.1)<1e-8);
});
test('破壊後に同じIDを再建しても付与と周期は継承しない',()=>{
 const {state,unit}=setup('SC014');state.elementals=state.elementals.slice(0,1);
 tryUseAbility(state,config,unit.unitId,0);tickAbilities(state,config,19);
 state.elementals[0].currentHp=0;removeDestroyedElementals(state);
 unit.mode='BuildingElemental';unit.pendingElementalId='Elemental1';unit.buildTimerSeconds=1;
 tickElementalBuilds(state,config,1);
 assert.equal(state.elementals[0].nation,unit.nation);assert.deepEqual(state.elementals[0].enchantments,[]);
 tickAbilities(state,config,20);assert.equal(state.playerSummonGauge,0);
});
test('アウインは初回20秒・再付与で周期を維持し複数基が独立加算', () => {
  const {state,unit} = setup('SC014');
  tryUseAbility(state,config,unit.unitId,0);
  tickAbilities(state,config,19.999); assert.equal(state.playerSummonGauge,0);
  unit.abilityAp=4; tryUseAbility(state,config,unit.unitId,0);
  tickAbilities(state,config,.001); assert.ok(Math.abs(state.playerSummonGauge-.1)<1e-8);
  tickAbilities(state,config,40); assert.ok(Math.abs(state.playerSummonGauge-.3)<1e-8);
});
test('未完成・敵国エレメントは付与対象外、Setupと終了後は時間停止', () => {
  const {state,unit} = setup('SC003');
  state.elementals[0].isComplete=false; state.elementals[1].nation='Other';
  assert.equal(tryUseAbility(state,config,unit.unitId,0),false);
  state.rainRemainingSeconds=10; state.phase='Setup'; unit.abilityAp=0;
  tickAbilities(state,config,30); assert.equal(state.rainRemainingSeconds,10); assert.equal(unit.abilityAp,0);
  state.phase='InProgress'; state.result='Draw'; tickAbilities(state,config,30); assert.equal(state.rainRemainingSeconds,10);
});
