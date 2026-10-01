import test from 'node:test';
import assert from 'node:assert/strict';
import { Encoder, Decoder } from '@colyseus/schema';
import { createDefaultBattleConfig, createDefaultBattleState, tryUseAbility, tickAbilities } from '@reijin-summon/shared';
import { ArenaState, publishBattle } from '../src/rooms/schema/ArenaState.js';
import { MatchController } from '../src/online/matchController.js';

test('エンチャントの全実対象を空配列から差分配信し全量配信でも保持する', () => {
  const config = createDefaultBattleConfig(), battle = createDefaultBattleState(config);
  battle.phase = 'InProgress';
  const source = new ArenaState(), destination = new ArenaState();
  const encoder = new Encoder(source), decoder = new Decoder(destination);
  publishBattle(source, battle);
  decoder.decode(encoder.encodeAll());
  encoder.discardChanges();
  const unit = battle.units[0];
  unit.position = { x: 0, y: 0 };
  battle.elementals = [
    { elementalId: 'Elemental1', team: 'Player', nation: unit.nation, position: { x: 2, y: 0 }, maxHp: 100, currentHp: 100, isComplete: true, enchantments: [] },
    { elementalId: 'Elemental2', team: 'Player', nation: unit.nation, position: { x: -1, y: 1 }, maxHp: 100, currentHp: 100, isComplete: true, enchantments: [] }
  ];
  const expected = battle.elementals.map(elemental => ({ elementalId: elemental.elementalId, position: { ...elemental.position } }));
  for (const cardId of ['SC003', 'SC014', 'SC019']) {
    unit.cardId = cardId;
    unit.abilityAp = 5;
    assert.equal(tryUseAbility(battle, config, unit.unitId, 0), true);
    publishBattle(source, battle);
    decoder.decode(encoder.encode());
    encoder.discardChanges();
    assert.deepEqual(destination.battle!.toJSON().recentAbilityEvents.at(-1).elementalTargets, expected);
  }
  const full = new ArenaState();
  new Decoder(full).decode(encoder.encodeAll());
  assert.deepEqual(full.battle!.toJSON().recentAbilityEvents, destination.battle!.toJSON().recentAbilityEvents);
});
test('空の効果配列から付与・雨・エンチャント・イベント・期限削除を配信できる',()=>{
  const config=createDefaultBattleConfig(),battle=createDefaultBattleState(config); battle.phase='InProgress';
  const source=new ArenaState(),destination=new ArenaState();
  const encoder=new Encoder(source),decoder=new Decoder(destination);
  publishBattle(source,battle); decoder.decode(encoder.encodeAll()); encoder.discardChanges();
  const unit=battle.units[0]; unit.cardId='SC007'; unit.abilityAp=1;
  tryUseAbility(battle,config,unit.unitId,0); battle.rainRemainingSeconds=100;
  battle.elementals.push({elementalId:'Elemental1',team:'Player',nation:'ScaleGuild',position:{x:1,y:1},maxHp:100,currentHp:100,isComplete:true,enchantments:[{kind:'speed',elapsedSeconds:0},{kind:'gauge',elapsedSeconds:19}]});
  publishBattle(source,battle); decoder.decode(encoder.encode()); encoder.discardChanges();
  const data=destination.battle!.toJSON();
  assert.equal(data.units[0].abilityEffects.length,2); assert.equal(data.rainRemainingSeconds,100);
  assert.equal(data.elementals[0].enchantments.length,2); assert.equal(data.recentAbilityEvents[0].targets[0].unitId,unit.unitId);
  tickAbilities(battle,config,10); publishBattle(source,battle); decoder.decode(encoder.encode());
  assert.equal(destination.battle!.toJSON().units[0].abilityEffects.length,0);
});

test('オンライン両陣営は自分のアビリティを発動でき、抽選結果はサーバーの1対象だけ',()=>{
 const match=new MatchController();
 for(const team of ['Player','Cpu'] as const) {
  match.setConnected(team,true);match.setDeck(team,['SC002','SC003'],'raphael');match.setReady(team,true);
 }
 match.advance(5);const view=match.publicView(),battle=view.battle!;
 for(const unit of battle.units) {unit.position={x:0,y:unit.team==='Player'?-1:1};unit.abilityAp=5;}
 for(const team of ['Player','Cpu'] as const) {
  const own=`${team}:SC002` as 'Player:SC002'|'Cpu:SC002';
  const foreign=team==='Player'?'Cpu:SC002':'Player:SC002';
  assert.equal(match.apply(team,{version:1,matchId:view.matchId,sequence:1,command:{commandType:'UseAbility',team,unitId:foreign,facingRotation:0}} as any).ok,false);
  assert.equal(match.apply(team,{version:1,matchId:view.matchId,sequence:2,command:{commandType:'UseAbility',team,unitId:own,facingRotation:team==='Player'?0:Math.PI}} as any).ok,true);
  const event=battle.recentAbilityEvents.at(-1)!;
  assert.equal(event.sourceUnitId,own);assert.equal(event.targets.length,1);
  assert.ok(event.targets[0].unitId.startsWith(team==='Player'?'Cpu:':'Player:'));
 }
 const schema=new ArenaState();publishBattle(schema,battle);
 assert.equal(schema.battle!.toJSON().recentAbilityEvents.length,2);
});
