import { findUnit, isUnitAlive } from "../core/battleState";
import type { BattleConfig, BattleState, ElementalId, ElementalState, TeamId, UnitId } from "../core/types";

const elementalIds: ElementalId[] = [
  "Elemental1",
  "Elemental2",
  "Elemental3",
  "Elemental4",
  "Elemental5",
  "Elemental6",
  "Elemental7",
  "Elemental8"
];

export function tryBeginElementalBuild(state: BattleState, config: BattleConfig, unitId: UnitId): boolean {
  const unit = findUnit(state, unitId);
  if (!isUnitAlive(unit) || unit.mode !== "Active") {
    return false;
  }
  const completedCount = countCompletedElementals(state, unit.team);
  const pendingCount = state.units.filter((candidate) => candidate.team === unit.team && candidate.mode === "BuildingElemental").length;
  if (completedCount + pendingCount >= config.maxElementalsPerTeam) {
    return false;
  }
  const nextId = nextAvailableElementalId(state);
  if (!nextId) {
    return false;
  }
  unit.mode = "BuildingElemental";
  unit.buildTimerSeconds = config.elementalBuildSeconds;
  unit.pendingElementalId = nextId;
  return true;
}

export function tickElementalBuilds(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  for (const unit of state.units) {
    if (unit.mode !== "BuildingElemental" || !unit.pendingElementalId || !isUnitAlive(unit)) {
      continue;
    }
    unit.buildTimerSeconds = Math.max(0, unit.buildTimerSeconds - deltaSeconds);
    if (unit.buildTimerSeconds > 0) {
      continue;
    }
    state.elementals.push({
      elementalId: unit.pendingElementalId,
      team: unit.team,
      position: { ...unit.position },
      maxHp: config.elementalMaxHp,
      currentHp: config.elementalMaxHp,
      isComplete: true
    });
    unit.mode = "Active";
    unit.pendingElementalId = null;
    unit.buildTimerSeconds = 0;
  }
}

export function removeDestroyedElementals(state: BattleState): void {
  state.elementals = state.elementals.filter((elemental) => elemental.currentHp > 0);
}

export function countCompletedElementals(state: BattleState, team: TeamId): number {
  return state.elementals.filter((elemental) => elemental.team === team && elemental.isComplete && elemental.currentHp > 0).length;
}

export function completedElementalsForTeam(state: BattleState, team: TeamId): ElementalState[] {
  return state.elementals.filter((elemental) => elemental.team === team && elemental.isComplete && elemental.currentHp > 0);
}

function nextAvailableElementalId(state: BattleState): ElementalId | null {
  const used = new Set<ElementalId>();
  for (const elemental of state.elementals) {
    if (elemental.currentHp > 0) {
      used.add(elemental.elementalId);
    }
  }
  for (const unit of state.units) {
    if (unit.pendingElementalId) {
      used.add(unit.pendingElementalId);
    }
  }
  return elementalIds.find((id) => !used.has(id)) ?? null;
}
