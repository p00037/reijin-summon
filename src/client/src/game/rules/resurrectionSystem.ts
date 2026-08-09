import { findLeader, findUnit, getMpState, setMpState } from "../core/battleState";
import type { BattleConfig, BattleState, TeamId, UnitId, Vec2 } from "../core/types";
import { distanceSq } from "../core/vector";

const mpRecoverySeconds = [25, 24, 21, 19, 16, 13, 9, 5, 4, 3, 3] as const;

export function mpRecoverySecondsForDefeatedLevel(level: number): number {
  const index = Math.min(10, Math.max(0, Math.floor(level)));
  return mpRecoverySeconds[index];
}

export function defeatedLevelTotal(state: BattleState, team: TeamId): number {
  return state.units
    .filter((unit) => unit.team === team && unit.mode === "Defeated")
    .reduce((total, unit) => total + unit.stats.level, 0);
}

export function canReviveUnit(
  state: BattleState,
  config: BattleConfig,
  team: TeamId,
  unitId: UnitId,
  targetPosition: Vec2
): boolean {
  const unit = findUnit(state, unitId);
  const leader = findLeader(state, team);
  const isInsideBattlefield =
    targetPosition.x >= config.battlefieldMin.x &&
    targetPosition.x <= config.battlefieldMax.x &&
    targetPosition.y >= config.battlefieldMin.y &&
    targetPosition.y <= config.battlefieldMax.y;
  return (
    state.result === "InProgress" &&
    state.phase === "InProgress" &&
    unit.team === team &&
    unit.mode === "Defeated" &&
    getMpState(state, team).current >= unit.stats.revivalCost &&
    isInsideBattlefield &&
    distanceSq(targetPosition, leader.position) <= config.leaderHealingRadius ** 2
  );
}

export function tryReviveUnit(
  state: BattleState,
  config: BattleConfig,
  team: TeamId,
  unitId: UnitId,
  targetPosition: Vec2
): boolean {
  if (!canReviveUnit(state, config, team, unitId, targetPosition)) {
    return false;
  }

  const unit = findUnit(state, unitId);
  const mpState = getMpState(state, team);
  setMpState(
    state,
    team,
    mpState.current - unit.stats.revivalCost,
    mpState.recoveryProgress,
    mpState.leaderDamageProgress
  );
  unit.mode = "Active";
  unit.currentHp = unit.stats.maxHp;
  unit.position = { ...targetPosition };
  unit.destination = { ...targetPosition };
  unit.attackTimerSeconds = 0;
  unit.leaderAttackTimerSeconds = 0;
  unit.leaderHealingElapsedSeconds = 0;
  unit.restHealingElapsedSeconds = 0;
  unit.buildTimerSeconds = 0;
  unit.pendingElementalId = null;
  unit.defeatedOrder = null;
  return true;
}

export function tickMpRecovery(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  for (const team of ["Player", "Cpu"] as const) {
    const mpState = getMpState(state, team);
    if (mpState.current >= config.maxMp) {
      setMpState(state, team, config.maxMp, 0, mpState.leaderDamageProgress);
      continue;
    }

    const recoverySeconds = mpRecoverySecondsForDefeatedLevel(defeatedLevelTotal(state, team));
    const recoveryProgress =
      mpState.recoveryProgress + Math.max(0, deltaSeconds) / recoverySeconds;
    const recoveredMp = Math.floor(recoveryProgress);
    const current = Math.min(config.maxMp, mpState.current + recoveredMp);
    const remainingProgress =
      current >= config.maxMp ? 0 : recoveryProgress - recoveredMp;
    setMpState(
      state,
      team,
      current,
      remainingProgress,
      current >= config.maxMp ? 0 : mpState.leaderDamageProgress
    );
  }
}

export function recordLeaderDamageForMp(
  state: BattleState,
  config: BattleConfig,
  team: TeamId,
  damage: number
): void {
  const mpState = getMpState(state, team);
  if (mpState.current >= config.maxMp) {
    setMpState(state, team, config.maxMp, 0, 0);
    return;
  }

  const leaderDamageProgress = mpState.leaderDamageProgress + damage;
  const threshold = findLeader(state, team).maxHp * config.leaderDamageMpThresholdRatio;
  const recoveredMp = Math.floor(leaderDamageProgress / threshold);
  const current = Math.min(config.maxMp, mpState.current + recoveredMp);
  const remainingDamageProgress = current >= config.maxMp ? 0 : leaderDamageProgress % threshold;
  setMpState(
    state,
    team,
    current,
    current >= config.maxMp ? 0 : mpState.recoveryProgress,
    remainingDamageProgress
  );
}
