import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "./battleConfig";
import { createDefaultBattleState, findLeader, findUnit } from "./battleState";
import type { BattleCommand } from "./types";

test("既定状態は左右のリーダーと各3体の通常ユニットを持つ", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(state.remainingSeconds, 180);
  assert.equal(state.leaders.length, 2);
  assert.equal(state.units.length, 6);
  assert.equal(findLeader(state, "Player").currentHp, 1000);
  assert.equal(findLeader(state, "Cpu").position.x, 7);
  assert.equal(findUnit(state, "PlayerMelee").unitType, "Melee");
  assert.equal(findUnit(state, "CpuRanged").position.y, -1.5);
});

test("既定設定と既定状態は可変のステータス参照を共有しない", () => {
  const firstConfig = createDefaultBattleConfig();
  const secondConfig = createDefaultBattleConfig();

  firstConfig.statsByType.Melee.maxHp = 1;

  assert.equal(secondConfig.statsByType.Melee.maxHp, 350);
  assert.equal(createDefaultBattleConfig().statsByType.Melee.maxHp, 350);

  const firstState = createDefaultBattleState(createDefaultBattleConfig());
  const secondState = createDefaultBattleState(createDefaultBattleConfig());

  findUnit(firstState, "PlayerMelee").stats.maxHp = 1;

  assert.equal(findUnit(secondState, "PlayerMelee").stats.maxHp, 350);
});

const validPlayerMoveCommand: BattleCommand = {
  commandType: "MoveUnit",
  team: "Player",
  unitId: "PlayerMelee",
  targetPosition: { x: 0, y: 0 }
};

const validCpuBuildCommand: BattleCommand = {
  commandType: "BeginElementalBuild",
  team: "Cpu",
  unitId: "CpuRanged"
};

const validSummonCommand: BattleCommand = {
  commandType: "Summon",
  team: "Cpu"
};

assert.equal(validPlayerMoveCommand.team, "Player");
assert.equal(validCpuBuildCommand.team, "Cpu");
assert.equal(validSummonCommand.commandType, "Summon");

const invalidPlayerMoveCommand: BattleCommand = {
  commandType: "MoveUnit",
  team: "Player",
  // @ts-expect-error Player commands cannot target Cpu units.
  unitId: "CpuMelee",
  targetPosition: { x: 0, y: 0 }
};

const invalidCpuBuildCommand: BattleCommand = {
  commandType: "BeginElementalBuild",
  team: "Cpu",
  // @ts-expect-error Cpu commands cannot build with Player units.
  unitId: "PlayerRanged"
};

assert.equal(invalidPlayerMoveCommand.commandType, "MoveUnit");
assert.equal(invalidCpuBuildCommand.commandType, "BeginElementalBuild");
