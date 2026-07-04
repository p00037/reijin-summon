import type { BattleConfig, BattleState, LeaderState, TeamId, UnitId, UnitState, UnitType } from "./types";

export function createDefaultBattleState(config: BattleConfig): BattleState {
  return {
    remainingSeconds: config.matchDurationSeconds,
    playerSummonCooldownSeconds: 0,
    cpuSummonCooldownSeconds: 0,
    result: "InProgress",
    leaders: [
      createLeader("Player", config.playerLeaderPosition, config.leaderMaxHp),
      createLeader("Cpu", config.cpuLeaderPosition, config.leaderMaxHp)
    ],
    units: [
      createUnit("PlayerMelee", "Player", "Melee", { x: -5, y: 1.5 }, config),
      createUnit("PlayerSpeed", "Player", "Speed", { x: -5, y: 0 }, config),
      createUnit("PlayerRanged", "Player", "Ranged", { x: -5, y: -1.5 }, config),
      createUnit("CpuMelee", "Cpu", "Melee", { x: 5, y: 1.5 }, config),
      createUnit("CpuSpeed", "Cpu", "Speed", { x: 5, y: 0 }, config),
      createUnit("CpuRanged", "Cpu", "Ranged", { x: 5, y: -1.5 }, config)
    ],
    elementals: [],
    summonedUnits: [],
    recentAttackEvents: [],
    nextSummonedUnitId: 1
  };
}

export function findLeader(state: BattleState, team: TeamId): LeaderState {
  const leader = state.leaders.find((candidate) => candidate.team === team);
  if (!leader) {
    throw new Error(`Leader not found: ${team}`);
  }
  return leader;
}

export function findUnit(state: BattleState, unitId: UnitId): UnitState {
  const unit = state.units.find((candidate) => candidate.unitId === unitId);
  if (!unit) {
    throw new Error(`Unit not found: ${unitId}`);
  }
  return unit;
}

export function isUnitAlive(unit: UnitState): boolean {
  return unit.mode !== "Defeated" && unit.currentHp > 0;
}

export function teamForUnit(unitId: UnitId): TeamId {
  return unitId.startsWith("Player") ? "Player" : "Cpu";
}

export function oppositeTeam(team: TeamId): TeamId {
  return team === "Player" ? "Cpu" : "Player";
}

export function getSummonCooldown(state: BattleState, team: TeamId): number {
  return team === "Player" ? state.playerSummonCooldownSeconds : state.cpuSummonCooldownSeconds;
}

export function setSummonCooldown(state: BattleState, team: TeamId, seconds: number): void {
  if (team === "Player") {
    state.playerSummonCooldownSeconds = seconds;
  } else {
    state.cpuSummonCooldownSeconds = seconds;
  }
}

function createLeader(team: TeamId, position: { x: number; y: number }, maxHp: number): LeaderState {
  return {
    leaderId: team,
    team,
    position: { ...position },
    maxHp,
    currentHp: maxHp
  };
}

function createUnit(
  unitId: UnitId,
  team: TeamId,
  unitType: UnitType,
  spawnPosition: { x: number; y: number },
  config: BattleConfig
): UnitState {
  const stats = config.statsByType[unitType];
  return {
    unitId,
    team,
    unitType,
    position: { ...spawnPosition },
    spawnPosition: { ...spawnPosition },
    destination: { ...spawnPosition },
    stats,
    currentHp: stats.maxHp,
    mode: "Active",
    buildTimerSeconds: 0,
    respawnTimerSeconds: 0,
    attackTimerSeconds: 0,
    pendingElementalId: null
  };
}
