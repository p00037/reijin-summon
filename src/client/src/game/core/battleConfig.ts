import type { BattleConfig, UnitStats, UnitType } from "./types";

const statsByType: Record<UnitType, UnitStats> = {
  Melee: {
    maxHp: 350,
    moveSpeed: 3.5 / 3,
    attackDamage: 45,
    attackRange: 1.25,
    attackIntervalSeconds: 1.2
  },
  Speed: {
    maxHp: 250,
    moveSpeed: 5.5 / 3,
    attackDamage: 30,
    attackRange: 1,
    attackIntervalSeconds: 0.8
  },
  Ranged: {
    maxHp: 220,
    moveSpeed: 1,
    attackDamage: 35,
    attackRange: 3.5,
    attackIntervalSeconds: 1.4
  }
};

export function createDefaultBattleConfig(): BattleConfig {
  return {
    matchDurationSeconds: 180,
    leaderMaxHp: 1000,
    elementalBuildSeconds: 5,
    maxElementalsPerTeam: 4,
    requiredElementalsToSummon: 2,
    summonCooldownSeconds: 30,
    summonedUnitMinHpMultiplier: 3,
    summonedUnitMaxHpMultiplier: 10,
    summonedUnitHpPerAreaMultiplier: 1,
    summonedUnitAttackDamageMultiplier: 3,
    summonedUnitHealthDecayMinimumHpFactorPerSecond: 0.1,
    unitRespawnSeconds: 10,
    elementalMaxHp: 120,
    directLeaderDamageMultiplier: 0.25,
    playerLeaderPosition: { x: -7, y: 0 },
    cpuLeaderPosition: { x: 7, y: 0 },
    battlefieldMin: { x: -7.5, y: -4.5 },
    battlefieldMax: { x: 7.5, y: 4.5 },
    contactSlowRadius: 0.45,
    contactSlowMultiplier: 1 / 3,
    leaderVisualSize: 0.8,
    leaderHealingRadius: 0.8 * 2.5,
    statsByType
  };
}
