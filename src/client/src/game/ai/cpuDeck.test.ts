import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createOnlineBattleState } from "../core/deckBattleState";
import { validateDeck } from "../deck/deckModel";
import { createCpuBattleState } from "./cpuDeck";
import { createCpuPlannerMemory, planCpuCommands } from "./cpuPlanner";
import { GameSession } from "../rules/gameSession";
import { findLeader } from "../core/battleState";

test("CPU戦は指定の4枚・コスト10とリヴァイアサンに固定する", () => {
  const config = createDefaultBattleConfig();
  const state = createCpuBattleState(config, ["SC002"], "dullahan");
  const cpuUnits = state.units.filter(unit => unit.team === "Cpu");
  assert.deepEqual(cpuUnits.map(unit => unit.cardId), ["SC012", "SC009", "SC005", "SC007"]);
  assert.equal(validateDeck(cpuUnits.map(unit => unit.cardId!)).cost, 10);
  assert.equal(state.cpuSummonId, "leviathan");
  assert.equal(state.playerSummonId, "dullahan");
  assert.deepEqual(state.cpuSummonCustomization, { attackBonus: 9, defenseReduction: .16, hpBonus: 0 });
  const goo = cpuUnits.find(unit => unit.cardId === "SC012")!;
  const red = cpuUnits.find(unit => unit.cardId === "SC009")!;
  const tiger = cpuUnits.find(unit => unit.cardId === "SC005")!;
  const rose = cpuUnits.find(unit => unit.cardId === "SC007")!;
  assert.ok(red.position.y < goo.position.y);
  assert.ok(tiger.position.x < 0 && rose.position.x > 0);
  for (const unit of cpuUnits) {
    assert.deepEqual(unit.position, unit.destination);
    assert.deepEqual(unit.position, unit.spawnPosition);
    for (const other of cpuUnits.filter(other => other !== unit)) {
      assert.ok(Math.hypot(unit.position.x - other.position.x, unit.position.y - other.position.y) >= config.initialPlacementMinDistance);
    }
  }
});

test("再戦用に編成・召喚獣・HP・APを新しく生成する", () => {
  const config = createDefaultBattleConfig();
  const first = createCpuBattleState(config, ["SC010"], "raphael");
  first.units.find(unit => unit.team === "Cpu")!.currentHp = 1;
  first.cpuSummonGauge = 1;
  const next = createCpuBattleState(config, ["SC010"], "raphael");
  assert.equal(next.units.find(unit => unit.team === "Cpu")!.currentHp, 1311);
  assert.equal(next.cpuSummonGauge, 0);
  assert.equal(next.cpuSummonId, "leviathan");
});

test("オンライン対戦では双方が選んだカードと召喚獣を使う", () => {
  const state = createOnlineBattleState(createDefaultBattleConfig(), {
    Player: { cardIds: ["SC002"], summonId: "jackpot" },
    Cpu: { cardIds: ["SC015"], summonId: "yggdrasil" }
  });
  assert.deepEqual(state.units.map(unit => unit.cardId), ["SC002", "SC015"]);
  assert.equal(state.cpuSummonId, "yggdrasil");
});

test("デッキ2を選ぶとダライアス・レッドアイ・クリン・ローズとユグドラシルになる", () => {
  const config = createDefaultBattleConfig();
  const state = createCpuBattleState(config, ["SC002"], "bahamut", "deck2");
  const units = state.units.filter(unit => unit.team === "Cpu");
  assert.deepEqual(units.map(unit => unit.cardId), ["SC015", "SC009", "SC004", "SC007"]);
  assert.equal(state.cpuSummonId, "yggdrasil");
  assert.equal(state.playerSummonId, "bahamut");
  assert.equal(state.cpuSummonCustomization.attackBonus, 12);
  assert.ok(Math.abs(state.cpuSummonCustomization.defenseReduction - .14) < 1e-9);
  const clerk = units.find(unit => unit.cardId === "SC004")!;
  const darius = units.find(unit => unit.cardId === "SC015")!;
  assert.ok(clerk.position.y > darius.position.y);
  assert.equal(validateDeck(units.map(unit => unit.cardId!)).cost, 10);
  state.cpuSummonGauge = 1;
  const retry = createCpuBattleState(config, ["SC002"], "bahamut", "deck2");
  assert.equal(retry.cpuSummonGauge, 0);
  assert.equal(retry.cpuSummonId, "yggdrasil");
});

test("デッキ3は指定4枚で、対戦ごとに6種類を抽選し試合中は固定する", () => {
  const config = createDefaultBattleConfig();
  const summons = ["raphael", "jackpot", "yggdrasil", "leviathan", "bahamut", "dullahan"];
  for (const [index, summon] of summons.entries()) {
    const state = createCpuBattleState(config, ["SC002"], "bahamut", "deck3", () => (index + .5) / 6);
    const units = state.units.filter(unit => unit.team === "Cpu");
    assert.deepEqual(units.map(unit => unit.cardId), ["SC014", "SC013", "SC003", "SC010"]);
    assert.equal(validateDeck(units.map(unit => unit.cardId!)).cost, 10);
    assert.equal(state.cpuSummonId, summon);
    assert.equal(state.playerSummonId, "bahamut");
    assert.equal(state.cpuSummonCustomization.attackBonus, 0);
    assert.ok(Math.abs(state.cpuSummonCustomization.defenseReduction - .4) < 1e-9);
    const rear = units.filter(unit => unit.unitType === "Ranged");
    const front = units.filter(unit => unit.unitType === "Melee");
    assert.ok(rear.every(shooter => front.every(guard => shooter.position.y > guard.position.y)));
    new GameSession(config, state).tick(1);
    assert.equal(state.cpuSummonId, summon);
  }
});

test("実戦ルールで陣地拡張からアビリティ・召喚・敵召喚士への攻撃まで進行する", () => {
  const config = createDefaultBattleConfig();
  const state = createCpuBattleState(config, ["SC020", "SC019", "SC014"], "raphael");
  state.phase = "InProgress";
  const session = new GameSession(config, state, () => .99);
  const memory = createCpuPlannerMemory();
  let gaugeAbilityUses = 0, summonCount = 0, maximumElementals = 0;
  for (let second = 0; second < 150 && state.result === "InProgress"; second++) {
    for (const command of planCpuCommands(state, config, memory)) {
      if (command.commandType === "UseAbility" && command.unitId === "Cpu:SC012") gaugeAbilityUses++;
      if (command.commandType === "Summon") summonCount++;
      session.applyCommand(command);
    }
    session.tick(1);
    const fieldCount = state.elementals.filter(e => e.team === "Cpu" && e.currentHp > 0).length;
    maximumElementals = Math.max(maximumElementals, fieldCount);
    assert.ok(fieldCount <= config.maxElementalsPerTeam);
    assert.ok(state.cpuMp >= 0 && state.cpuMp <= config.maxMp);
  }
  assert.ok(maximumElementals >= 4);
  assert.ok(gaugeAbilityUses >= 1 && summonCount >= 1);
  assert.ok(findLeader(state, "Player").currentHp < config.leaderMaxHp);
});
