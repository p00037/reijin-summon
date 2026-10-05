import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBattleConfig } from '../core/battleConfig.js';
import { createDefaultBattleState, findLeader } from '../core/battleState.js';
import type { SummonId } from '../core/summonCatalog.js';
import { tryExecuteSummon, tickSummonedUnits } from './summonSystem.js';
import { tickAbilities, tryUseAbility } from './abilitySystem.js';
import { effectiveAttackDamage, effectiveMoveSpeed, unitDamageMultiplier } from './abilityEffects.js';
import { tickMpRecovery, tryReviveUnit } from './resurrectionSystem.js';
import { tickMovement, markDefeatedUnits } from './unitSystem.js';
import { GameSession } from './gameSession.js';
import { potentialPull } from './summonPotential.js';

function fixture(id: SummonId = 'raphael', team: 'Player' | 'Cpu' = 'Player') {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.phase = 'InProgress';
  state.playerSummonId = state.cpuSummonId = id;
  state.playerSummonGauge = state.cpuSummonGauge = 1;
  findLeader(state, team).currentHp = 2400;
  state.elementals = [
    { elementalId: 'Elemental1', team, position: { x: -5, y: 3 }, maxHp: 1000, currentHp: 1000, isComplete: true },
    { elementalId: 'Elemental2', team, position: { x: 5, y: 3 }, maxHp: 1000, currentHp: 1000, isComplete: true }
  ];
  const allies = state.units.filter(u => u.team === team);
  const enemies = state.units.filter(u => u.team !== team);
  // 専用攻撃や接触が検証対象の潜在効果に干渉しない配置。
  allies.forEach((u, i) => { u.position = { x: -5, y: -3 + i }; u.destination = { ...u.position }; });
  enemies.forEach((u, i) => { u.position = { x: 5, y: -3 + i }; u.destination = { ...u.position }; });
  return { config, state, allies, enemies, team };
}

for (const team of ['Player', 'Cpu'] as const) {
  for (const [hp, healed] of [[2401, 100], [2400, 600], [2399, 600]] as const) {
    test(`${team}の潜在発動は召喚時HP30%以下の境界で判定する（HP${hp}）`, () => {
      const { config, state, allies } = fixture('raphael', team);
      findLeader(state, team).currentHp = hp;
      allies[0].currentHp = 100;
      assert.equal(tryExecuteSummon(state, config, team), true);
      assert.equal(allies[0].currentHp, healed);
    });
  }
}

test('召喚失敗では回復・MP・潜在イベントを発生させない', () => {
  const { config, state, allies } = fixture();
  state.playerSummonGauge = .99;
  allies[0].currentHp = 100;
  assert.equal(tryExecuteSummon(state, config, 'Player'), false);
  assert.equal(allies[0].currentHp, 100);
  assert.equal(state.playerMp, 0);
  assert.equal(state.nextSummonedUnitId, 1);
});

test('ラファエルは回復上限を守り、味方だけをHP60%・最大AP半分で無料復活する', () => {
  const { config, state, allies, enemies } = fixture();
  allies[0].currentHp = 900;
  allies[1].currentHp = 0;
  allies[1].mode = 'Defeated';
  allies[2].currentHp = 0;
  allies[2].mode = 'Defeated';
  enemies[0].currentHp = 100;
  state.playerMp = 4;
  tryExecuteSummon(state, config, 'Player');
  assert.equal(allies[0].currentHp, 1100);
  assert.equal(allies[1].currentHp, 636);
  assert.equal(allies[2].currentHp, 615);
  assert.equal(allies[1].abilityAp, 2); // SC019: AP5の半分を切り捨て
  assert.equal(allies[2].abilityAp, 2); // SC014: AP4の半分
  assert.equal(allies[2].abilityRecoverySeconds, 0);
  assert.equal(allies[2].mode, 'Active');
  assert.deepEqual(allies[2].position, config.playerLeaderPosition);
  assert.equal(enemies[0].currentHp, 100);
  assert.equal(state.playerMp, 4);
});

test('通常復活後1秒は潜在回復の対象外となり、期限後は対象になる', () => {
  for (const [elapsed, expected] of [[.999, 100], [1, 600]]) {
    const { config, state, allies } = fixture();
    allies[0].mode = 'Defeated'; allies[0].currentHp = 0;
    state.playerMp = 10;
    assert.equal(tryReviveUnit(state, config, 'Player', allies[0].unitId, config.playerLeaderPosition), true);
    allies[0].currentHp = 100;
    tickAbilities(state, config, elapsed);
    tryExecuteSummon(state, config, 'Player');
    assert.equal(allies[0].currentHp, expected);
  }
});

test('ジャックポットは防御を無視して生存敵へ600ダメージとAPリセットを行う', () => {
  const { config, state, allies, enemies } = fixture('jackpot');
  enemies[0].currentHp = 1000;
  enemies[0].abilityAp = 2;
  enemies[0].abilityRecoverySeconds = 19;
  enemies[0].abilityEffects = [{ abilityId: 'SC007', sourceUnitId: enemies[0].unitId, castId: 1, kind: 'defense', amount: .1, remainingSeconds: 10 }];
  const before = allies[0].currentHp;
  tryExecuteSummon(state, config, 'Player');
  assert.equal(enemies[0].currentHp, 400);
  assert.equal(enemies[0].abilityAp, 0);
  assert.equal(enemies[0].abilityRecoverySeconds, 0);
  assert.equal(allies[0].currentHp, before);
});

test('ジャックポットの潜在ダメージは敵召喚獣にも届き、召喚士は通常の初撃だけ受ける', () => {
  const { config, state } = fixture('jackpot');
  state.cpuSummonId = 'raphael';
  assert.equal(tryExecuteSummon(state, config, 'Cpu'), true);
  const enemy = state.summonedUnits[0];
  enemy.position = { x: 5, y: -3 };
  const before = enemy.currentHp;
  tryExecuteSummon(state, config, 'Player');
  assert.equal(enemy.currentHp, before - 225); // 600 × 0.375
  assert.equal(findLeader(state, 'Cpu').currentHp, 7700);
});

test('ユグドラシルは味方APを最大化しMPを3回復するが、死者と復活直後には付与しない', () => {
  const { config, state, allies } = fixture('yggdrasil');
  allies[0].mode = 'Defeated'; allies[0].currentHp = 0;
  state.playerMp = 8;
  tryReviveUnit(state, config, 'Player', allies[0].unitId, config.playerLeaderPosition);
  allies[1].mode = 'Defeated'; allies[1].currentHp = 0;
  state.playerMp = 9;
  allies[2].abilityRecoverySeconds = 19;
  tryExecuteSummon(state, config, 'Player');
  assert.equal(allies[0].abilityAp, 0);
  assert.equal(allies[1].abilityAp, 0);
  assert.equal(allies[2].abilityAp, 4);
  assert.equal(allies[2].abilityRecoverySeconds, 0);
  assert.equal(state.playerMp, 10);
  assert.equal(state.playerMpRecoveryProgress, 0);
});

test('ユグドラシルのMP加速は召喚中だけ有効で、攻撃時減速は解除できる', () => {
  const { config, state, enemies } = fixture('yggdrasil');
  tryExecuteSummon(state, config, 'Player');
  state.playerMp = 0;
  tickMpRecovery(state, config, 10);
  assert.ok(Math.abs(state.playerMpRecoveryProgress - .6) < 1e-9);
  assert.ok(Math.abs(effectiveMoveSpeed(state, config, enemies[0]) - enemies[0].stats.moveSpeed * .75) < 1e-9);
  enemies[1].cardId = 'SC001'; enemies[1].abilityAp = 1;
  enemies[1].position = { ...enemies[0].position };
  // 三日月の秘法は雨中に全敵の時間制効果を解除。
  const caster = state.units.find(u => u.team === 'Player')!;
  caster.cardId = 'SC017'; caster.abilityAp = 1; state.rainRemainingSeconds = 10;
  assert.equal(tryUseAbility(state, config, caster.unitId, 0), true);
  assert.equal(effectiveMoveSpeed(state, config, enemies[0]), enemies[0].stats.moveSpeed);
  state.summonedUnits[0].currentHp = 0;
  tickSummonedUnits(state, config, 0);
  tickMpRecovery(state, config, 10);
  assert.equal(state.playerMp, 1);
  assert.ok(Math.abs(state.playerMpRecoveryProgress) < 1e-9);
});

test('ユグドラシルの後続攻撃は召喚後に復活した敵へ潜在減速を付与しない', () => {
  const { config, state, enemies } = fixture('yggdrasil');
  enemies[0].mode = 'Defeated'; enemies[0].currentHp = 0;
  tryExecuteSummon(state, config, 'Player');
  state.cpuMp = 10;
  tryReviveUnit(state, config, 'Cpu', enemies[0].unitId, config.cpuLeaderPosition);
  tickAbilities(state, config, 2);
  tickSummonedUnits(state, config, 1.5);
  assert.equal(effectiveMoveSpeed(state, config, enemies[0]), enemies[0].stats.moveSpeed);
});

test('リヴァイアサンは発動時の味方と自身を20秒強化し敵へ追加ダメージを与える', () => {
  const { config, state, allies, enemies } = fixture('leviathan');
  const baseAttack = effectiveAttackDamage(allies[0], state, config);
  tryExecuteSummon(state, config, 'Player');
  const summon = state.summonedUnits[0];
  assert.equal(effectiveAttackDamage(allies[0], state, config), baseAttack + 15);
  assert.ok(Math.abs(effectiveMoveSpeed(state, config, allies[0]) - allies[0].stats.moveSpeed * 1.125) < 1e-9);
  assert.equal(unitDamageMultiplier(allies[0], state), .95);
  assert.equal(summon.attackDamage, 120);
  assert.ok(Math.abs(summon.moveSpeed - 8.2 / 25 * 1.125) < 1e-9);
  assert.ok(Math.abs(summon.damageMultiplier - .325 * .95) < 1e-9);
  assert.equal(enemies[0].currentHp, 600); // 400潜在＋100通常波動
  assert.equal(findLeader(state, 'Cpu').currentHp, 7800);
  tickAbilities(state, config, 20);
  summon.healthDecayPerSecond = 0; summon.position = { x: -5, y: 3 };
  tickSummonedUnits(state, config, 20);
  assert.equal(effectiveAttackDamage(allies[0], state, config), baseAttack);
  assert.equal(summon.attackDamage, 105);
  assert.ok(Math.abs(summon.moveSpeed - 8.2 / 25) < 1e-9);
  assert.ok(Math.abs(summon.damageMultiplier - .325) < 1e-9);
});

test('バハムートはATKを40増やし敵の移動指示より引き寄せを優先する', () => {
  const { config, state, enemies } = fixture('bahamut');
  tryExecuteSummon(state, config, 'Player');
  const summon = state.summonedUnits[0];
  summon.position = { x: 0, y: 0 }; summon.healthDecayPerSecond = 0;
  enemies[0].position = { x: 5, y: 0 }; enemies[0].destination = { x: 6, y: 0 };
  enemies[1].currentHp = enemies[2].currentHp = 0;
  assert.equal(summon.attackDamage, 139);
  tickMovement(state, config, 1);
  assert.ok(Math.abs(enemies[0].position.x - 4.59) < 1e-9);
  tickAbilities(state, config, 12);
  tickMovement(state, config, 1);
  assert.ok(enemies[0].position.x > 4.59);
});

test('バハムートの引き寄せはエレメンタル生成を中断せず、解除後は元の移動指示に戻る', () => {
  const { config, state, allies, enemies } = fixture('bahamut');
  tryExecuteSummon(state, config, 'Player');
  enemies[0].mode = 'BuildingElemental'; enemies[0].buildTimerSeconds = 5;
  const origin = { ...enemies[0].position };
  tickMovement(state, config, 1);
  assert.deepEqual(enemies[0].position, origin);
  assert.equal(enemies[0].mode, 'BuildingElemental');
  allies[0].cardId = 'SC017'; allies[0].abilityAp = 1; state.rainRemainingSeconds = 10;
  assert.equal(tryUseAbility(state, config, allies[0].unitId, 0), true);
  enemies[0].mode = 'Active'; enemies[0].destination = { x: 6, y: -3 };
  tickMovement(state, config, 1);
  assert.ok(enemies[0].position.x > 5);
});

test('デュラハンは敵ATKを17秒下げ、味方を満タン・AP0で無料復活する', () => {
  const { config, state, allies, enemies } = fixture('dullahan');
  const before = effectiveAttackDamage(enemies[0], state, config);
  allies[0].currentHp = 0; allies[0].mode = 'Defeated';
  state.playerMp = 4;
  tryExecuteSummon(state, config, 'Player');
  assert.equal(effectiveAttackDamage(enemies[0], state, config), before - 20);
  assert.equal(allies[0].currentHp, 1100);
  assert.equal(allies[0].abilityAp, 0);
  assert.deepEqual(allies[0].position, config.playerLeaderPosition);
  assert.equal(state.playerMp, 4);
  tickAbilities(state, config, 17);
  assert.equal(effectiveAttackDamage(enemies[0], state, config), before);
});

test('潜在ダメージによる死亡スキル・MP・勝敗を召喚コマンド内で確定する', () => {
  const { config, state, enemies } = fixture('leviathan');
  enemies[0].cardId = 'SC013'; enemies[0].stats.level = 3; enemies[0].currentHp = 300;
  findLeader(state, 'Cpu').currentHp = 150;
  new GameSession(config, state, () => .49).applyCommand({ commandType: 'Summon', team: 'Player' });
  assert.equal(enemies[0].mode, 'Defeated');
  assert.equal(state.cpuMp, 3);
  assert.equal(state.result, 'PlayerWin');
});

test('発動条件は毎回の召喚時に評価し、HP低下だけでは活動中の召喚獣に後付けしない', () => {
  const { config, state, allies } = fixture();
  findLeader(state, 'Player').currentHp = 3000;
  allies[0].currentHp = 100;
  tryExecuteSummon(state, config, 'Player');
  findLeader(state, 'Player').currentHp = 2000;
  tickSummonedUnits(state, config, 0);
  assert.equal(allies[0].currentHp, 100);
  state.summonedUnits = []; state.playerSummonGauge = 1;
  tryExecuteSummon(state, config, 'Player');
  assert.equal(allies[0].currentHp, 600);
});

test('潜在で復活した味方を同じ発動の回復対象へ重ねて加えない', () => {
  const { config, state, allies } = fixture();
  allies[0].currentHp = 0;
  markDefeatedUnits(state, config, () => 1);
  tryExecuteSummon(state, config, 'Player');
  assert.equal(allies[0].currentHp, 660);
});

test('召喚時にいた敵でも一度戦闘不能になった後の復活には潜在減速を再付与しない', () => {
  const { config, state, enemies } = fixture('yggdrasil');
  tryExecuteSummon(state, config, 'Player');
  enemies[0].currentHp = 0;
  markDefeatedUnits(state, config, () => 1);
  state.cpuMp = 10;
  tryReviveUnit(state, config, 'Cpu', enemies[0].unitId, config.cpuLeaderPosition);
  tickAbilities(state, config, 2);
  tickSummonedUnits(state, config, 1.5);
  assert.equal(effectiveMoveSpeed(state, config, enemies[0]), enemies[0].stats.moveSpeed);
});

test('生成中にバハムートが移動して消滅しても最後の位置を引き寄せ先に保つ', () => {
  const { config, state, enemies } = fixture('bahamut');
  enemies[0].mode = 'BuildingElemental'; enemies[0].buildTimerSeconds = 5;
  tryExecuteSummon(state, config, 'Player');
  const summon = state.summonedUnits[0];
  summon.position = { x: 0, y: -3 }; summon.healthDecayPerSecond = 0;
  tickSummonedUnits(state, config, 1);
  assert.ok(summon.position.y > -3);
  const finalPosition = { ...summon.position };
  summon.currentHp = 0;
  tickSummonedUnits(state, config, 0);
  enemies[0].mode = 'Active';
  assert.deepEqual(potentialPull(state, enemies[0])?.destination, finalPosition);
});
