import { findLeader, isUnitAlive } from "../core/battleState";
import type { BattleCommand, BattleConfig, BattleState, CpuUnitId, UnitState } from "../core/types";
import { countCompletedElementals } from "../rules/elementalSystem";
import { canSummon } from "../rules/summonSystem";

export function planCpuCommands(state: BattleState, config: BattleConfig): BattleCommand[] {
  if (canSummon(state, config, "Cpu")) {
    return [{ commandType: "Summon", team: "Cpu" }];
  }

  const cpuUnits = state.units.filter(isActiveAliveCpuUnit);
  const firstAvailableUnit = cpuUnits[0];
  if (!firstAvailableUnit) {
    return [];
  }

  if (countCompletedElementals(state, "Cpu") < config.maxElementalsPerTeam) {
    return [{ commandType: "BeginElementalBuild", team: "Cpu", unitId: firstAvailableUnit.unitId }];
  }

  const playerLeader = findLeader(state, "Player");
  return cpuUnits.map((unit) => ({
    commandType: "MoveUnit",
    team: "Cpu",
    unitId: unit.unitId,
    targetPosition: { ...playerLeader.position }
  }));
}

function isActiveAliveCpuUnit(unit: UnitState): unit is UnitState & { unitId: CpuUnitId; team: "Cpu"; mode: "Active" } {
  return unit.team === "Cpu" && unit.unitId.startsWith("Cpu") && unit.mode === "Active" && isUnitAlive(unit);
}
