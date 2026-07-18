import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader } from "../core/battleState";
import type { ElementalId } from "../core/types";
import { canSummon, tryExecuteSummon, tickSummonGauges, tickSummonedUnits } from "./summonSystem";

test("完成済みエレメンタルが2つあれば召喚できる", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: -5, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: -4, y: 1 }, maxHp: 120, currentHp: 120, isComplete: true }
  );
  state.playerSummonGauge = 1;

  assert.equal(tryExecuteSummon(state, config, "Player"), true);
  assert.equal(state.summonedUnits.length, 1);
  assert.equal(state.playerSummonGauge, 0);
  assert.deepEqual(state.summonedUnits[0].destination, { x: 0, y: 4.1 });
  assert.equal(Number(state.summonedUnits[0].moveSpeed.toFixed(2)), 0.6);
});

test("召喚ユニットは接触した敵リーダーへ継続ダメージを与える", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.summonedUnits.push({
    summonedUnitId: 1,
    team: "Player",
    position: { x: 0, y: 4.1 },
    destination: { x: 0, y: 4.1 },
    maxHp: 100,
    currentHp: 100,
    attackDamage: 135,
    moveSpeed: 1,
    healthDecayPerSecond: 10
  });

  tickSummonedUnits(state, config, 1);

  assert.equal(findLeader(state, "Cpu").currentHp, 1865);
  assert.equal(state.summonedUnits[0].currentHp, 90);
});

test("クールダウンは0未満にならない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.elementals.push({
    elementalId: "Elemental1", team: "Player", position: { x: 0, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true
  });
  tickSummonGauges(state, config, 45);
  assert.equal(Number(state.playerSummonGauge.toFixed(6)), Number((1 / 6).toFixed(6)));
});

test("完成済みエレメンタルが不足していると召喚できない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Player",
    position: { x: -5, y: 0 },
    maxHp: 120,
    currentHp: 120,
    isComplete: true
  });

  assert.equal(canSummon(state, config, "Player"), false);
  assert.equal(tryExecuteSummon(state, config, "Player"), false);
  assert.equal(state.summonedUnits.length, 0);
});

test("クールダウン中は召喚できない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addCompletedPlayerElementals(state);
  state.playerSummonGauge = 0.99;

  assert.equal(canSummon(state, config, "Player"), false);
  assert.equal(tryExecuteSummon(state, config, "Player"), false);
  assert.equal(state.summonedUnits.length, 0);
});

test("自リーダーが倒れていると召喚できない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addCompletedPlayerElementals(state);
  findLeader(state, "Player").currentHp = 0;

  assert.equal(canSummon(state, config, "Player"), false);
  assert.equal(tryExecuteSummon(state, config, "Player"), false);
  assert.equal(state.summonedUnits.length, 0);
});

test("このtickで消滅する召喚ユニットは接触ダメージを与えない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.summonedUnits.push({
    summonedUnitId: 1,
    team: "Player",
    position: { x: 7, y: 0 },
    destination: { x: 7, y: 0 },
    maxHp: 100,
    currentHp: 10,
    attackDamage: 135,
    moveSpeed: 1,
    healthDecayPerSecond: 10
  });

  tickSummonedUnits(state, config, 1);

  assert.equal(findLeader(state, "Cpu").currentHp, 2000);
  assert.equal(state.summonedUnits.length, 0);
});

test("召喚獣HPは戦場面積の5%で近接ユニットと同じになる", () => {
  const config = createDefaultBattleConfig();
  config.battlefieldMin = { x: 0, y: 0 };
  config.battlefieldMax = { x: 10, y: 10 };
  const state = createDefaultBattleState(config);
  findLeader(state, "Player").position = { x: 0, y: 0 };
  state.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: 10, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: 0, y: 1 }, maxHp: 120, currentHp: 120, isComplete: true }
  );
  state.playerSummonGauge = 1;

  assert.equal(tryExecuteSummon(state, config, "Player"), true);
  assert.equal(state.summonedUnits[0].maxHp, 350);
});

test("召喚獣HPは戦場面積の100%で近接ユニットの20倍になる", () => {
  const config = createDefaultBattleConfig();
  config.battlefieldMin = { x: 0, y: 0 };
  config.battlefieldMax = { x: 10, y: 10 };
  const state = createDefaultBattleState(config);
  findLeader(state, "Player").position = { x: 0, y: 0 };
  state.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: 10, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: 10, y: 10 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental3", team: "Player", position: { x: 0, y: 10 }, maxHp: 120, currentHp: 120, isComplete: true }
  );
  state.playerSummonGauge = 1;

  assert.equal(tryExecuteSummon(state, config, "Player"), true);
  assert.equal(state.summonedUnits[0].maxHp, 7000);
});

test("2回の召喚は連番IDを割り当てる", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addCompletedPlayerElementals(state);

  assert.equal(tryExecuteSummon(state, config, "Player"), true);
  state.playerSummonGauge = 1;
  assert.equal(tryExecuteSummon(state, config, "Player"), true);

  assert.deepEqual(
    state.summonedUnits.map((summoned) => summoned.summonedUnitId),
    [1, 2]
  );
});

test("召喚ユニットの位置と目的地はリーダー位置のコピーになる", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addCompletedPlayerElementals(state);

  assert.equal(tryExecuteSummon(state, config, "Player"), true);
  const summoned = state.summonedUnits[0];
  const playerLeader = findLeader(state, "Player");
  const cpuLeader = findLeader(state, "Cpu");
  playerLeader.position.x = 123;
  cpuLeader.position.x = 456;

  assert.deepEqual(summoned.position, { x: 0, y: -4.1 });
  assert.deepEqual(summoned.destination, { x: 0, y: 4.1 });
  assert.notEqual(summoned.position, playerLeader.position);
  assert.notEqual(summoned.destination, cpuLeader.position);
});

test("非接触の召喚ユニットは敵リーダーへ移動する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  findLeader(state, "Cpu").position = { x: 7, y: 0 };
  state.summonedUnits.push({
    summonedUnitId: 1,
    team: "Player",
    position: { x: 6, y: 0 },
    destination: { x: 6, y: 0 },
    maxHp: 100,
    currentHp: 100,
    attackDamage: 135,
    moveSpeed: 1,
    healthDecayPerSecond: 10
  });

  tickSummonedUnits(state, config, 0.5);

  assert.deepEqual(state.summonedUnits[0].position, { x: 6.5, y: 0 });
  assert.deepEqual(state.summonedUnits[0].destination, { x: 7, y: 0 });
});

test("召喚ユニットは接触した敵通常ユニットへ継続ダメージを与え、移動速度が低下する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  findLeader(state, "Cpu").position = { x: 7, y: 0 };
  const enemyUnit = state.units.find((unit) => unit.unitId === "CpuMelee");
  assert.ok(enemyUnit);
  enemyUnit.position = { x: -5.8, y: 0 };
  enemyUnit.destination = { x: -5.8, y: 0 };
  state.summonedUnits.push({
    summonedUnitId: 1,
    team: "Player",
    position: { x: -6, y: 0 },
    destination: { x: 7, y: 0 },
    maxHp: 100,
    currentHp: 100,
    attackDamage: 90,
    moveSpeed: 1,
    healthDecayPerSecond: 10
  });

  tickSummonedUnits(state, config, 1);

  assert.equal(enemyUnit.currentHp, enemyUnit.stats.maxHp - 90);
  assert.equal(Number(state.summonedUnits[0].position.x.toFixed(2)), -5.67);
});

test("召喚ユニット同士は接触中に互いへ継続ダメージを与え、移動速度が低下する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  findLeader(state, "Player").position = { x: -7, y: 0 };
  findLeader(state, "Cpu").position = { x: 7, y: 0 };
  state.summonedUnits.push(
    {
      summonedUnitId: 1,
      team: "Player",
      position: { x: 0, y: 0 },
      destination: { x: 7, y: 0 },
      maxHp: 100,
      currentHp: 100,
      attackDamage: 30,
      moveSpeed: 1,
      healthDecayPerSecond: 10
    },
    {
      summonedUnitId: 2,
      team: "Cpu",
      position: { x: 0.2, y: 0 },
      destination: { x: -7, y: 0 },
      maxHp: 100,
      currentHp: 100,
      attackDamage: 40,
      moveSpeed: 1,
      healthDecayPerSecond: 10
    }
  );

  tickSummonedUnits(state, config, 1);

  assert.equal(state.summonedUnits[0].currentHp, 50);
  assert.equal(state.summonedUnits[1].currentHp, 60);
  assert.equal(Number(state.summonedUnits[0].position.x.toFixed(2)), 0.33);
  assert.equal(Number(state.summonedUnits[1].position.x.toFixed(2)), -0.13);
});

test("6個のエレメントで召喚ゲージが45秒で満タンになる", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const elementalIds: ElementalId[] = [
    "Elemental1", "Elemental2", "Elemental3", "Elemental4", "Elemental5", "Elemental6"
  ];
  state.elementals.push(...elementalIds.map((elementalId, index) => ({
    elementalId,
    team: "Player" as const,
    position: { x: index, y: 0 },
    maxHp: 120,
    currentHp: 120,
    isComplete: true
  })));

  tickSummonGauges(state, config, 45);

  assert.equal(state.playerSummonGauge, 1);
  assert.equal(canSummon(state, config, "Player"), true);
});

test("エレメントが0個なら召喚ゲージは増えない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  tickSummonGauges(state, config, 300);

  assert.equal(state.playerSummonGauge, 0);
});

function addCompletedPlayerElementals(state: ReturnType<typeof createDefaultBattleState>): void {
  state.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: -5, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: -4, y: 1 }, maxHp: 120, currentHp: 120, isComplete: true }
  );
  state.playerSummonGauge = 1;
}
