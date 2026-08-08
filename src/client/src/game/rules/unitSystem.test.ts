import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader, findUnit } from "../core/battleState";
import { applyMoveCommand, markDefeatedUnits, tickCombat, tickMovement, tickUnitHealing } from "./unitSystem";

test("移動コマンドは生成中を解除し、目標を戦場内にクランプする", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.mode = "BuildingElemental";
  unit.pendingElementalId = "Elemental1";

  applyMoveCommand(state, config, {
    commandType: "MoveUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: 100, y: -100 }
  });

  assert.equal(unit.mode, "Active");
  assert.equal(unit.pendingElementalId, null);
  assert.deepEqual(unit.destination, { x: 6.3, y: -4.5 });
});

test("ユニットは目標へ移動する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.position = { x: -5, y: 1.5 };
  unit.destination = { x: -5, y: 1.5 };

  applyMoveCommand(state, config, {
    commandType: "MoveUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: -4, y: 1.5 }
  });
  tickMovement(state, config, 3);

  assert.equal(Number(unit.position.x.toFixed(2)), -4.38);
});

test("攻撃範囲内の敵リーダーへ直接ダメージを与える", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.position = { x: 0, y: 3 };
  unit.destination = { x: 0, y: 3 };
  unit.attackTimerSeconds = 0;
  for (const enemy of state.units.filter((candidate) => candidate.team === "Cpu")) {
    enemy.currentHp = 0;
    enemy.mode = "Defeated";
  }

  tickCombat(state, config, 1.2);

  assert.equal(findLeader(state, "Cpu").currentHp, 8000 - 61 * 0.25);
});

test("HP0の通常ユニットの撤退順を記録して時間では復活しない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const first = findUnit(state, "PlayerMelee");
  const second = findUnit(state, "PlayerSpeed");
  first.currentHp = 0;
  markDefeatedUnits(state);
  second.currentHp = 0;
  markDefeatedUnits(state);

  assert.equal(first.mode, "Defeated");
  assert.equal(first.defeatedOrder, 1);
  assert.equal(second.defeatedOrder, 2);
  assert.equal(state.nextDefeatedOrder, 3);
  tickCombat(state, config, 30);
  assert.equal(first.mode, "Defeated");
  assert.equal(first.currentHp, 0);
});

test("戦闘tickは撃破済みユニットを復活させない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerSpeed");
  unit.currentHp = 0;
  unit.mode = "Defeated";

  tickCombat(state, config, 1);

  assert.equal(unit.mode, "Defeated");
  assert.equal(unit.currentHp, 0);
});

test("生成中ユニットの撃破は生成を解除して撤退順を記録する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerSpeed");
  unit.currentHp = 0;
  unit.mode = "BuildingElemental";
  unit.buildTimerSeconds = 3;
  unit.pendingElementalId = "Elemental1";

  tickCombat(state, config, 1);

  assert.equal(unit.mode, "Defeated");
  assert.equal(unit.defeatedOrder, 1);
  assert.equal(unit.buildTimerSeconds, 0);
  assert.equal(unit.pendingElementalId, null);
});

test("combat chooses nearest target across all target kinds", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerRanged");
  const enemyUnit = findUnit(state, "CpuMelee");
  attacker.position = { x: 0, y: 0 };
  attacker.destination = { x: 0, y: 0 };
  attacker.attackTimerSeconds = 0;
  enemyUnit.position = { x: 3, y: 0 };
  enemyUnit.destination = { x: 3, y: 0 };
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Cpu",
    position: { x: 1, y: 0 },
    maxHp: 120,
    currentHp: 120,
    isComplete: true
  });

  tickCombat(state, config, 1.4);

  assert.equal(state.elementals[0].currentHp, 120 - attacker.stats.attackDamage);
  assert.equal(enemyUnit.currentHp, enemyUnit.stats.maxHp);
});

test("keeper deals double damage to elementals but normal damage to units", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const keeper = findUnit(state, "PlayerMelee");
  const enemyUnit = findUnit(state, "CpuMelee");
  keeper.position = { x: 0, y: 0 };
  keeper.destination = { ...keeper.position };
  keeper.attackTimerSeconds = 0;
  enemyUnit.position = { x: 0.5, y: 0 };
  enemyUnit.destination = { ...enemyUnit.position };
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Cpu",
    position: { x: 0.25, y: 0 },
    maxHp: 1000,
    currentHp: 1000,
    isComplete: true
  });

  tickCombat(state, config, 1.2);

  assert.equal(state.elementals[0].currentHp, 878);
  assert.equal(enemyUnit.currentHp, enemyUnit.stats.maxHp);

  keeper.attackTimerSeconds = 0;
  state.elementals[0].currentHp = 0;
  tickCombat(state, config, 1.2);

  assert.equal(enemyUnit.currentHp, enemyUnit.stats.maxHp - 61);
});

test("units in the leader healing area recover 10% of maximum HP every two seconds", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerSpeed");
  unit.position = { ...findLeader(state, "Player").position };
  unit.destination = { x: unit.position.x + 1, y: unit.position.y };
  unit.currentHp = 500;

  tickUnitHealing(state, config, 1.99);
  assert.equal(unit.currentHp, 500);
  tickUnitHealing(state, config, 0.01);

  assert.equal(unit.currentHp, 606);
});

test("leaving the leader healing area resets its periodic recovery timer", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerSpeed");
  unit.position = { ...findLeader(state, "Player").position };
  unit.destination = { x: unit.position.x + 1, y: unit.position.y };
  unit.currentHp = 500;

  tickUnitHealing(state, config, 1.5);
  unit.position = { x: 6, y: 0 };
  tickUnitHealing(state, config, 1);
  unit.position = { ...findLeader(state, "Player").position };
  tickUnitHealing(state, config, 0.5);

  assert.equal(unit.currentHp, 500);
  assert.equal(unit.leaderHealingElapsedSeconds, 0.5);
});

test("a stopped keeper recovers 60 HP every 1.5 seconds", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const keeper = findUnit(state, "PlayerMelee");
  keeper.currentHp = 500;

  tickUnitHealing(state, config, 1.49);
  assert.equal(keeper.currentHp, 500);
  tickUnitHealing(state, config, 0.01);

  assert.equal(keeper.currentHp, 560);
});

test("keeper rest healing and leader-area healing stack on their own intervals", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const keeper = findUnit(state, "PlayerMelee");
  keeper.position = { ...findLeader(state, "Player").position };
  keeper.destination = { ...keeper.position };
  keeper.currentHp = 500;

  tickUnitHealing(state, config, 6);

  assert.equal(keeper.currentHp, 500 + 3 * 110 + 4 * 60);
});

test("a move command resets the keeper's healing timers", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const keeper = findUnit(state, "PlayerMelee");
  keeper.position = { ...findLeader(state, "Player").position };
  keeper.destination = { ...keeper.position };

  tickUnitHealing(state, config, 0.5);
  applyMoveCommand(state, config, {
    commandType: "MoveUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: keeper.position.x + 1, y: keeper.position.y }
  });

  assert.equal(keeper.leaderHealingElapsedSeconds, 0);
  assert.equal(keeper.restHealingElapsedSeconds, 0);
});

test("building units reset their healing timers and do not recover", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const keeper = findUnit(state, "PlayerMelee");
  keeper.position = { ...findLeader(state, "Player").position };
  keeper.destination = { ...keeper.position };
  keeper.currentHp = 500;
  keeper.mode = "BuildingElemental";
  keeper.leaderHealingElapsedSeconds = 1;
  keeper.restHealingElapsedSeconds = 1;

  tickUnitHealing(state, config, 1);

  assert.equal(keeper.currentHp, 500);
  assert.equal(keeper.leaderHealingElapsedSeconds, 0);
  assert.equal(keeper.restHealingElapsedSeconds, 0);
});

test("defeat resets healing timers", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const keeper = findUnit(state, "PlayerMelee");
  keeper.currentHp = 0;
  keeper.attackTimerSeconds = 0.25;
  keeper.leaderAttackTimerSeconds = 0.75;
  keeper.leaderHealingElapsedSeconds = 1;
  keeper.restHealingElapsedSeconds = 1;

  tickCombat(state, config, 0);

  assert.equal(keeper.mode, "Defeated");
  assert.equal(keeper.attackTimerSeconds, 0);
  assert.equal(keeper.leaderAttackTimerSeconds, 0);
  assert.equal(keeper.leaderHealingElapsedSeconds, 0);
  assert.equal(keeper.restHealingElapsedSeconds, 0);
});

test("large healing ticks apply every completed interval without exceeding maximum HP", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const keeper = findUnit(state, "PlayerMelee");
  keeper.position = { ...findLeader(state, "Player").position };
  keeper.destination = { ...keeper.position };
  keeper.currentHp = 1000;

  tickUnitHealing(state, config, 30);

  assert.equal(keeper.currentHp, keeper.stats.maxHp);
  assert.equal(keeper.leaderHealingElapsedSeconds, 0);
  assert.equal(keeper.restHealingElapsedSeconds, 0);
});

test("移動中かつ非接敵のマスターは射程内の敵を攻撃しない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerRanged");
  const enemy = findUnit(state, "CpuMelee");
  attacker.position = { x: 0, y: 0 };
  attacker.destination = { x: 1, y: 0 };
  attacker.attackTimerSeconds = 0;
  for (const candidate of state.units.filter((unit) => unit.team === "Cpu" && unit.unitId !== enemy.unitId)) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }
  enemy.position = { x: 3, y: 0 };
  enemy.destination = { ...enemy.position };

  tickCombat(state, config, 1);

  assert.equal(enemy.currentHp, enemy.stats.maxHp);
});

test("移動中でも接敵中のマスターは射程内の敵を攻撃する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerRanged");
  const enemy = findUnit(state, "CpuMelee");
  attacker.position = { x: 0, y: 0 };
  attacker.destination = { x: 1, y: 0 };
  attacker.attackTimerSeconds = 0;
  for (const candidate of state.units.filter((unit) => unit.team === "Cpu" && unit.unitId !== enemy.unitId)) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }
  enemy.position = { x: 0.5, y: 0 };
  enemy.destination = { ...enemy.position };

  tickCombat(state, config, 1);

  assert.equal(enemy.currentHp, enemy.stats.maxHp - attacker.stats.attackDamage);
});

test("移動中でも接敵中のマスターは距離0.5の敵召喚獣を攻撃する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerRanged");
  attacker.position = { x: 0, y: 0 };
  attacker.destination = { x: 1, y: 0 };
  attacker.attackTimerSeconds = 0;
  for (const enemy of state.units.filter((unit) => unit.team === "Cpu")) {
    enemy.currentHp = 0;
    enemy.mode = "Defeated";
  }
  findLeader(state, "Cpu").position = { x: 10, y: 0 };
  state.summonedUnits.push({
    summonedUnitId: 1,
    team: "Cpu",
    position: { x: 0.5, y: 0 },
    destination: { x: 0.5, y: 0 },
    maxHp: 1000,
    currentHp: 1000,
    attackDamage: 90,
    leaderAttackDamage: 90,
    attackIntervalSeconds: 0.5,
    attackTimerSeconds: 0,
    leaderAttackIntervalSeconds: 2,
    leaderAttackTimerSeconds: 0,
    moveSpeed: 1,
    healthDecayPerSecond: 10
  });

  tickCombat(state, config, 1);

  assert.equal(state.summonedUnits[0].currentHp, 1000 - attacker.stats.attackDamage);
});

test("combat clears stale attack events before processing", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.position = { x: -5, y: 1.5 };
  unit.destination = { x: -5, y: 1.5 };
  unit.attackTimerSeconds = 5;
  state.recentAttackEvents.push({
    attackerUnitId: "PlayerMelee",
    origin: { x: 0, y: 0 },
    targetPosition: { x: 1, y: 0 }
  });

  tickCombat(state, config, 1);

  assert.deepEqual(state.recentAttackEvents, []);
});

test("movement is slowed near a live enemy elemental", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.position = { x: -5, y: 1.5 };
  unit.destination = { x: -5, y: 1.5 };
  applyMoveCommand(state, config, {
    commandType: "MoveUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: -4, y: 1.5 }
  });
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Cpu",
    position: { x: -5, y: 1.5 },
    maxHp: 120,
    currentHp: 120,
    isComplete: true
  });

  tickMovement(state, config, 1);

  assert.equal(Number(unit.position.x.toFixed(2)), -4.93);
});

test("movement is slowed at the Unit-to-Unit collision-circle boundary", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  const enemy = findUnit(state, "CpuMelee");
  unit.position = { x: 0, y: 0 };
  unit.destination = { x: 3, y: 0 };
  enemy.position = { x: 1.512, y: 0 };
  for (const candidate of state.units.filter(
    (value) => value.team === "Cpu" && value.unitId !== enemy.unitId
  )) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }

  tickMovement(state, config, 1);

  assert.equal(
    Number(unit.position.x.toFixed(6)),
    Number((unit.stats.moveSpeed * config.contactSlowMultiplier).toFixed(6))
  );
});

test("movement is slowed at the Unit-to-SummonedUnit collision-circle boundary", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  for (const candidate of state.units.filter((value) => value.team === "Cpu")) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }
  unit.position = { x: 0, y: 0 };
  unit.destination = { x: 3, y: 0 };
  state.summonedUnits.push({
    summonedUnitId: 1,
    team: "Cpu",
    position: { x: 1.7388, y: 0 },
    destination: { x: 1.7388, y: 0 },
    maxHp: 100,
    currentHp: 100,
    attackDamage: 0,
    leaderAttackDamage: 0,
    attackIntervalSeconds: 0.5,
    attackTimerSeconds: 0,
    leaderAttackIntervalSeconds: 2,
    leaderAttackTimerSeconds: 0,
    moveSpeed: 0,
    healthDecayPerSecond: 0
  });

  tickMovement(state, config, 1);

  assert.equal(
    Number(unit.position.x.toFixed(6)),
    Number((unit.stats.moveSpeed * config.contactSlowMultiplier).toFixed(6))
  );
});

test("movement is not slowed just beyond the Unit-to-Point collision-circle boundary", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  for (const candidate of state.units.filter((value) => value.team === "Cpu")) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }
  unit.position = { x: 0, y: 0 };
  unit.destination = { x: 3, y: 0 };
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Cpu",
    position: { x: 0.756 + 0.0001, y: 0 },
    maxHp: 100,
    currentHp: 100,
    isComplete: true
  });

  tickMovement(state, config, 1);

  assert.equal(
    Number(unit.position.x.toFixed(6)),
    Number(unit.stats.moveSpeed.toFixed(6))
  );
});

test("movement is slowed at the Unit-to-Point collision-circle boundary", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  for (const candidate of state.units.filter((value) => value.team === "Cpu")) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }
  unit.position = { x: 0, y: 0 };
  unit.destination = { x: 3, y: 0 };
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Cpu",
    position: { x: 0.756, y: 0 },
    maxHp: 100,
    currentHp: 100,
    isComplete: true
  });

  tickMovement(state, config, 1);

  assert.equal(
    Number(unit.position.x.toFixed(6)),
    Number((unit.stats.moveSpeed * config.contactSlowMultiplier).toFixed(6))
  );
});

test("allies and defeated enemies do not slow movement", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  const enemyUnit = findUnit(state, "CpuMelee");
  unit.position = { x: -5, y: 1.5 };
  unit.destination = { x: -5, y: 1.5 };
  enemyUnit.mode = "Defeated";
  enemyUnit.currentHp = 0;
  enemyUnit.position = { ...unit.position };
  applyMoveCommand(state, config, {
    commandType: "MoveUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: -4, y: 1.5 }
  });
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Player",
    position: { ...unit.position },
    maxHp: 120,
    currentHp: 120,
    isComplete: true
  });

  tickMovement(state, config, 1);

  assert.equal(Number(unit.position.x.toFixed(2)), -4.79);
});

test("attack timer gates combat damage", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerMelee");
  const enemy = findUnit(state, "CpuMelee");
  findUnit(state, "PlayerRanged").attackTimerSeconds = 10;
  attacker.position = { x: 0, y: 0 };
  attacker.destination = { x: 0, y: 0 };
  attacker.attackTimerSeconds = 0.5;
  enemy.position = { x: 1, y: 0 };
  enemy.destination = { x: 1, y: 0 };

  tickCombat(state, config, 0.25);

  assert.equal(enemy.currentHp, enemy.stats.maxHp);

  tickCombat(state, config, 0.25);

  assert.equal(enemy.currentHp, enemy.stats.maxHp - attacker.stats.attackDamage);
});

test("通常ユニットは通常ユニットへの攻撃を0.5秒ごとに行う", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerMelee");
  const enemy = findUnit(state, "CpuMelee");
  attacker.position = { x: 0, y: 0 };
  attacker.destination = { ...attacker.position };
  enemy.position = { x: 1, y: 0 };
  enemy.destination = { ...enemy.position };
  for (const ally of state.units.filter((unit) => unit.team === "Player" && unit.unitId !== attacker.unitId)) {
    ally.attackTimerSeconds = 10;
    ally.leaderAttackTimerSeconds = 10;
  }
  for (const candidate of state.units.filter(
    (unit) => unit.team === "Cpu" && unit.unitId !== enemy.unitId
  )) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }

  tickCombat(state, config, 0);
  const afterFirstAttack = enemy.currentHp;
  tickCombat(state, config, 0.49);
  assert.equal(enemy.currentHp, afterFirstAttack);
  tickCombat(state, config, 0.01);

  assert.equal(enemy.currentHp, afterFirstAttack - attacker.stats.attackDamage);
  assert.equal(attacker.attackTimerSeconds, 0.5);
});

test("通常ユニットは敵リーダーへの攻撃を1秒ごとに行う", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerMelee");
  attacker.position = { x: 0, y: 4.1 };
  attacker.destination = { ...attacker.position };
  for (const enemy of state.units.filter((unit) => unit.team === "Cpu")) {
    enemy.currentHp = 0;
    enemy.mode = "Defeated";
  }

  tickCombat(state, config, 0);
  const afterFirstAttack = findLeader(state, "Cpu").currentHp;
  tickCombat(state, config, 0.99);
  assert.equal(findLeader(state, "Cpu").currentHp, afterFirstAttack);
  tickCombat(state, config, 0.01);

  assert.equal(
    findLeader(state, "Cpu").currentHp,
    afterFirstAttack - attacker.stats.attackDamage * config.directLeaderDamageMultiplier
  );
  assert.equal(attacker.leaderAttackTimerSeconds, 1);
});

test("通常ユニットは敵召喚獣への攻撃後に通常対象用0.5秒タイマーを設定する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerRanged");
  attacker.position = { x: 0, y: 0 };
  attacker.destination = { ...attacker.position };
  findLeader(state, "Cpu").position = { x: 10, y: 0 };
  for (const enemy of state.units.filter((unit) => unit.team === "Cpu")) {
    enemy.currentHp = 0;
    enemy.mode = "Defeated";
  }
  state.summonedUnits.push({
    summonedUnitId: 1,
    team: "Cpu",
    position: { x: 1, y: 0 },
    destination: { x: 0, y: 0 },
    maxHp: 1000,
    currentHp: 1000,
    attackDamage: 99,
    leaderAttackDamage: 300,
    attackIntervalSeconds: 0.5,
    attackTimerSeconds: 0,
    leaderAttackIntervalSeconds: 2,
    leaderAttackTimerSeconds: 0,
    moveSpeed: 0,
    healthDecayPerSecond: 0
  });

  tickCombat(state, config, 0);

  assert.equal(state.summonedUnits[0].currentHp, 1000 - attacker.stats.attackDamage);
  assert.equal(attacker.attackTimerSeconds, 0.5);
  assert.equal(attacker.leaderAttackTimerSeconds, 0);
});

test("通常ユニットは通常ユニット用と敵リーダー用のタイマーを独立して減らす", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerRanged");
  const enemy = findUnit(state, "CpuMelee");
  attacker.position = { x: 0, y: 0 };
  attacker.destination = { ...attacker.position };
  enemy.position = { x: 0.5, y: 0 };
  enemy.destination = { ...enemy.position };
  findLeader(state, "Cpu").position = { x: 2, y: 0 };
  for (const candidate of state.units.filter(
    (unit) => unit.team === "Cpu" && unit.unitId !== enemy.unitId
  )) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }

  tickCombat(state, config, 0);
  assert.equal(attacker.attackTimerSeconds, 0.5);
  assert.equal(attacker.leaderAttackTimerSeconds, 0);

  enemy.position = { x: 10, y: 0 };
  tickCombat(state, config, 0);
  assert.equal(attacker.attackTimerSeconds, 0.5);
  assert.equal(attacker.leaderAttackTimerSeconds, 1);

  enemy.position = { x: 0.5, y: 0 };
  tickCombat(state, config, 0.5);
  assert.equal(attacker.attackTimerSeconds, 0.5);
  assert.equal(attacker.leaderAttackTimerSeconds, 0.5);

  enemy.position = { x: 10, y: 0 };
  tickCombat(state, config, 10);
  assert.equal(attacker.attackTimerSeconds, 0);
  assert.equal(attacker.leaderAttackTimerSeconds, 1);
});

test("通常ユニットは攻撃対象がなくても両方のタイマーを減らす", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerMelee");
  attacker.position = { x: -6, y: 0 };
  attacker.destination = { ...attacker.position };
  attacker.attackTimerSeconds = 0.25;
  attacker.leaderAttackTimerSeconds = 0.75;
  findLeader(state, "Cpu").position = { x: 6, y: 0 };
  for (const enemy of state.units.filter((unit) => unit.team === "Cpu")) {
    enemy.currentHp = 0;
    enemy.mode = "Defeated";
  }

  tickCombat(state, config, 0.5);
  assert.equal(attacker.attackTimerSeconds, 0);
  assert.equal(attacker.leaderAttackTimerSeconds, 0.25);

  tickCombat(state, config, 1);
  assert.equal(attacker.attackTimerSeconds, 0);
  assert.equal(attacker.leaderAttackTimerSeconds, 0);
});
