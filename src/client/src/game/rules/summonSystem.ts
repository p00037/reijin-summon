import { findLeader, getSummonCooldown, oppositeTeam, setSummonCooldown } from "../core/battleState";
import type { BattleConfig, BattleState, TeamId } from "../core/types";
import { distance, moveTowards } from "../core/vector";
import { calculateSummonArea } from "./areaCalculator";
import { completedElementalsForTeam } from "./elementalSystem";

export function canSummon(state: BattleState, config: BattleConfig, team: TeamId): boolean {
  return getSummonCooldown(state, team) === 0 && completedElementalsForTeam(state, team).length >= config.requiredElementalsToSummon;
}

export function tryExecuteSummon(state: BattleState, config: BattleConfig, team: TeamId): boolean {
  if (!canSummon(state, config, team)) {
    return false;
  }

  const leader = findLeader(state, team);
  const enemyLeader = findLeader(state, oppositeTeam(team));
  const elementals = completedElementalsForTeam(state, team);
  const area = calculateSummonArea([leader.position, ...elementals.map((elemental) => elemental.position)]);
  const meleeStats = config.statsByType.Melee;
  const hpMultiplier = Math.min(
    config.summonedUnitMaxHpMultiplier,
    Math.max(config.summonedUnitMinHpMultiplier, config.summonedUnitMinHpMultiplier + area * config.summonedUnitHpPerAreaMultiplier)
  );
  const maxHp = meleeStats.maxHp * hpMultiplier;

  state.summonedUnits.push({
    summonedUnitId: state.nextSummonedUnitId,
    team,
    position: { ...leader.position },
    destination: { ...enemyLeader.position },
    maxHp,
    currentHp: maxHp,
    attackDamage: meleeStats.attackDamage * config.summonedUnitAttackDamageMultiplier,
    moveSpeed: meleeStats.moveSpeed,
    healthDecayPerSecond: meleeStats.maxHp * config.summonedUnitMinHpMultiplier * config.summonedUnitHealthDecayMinimumHpFactorPerSecond
  });
  state.nextSummonedUnitId += 1;
  setSummonCooldown(state, team, config.summonCooldownSeconds);
  return true;
}

export function tickSummonCooldowns(state: BattleState, deltaSeconds: number): void {
  state.playerSummonCooldownSeconds = Math.max(0, state.playerSummonCooldownSeconds - deltaSeconds);
  state.cpuSummonCooldownSeconds = Math.max(0, state.cpuSummonCooldownSeconds - deltaSeconds);
}

export function tickSummonedUnits(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  for (const summoned of state.summonedUnits) {
    const enemyLeader = findLeader(state, oppositeTeam(summoned.team));
    summoned.destination = { ...enemyLeader.position };
    const touchingLeader = distance(summoned.position, enemyLeader.position) <= config.contactSlowRadius;
    if (touchingLeader) {
      enemyLeader.currentHp = Math.max(0, enemyLeader.currentHp - summoned.attackDamage * deltaSeconds);
    } else {
      summoned.position = moveTowards(summoned.position, summoned.destination, summoned.moveSpeed * deltaSeconds);
    }
    summoned.currentHp = Math.max(0, summoned.currentHp - summoned.healthDecayPerSecond * deltaSeconds);
  }
  state.summonedUnits = state.summonedUnits.filter((summoned) => summoned.currentHp > 0);
}
