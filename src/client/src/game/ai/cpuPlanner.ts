import { findLeader, isUnitAlive } from "../core/battleState";
import type { BattleCommand, BattleConfig, BattleState, CpuUnitId, UnitState } from "../core/types";
import { canPlaceElementalAtUnit, countCompletedElementals } from "../rules/elementalSystem";
import { canReviveUnit } from "../rules/resurrectionSystem";
import { canSummon } from "../rules/summonSystem";

export function planCpuCommands(state: BattleState, config: BattleConfig): BattleCommand[] {
  const cpuLeader = findLeader(state, "Cpu");
  const reviveTargetPosition = { ...cpuLeader.position };
  const reviveCandidate = state.units
    .filter((unit) => unit.team === "Cpu" && unit.mode === "Defeated" && unit.defeatedOrder !== null)
    .sort((left, right) => left.defeatedOrder! - right.defeatedOrder!)
    .find((unit) => canReviveUnit(state, config, "Cpu", unit.unitId, reviveTargetPosition));
  if (reviveCandidate) {
    return [{
      commandType: "ReviveUnit",
      team: "Cpu",
      unitId: reviveCandidate.unitId,
      targetPosition: reviveTargetPosition
    }];
  }

  if (canSummon(state, config, "Cpu")) {
    return [{ commandType: "Summon", team: "Cpu" }];
  }

  const cpuUnits = state.units.filter(isActiveAliveCpuUnit);
  const firstAvailableUnit = cpuUnits[0];
  if (!firstAvailableUnit) {
    return [];
  }

  if (countCpuElementalsIncludingPending(state) < config.maxElementalsPerTeam) {
    const placementUnit = cpuUnits.find((unit) => canPlaceElementalAtUnit(state, config, unit.unitId));
    if (placementUnit) {
      return [{ commandType: "BeginElementalBuild", team: "Cpu", unitId: placementUnit.unitId }];
    }
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

function countCpuElementalsIncludingPending(state: BattleState): number {
  return (
    countCompletedElementals(state, "Cpu") +
    state.units.filter((unit) => unit.team === "Cpu" && unit.mode === "BuildingElemental").length
  );
}
