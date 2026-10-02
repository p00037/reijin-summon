import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBattleConfig } from '../core/battleConfig.js';
import { createDefaultBattleState } from '../core/battleState.js';
import { GameSession } from './gameSession.js';
import { tickCombat } from './unitSystem.js';
import { tryUseAbility } from './abilitySystem.js';
import { damageUnit } from './combatDamage.js';
import { tryExecuteSummon } from './summonSystem.js';

test('通常攻撃にはローズクォーツ防御が適用される',()=>{
  const config=createDefaultBattleConfig(),state=createDefaultBattleState(config);
  state.phase='InProgress'; const [attacker,,,target]=state.units;
  state.units=[attacker,target]; attacker.position={x:0,y:0}; target.position={x:0,y:.8};
  attacker.stats.attackDamage=100;
  target.cardId='SC007'; target.abilityAp=1;
  state.elementals=Array.from({length:6},(_,i)=>({elementalId:`Elemental${i+1}` as 'Elemental1',team:'Cpu',nation:target.nation,position:{x:4,y:4},maxHp:100,currentHp:100,isComplete:true,enchantments:[]}));
  tryUseAbility(state,config,target.unitId,0);
  const hp=target.currentHp; tickCombat(state,config,0);
  assert.equal(target.currentHp,hp-70);
});
test('防御軽減は召喚獣攻撃に適用しダメージアビリティには適用しない',()=>{
 const state=createDefaultBattleState(createDefaultBattleConfig()),target=state.units[0];
 target.currentHp=500;target.abilityEffects=[{abilityId:'SC007',sourceUnitId:target.unitId,castId:1,kind:'defense',amount:.7,remainingSeconds:10}];
 damageUnit(target,100,'summon');assert.equal(target.currentHp,430);
 damageUnit(target,100,'ability');assert.equal(target.currentHp,330);
});
test('ATK0の通常攻撃はユニット・エレメント・召喚獣・召喚士へダメージ0',()=>{
 for(const kind of ['unit','elemental','summon','leader']) {
  const config=createDefaultBattleConfig(),state=createDefaultBattleState(config),attacker=state.units[0],enemy=state.units[3];
  state.units=[attacker];attacker.position={x:0,y:0};attacker.stats.attackDamage=0;
  const position={x:0,y:.5};let target:{currentHp:number};
  if(kind==='unit') {enemy.position=position;state.units.push(enemy);target=enemy;}
  else if(kind==='elemental') {const elemental={elementalId:'Elemental1' as const,team:'Cpu' as const,position,maxHp:100,currentHp:100,isComplete:true};state.elementals.push(elemental);target=elemental;}
  else if(kind==='leader') {target=state.leaders[1];state.leaders[1].position=position;}
  else {state.cpuSummonGauge=1;tryExecuteSummon(state,config,'Cpu');state.summonedUnits[0].position=position;target=state.summonedUnits[0];}
  const hp=target.currentHp;tickCombat(state,config,0);assert.equal(target.currentHp,hp,kind);
 }
});
test('大津波による撃破は直ちに死亡処理しAPと効果を消す',()=>{
  const session=new GameSession(),state=session.state; state.phase='InProgress';
  const [caster,,,target]=state.units;
  caster.cardId='SC015'; caster.abilityAp=3; caster.position.y=1;
  target.currentHp=100; target.abilityAp=2;
  session.applyCommand({commandType:'UseAbility',team:'Player',unitId:caster.unitId as 'PlayerMelee',facingRotation:0});
  assert.equal(target.mode,'Defeated'); assert.equal(target.abilityAp,0);
});
test('長いtickでも細分化したtickと効果・移動・APが一致する',()=>{
  const a=new GameSession(),b=new GameSession();
  for(const session of [a,b]) {
    session.state.phase='InProgress'; session.state.units=session.state.units.slice(0,1);
    const unit=session.state.units[0]; unit.cardId='SC007'; unit.abilityAp=1; unit.destination={x:0,y:0};
    tryUseAbility(session.state,session.config,unit.unitId,0);
    unit.abilityEffects.forEach(e=>e.remainingSeconds=.25);
    unit.abilityEffects.find(e=>e.kind==='speed')!.amount=2;
  }
  a.tick(.5); for(let i=0;i<30;i++) b.tick(1/60);
  assert.ok(Math.abs(a.state.units[0].position.x-b.state.units[0].position.x)<1e-8);
});
