import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader, findUnit } from "../core/battleState";
import { planCpuCommands } from "./cpuPlanner";

test("CPU revives the oldest defeated unit at its leader when it has enough MP", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const older = findUnit(state, "CpuSpeed");
  const newer = findUnit(state, "CpuMelee");
  older.mode = "Defeated";
  older.currentHp = 0;
  older.defeatedOrder = 1;
  newer.mode = "Defeated";
  newer.currentHp = 0;
  newer.defeatedOrder = 2;
  state.phase = "InProgress";
  state.cpuMp = 3;

  assert.deepEqual(planCpuCommands(state, config), [{
    commandType: "ReviveUnit",
    team: "Cpu",
    unitId: "CpuSpeed",
    targetPosition: { ...findLeader(state, "Cpu").position }
  }]);
});

test("CPU keeps existing planning when MP is insufficient for revival", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "CpuMelee");
  unit.mode = "Defeated";
  unit.currentHp = 0;
  unit.defeatedOrder = 1;
  state.phase = "InProgress";
  state.cpuMp = 2;

  assert.deepEqual(planCpuCommands(state, config), [{
    commandType: "BeginElementalBuild",
    team: "Cpu",
    unitId: "CpuSpeed"
  }]);
});

test("CPUは召喚可能なら召喚を最優先する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.elementals.push(
    { elementalId: "Elemental1", team: "Cpu", position: { x: 5, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Cpu", position: { x: 4, y: 1 }, maxHp: 120, currentHp: 120, isComplete: true }
  );
  state.cpuSummonGauge = 1;

  assert.deepEqual(planCpuCommands(state, config), [{ commandType: "Summon", team: "Cpu" }]);
});

test("CPUは召喚できないときエレメンタル生成を開始する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const commands = planCpuCommands(state, config);
  assert.equal(commands[0].commandType, "BeginElementalBuild");
  assert.equal(commands[0].team, "Cpu");
});

test("CPUは配置可能な別ユニットでエレメンタル生成を開始する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const cpuMelee = state.units.find((unit) => unit.unitId === "CpuMelee")!;
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Cpu",
    position: { ...cpuMelee.position },
    maxHp: 120,
    currentHp: 120,
    isComplete: true
  });

  assert.deepEqual(planCpuCommands(state, config), [
    { commandType: "BeginElementalBuild", team: "Cpu", unitId: "CpuSpeed" }
  ]);
});

test("CPUは全ユニットがエレメンタルを配置できないときプレイヤーリーダーへ移動する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const cpuUnits = state.units.filter((unit) => unit.team === "Cpu");
  const elementalIds = ["Elemental1", "Elemental2", "Elemental3"] as const;
  state.elementals.push(...cpuUnits.map((unit, index) => ({
    elementalId: elementalIds[index],
    team: "Cpu" as const,
    position: { ...unit.position },
    maxHp: 120,
    currentHp: 120,
    isComplete: true
  })));

  const commands = planCpuCommands(state, config);

  assert.equal(commands.length, 3);
  assert(commands.every((command) => command.commandType === "MoveUnit"));
  assert(commands.every((command) => command.team === "Cpu"));
  assert(commands.every(
    (command) => command.commandType !== "MoveUnit" ||
      (command.targetPosition.x === 0 && command.targetPosition.y === -4.1)
  ));
});

test("CPUは完成済みと生成中の合計が上限なら移動する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.cpuSummonGauge = 0.5;
  state.elementals.push(
    { elementalId: "Elemental1", team: "Cpu", position: { x: 5, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Cpu", position: { x: 4, y: 1 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental3", team: "Cpu", position: { x: 4, y: -1 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental4", team: "Cpu", position: { x: 3, y: 1 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental5", team: "Cpu", position: { x: 3, y: -1 }, maxHp: 120, currentHp: 120, isComplete: true }
  );
  const buildingUnit = state.units.find((unit) => unit.unitId === "CpuMelee")!;
  buildingUnit.mode = "BuildingElemental";
  buildingUnit.pendingElementalId = "Elemental6";
  buildingUnit.buildTimerSeconds = buildingUnit.stats.elementalBuildSeconds;

  const commands = planCpuCommands(state, config);

  assert.equal(commands.length, 2);
  assert.deepEqual(
    commands.map((command) => command.commandType),
    ["MoveUnit", "MoveUnit"]
  );
  assert(commands.every((command) => command.team === "Cpu"));
});
