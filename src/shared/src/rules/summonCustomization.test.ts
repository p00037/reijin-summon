import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBattleConfig } from '../core/battleConfig.js';
import { createDeckBattleState } from '../core/deckBattleState.js';
import { findLeader } from '../core/battleState.js';
import type { SummonId } from '../core/summonCatalog.js';
import { canSummon, tryExecuteSummon, tickSummonedUnits } from './summonSystem.js';
import { damageSummonedUnit } from './combatDamage.js';

function fixture(cards: string[], id: SummonId = 'raphael', enemyCards = ['SC002']) {
  const config = createDefaultBattleConfig();
  const state = createDeckBattleState(config, cards, enemyCards, id);
  state.phase = 'InProgress';
  state.playerSummonGauge = state.cpuSummonGauge = 1;
  state.units.forEach(unit => { unit.position = { x: 5, y: 0 }; unit.destination = { ...unit.position }; });
  return { config, state };
}

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
}

test('20枚の効果種類に従い、ATKはレベル+1・DEFは指定コスト・HPは500を召喚へ反映する', () => {
  const cases = [
    ['SC001', 99, .295, 1750], ['SC002', 99, .335, 1750],
    ['SC003', 99, .295, 1750], ['SC004', 99, .335, 1750],
    ['SC005', 102, .375, 1750], ['SC006', 99, .295, 1750],
    ['SC007', 101, .375, 1750], ['SC008', 99, .335, 1750],
    ['SC009', 103, .375, 1750], ['SC010', 99, .335, 1750],
    ['SC011', 99, .215, 1750], ['SC012', 99, .215, 1750],
    ['SC013', 99, .255, 1750], ['SC014', 99, .215, 1750],
    ['SC015', 105, .275, 1750], ['SC016', 99, .375, 2250],
    ['SC017', 99, .175, 1750], ['SC018', 99, .255, 1750],
    ['SC019', 103, .375, 1750], ['SC020', 99, .255, 1750]
  ] as const;
  for (const [card, attack, damageMultiplier, hp] of cases) {
    const { state, config } = fixture([card]);
    assert.equal(tryExecuteSummon(state, config, 'Player'), true, card);
    const summon = state.summonedUnits[0];
    assert.equal(summon.attackDamage, attack, card);
    close(summon.damageMultiplier, damageMultiplier);
    assert.equal(summon.maxHp, hp, card);
    assert.equal(summon.currentHp, hp, card);
  }
});

test('両陣営の編成を別々に集計し、死亡・国籍変更と再召喚で補正を変えない', () => {
  const { state, config } = fixture(['SC015', 'SC009', 'SC002', 'SC007'], 'raphael', ['SC016', 'SC017']);
  state.cpuSummonId = 'bahamut';
  state.units.forEach(unit => { unit.mode = 'Defeated'; unit.currentHp = 0; unit.nation = 'Other'; });
  tryExecuteSummon(state, config, 'Player');
  tryExecuteSummon(state, config, 'Cpu');
  const [player, cpu] = state.summonedUnits;
  assert.equal(player.attackDamage, 111);
  close(player.damageMultiplier, .235);
  assert.equal(player.maxHp, 1750);
  assert.equal(cpu.attackDamage, 99);
  close(cpu.damageMultiplier, .125);
  assert.equal(cpu.maxHp, 1650);
  state.summonedUnits = [];
  state.playerSummonGauge = 1;
  state.units.forEach(unit => { unit.mode = 'Active'; unit.currentHp = unit.stats.maxHp; });
  tryExecuteSummon(state, config, 'Player');
  assert.equal(state.summonedUnits[0].attackDamage, 111);
  close(state.summonedUnits[0].damageMultiplier, .235);
});

for (const id of ['jackpot', 'yggdrasil'] as const) {
  test(`${id}もHP補正を1倍で受け、面積0で500HPの召喚と自然消耗ができる`, () => {
    const { state, config } = fixture(['SC016'], id);
    assert.equal(canSummon(state, config, 'Player'), true);
    assert.equal(tryExecuteSummon(state, config, 'Player'), true);
    assert.equal(state.playerSummonGauge, 0);
    assert.equal(state.summonedUnits[0].maxHp, 500);
    tickSummonedUnits(state, config, 1);
    assert.equal(state.summonedUnits[0].currentHp, 380);
  });
}

test('DEFを合算して被ダメージ率5%で止め、自然HP消耗には適用しない', () => {
  const { state, config } = fixture(['SC011', 'SC012', 'SC001']);
  tryExecuteSummon(state, config, 'Player');
  const summon = state.summonedUnits[0];
  assert.equal(summon.damageMultiplier, .05);
  damageSummonedUnit(summon, 1000);
  assert.equal(summon.currentHp, 1700);
  tickSummonedUnits(state, config, 1);
  assert.equal(summon.currentHp, 1580);
});

test('通常ATKの合算比率を召喚士への実ダメージに反映する', () => {
  const { state, config } = fixture(['SC005', 'SC007']);
  tryExecuteSummon(state, config, 'Player');
  const summon = state.summonedUnits[0];
  assert.equal(summon.attackDamage, 104);
  close(summon.leaderAttackDamage, 315.1515151515151);
  summon.position = { ...findLeader(state, 'Cpu').position };
  tickSummonedUnits(state, config, 0);
  close(findLeader(state, 'Cpu').currentHp, 7684.848484848485);
});

function addArea(state: ReturnType<typeof fixture>['state']) {
  state.elementals = [
    { elementalId: 'Elemental1', team: 'Player', position: { x: -4, y: 2 }, maxHp: 1000, currentHp: 1000, isComplete: true },
    { elementalId: 'Elemental2', team: 'Player', position: { x: 4, y: 2 }, maxHp: 1000, currentHp: 1000, isComplete: true }
  ];
}

test('ユグドラシルのATKを1倍で加算し、初回エレメンタル攻撃と周期攻撃も強化する', () => {
  const { state, config } = fixture(['SC005', 'SC007'], 'yggdrasil');
  addArea(state);
  state.elementals.push({ elementalId: 'Elemental3', team: 'Cpu', position: { x: 5, y: 2 }, maxHp: 1000, currentHp: 1000, isComplete: true });
  tryExecuteSummon(state, config, 'Player');
  assert.equal(state.summonedUnits[0].attackDamage, 15);
  assert.equal(state.units[2].currentHp, 485);
  assert.equal(state.elementals[2].currentHp, 985);
  assert.equal(findLeader(state, 'Cpu').currentHp, 7764.5);
  tickSummonedUnits(state, config, 1.5);
  assert.equal(state.units[2].currentHp, 470);
  assert.equal(state.elementals[2].currentHp, 985);
  assert.equal(findLeader(state, 'Cpu').currentHp, 7529);
});

test('ジャックポットの初回・周期レーザーは敵味方へ同じATK補正を使う', () => {
  const { state, config } = fixture(['SC005', 'SC007'], 'jackpot');
  addArea(state);
  state.units.forEach(unit => { unit.position = { x: 0, y: 1 }; });
  tryExecuteSummon(state, config, 'Player');
  assert.equal(state.summonedUnits[0].attackDamage, 57);
  close(state.units[0].currentHp, 501.1538461538462);
  close(state.units[2].currentHp, 171.1538461538462);
  tickSummonedUnits(state, config, .5);
  close(state.units[0].currentHp, 444.1538461538462);
  close(state.units[2].currentHp, 114.1538461538462);
  close(findLeader(state, 'Cpu').currentHp, 7588.942307692308);
});

test('リヴァイアサンの波動比率は潜在ATKを含めず、期限後もカスタマイズを維持する', () => {
  const { state, config } = fixture(['SC015'], 'leviathan', ['SC016']);
  findLeader(state, 'Player').currentHp = 2400;
  tryExecuteSummon(state, config, 'Player');
  const summon = state.summonedUnits[0];
  assert.equal(summon.attackDamage, 126);
  close(summon.damageMultiplier, .21375);
  // 敵HP1496から、固定潜在400とATK補正済みの初回波動だけを引く。
  close(state.units[1].currentHp, 990.2857142857143);
  tickSummonedUnits(state, config, 20);
  assert.equal(summon.attackDamage, 111);
  close(summon.damageMultiplier, .225);
  close(state.units[1].currentHp, 905.7142857142857);
});

test('ATKカスタマイズはジャックポットの固定潜在ダメージ600を増やさない', () => {
  const { state, config } = fixture(['SC015'], 'jackpot', ['SC016']);
  addArea(state);
  findLeader(state, 'Player').currentHp = 2400;
  tryExecuteSummon(state, config, 'Player');
  assert.equal(state.summonedUnits[0].attackDamage, 58);
  assert.equal(state.units[1].currentHp, 896);
});
