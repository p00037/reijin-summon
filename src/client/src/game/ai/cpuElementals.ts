import { isUnitAlive } from "../core/battleState";
import type { BattleConfig, BattleState, UnitState, Vec2 } from "../core/types";
import { distanceSq } from "@reijin-summon/shared/core/vector";
import { effectiveAttackRange } from "../rules/abilitySystem";
import { getSummonBeam, isCircleInBeam } from "@reijin-summon/shared/rules/summonGeometry";
import { cpuFieldPosition } from "./cpuDeck";

export function cpuBuildSites(config: BattleConfig, wide = false): Vec2[] {
  return [
    cpuFieldPosition(config, 0, .18),
    cpuFieldPosition(config, -.28, .28),
    cpuFieldPosition(config, .28, .28),
    cpuFieldPosition(config, wide ? -.36 : -.32, wide ? .56 : .5),
    cpuFieldPosition(config, wide ? .36 : .32, wide ? .56 : .5),
    cpuFieldPosition(config, 0, wide ? .64 : .58)
  ];
}

export function isCpuBuildSafe(
  state: BattleState, config: BattleConfig, position: Vec2, buildSeconds: number
): boolean {
  const threatenedByUnit = state.units.some(enemy => {
    if (enemy.team !== "Player" || !isUnitAlive(enemy) || enemy.mode !== "Active") return false;
    const approaching = distanceSq(enemy.position, enemy.destination) > .01;
    const reach = effectiveAttackRange(enemy, config) + .5
      + (approaching ? enemy.stats.moveSpeed * Math.min(2, buildSeconds) : 0);
    return distanceSq(position, enemy.position) <= reach ** 2;
  });
  const threatenedBySummon = state.summonedUnits.some(enemy => {
    if (enemy.team !== "Player" || enemy.currentHp <= 0) return false;
    if (enemy.summonId === "jackpot") {
      return isCircleInBeam(position, config.unitCollisionRadius, getSummonBeam(enemy, state, config));
    }
    return enemy.moveSpeed > 0 && distanceSq(position, enemy.position)
      <= (config.unitCollisionRadius + config.summonedUnitCollisionRadius + enemy.moveSpeed * 2) ** 2;
  });
  return !threatenedByUnit && !threatenedBySummon;
}

export function chooseCpuBuildSite(
  state: BattleState, config: BattleConfig, unit: UnitState, reserved: readonly Vec2[], sites?: readonly Vec2[]
): Vec2 | undefined {
  const occupied = [
    ...state.elementals.filter(e => e.currentHp > 0).map(e => e.position),
    ...state.units.filter(u => u.mode === "BuildingElemental" && isUnitAlive(u)).map(u => u.position),
    ...reserved
  ];
  const spacing = Math.max(.8, config.elementalPlacementRadius * 2);
  const wide = state.units.some(candidate => candidate.team === "Cpu" && candidate.cardId === "SC015");
  return [...(sites ?? cpuBuildSites(config, wide))]
    .filter(position => occupied.every(other => distanceSq(position, other) > spacing ** 2))
    .filter(position => isCpuBuildSafe(state, config, position, unit.stats.elementalBuildSeconds))
    .sort((left, right) => distanceSq(unit.position, left) - distanceSq(unit.position, right))[0];
}
