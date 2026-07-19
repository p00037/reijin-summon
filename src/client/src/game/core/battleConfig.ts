import type { BattleConfig, UnitStats, UnitType } from "./types";

const statsByType: Record<UnitType, UnitStats> = {
  Melee: {
    maxHp: 350,
    moveSpeed: 8.2 / 40,
    attackDamage: 45,
    attackRange: 1.25,
    attackIntervalSeconds: 1.2
  },
  Speed: {
    maxHp: 250,
    moveSpeed: 8.2 / 22,
    attackDamage: 30,
    attackRange: 1,
    attackIntervalSeconds: 0.8
  },
  Ranged: {
    maxHp: 220,
    moveSpeed: 8.2 / 32,
    attackDamage: 35,
    attackRange: 3.5,
    attackIntervalSeconds: 1.4
  }
};

export function createDefaultBattleConfig(): BattleConfig {
  return {
    matchDurationSeconds: 180,
    leaderMaxHp: 2000,
    elementalBuildSeconds: 5,
    elementalPlacementRadius: 0.30375,
    elementalContactRadius: 0.30375,
    maxElementalsPerTeam: 6,
    summonGaugeSecondsAtMaxElementals: 45,
    summonedUnitBaseHp: 1750,
    summonedUnitHpPerFieldPercent: 60,
    summonedUnitAttackDamage: 99,
    summonedUnitLeaderAttackDamage: 300,
    summonedUnitAttackIntervalSeconds: 2,
    summonedUnitHealthDecayPerSecond: 120,
    summonedUnitMoveSpeed: 8.2 / 12,
    unitRespawnSeconds: 10,
    elementalMaxHp: 120,
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
