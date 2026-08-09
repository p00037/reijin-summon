import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { findLeader, findUnit } from "../core/battleState";
import type { BattleCommand } from "../core/types";
import { GameSession } from "./gameSession";

function createStartedSession(config = createDefaultBattleConfig()): GameSession {
  const session = new GameSession(config);
  session.applyCommand({ commandType: "StartBattle", team: "Player" });
  session.tick(config.countdownSeconds);
  return session;
}

test("戦闘中にMP自然回復が進む", () => {
  const session = new GameSession();
  session.tick(25);
  assert.equal(session.state.playerMp, 0);
  session.applyCommand({ commandType: "StartBattle", team: "Player" });
  session.tick(session.config.countdownSeconds);

  session.tick(-25);
  assert.equal(session.state.playerMpRecoveryProgress, 0);
  assert.equal(session.state.remainingSeconds, session.config.matchDurationSeconds);

  session.tick(25);
  assert.equal(session.state.playerMp, 1);
});

test("ReviveUnitコマンドの成功時だけMPを一度消費する", () => {
  const session = createStartedSession();
  const unit = findUnit(session.state, "PlayerMelee");
  unit.mode = "Defeated";
  unit.currentHp = 0;
  session.state.playerMp = 6;
  const command = {
    commandType: "ReviveUnit" as const,
    team: "Player" as const,
    unitId: unit.unitId,
    targetPosition: { ...findLeader(session.state, "Player").position }
  };

  session.applyCommand(command);
  session.applyCommand(command);

  assert.equal(session.state.playerMp, 3);
  assert.equal(unit.mode, "Active");
});

test("通常ユニットがリーダーへ与えた実ダメージ800でMP1回復する", () => {
  const session = createStartedSession();
  const attacker = findUnit(session.state, "CpuMelee");
  const leader = findLeader(session.state, "Player");
  attacker.position = { ...leader.position };
  attacker.destination = { ...leader.position };
  attacker.stats.attackDamage = 800;
  session.config.directLeaderDamageMultiplier = 1;
  for (const playerUnit of session.state.units.filter((unit) => unit.team === "Player")) {
    playerUnit.mode = "Defeated";
    playerUnit.currentHp = 0;
  }

  session.tick(0);

  assert.equal(session.state.playerMp, 1);
});

test("召喚獣がリーダーへ与えた実ダメージ800でMP1回復する", () => {
  const session = createStartedSession();
  const leader = findLeader(session.state, "Player");
  session.state.summonedUnits.push({
    summonedUnitId: 99,
    team: "Cpu",
    position: { ...leader.position },
    destination: { ...leader.position },
    maxHp: 1000,
    currentHp: 1000,
    attackDamage: 0,
    leaderAttackDamage: 800,
    attackIntervalSeconds: 0.5,
    attackTimerSeconds: 0,
    leaderAttackIntervalSeconds: 2,
    leaderAttackTimerSeconds: 0,
    moveSpeed: 0,
    healthDecayPerSecond: 0
  });

  session.tick(0);

  assert.equal(session.state.playerMp, 1);
});

test("Setup中は初期配置だけを受け付けて戦闘時間を進めない", () => {
  const session = new GameSession();

  session.applyCommand({
    commandType: "PlaceInitialUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: -4, y: -2 }
  });
  session.applyCommand({
    commandType: "MoveUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: 4, y: 2 }
  });
  session.tick(10);

  assert.deepEqual(
    session.state.units.find((unit) => unit.unitId === "PlayerMelee")!.position,
    { x: -4, y: -2 }
  );
  assert.equal(session.state.remainingSeconds, 300);
});

test("StartBattleは5秒のカウントダウン後に戦闘を開始する", () => {
  const session = new GameSession();

  session.applyCommand({ commandType: "StartBattle", team: "Player" });
  assert.equal(session.state.phase, "Countdown");
  assert.equal(session.state.countdownRemainingSeconds, 5);

  session.tick(1.25);
  assert.equal(session.state.phase, "Countdown");
  assert.equal(session.state.countdownRemainingSeconds, 3.75);
  assert.equal(session.state.remainingSeconds, 300);

  session.tick(0);
  assert.equal(session.state.countdownRemainingSeconds, 3.75);

  session.tick(-1);
  assert.equal(session.state.countdownRemainingSeconds, 3.75);

  session.tick(10);
  assert.equal(session.state.phase, "InProgress");
  assert.equal(session.state.countdownRemainingSeconds, 0);
  assert.equal(session.state.remainingSeconds, 300);

  session.tick(1);
  assert.equal(session.state.remainingSeconds, 299);
});

test("CPUを指定した壊れた初期配置コマンドはSetup状態を変更しない", () => {
  const session = new GameSession();
  const stateBefore = structuredClone(session.state);
  const malformedCommand = {
    commandType: "PlaceInitialUnit",
    team: "Cpu",
    unitId: "PlayerMelee",
    targetPosition: { x: -4, y: -2 }
  } as unknown as BattleCommand;

  session.applyCommand(malformedCommand);

  assert.deepEqual(session.state, stateBefore);
});

test("CPUを指定した壊れた戦闘開始コマンドはSetup状態を変更しない", () => {
  const session = new GameSession();
  const stateBefore = structuredClone(session.state);
  const malformedCommand = {
    commandType: "StartBattle",
    team: "Cpu"
  } as unknown as BattleCommand;

  session.applyCommand(malformedCommand);

  assert.deepEqual(session.state, stateBefore);
});

test("Countdown中の重複開始と初期配置を拒否する", () => {
  const session = new GameSession();
  session.applyCommand({ commandType: "StartBattle", team: "Player" });
  session.tick(1);

  session.applyCommand({ commandType: "StartBattle", team: "Player" });
  session.applyCommand({
    commandType: "PlaceInitialUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: -4, y: -2 }
  });

  assert.equal(session.state.countdownRemainingSeconds, 4);
  assert.deepEqual(
    session.state.units.find((unit) => unit.unitId === "PlayerMelee")!.position,
    { x: -2.4, y: -3 }
  );
});

test("CPUリーダーHPが0になるとPlayerWinになる", () => {
  const session = createStartedSession();
  session.state.leaders.find((leader) => leader.team === "Cpu")!.currentHp = 0;
  session.tick(0);
  assert.equal(session.state.result, "PlayerWin");
});

test("終了判定を発生させたRanged攻撃イベントは次tickで破棄される", () => {
  for (const ending of ["FatalAttack", "TimeLimit"] as const) {
    const session = createStartedSession();
    const attacker = session.state.units.find(
      (unit) => unit.unitId === "PlayerRanged"
    )!;
    const cpuLeader = session.state.leaders.find(
      (leader) => leader.team === "Cpu"
    )!;
    attacker.position = { ...cpuLeader.position };
    attacker.destination = { ...attacker.position };
    for (const enemy of session.state.units.filter(
      (unit) => unit.team === "Cpu"
    )) {
      enemy.position = { x: -6, y: -4 };
      enemy.destination = { ...enemy.position };
      enemy.attackTimerSeconds = 10;
      enemy.leaderAttackTimerSeconds = 10;
    }

    if (ending === "FatalAttack") {
      cpuLeader.currentHp = 1;
    } else {
      cpuLeader.currentHp = 7000;
      session.state.remainingSeconds = 0.1;
    }

    session.tick(ending === "FatalAttack" ? 0 : 0.1);

    assert.equal(session.state.result, "PlayerWin", ending);
    assert.deepEqual(
      session.state.recentAttackEvents.map((event) => event.attackerUnitId),
      ["PlayerRanged"],
      ending
    );

    session.tick(0);

    assert.deepEqual(session.state.recentAttackEvents, [], ending);
  }
});

test("moving into the leader healing area only counts time after entry", () => {
  const config = createDefaultBattleConfig();
  config.statsByType.Speed.moveSpeed = 1;
  const session = createStartedSession(config);
  const unit = session.state.units.find((candidate) => candidate.unitId === "PlayerSpeed")!;
  unit.position = { x: 0, y: -7 };
  unit.destination = { x: 0, y: -4.1 };
  unit.currentHp = 500;
  unit.leaderHealingElapsedSeconds = 1;

  session.tick(3);

  assert.equal(unit.currentHp, 606);
  assert.equal(Number(unit.leaderHealingElapsedSeconds.toFixed(2)), 1.1);
});

test("stopped keeper in the leader healing area receives both periodic heals", () => {
  const session = createStartedSession();
  const keeper = session.state.units.find((candidate) => candidate.unitId === "PlayerMelee")!;
  keeper.position = { ...session.state.leaders.find((leader) => leader.team === "Player")!.position };
  keeper.destination = { ...keeper.position };
  keeper.currentHp = 500;

  session.tick(2);

  assert.equal(keeper.currentHp, 500 + 110 + 60);
});

test("moving keeper only counts rest time after reaching its destination", () => {
  const config = createDefaultBattleConfig();
  config.statsByType.Melee.moveSpeed = 1;
  const session = createStartedSession(config);
  const keeper = session.state.units.find((candidate) => candidate.unitId === "PlayerMelee")!;
  keeper.position = { x: 5, y: 0 };
  keeper.destination = { x: 6, y: 0 };
  keeper.currentHp = 500;
  keeper.restHealingElapsedSeconds = 0.25;

  session.tick(3);

  assert.equal(keeper.currentHp, 560);
  assert.equal(Number(keeper.restHealingElapsedSeconds.toFixed(2)), 0.75);
});

test("keeper completing an elemental build only counts rest time after completion", () => {
  const config = createDefaultBattleConfig();
  const session = createStartedSession(config);
  const keeper = session.state.units.find((candidate) => candidate.unitId === "PlayerMelee")!;
  keeper.position = { x: 5, y: 0 };
  keeper.destination = { ...keeper.position };
  keeper.currentHp = 500;
  keeper.mode = "BuildingElemental";
  keeper.buildTimerSeconds = 2;
  keeper.pendingElementalId = "Elemental1";
  keeper.restHealingElapsedSeconds = 0.25;

  session.tick(3);

  assert.equal(keeper.currentHp, 500);
  assert.equal(Number(keeper.restHealingElapsedSeconds.toFixed(2)), 1);
});

test("時間切れ時はリーダーHPの高い側が勝つ", () => {
  const session = createStartedSession();
  session.state.remainingSeconds = 0.1;
  session.state.leaders.find((leader) => leader.team === "Player")!.currentHp = 900;
  session.state.leaders.find((leader) => leader.team === "Cpu")!.currentHp = 800;
  session.tick(0.2);
  assert.equal(session.state.result, "PlayerWin");
});

test("戦闘中に撃破されたユニットに撤退順を記録する", () => {
  const session = createStartedSession();
  const playerUnit = session.state.units.find((unit) => unit.unitId === "PlayerMelee")!;
  const cpuUnit = session.state.units.find((unit) => unit.unitId === "CpuMelee")!;
  playerUnit.position = { x: 0, y: 0 };
  playerUnit.destination = { x: 0, y: 0 };
  cpuUnit.position = { x: 0.5, y: 0 };
  cpuUnit.destination = { x: 0.5, y: 0 };
  cpuUnit.currentHp = 1;

  session.tick(1);

  assert.equal(cpuUnit.mode, "Defeated");
  assert.equal(cpuUnit.defeatedOrder, 1);
});

test("BeginElementalBuildはコマンドのteamと実ユニットteamが違う場合は無視する", () => {
  const session = createStartedSession();
  const cpuUnit = session.state.units.find((unit) => unit.unitId === "CpuMelee")!;
  const malformedCommand = {
    commandType: "BeginElementalBuild",
    team: "Player",
    unitId: "CpuMelee"
  } as unknown as BattleCommand;

  session.applyCommand(malformedCommand);

  assert.equal(cpuUnit.mode, "Active");
  assert.equal(cpuUnit.pendingElementalId, null);
});
