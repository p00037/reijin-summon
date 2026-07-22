import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import type { BattleCommand } from "../core/types";
import { GameSession } from "./gameSession";

test("CPUリーダーHPが0になるとPlayerWinになる", () => {
  const session = new GameSession();
  session.state.leaders.find((leader) => leader.team === "Cpu")!.currentHp = 0;
  session.tick(0);
  assert.equal(session.state.result, "PlayerWin");
});

test("moving into the leader healing area only counts time after entry", () => {
  const config = createDefaultBattleConfig();
  config.statsByType.Speed.moveSpeed = 1;
  const session = new GameSession(config);
  const unit = session.state.units.find((candidate) => candidate.unitId === "PlayerSpeed")!;
  unit.position = { x: 0, y: -7 };
  unit.destination = { x: 0, y: -4.1 };
  unit.currentHp = 500;
  unit.leaderHealingElapsedSeconds = 1;

  session.tick(3);

  assert.equal(unit.currentHp, 606);
  assert.equal(Number(unit.leaderHealingElapsedSeconds.toFixed(2)), 1.1);
});

test("moving keeper only counts rest time after reaching its destination", () => {
  const config = createDefaultBattleConfig();
  config.statsByType.Melee.moveSpeed = 1;
  const session = new GameSession(config);
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
  const session = new GameSession(config);
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
  const session = new GameSession();
  session.state.remainingSeconds = 0.1;
  session.state.leaders.find((leader) => leader.team === "Player")!.currentHp = 900;
  session.state.leaders.find((leader) => leader.team === "Cpu")!.currentHp = 800;
  session.tick(0.2);
  assert.equal(session.state.result, "PlayerWin");
});

test("戦闘中に撃破されたユニットの復活タイマーは同じtickのdeltaを失わない", () => {
  const session = new GameSession();
  const playerUnit = session.state.units.find((unit) => unit.unitId === "PlayerMelee")!;
  const cpuUnit = session.state.units.find((unit) => unit.unitId === "CpuMelee")!;
  playerUnit.position = { x: 0, y: 0 };
  playerUnit.destination = { x: 0, y: 0 };
  cpuUnit.position = { x: 0.5, y: 0 };
  cpuUnit.destination = { x: 0.5, y: 0 };
  cpuUnit.currentHp = 1;

  session.tick(1);

  assert.equal(cpuUnit.mode, "Defeated");
  assert.equal(cpuUnit.respawnTimerSeconds, session.config.unitRespawnSeconds);
});

test("BeginElementalBuildはコマンドのteamと実ユニットteamが違う場合は無視する", () => {
  const session = new GameSession();
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
