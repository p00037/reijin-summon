import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader } from "../core/battleState";
import { canSummon, tryExecuteSummon, tickSummonCooldowns, tickSummonedUnits } from "./summonSystem";

test("完成済みエレメンタルが2つあれば召喚できる", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: -5, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: -4, y: 1 }, maxHp: 120, currentHp: 120, isComplete: true }
  );

  assert.equal(tryExecuteSummon(state, config, "Player"), true);
  assert.equal(state.summonedUnits.length, 1);
  assert.equal(state.playerSummonCooldownSeconds, 30);
  assert.deepEqual(state.summonedUnits[0].destination, { x: 7, y: 0 });
});

test("召喚ユニットは接触した敵リーダーへ継続ダメージを与える", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.summonedUnits.push({
    summonedUnitId: 1,
    team: "Player",
    position: { x: 7, y: 0 },
    destination: { x: 7, y: 0 },
    maxHp: 100,
    currentHp: 100,
    attackDamage: 135,
    moveSpeed: 1,
    healthDecayPerSecond: 10
  });

  tickSummonedUnits(state, config, 1);

  assert.equal(findLeader(state, "Cpu").currentHp, 865);
  assert.equal(state.summonedUnits[0].currentHp, 90);
});

test("クールダウンは0未満にならない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.playerSummonCooldownSeconds = 1;
  tickSummonCooldowns(state, 2);
  assert.equal(state.playerSummonCooldownSeconds, 0);
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
  state.playerSummonCooldownSeconds = 1;

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

  assert.equal(findLeader(state, "Cpu").currentHp, 1000);
  assert.equal(state.summonedUnits.length, 0);
});

test("召喚HP倍率は最小値と最大値にクランプされる", () => {
  const config = createDefaultBattleConfig();
  const minState = createDefaultBattleState(config);
  minState.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: -7, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: -7, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true }
  );

  assert.equal(tryExecuteSummon(minState, config, "Player"), true);
  assert.equal(minState.summonedUnits[0].maxHp, 1050);

  const maxState = createDefaultBattleState(config);
  maxState.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: -7, y: 100 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: 100, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true }
  );

  assert.equal(tryExecuteSummon(maxState, config, "Player"), true);
  assert.equal(maxState.summonedUnits[0].maxHp, 3500);
});

test("2回の召喚は連番IDを割り当てる", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addCompletedPlayerElementals(state);

  assert.equal(tryExecuteSummon(state, config, "Player"), true);
  state.playerSummonCooldownSeconds = 0;
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

  assert.deepEqual(summoned.position, { x: -7, y: 0 });
  assert.deepEqual(summoned.destination, { x: 7, y: 0 });
  assert.notEqual(summoned.position, playerLeader.position);
  assert.notEqual(summoned.destination, cpuLeader.position);
});

test("非接触の召喚ユニットは敵リーダーへ移動する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
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

function addCompletedPlayerElementals(state: ReturnType<typeof createDefaultBattleState>): void {
  state.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: -5, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: -4, y: 1 }, maxHp: 120, currentHp: 120, isComplete: true }
  );
}
