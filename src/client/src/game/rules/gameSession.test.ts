import test from "node:test";
import assert from "node:assert/strict";
import type { BattleCommand } from "../core/types";
import { GameSession } from "./gameSession";

test("CPUリーダーHPが0になるとPlayerWinになる", () => {
  const session = new GameSession();
  session.state.leaders.find((leader) => leader.team === "Cpu")!.currentHp = 0;
  session.tick(0);
  assert.equal(session.state.result, "PlayerWin");
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
