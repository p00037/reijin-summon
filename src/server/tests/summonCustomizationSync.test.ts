import test from 'node:test';
import assert from 'node:assert/strict';
import { Encoder, Decoder } from '@colyseus/schema';
import { createDefaultBattleConfig, createOnlineBattleState, tryExecuteSummon, tickSummonedUnits } from '@reijin-summon/shared';
import { ArenaState, publishBattle } from '../src/rooms/schema/ArenaState.js';
import { MatchController } from '../src/online/matchController.js';

for (const team of ['Player', 'Cpu'] as const) {
  test(`${team}の準備データは相手の補正を編成変更・開始待ち・再戦前にも隠す`, () => {
    const match = new MatchController();
    const opponent = team === 'Player' ? 'Cpu' : 'Player';
    const ownKey = team === 'Player' ? 'playerSummonCustomization' : 'cpuSummonCustomization';
    const enemyKey = team === 'Player' ? 'cpuSummonCustomization' : 'playerSummonCustomization';
    const assertHidden = () => {
      const view = match.privateView(team)!;
      assert.deepEqual(view[enemyKey], { attackBonus: 0, defenseReduction: 0, hpBonus: 0 });
      assert.equal(view[ownKey].attackBonus, 3);
      assert.ok(view.units.every(unit => unit.team === team));
      assert.equal(match.publicView().battle, null);
    };
    match.setDeck(team, ['SC005'], 'raphael');
    assertHidden();
    match.setConnected('Player', true);
    match.setConnected('Cpu', true);
    match.setDeck(opponent, ['SC016', 'SC017'], 'jackpot');
    assertHidden();
    match.setDeck(opponent, ['SC010'], 'raphael');
    assertHidden();
    match.setDeck(opponent, ['SC016', 'SC017'], 'jackpot');
    match.setReady(team, true);
    match.setReady(opponent, true);
    match.advance(4);
    assertHidden();
    match.advance(1);
    const battle = match.publicView().battle!;
    assert.equal(battle[enemyKey].hpBonus, 500);
    assert.equal(battle[ownKey].attackBonus, 3);
    match.finish('Draw', 'test');
    match.requestRematch(team);
    match.requestRematch(opponent);
    assertHidden();
  });
}

test('編成補正と特殊攻撃比率を初回・差分・復帰用全量で同期する', () => {
  const config = createDefaultBattleConfig();
  const battle = createOnlineBattleState(config, {
    Player: { cardIds: ['SC005', 'SC007'], summonId: 'leviathan' },
    Cpu: { cardIds: ['SC016', 'SC017'], summonId: 'jackpot' }
  });
  battle.phase = 'InProgress';
  battle.playerSummonGauge = battle.cpuSummonGauge = 1;
  const source = new ArenaState(), target = new ArenaState();
  const encoder = new Encoder(source), decoder = new Decoder(target);
  publishBattle(source, battle);
  decoder.decode(encoder.encodeAll());
  encoder.discardChanges();
  let data = target.battle!.toJSON();
  assert.deepEqual(data.playerSummonCustomization, { attackBonus: 5, defenseReduction: 0, hpBonus: 0 });
  assert.equal(data.cpuSummonCustomization.attackBonus, 0);
  assert.equal(data.cpuSummonCustomization.hpBonus, 500);
  assert.ok(Math.abs(data.cpuSummonCustomization.defenseReduction - .2) < 1e-7);
  assert.equal(tryExecuteSummon(battle, config, 'Player'), true);
  assert.equal(tryExecuteSummon(battle, config, 'Cpu'), true);
  publishBattle(source, battle);
  decoder.decode(encoder.encode());
  encoder.discardChanges();
  data = target.battle!.toJSON();
  assert.equal(data.summonedUnits[0].attackDamage, 110);
  assert.ok(Math.abs(data.summonedUnits[0].customizationAttackRatio - 1.0476190476190477) < 1e-7);
  assert.equal(data.summonedUnits[1].maxHp, 500);
  assert.equal(data.summonedUnits[1].customizationAttackRatio, 1);
  assert.ok(Math.abs(data.summonedUnits[1].damageMultiplier - .4) < 1e-7);
  tickSummonedUnits(battle, config, .5);
  publishBattle(source, battle);
  decoder.decode(encoder.encode());
  encoder.discardChanges();
  data = target.battle!.toJSON();
  assert.equal(data.summonedUnits[1].currentHp, 440);
  const reconnected = new ArenaState();
  new Decoder(reconnected).decode(encoder.encodeAll());
  assert.deepEqual(reconnected.battle!.toJSON(), data);
});
