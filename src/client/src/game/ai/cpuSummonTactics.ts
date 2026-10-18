import { findLeader, isUnitAlive } from "../core/battleState";
import type { BattleConfig, BattleState } from "../core/types";
import { distanceSq } from "@reijin-summon/shared/core/vector";
import { effectiveAttackDamage } from "@reijin-summon/shared/rules/abilityEffects";
import { effectiveAttackRange } from "../rules/abilitySystem";
import { calculateSummonArea, calculateSummonCentroid } from "../rules/areaCalculator";
import { completedElementalsForTeam } from "../rules/elementalSystem";
import { getCustomizedSummonDefinition } from "@reijin-summon/shared/deck/summonCustomization";
import { getSummonDefinition } from "../core/summonCatalog";
import { areCollisionCirclesTouching } from "@reijin-summon/shared/rules/collisionGeometry";
import { getSummonBeam, isCircleInBeam } from "@reijin-summon/shared/rules/summonGeometry";
import { summonSpecialSettings } from "@reijin-summon/shared/rules/summonAttacks";

export function shouldSummonCpuStationary(state: BattleState, config: BattleConfig): boolean {
  const leader = findLeader(state, "Cpu");
  const definition = getCustomizedSummonDefinition(state.cpuSummonId, state.cpuSummonCustomization);
  const initialLeaderDamage = state.cpuSummonId === "jackpot"
    ? summonSpecialSettings.jackpot.initialDamage * definition.customizationAttackRatio : definition.leaderAttackDamage;
  if (leader.currentHp <= leader.maxHp * .3 || findLeader(state, "Player").currentHp <= initialLeaderDamage) return true;
  const points = [leader.position, ...completedElementalsForTeam(state, "Cpu").map(elemental => elemental.position)];
  const area = (config.battlefieldMax.x - config.battlefieldMin.x) * (config.battlefieldMax.y - config.battlefieldMin.y);
  const hp = definition.baseHp + calculateSummonArea(points) / area * 100 * config.summonedUnitHpPerFieldPercent;
  const position = calculateSummonCentroid(points, leader.position);
  const incomingDamage = state.units.filter(unit => unit.team === "Player" && unit.mode === "Active" && isUnitAlive(unit)
    && distanceSq(position, unit.position) <= effectiveAttackRange(unit, config) ** 2)
    .reduce((total, unit) => total + effectiveAttackDamage(unit, state, config) / unit.stats.attackIntervalSeconds * definition.damageMultiplier, 0);
  const incomingSummonDamage = state.summonedUnits.filter(summon => summon.team === "Player" && summon.currentHp > 0)
    .reduce((total, summon) => {
      const style = getSummonDefinition(summon.summonId).attackStyle;
      let damagePerSecond = 0;
      if (style === "global") {
        damagePerSecond = summon.attackDamage / summonSpecialSettings.yggdrasil.interval;
      } else if (style === "beam") {
        if (isCircleInBeam(position, config.summonedUnitCollisionRadius, getSummonBeam(summon, state, config))) {
          damagePerSecond = summon.attackDamage / summonSpecialSettings.jackpot.interval;
        }
      } else {
        if (areCollisionCirclesTouching(config, position, "SummonedUnit", summon.position, "SummonedUnit")) {
          damagePerSecond = summon.attackDamage / summon.attackIntervalSeconds;
        }
        if (summon.summonId === "leviathan") {
          damagePerSecond += summonSpecialSettings.leviathan.periodicDamage * (summon.customizationAttackRatio ?? 1)
            / summonSpecialSettings.leviathan.interval;
        }
      }
      return total + damagePerSecond * definition.damageMultiplier;
    }, 0);
  // 自然消耗と召喚地点の敵火力を見て、通常は約8秒以上の活動時間を確保する。
  const expectedSeconds = hp / (config.summonedUnitHealthDecayPerSecond + incomingDamage + incomingSummonDamage);
  return expectedSeconds >= Math.min(8, Math.max(0, state.remainingSeconds - 1));
}

