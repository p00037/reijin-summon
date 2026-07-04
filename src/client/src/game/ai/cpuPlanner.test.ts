import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState } from "../core/battleState";
import { planCpuCommands } from "./cpuPlanner";

test("CPUは召喚可能なら召喚を最優先する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.elementals.push(
    { elementalId: "Elemental1", team: "Cpu", position: { x: 5, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Cpu", position: { x: 4, y: 1 }, maxHp: 120, currentHp: 120, isComplete: true }
  );

  assert.deepEqual(planCpuCommands(state, config), [{ commandType: "Summon", team: "Cpu" }]);
});

test("CPUは召喚できないときエレメンタル生成を開始する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const commands = planCpuCommands(state, config);
  assert.equal(commands[0].commandType, "BeginElementalBuild");
  assert.equal(commands[0].team, "Cpu");
});
