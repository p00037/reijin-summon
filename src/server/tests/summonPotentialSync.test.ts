import test from 'node:test';
import assert from 'node:assert/strict';
import { Encoder, Decoder } from '@colyseus/schema';
import { createDefaultBattleConfig, createDefaultBattleState, findLeader, tryExecuteSummon, tickAbilities } from '@reijin-summon/shared';

test('潜在の発動・引き寄せ・復活保護を全量と差分で同期する', async () => {
  await assert.doesNotReject(() => import('../src/rooms/schema/ArenaState.js'), '潜在イベントの空配列を含む共有状態から同期スキーマを生成できる');
  const { ArenaState, publishBattle } = await import('../src/rooms/schema/ArenaState.js');
  const config = createDefaultBattleConfig(), battle = createDefaultBattleState(config);
  battle.phase = 'InProgress'; battle.playerSummonId = 'bahamut'; battle.playerSummonGauge = 1;
  findLeader(battle, 'Player').currentHp = 2400;
  const source = new ArenaState(), destination = new ArenaState();
  const encoder = new Encoder(source), decoder = new Decoder(destination);
  publishBattle(source, battle); decoder.decode(encoder.encodeAll()); encoder.discardChanges();
  tryExecuteSummon(battle, config, 'Player');
  publishBattle(source, battle); decoder.decode(encoder.encode()); encoder.discardChanges();
  let data = destination.battle!.toJSON();
  assert.equal(data.recentSummonPotentialEvents.length, 1);
  assert.equal(data.recentSummonPotentialEvents[0].summonId, 'bahamut');
  assert.equal(data.recentSummonPotentialEvents[0].eventId, 1);
  assert.equal(data.recentSummonPotentialEvents[0].targets.length, 3);
  assert.equal(data.summonedUnits[0].potentialActive, true);
  assert.equal(data.summonedUnits[0].attackDamage, 139);
  assert.equal(data.units[3].abilityEffects[0].kind, 'pull');
  assert.equal(data.units[3].abilityEffects[0].sourceSummonedUnitId, 1);
  assert.equal(data.units[3].abilityEffects[0].remainingSeconds, 12);
  assert.ok(Math.abs(data.units[3].abilityEffects[0].amount - .41) < 1e-7);
  const full = new ArenaState(); new Decoder(full).decode(encoder.encodeAll());
  assert.deepEqual(full.battle!.toJSON(), data);
  tickAbilities(battle, config, 12);
  battle.summonedUnits = []; battle.playerSummonId = 'raphael'; battle.playerSummonGauge = 1;
  battle.units[0].mode = 'Defeated'; battle.units[0].currentHp = 0;
  tryExecuteSummon(battle, config, 'Player');
  publishBattle(source, battle); decoder.decode(encoder.encode()); encoder.discardChanges();
  data = destination.battle!.toJSON();
  assert.equal(data.units[3].abilityEffects.length, 0);
  assert.equal(data.units[0].potentialProtectionSeconds, 1);
  assert.equal(data.units[0].currentHp, 660);
  assert.equal(data.nextSummonPotentialEventId, 3);
  battle.recentSummonPotentialEvents = [];
  publishBattle(source, battle); decoder.decode(encoder.encode());
  assert.deepEqual(destination.battle!.toJSON().recentSummonPotentialEvents, []);
});

test('ユグドラシルの発動時対象・MP・最大APを同期する', async () => {
  const { ArenaState, publishBattle } = await import('../src/rooms/schema/ArenaState.js');
  const config = createDefaultBattleConfig(), battle = createDefaultBattleState(config);
  battle.phase = 'InProgress'; battle.playerSummonId = 'yggdrasil'; battle.playerSummonGauge = 1;
  findLeader(battle, 'Player').currentHp = 2400;
  battle.elementals = [
    { elementalId: 'Elemental1', team: 'Player', position: { x: -4, y: 3 }, maxHp: 1000, currentHp: 1000, isComplete: true },
    { elementalId: 'Elemental2', team: 'Player', position: { x: 4, y: 3 }, maxHp: 1000, currentHp: 1000, isComplete: true }
  ];
  battle.units[3].mode = 'Defeated'; battle.units[3].currentHp = 0;
  tryExecuteSummon(battle, config, 'Player');
  const source = new ArenaState(), target = new ArenaState();
  publishBattle(source, battle);
  new Decoder(target).decode(new Encoder(source).encodeAll());
  assert.deepEqual(target.battle!.toJSON().summonedUnits[0].potentialTargets, [{ unitId: 'CpuSpeed' }, { unitId: 'CpuRanged' }]);
  assert.equal(target.battle!.toJSON().playerMp, 3);
  assert.equal(target.battle!.toJSON().units[2].abilityAp, 4);
});
