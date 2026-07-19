import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader } from "../core/battleState";
import type { BattleState, ElementalId, TeamId } from "../core/types";
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
  const summoned = state.summonedUnits[0];
  assert.equal(summoned.moveSpeed, 8.2 / 12);
  assert.equal(summoned.attackDamage, 99);
  assert.equal(summoned.leaderAttackDamage, 300);
  assert.equal(summoned.attackIntervalSeconds, 2);
  assert.equal(summoned.attackTimerSeconds, 0);
  assert.equal(summoned.healthDecayPerSecond, 120);
});

test("召喚ユニットは攻撃可能時に敵リーダーへ1回分のダメージを与える", () => {
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
    leaderAttackDamage: 135,
    attackIntervalSeconds: 2,
    attackTimerSeconds: 0,
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
    leaderAttackDamage: 135,
    attackIntervalSeconds: 2,
    attackTimerSeconds: 0,
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
  assert.equal(state.summonedUnits[0].maxHp, 2050);
});

test("召喚獣は2Cごとに通常対象へ99、召喚士へ300ダメージを与える", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const enemyUnit = state.units.find((unit) => unit.unitId === "CpuMelee")!;
  enemyUnit.position = { x: 0, y: 4.1 };
  enemyUnit.destination = { ...enemyUnit.position };
  state.summonedUnits.push({
    summonedUnitId: 1,
    team: "Player",
    position: { x: 0, y: 4.1 },
    destination: { x: 0, y: 4.1 },
    maxHp: 2000,
    currentHp: 2000,
    attackDamage: 99,
    leaderAttackDamage: 300,
    attackIntervalSeconds: 2,
    attackTimerSeconds: 2,
    moveSpeed: 8.2 / 12,
    healthDecayPerSecond: 0
  });

  tickSummonedUnits(state, config, 1.99);

  assert.equal(findLeader(state, "Cpu").currentHp, 2000);
  assert.equal(enemyUnit.currentHp, enemyUnit.stats.maxHp);

  tickSummonedUnits(state, config, 0.01);

  assert.equal(findLeader(state, "Cpu").currentHp, 1700);
  assert.equal(enemyUnit.currentHp, enemyUnit.stats.maxHp - 99);
  assert.equal(state.summonedUnits[0].attackTimerSeconds, 2);
});

test("召喚獣は1CでHPが120自然減少する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addCompletedPlayerElementals(state);
  assert.equal(tryExecuteSummon(state, config, "Player"), true);
  const summoned = state.summonedUnits[0];
  const hpBeforeTick = summoned.currentHp;

  tickSummonedUnits(state, config, 1);

  assert.equal(summoned.currentHp, hpBeforeTick - 120);
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
  assert.equal(state.summonedUnits[0].maxHp, 7750);
});

test("召喚獣HPは召喚面積0%で基礎HPになる", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  findLeader(state, "Player").position = { x: 0, y: 0 };
  state.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: 1, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: 2, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true }
  );
  state.playerSummonGauge = 1;

  assert.equal(tryExecuteSummon(state, config, "Player"), true);
  assert.equal(state.summonedUnits[0].maxHp, 1750);
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
    leaderAttackDamage: 135,
    attackIntervalSeconds: 2,
    attackTimerSeconds: 0,
    moveSpeed: 1,
    healthDecayPerSecond: 10
  });

  tickSummonedUnits(state, config, 0.5);

  assert.deepEqual(state.summonedUnits[0].position, { x: 6.5, y: 0 });
  assert.deepEqual(state.summonedUnits[0].destination, { x: 7, y: 0 });
});

test("召喚ユニットは接触した敵通常ユニットへ攻撃し、移動速度が低下する", () => {
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
    leaderAttackDamage: 90,
    attackIntervalSeconds: 2,
    attackTimerSeconds: 0,
    moveSpeed: 1,
    healthDecayPerSecond: 10
  });

  tickSummonedUnits(state, config, 1);

  assert.equal(enemyUnit.currentHp, enemyUnit.stats.maxHp - 90);
  assert.equal(Number(state.summonedUnits[0].position.x.toFixed(2)), -5.67);
});

test("召喚ユニット同士は接触中に互いへ攻撃し、移動速度が低下する", () => {
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
      leaderAttackDamage: 30,
      attackIntervalSeconds: 2,
      attackTimerSeconds: 0,
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
      leaderAttackDamage: 40,
      attackIntervalSeconds: 2,
      attackTimerSeconds: 0,
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

test("自陣営の生存中召喚獣がいる間は召喚ゲージが増えない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addCompletedPlayerElementals(state);
  state.playerSummonGauge = 0;
  addSummonedUnit(state, "Player", 100);

  tickSummonGauges(state, config, 45);

  assert.equal(state.playerSummonGauge, 0);
});

test("相手陣営の召喚獣だけがいる場合は召喚ゲージが増える", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addCompletedPlayerElementals(state);
  state.playerSummonGauge = 0;
  addSummonedUnit(state, "Cpu", 100);

  tickSummonGauges(state, config, 45);

  assert.ok(state.playerSummonGauge > 0);
});

test("HPが0の自陣営召喚獣は召喚ゲージの増加を妨げない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addCompletedPlayerElementals(state);
  state.playerSummonGauge = 0;
  addSummonedUnit(state, "Player", 0);

  tickSummonGauges(state, config, 45);

  assert.ok(state.playerSummonGauge > 0);
});

function addCompletedPlayerElementals(state: ReturnType<typeof createDefaultBattleState>): void {
  state.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: -5, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: -4, y: 1 }, maxHp: 120, currentHp: 120, isComplete: true }
  );
  state.playerSummonGauge = 1;
}

function addSummonedUnit(state: BattleState, team: TeamId, currentHp: number): void {
  state.summonedUnits.push({
    summonedUnitId: state.nextSummonedUnitId++,
    team,
    position: { x: 0, y: 0 },
    destination: { x: 0, y: 0 },
    maxHp: 100,
    currentHp,
    attackDamage: 99,
    leaderAttackDamage: 300,
    attackIntervalSeconds: 2,
    attackTimerSeconds: 0,
    moveSpeed: 8.2 / 12,
    healthDecayPerSecond: 120
  });
}
