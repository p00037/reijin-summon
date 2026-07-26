import type { BattleConfig, UnitStats, UnitType } from "./types";

const statsByType: Record<UnitType, UnitStats> = {
  Melee: {
    maxHp: 1100,
    moveSpeed: 8.2 / 40,
    attackDamage: 61,
    attackRange: 1.25,
    attackIntervalSeconds: 0.5,
    elementalBuildSeconds: 5.7,
    elementalAttackMultiplier: 2
  },
  Speed: {
    maxHp: 1060,
    moveSpeed: 8.2 / 22,
    attackDamage: 53,
    attackRange: 1,
    attackIntervalSeconds: 0.5,
    elementalBuildSeconds: 7.2,
    elementalAttackMultiplier: 1
  },
  Ranged: {
    maxHp: 1025,
    moveSpeed: 8.2 / 32,
    attackDamage: 36,
    attackRange: 3.5,
    attackIntervalSeconds: 0.5,
    elementalBuildSeconds: 6.7,
    elementalAttackMultiplier: 1
  }
};

export function createDefaultBattleConfig(): BattleConfig {
  return {
    matchDurationSeconds: 300,
    leaderMaxHp: 2000,
    leaderHealingIntervalSeconds: 2,
    leaderHealingPercent: 0.1,
    keeperRestHealingIntervalSeconds: 1.5,
    keeperRestHealingAmount: 60,
    elementalPlacementRadius: 0.30375,
    elementalContactRadius: 0.30375,
    maxElementalsPerTeam: 6,
    summonGaugeSecondsAtMaxElementals: 45,
    summonedUnitBaseHp: 1750,
    summonedUnitHpPerFieldPercent: 60,
    summonedUnitAttackDamage: 99,
    summonedUnitLeaderAttackDamage: 300,
    summonedUnitAttackIntervalSeconds: 0.5,
    summonedUnitLeaderAttackIntervalSeconds: 2,
    summonedUnitHealthDecayPerSecond: 120,
    summonedUnitMoveSpeed: 8.2 / 12,
    unitRespawnSeconds: 10,
    unitLeaderAttackIntervalSeconds: 1,
    elementalMaxHp: 1000,
    directLeaderDamageMultiplier: 0.25,
    playerLeaderPosition: { x: 0, y: -4.1 },
    cpuLeaderPosition: { x: 0, y: 4.1 },
    battlefieldMin: { x: -6.3, y: -4.5 },
    battlefieldMax: { x: 6.3, y: 4.5 },
    contactSlowRadius: 0.45,
    contactSlowMultiplier: 1 / 3,
    leaderVisualSize: 0.8,
    leaderHealingRadius: 0.8 * 2.5,
    statsByType: {
      Melee: { ...statsByType.Melee },
      Speed: { ...statsByType.Speed },
      Ranged: { ...statsByType.Ranged }
    }
  };
}
