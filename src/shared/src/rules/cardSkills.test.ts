import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBattleConfig } from '../core/battleConfig.js';
import { createDeckBattleState } from '../core/deckBattleState.js';
import { findLeader } from '../core/battleState.js';
import { GameSession } from './gameSession.js';
import { effectiveAttackDamage, effectiveMoveSpeed } from './abilityEffects.js';
import { effectiveAttackRange, tryUseAbility } from './abilitySystem.js';
import { damageUnit } from './combatDamage.js';
import { markDefeatedUnits, tickCombat, tickUnitHealing } from './unitSystem.js';
import { tryReviveUnit } from './resurrectionSystem.js';

function setup(cards: string[], enemies = ['SC010'], random = () => 0.99) {
  const config = createDefaultBattleConfig();
  const state = createDeckBattleState(config, cards, enemies, 'raphael', () => 0);
  state.phase = 'InProgress';
  for (const unit of state.units) {
    unit.position = { x: 0, y: unit.team === 'Player' ? -1 : 1 };
    unit.destination = { ...unit.position };
    unit.attackTimerSeconds = 100;
    unit.leaderAttackTimerSeconds = 100;
  }
  return { config, state, session: new GameSession(config, state, random), unit: state.units[0] };
}

for (const [id, hp] of [['SC001', 605], ['SC012', 1131], ['SC014', 1040]] as const) {
  test(`${id}の不屈は100秒で通常攻撃を軽減する`, () => {
    const { config, state, unit } = setup([id]);
    state.remainingSeconds = 100.01;
    damageUnit(unit, 100, 'normal', state);
    state.remainingSeconds = 100;
    damageUnit(unit, 100, 'normal', state);
    assert.equal(unit.currentHp, hp);
  });
}
test('不屈は召喚攻撃と既存防御に乗算し、アビリティは軽減しない', () => {
  const { state, unit } = setup(['SC012']);
  state.remainingSeconds = 100;
  unit.abilityEffects = [{ abilityId: 'SC007', sourceUnitId: unit.unitId, castId: 1, kind: 'defense', amount: .7, remainingSeconds: 10 }];
  damageUnit(unit, 100, 'summon', state);
  damageUnit(unit, 100, 'ability', state);
  assert.equal(unit.currentHp, 1155);
});
test('底力は召喚士HPの各境界で段階加算し、50%以下だけ加速する', () => {
  const { config, state, unit } = setup(['SC003']);
  const leader = findLeader(state, 'Player');
  for (const [hp, atk, speed] of [[6001, 53, .205], [6000, 58, .205], [4000, 63, .230625], [2000, 68, .230625]]) {
    leader.currentHp = hp;
    assert.equal(effectiveAttackDamage(unit, state, config), atk);
    assert.ok(Math.abs(effectiveMoveSpeed(state, config, unit) - speed) < 1e-9);
  }
  leader.currentHp = 8000;
  assert.equal(effectiveAttackDamage(unit, state, config), 53);
});
test('狂戦士は敵半面だけ有効で中央線と後攻視点に対応する', () => {
  const { config, state, unit } = setup(['SC005'], ['SC005']);
  unit.position.y = 0;
  assert.equal(effectiveAttackDamage(unit, state, config), 46);
  unit.position.y = .01;
  assert.equal(effectiveAttackDamage(unit, state, config), 48);
  const enemy = state.units[1];
  enemy.position.y = -.01;
  assert.equal(effectiveAttackDamage(enemy, state, config), 48);
});
test('士気旺盛は200秒を含み、時間制弱体と合算する', () => {
  const { config, state, unit } = setup(['SC007']);
  unit.abilityEffects = [{ abilityId: 'SC002', sourceUnitId: unit.unitId, castId: 1, kind: 'attack', amount: -14, remainingSeconds: 13 }];
  state.remainingSeconds = 200;
  assert.equal(effectiveAttackDamage(unit, state, config), 18);
  state.remainingSeconds = 199.99;
  assert.equal(effectiveAttackDamage(unit, state, config), 15);
});
test('逆境はHP20%で有効になり、回復すると解除する', () => {
  const { config, state, unit } = setup(['SC009']);
  unit.currentHp = 212.4;
  assert.equal(effectiveAttackDamage(unit, state, config), 89);
  unit.currentHp = 212.41;
  assert.equal(effectiveAttackDamage(unit, state, config), 59);
});
test('追撃は敵召喚士HP30%で有効になる', () => {
  const { config, state, unit } = setup(['SC019']);
  findLeader(state, 'Cpu').currentHp = 2400;
  assert.equal(effectiveAttackDamage(unit, state, config), 71);
  findLeader(state, 'Cpu').currentHp = 2401;
  assert.equal(effectiveAttackDamage(unit, state, config), 55);
});
test('雨の強化はATKと実際の移動に反映し、晴れると終了する', () => {
  const { config, state, unit, session } = setup(['SC015']);
  state.rainRemainingSeconds = 10;
  unit.destination = { x: 3, y: -1 };
  assert.equal(effectiveAttackDamage(unit, state, config), 85);
  session.tick(1);
  assert.ok(Math.abs(unit.position.x - .230625) < 1e-8);
  state.rainRemainingSeconds = 0;
  assert.equal(effectiveAttackDamage(unit, state, config), 75);
  assert.equal(effectiveMoveSpeed(state, config, unit), .205);
});
test('集約する魔力は保持APに追従し、拡大射程で実際に攻撃する', () => {
  const { config, state, unit } = setup(['SC017']);
  unit.position = { x: 0, y: -1 };
  unit.destination = { ...unit.position };
  state.units[1].position = { x: 0, y: 3 };
  unit.attackTimerSeconds = 0;
  unit.abilityAp = 1;
  assert.equal(effectiveAttackDamage(unit, state, config), 50);
  assert.ok(Math.abs(effectiveAttackRange(unit, config) - 4.76) < 1e-9);
  tickCombat(state, config, 0);
  assert.equal(state.units[1].currentHp, 490);
  state.rainRemainingSeconds = 1;
  assert.equal(tryUseAbility(state, config, unit.unitId, 0), true);
  assert.equal(effectiveAttackDamage(unit, state, config), 47);
  assert.equal(effectiveAttackRange(unit, config), 3.5);
});
test('シリカは死亡1回につき6.75ポイントだけ増加し、上限100%', () => {
  const { config, state, unit } = setup(['SC002']);
  state.playerSummonGauge = .95;
  unit.currentHp = 0;
  markDefeatedUnits(state, config, () => 0);
  assert.equal(state.playerSummonGauge, 1);
  markDefeatedUnits(state, config, () => 0);
  state.playerMp = 10;
  tryReviveUnit(state, config, 'Player', unit.unitId, config.playerLeaderPosition);
  state.playerSummonGauge = 0;
  unit.currentHp = 0;
  markDefeatedUnits(state, config, () => 0);
  assert.equal(state.playerSummonGauge, .0675);
});
test('召喚中の精霊の願いを持ち越さない', () => {
  const { state, unit, session } = setup(['SC002']);
  state.playerSummonGauge = 1;
  session.applyCommand({ commandType: 'Summon', team: 'Player' });
  unit.currentHp = 0;
  session.tick(0);
  assert.equal(state.playerSummonGauge, 0);
});
test('クリンは死亡前APを渡し、自然回復の進捗は保持する', () => {
  const { config, state, unit } = setup(['SC004', 'SC019']);
  const ally = state.units[1];
  unit.abilityAp = 3;
  ally.abilityAp = 1;
  ally.abilityRecoverySeconds = 7;
  unit.currentHp = 0;
  markDefeatedUnits(state, config, () => 0);
  assert.equal(ally.abilityAp, 4);
  assert.equal(ally.abilityRecoverySeconds, 7);
  assert.equal(unit.abilityAp, 0);
});
test('セレは自身のレベル×200回復し、ザンダーには4/3倍する', () => {
  const { config, state, unit } = setup(['SC006', 'SC016']);
  const ally = state.units[1];
  ally.currentHp = 100;
  unit.currentHp = 0;
  markDefeatedUnits(state, config, () => 0);
  assert.ok(Math.abs(ally.currentHp - 633.3333333333) < 1e-7);
});
test('全てを飲み込む力は回復エリアと待機回復へ反映する', () => {
  const { config, state, unit } = setup(['SC016']);
  unit.position = { ...config.playerLeaderPosition };
  unit.destination = { ...unit.position };
  unit.currentHp = 100;
  tickUnitHealing(state, config, 2);
  assert.ok(Math.abs(unit.currentHp - 379.4666666667) < 1e-7);
});
for (const id of ['SC013', 'SC020']) {
  test(`${id}は50%未満の抽選でレベル分MP回復、50%で失敗する`, () => {
    for (const [roll, mp] of [[.4999, 3], [.5, 0]]) {
      const { config, state, unit } = setup([id]);
      unit.currentHp = 0;
      markDefeatedUnits(state, config, () => roll);
      assert.equal(state.playerMp, mp);
    }
  });
}
test('撤退のMP回復は上限まで、途中進捗も正しく処理する', () => {
  const { config, state, unit } = setup(['SC020']);
  state.playerMp = 9;
  state.playerMpRecoveryProgress = .5;
  state.playerLeaderDamageProgress = 300;
  unit.currentHp = 0;
  markDefeatedUnits(state, config, () => .49);
  assert.equal(state.playerMp, 10);
  assert.equal(state.playerMpRecoveryProgress, 0);
  assert.equal(state.playerLeaderDamageProgress, 0);
});
for (const id of ['SC008', 'SC011']) {
  test(`${id}は最後の攻撃者だけ50%でAP1回復する`, () => {
    for (const [roll, ap] of [[.4999, 1], [.5, 0]]) {
      const { config, state, unit } = setup([id]);
      state.units[1].position = { x: 0, y: -.5 };
      state.units[1].currentHp = 1;
      unit.attackTimerSeconds = 0;
      tickCombat(state, config, 0, false, () => roll);
      assert.equal(unit.abilityAp, ap);
    }
  });
}
test('士気高揚はエレメンタル破壊で発動しない', () => {
  const { config, state, unit } = setup(['SC008']);
  state.units = [unit];
  state.elementals = [{ elementalId: 'Elemental1', team: 'Cpu', position: { x: 0, y: -.5 }, maxHp: 1, currentHp: 1, isComplete: true }];
  unit.attackTimerSeconds = 0;
  tickCombat(state, config, 0, false, () => 0);
  assert.equal(unit.abilityAp, 0);
});
test('ステラは30%未満でその場に全HP復活し、AP・建築・効果をリセットする', () => {
  const { config, state, unit } = setup(['SC018']);
  unit.mode = 'BuildingElemental';
  unit.pendingElementalId = 'Elemental1';
  unit.buildTimerSeconds = 3;
  unit.abilityAp = 2;
  unit.destination = { x: 3, y: -1 };
  unit.abilityEffects = [{ abilityId: 'SC018', sourceUnitId: unit.unitId, castId: 1, kind: 'intelligence', amount: 3, remainingSeconds: 70 }];
  unit.currentHp = 0;
  markDefeatedUnits(state, config, () => .2999);
  assert.equal(unit.mode, 'Active');
  assert.equal(unit.currentHp, 1025);
  assert.deepEqual(unit.destination, unit.position);
  assert.equal(unit.pendingElementalId, null);
  assert.equal(unit.buildTimerSeconds, 0);
  assert.equal(unit.abilityAp, 0);
  assert.deepEqual(unit.abilityEffects, []);
  assert.equal(state.playerMp, 0);
  unit.currentHp = 0;
  markDefeatedUnits(state, config, () => .3);
  assert.equal(unit.mode, 'Defeated');
});
test('同時死亡した味方に癒しを渡さず、死亡したカードを生き返らせない', () => {
  const { config, state, unit } = setup(['SC006', 'SC010']);
  state.units[1].currentHp = 0;
  unit.currentHp = 0;
  markDefeatedUnits(state, config, () => 0);
  assert.equal(state.units[1].currentHp, 0);
  assert.equal(state.units[1].mode, 'Defeated');
});
test('ダメージアビリティと召喚獣の撃破からも死亡スキルが発動する', () => {
  for (const kind of ['ability', 'summon'] as const) {
    const { state, unit, session } = setup(['SC002']);
    damageUnit(unit, 1000, kind, state);
    session.tick(0);
    assert.equal(state.playerSummonGauge, .0675);
  }
});
test('試合終了後は死亡スキルを発動しない', () => {
  const { config, state, unit } = setup(['SC002']);
  state.result = 'CpuWin';
  unit.currentHp = 0;
  markDefeatedUnits(state, config, () => 0);
  assert.equal(state.playerSummonGauge, 0);
});

test('APの受渡しは上限で止まり、能力なしの味方も抽選対象に含む', () => {
  const { config, state, unit } = setup(['SC004', 'SC019', 'SC010']);
  const ally = state.units[1]; ally.abilityAp = 4; ally.abilityRecoverySeconds = 12;
  unit.abilityAp = 3; unit.currentHp = 0;
  markDefeatedUnits(state, config, () => 0);
  assert.equal(ally.abilityAp, 5); assert.equal(ally.abilityRecoverySeconds, 0);
  state.playerMp = 10;
  tryReviveUnit(state, config, 'Player', unit.unitId, config.playerLeaderPosition);
  unit.abilityAp = 3; unit.currentHp = 0;
  markDefeatedUnits(state, config, () => .99);
  assert.equal(state.units[2].abilityAp, 0);
  assert.equal(ally.abilityAp, 5);
});

test('死亡前APを次の更新より先に保存し、AP0の撤退では抽選しない', () => {
  const { state, unit, session } = setup(['SC004', 'SC019'], ['SC010'], () => 0);
  unit.abilityAp = 3; unit.currentHp = 0;
  session.tick(0);
  assert.equal(state.units[1].abilityAp, 3);
  const other = setup(['SC004', 'SC019']);
  other.unit.currentHp = 0;
  markDefeatedUnits(other.state, other.config, () => { assert.fail('AP0の死亡で対象抽選しない'); });
  assert.equal(other.state.units[1].abilityAp, 0);
});

test('癒しはHP満タンの味方も抽選に含み、上限までの実回復量を通知する', () => {
  const { config, state, unit } = setup(['SC006', 'SC016', 'SC010']);
  const ally = state.units[1]; ally.currentHp = ally.stats.maxHp - 100;
  unit.currentHp = 0;
  markDefeatedUnits(state, config, () => .99);
  assert.equal(ally.currentHp, ally.stats.maxHp - 100);
  assert.deepEqual(state.recentSkillEvents, []);
  state.playerMp = 10;
  tryReviveUnit(state, config, 'Player', unit.unitId, config.playerLeaderPosition);
  unit.currentHp = 0;
  markDefeatedUnits(state, config, () => 0);
  assert.equal(ally.currentHp, ally.stats.maxHp);
  assert.equal(state.recentSkillEvents[0].amount, 100);
});

test('複数の攻撃者のうち致死攻撃者だけAPを獲得し、後続攻撃で上書きしない', () => {
  const { config, state } = setup(['SC008', 'SC011']);
  const [first, second, target] = state.units;
  damageUnit(target, 20, 'normal', state, first.unitId);
  damageUnit(target, 1000, 'normal', state, second.unitId);
  damageUnit(target, 1000, 'normal', state, first.unitId);
  markDefeatedUnits(state, config, () => 0);
  assert.equal(first.abilityAp, 0);
  assert.equal(second.abilityAp, 1);
  markDefeatedUnits(state, config, () => { assert.fail('同じ撃破を再抽選しない'); });
});

test('士気高揚はAP上限までで、ステラが復活しても撃破を記録する', () => {
  const { config, state, unit } = setup(['SC008'], ['SC018']);
  unit.abilityAp = 2; unit.abilityRecoverySeconds = 12;
  const enemy = state.units[1];
  damageUnit(enemy, 2000, 'normal', state, unit.unitId);
  markDefeatedUnits(state, config, () => 0);
  assert.equal(unit.abilityAp, 2); assert.equal(unit.abilityRecoverySeconds, 0);
  assert.equal(enemy.mode, 'Active'); assert.equal(enemy.currentHp, enemy.stats.maxHp);
});

test('両陣営の撤退スキルはサーバー用に注入された同じ抽選を使う', () => {
  let rolls = 0;
  const { state, session } = setup(['SC020'], ['SC013'], () => { rolls++; return .49; });
  for (const unit of state.units) unit.currentHp = 0;
  session.tick(0);
  assert.equal(rolls, 2);
  assert.equal(state.playerMp, 3); assert.equal(state.cpuMp, 3);
  session.tick(0);
  assert.equal(rolls, 2);
});

test('アビリティの実行コマンドからダメージ死亡のスキルを確定する', () => {
  const { state, unit, session } = setup(['SC002'], ['SC015']);
  const enemy = state.units[1]; enemy.position = {x: 0, y: -1}; enemy.abilityAp = 3;
  unit.currentHp = 1;
  session.applyCommand({commandType: 'UseAbility', team: 'Cpu', unitId: enemy.unitId, facingRotation: Math.PI});
  assert.equal(unit.mode, 'Defeated');
  assert.equal(state.playerSummonGauge, .0675);
});

test('召喚コマンドの全体攻撃による死亡と防御軽減を確定する', () => {
  const { state, unit, session } = setup(['SC002', 'SC012']);
  const ally = state.units[1];
  state.remainingSeconds = 100; state.cpuSummonGauge = 1; state.cpuSummonId = 'leviathan';
  unit.currentHp = 1;
  session.applyCommand({commandType: 'Summon', team: 'Cpu'});
  assert.equal(unit.mode, 'Defeated'); assert.equal(state.playerSummonGauge, .0675);
  assert.equal(ally.currentHp, ally.stats.maxHp - 100 * .8);
});

test('ステラの成功後の死亡も抽選し、同時死亡の癒し対象にはしない', () => {
  const { config, state, unit } = setup(['SC006', 'SC018']);
  const ally = state.units[1]; unit.currentHp = 0; ally.currentHp = 0;
  markDefeatedUnits(state, config, () => 0);
  assert.equal(unit.mode, 'Defeated'); assert.equal(ally.currentHp, ally.stats.maxHp);
  assert.equal(state.recentSkillEvents.length, 1);
  ally.currentHp = 0;
  markDefeatedUnits(state, config, () => .2);
  assert.equal(ally.mode, 'Active'); assert.equal(state.recentSkillEvents.length, 2);
});
