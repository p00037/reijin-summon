import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBattleConfig } from '../core/battleConfig.js';
import { createDefaultBattleState } from '../core/battleState.js';
import { abilityArea, abilityTargets } from './abilityTargets.js';
const config=createDefaultBattleConfig();
test('S/F/L/Cはカード別寸法を持ち前方円は向きへ追従する',()=>{
 const state=createDefaultBattleState(config),unit=state.units[0];unit.position={x:0,y:0};
 for(const [id,forward,radius] of [['SC006',1,.5],['SC002',1,1],['SC011',1,1.5],['SC003',0,1.5]] as const) {
  unit.cardId=id;const area=abilityArea(state,config,unit.unitId,Math.PI/2)!;
  assert.equal(area.kind,'circle');if(area.kind!=='circle') assert.fail('円が必要');
  assert.ok(Math.abs(area.center.x-config.unitCardWorldHeight*forward)<1e-8);
  assert.ok(Math.abs(area.center.y)<1e-8);assert.equal(area.radius,config.unitCardWorldHeight*radius);
 }
});
test('大津波の中央線は発動者の味方側、中央線上の敵も対象に含む',()=>{
 for(const team of ['Player','Cpu'] as const) {
  const state=createDefaultBattleState(config),caster=state.units.find(u=>u.team===team)!;
  caster.cardId='SC015';caster.position={x:0,y:0};
  const enemy=state.units.find(u=>u.team!==team)!;enemy.position={x:0,y:0};
  state.units=[caster,enemy];assert.deepEqual(abilityTargets(state,config,caster.unitId,0).unitIds,[enemy.unitId]);
  const area=abilityArea(state,config,caster.unitId,0)!;assert.equal(area.kind,'rectangle');
  if(area.kind==='rectangle') assert.equal(team==='Player'?area.max.y:area.min.y,0);
 }
});
test('未知カード・対象外の死亡ユニット・敵エレメントは選択しない',()=>{
 const state=createDefaultBattleState(config),unit=state.units[0];unit.cardId='unknown';
 assert.equal(abilityArea(state,config,unit.unitId,0),null);
 assert.deepEqual(abilityTargets(state,config,unit.unitId,0),{unitIds:[],elementalIds:[]});
 unit.cardId='SC002';state.units[3].position={...unit.position};state.units[3].currentHp=0;
 assert.deepEqual(abilityTargets(state,config,unit.unitId,0).unitIds,[]);
});
