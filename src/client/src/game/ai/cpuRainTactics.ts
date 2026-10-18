import { findLeader, isUnitAlive } from "../core/battleState";
import type { BattleConfig, BattleState, UnitState, Vec2 } from "../core/types";
import { clampVec2, distanceSq } from "@reijin-summon/shared/core/vector";
import { effectiveIntelligence, intelligenceMultiplier } from "@reijin-summon/shared/rules/abilityEffects";
import { abilityTargets, canUseAbility, effectiveAttackRange } from "../rules/abilitySystem";
import { cpuFieldPosition } from "./cpuDeck";

function waveKills(caster: UnitState, target: UnitState): boolean {
  return target.currentHp <= 415 * intelligenceMultiplier(effectiveIntelligence(caster), effectiveIntelligence(target));
}

export function shouldUseCpuWave(state: BattleState, config: BattleConfig, darius: UnitState, threatened: boolean): boolean {
  if (!canUseAbility(state, config, darius.unitId, 0)) return false;
  if (!threatened && cpuWavePosition(state, config, darius)) return false;
  const targets = abilityTargets(state, config, darius.unitId, 0).unitIds
    .map(id => state.units.find(unit => unit.unitId === id)!);
  return targets.length >= 2 || targets.some(target => waveKills(darius, target))
    || threatened && targets.some(target => distanceSq(target.position, findLeader(state, "Cpu").position) < 3 ** 2);
}

export function cpuWavePosition(state: BattleState, config: BattleConfig, darius: UnitState): Vec2 | undefined {
  if (darius.abilityAp < 3) return undefined;
  const middle = (config.battlefieldMin.y + config.battlefieldMax.y) / 2;
  const targets = state.units.filter(unit => unit.team === "Player" && isUnitAlive(unit));
  const lower = targets.filter(unit => unit.position.y <= middle);
  const upper = targets.filter(unit => unit.position.y >= middle);
  const value = (units: UnitState[]) => units.length + units.filter(unit => waveKills(darius, unit)).length;
  const useLower = value(lower) > value(upper);
  const best = useLower ? lower : upper;
  const currentlyLower = darius.position.y < middle;
  if (best.length === 0 || (best.length < 2 && !best.some(unit => waveKills(darius, unit))) || useLower === currentlyLower) return undefined;
  return { x: darius.position.x, y: middle + (useLower ? -.3 : .3) };
}

export function cpuClerkPosition(
  state: BattleState, config: BattleConfig, clerk: UnitState, darius: UnitState | undefined, pushing: boolean
): Vec2 {
  const nearest = [...state.units.filter(unit => unit.team === "Player" && isUnitAlive(unit)),
    ...state.summonedUnits.filter(summon => summon.team === "Player" && summon.currentHp > 0)]
    .sort((left, right) => distanceSq(left.position, clerk.position) - distanceSq(right.position, clerk.position))[0];
  if (nearest) {
    const distance = distanceSq(nearest.position, clerk.position);
    if (distance < 1.8 ** 2) return { ...findLeader(state, "Cpu").position };
    if (distance <= (effectiveAttackRange(clerk, config) * .95) ** 2) return { ...clerk.position };
  }
  if (pushing && darius) {
    return clampVec2({ x: darius.position.x, y: Math.max((config.battlefieldMin.y + config.battlefieldMax.y) / 2 + .8, darius.position.y + 1.8) }, config.battlefieldMin, config.battlefieldMax);
  }
  return cpuFieldPosition(config, 0, .18);
}


export { shouldSummonCpuStationary as shouldSummonCpuYggdrasil } from "./cpuSummonTactics";

