import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader, findUnit } from "../core/battleState";
import { applyMoveCommand, tickCombat, tickMovement, tickRespawns } from "./unitSystem";

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
  assert.deepEqual(unit.destination, { x: 7.5, y: -4.5 });
});

test("ユニットは目標へ移動する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");

  applyMoveCommand(state, config, {
    commandType: "MoveUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: -4, y: 1.5 }
  });
  tickMovement(state, config, 3);

  assert.equal(Number(unit.position.x.toFixed(2)), -4);
});

test("攻撃範囲内の敵リーダーへ直接ダメージを与える", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.position = { x: 6.4, y: 0 };
  unit.destination = { x: 6.4, y: 0 };
  unit.attackTimerSeconds = 0;

  tickCombat(state, config, 1.2);

  assert.equal(findLeader(state, "Cpu").currentHp, 1000 - 45 * 0.25);
});

test("撃破された通常ユニットは復活タイマー後にスポーン位置へ戻る", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerSpeed");
  unit.currentHp = 0;
  unit.mode = "Defeated";
  unit.respawnTimerSeconds = 10;
  unit.position = { x: 0, y: 0 };

  tickRespawns(state, 10);

  assert.equal(unit.mode, "Active");
  assert.equal(unit.currentHp, unit.stats.maxHp);
  assert.deepEqual(unit.position, unit.spawnPosition);
});

test("戦闘tickは撃破済みユニットの復活タイマーを巻き戻さない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerSpeed");
  unit.currentHp = 0;
  unit.mode = "Defeated";
  unit.respawnTimerSeconds = 4;

  tickCombat(state, config, 1);

  assert.equal(unit.respawnTimerSeconds, 4);
});

test("生成中ユニットの撃破は生成を解除して復活待ちにする", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerSpeed");
  unit.currentHp = 0;
  unit.mode = "BuildingElemental";
  unit.buildTimerSeconds = 3;
  unit.pendingElementalId = "Elemental1";

  tickCombat(state, config, 1);

  assert.equal(unit.mode, "Defeated");
  assert.equal(unit.respawnTimerSeconds, 10);
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

test("combat clears stale attack events before processing", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
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

  assert.equal(Number(unit.position.x.toFixed(2)), -4.61);
});

test("allies and defeated enemies do not slow movement", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  const enemyUnit = findUnit(state, "CpuMelee");
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

  assert.equal(Number(unit.position.x.toFixed(2)), -4);
});

test("attack timer gates combat damage", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerMelee");
  const enemy = findUnit(state, "CpuMelee");
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
