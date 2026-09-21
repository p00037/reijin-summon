import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader, findUnit } from "../core/battleState";
import { canSummon, tryExecuteSummon, tickSummonedUnits } from "./summonSystem";
import { tickCombat, tickMovement } from "./unitSystem";
import { GameSession } from "./gameSession";

function fixture() {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.phase = "InProgress";
  state.playerSummonGauge = 1;
  state.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: -6, y: 3 }, maxHp: 1000, currentHp: 1000, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: 6, y: 3 }, maxHp: 1000, currentHp: 1000, isComplete: true }
  );
  for (const unit of state.units) {
    unit.position = { x: unit.team === "Player" ? -5 : 5, y: -3 };
    unit.destination = { ...unit.position };
  }
  return { config, state };
}

test("選んだ召喚獣のHPと移動・攻撃を生成し陣地加算を維持する", () => {
  for (const [id, baseHp, speed, damage, interval] of [
    ["raphael", 1750, 8.2 / 12, 300, 2], ["jackpot", 0, 0, 75, 0.5],
    ["yggdrasil", 0, 0, 157, 1.5], ["leviathan", 3150, 8.2 / 25, 1500, 9],
    ["bahamut", 1150, 8.2 / 9, 300, 2], ["dullahan", 2000, 8.2 / 12, 300, 2]
  ] as const) {
    const { state, config } = fixture();
    state.playerSummonId = id;
    assert.equal(tryExecuteSummon(state, config, "Player"), true);
    const summon = state.summonedUnits[0];
    assert.equal(summon.summonId, id);
    assert.ok(Math.abs(summon.maxHp - (baseHp + 42.6 / 113.4 * 6000)) < 1e-8);
    assert.equal(summon.moveSpeed, speed);
    assert.equal(summon.leaderAttackDamage, damage);
    assert.equal(summon.leaderAttackIntervalSeconds, interval);
  }
});

test("面積0の固定型はゲージを消費せず召喚を拒否する", () => {
  for (const id of ["jackpot", "yggdrasil"] as const) {
    const { state, config } = fixture();
    state.playerSummonId = id;
    state.elementals = [];
    assert.equal(canSummon(state, config, "Player"), false);
    assert.equal(tryExecuteSummon(state, config, "Player"), false);
    assert.equal(state.playerSummonGauge, 1);
    assert.equal(state.summonedUnits.length, 0);
  }
});

test("生存召喚獣がいる間は再召喚しない", () => {
  const { state, config } = fixture();
  tryExecuteSummon(state, config, "Player");
  state.playerSummonGauge = 1;
  assert.equal(tryExecuteSummon(state, config, "Player"), false);
  assert.equal(state.playerSummonGauge, 1);
});

test("防御倍率をユニット攻撃に一度適用し自然消耗は減衰しない", () => {
  const { state, config } = fixture();
  state.playerSummonId = "bahamut";
  tryExecuteSummon(state, config, "Player");
  const summon = state.summonedUnits[0];
  summon.position = { x: 0, y: 0 };
  summon.moveSpeed = 0;
  const enemy = findUnit(state, "CpuMelee");
  enemy.position = { x: 0, y: 0 };
  enemy.stats.attackDamage = 100;
  const before = summon.currentHp;
  tickCombat(state, config, 0);
  assert.equal(summon.currentHp, before - 32.5);
  tickSummonedUnits(state, config, 1);
  assert.equal(summon.currentHp, before - 32.5 - 120);
});

test("ユグドラシルは初撃と1.5秒周期で全体を攻撃しエレメンタルは初撃だけ", () => {
  const { state, config } = fixture();
  state.playerSummonId = "yggdrasil";
  state.elementals.push({ elementalId: "Elemental3", team: "Cpu", position: { x: 5, y: 4 }, maxHp: 1000, currentHp: 1000, isComplete: true });
  const enemy = findUnit(state, "CpuMelee");
  const ally = findUnit(state, "PlayerMelee");
  tryExecuteSummon(state, config, "Player");
  const origin = { ...state.summonedUnits[0].position };
  assert.equal(enemy.currentHp, 1090);
  assert.equal(ally.currentHp, 1100);
  assert.equal(findLeader(state, "Cpu").currentHp, 7843);
  tickSummonedUnits(state, config, 3);
  assert.equal(enemy.currentHp, 1070);
  assert.equal(findLeader(state, "Cpu").currentHp, 7529);
  assert.equal(state.elementals[2].currentHp, 990);
  assert.deepEqual(state.summonedUnits[0].position, origin);
});

test("リヴァイアサンの波動は初撃100と5秒ごとの20で味方と樽を除外する", () => {
  const { state, config } = fixture();
  state.playerSummonId = "leviathan";
  tryExecuteSummon(state, config, "Player");
  state.summonedUnits[0].moveSpeed = 0;
  assert.equal(findUnit(state, "CpuMelee").currentHp, 1000);
  tickSummonedUnits(state, config, 10);
  assert.equal(findUnit(state, "CpuMelee").currentHp, 960);
  assert.equal(findLeader(state, "Cpu").currentHp, 7860);
  assert.equal(findUnit(state, "PlayerMelee").currentHp, 1100);
  assert.equal(state.elementals[0].currentHp, 1000);
});

test("レーザーは味方も巻き込み範囲外には当たらず初撃と継続が二重にならない", () => {
  const { state, config } = fixture();
  state.playerSummonId = "jackpot";
  const ally = findUnit(state, "PlayerMelee");
  const enemy = findUnit(state, "CpuMelee");
  ally.position = { x: 0, y: 2 };
  enemy.position = { x: 0, y: 3 };
  tryExecuteSummon(state, config, "Player");
  assert.equal(ally.currentHp, 800);
  assert.equal(enemy.currentHp, 800);
  assert.equal(findUnit(state, "CpuSpeed").currentHp, 1060);
  assert.equal(findLeader(state, "Cpu").currentHp, 7700);
  tickSummonedUnits(state, config, 0);
  assert.equal(enemy.currentHp, 800);
  tickSummonedUnits(state, config, 1);
  assert.equal(enemy.currentHp, 696);
  assert.equal(ally.currentHp, 696);
  assert.equal(findLeader(state, "Cpu").currentHp, 7550);
});

test("レーザーは味方を減速せず遠い敵ユニットを減速させる", () => {
  const { state, config } = fixture();
  state.playerSummonId = "jackpot";
  tryExecuteSummon(state, config, "Player");
  const ally = findUnit(state, "PlayerMelee");
  const enemy = findUnit(state, "CpuMelee");
  ally.position = { x: 0, y: 2.5 };
  enemy.position = { x: 0, y: 4.1 };
  // Separate trials prevent unit-vs-unit contact from changing the expected speed.
  enemy.currentHp = 0;
  ally.destination = { x: 0.5, y: 2.5 };
  tickMovement(state, config, 1);
  assert.ok(Math.abs(ally.position.x - 0.205) < 1e-8);
  ally.currentHp = 0;
  enemy.currentHp = 800;
  enemy.destination = { x: 0.5, y: 4.1 };
  tickMovement(state, config, 1);
  assert.ok(Math.abs(enemy.position.x - 0.205 / 3) < 1e-8);
});

test("召喚時ダメージの戦闘不能とMP・勝敗をコマンド内で反映する", () => {
  const { state, config } = fixture();
  state.playerSummonId = "leviathan";
  const enemy = findUnit(state, "CpuMelee");
  enemy.currentHp = 50;
  enemy.mode = "BuildingElemental";
  enemy.pendingElementalId = "Elemental3";
  state.cpuLeaderDamageProgress = 750;
  findLeader(state, "Cpu").currentHp = 50;
  const session = new GameSession(config, state);
  session.applyCommand({ commandType: "Summon", team: "Player" });
  assert.equal(enemy.mode, "Defeated");
  assert.equal(enemy.pendingElementalId, null);
  assert.equal(state.result, "PlayerWin");
  assert.equal(state.cpuMp, 1);
});

test("接触攻撃の周期は更新の分割や端数に依存しない", () => {
  const hpAfter = (steps: number[]) => {
    const { state, config } = fixture();
    tryExecuteSummon(state, config, "Player");
    const summon = state.summonedUnits[0];
    summon.position = { ...findLeader(state, "Cpu").position };
    summon.healthDecayPerSecond = 0;
    tickSummonedUnits(state, config, 0);
    for (const step of steps) tickSummonedUnits(state, config, step);
    return findLeader(state, "Cpu").currentHp;
  };
  assert.equal(hpAfter([6]), 6800);
  assert.equal(hpAfter(Array.from({ length: 40 }, () => 0.15)), 6800);
});

test("レーザー内を移動するマスターは実体との接触なしに射撃しない", () => {
  const { state, config } = fixture();
  state.playerSummonId = "jackpot";
  tryExecuteSummon(state, config, "Player");
  const ranged = findUnit(state, "CpuRanged");
  ranged.position = { x: 0, y: 4.1 };
  ranged.destination = { x: 0.5, y: 4.1 };
  const target = findUnit(state, "PlayerSpeed");
  target.position = { x: 2.5, y: 4.1 };
  const before = target.currentHp;
  tickCombat(state, config, 0);
  assert.equal(target.currentHp, before);
  assert.equal(state.recentAttackEvents.some(event => event.attackerUnitId === ranged.unitId), false);
});
