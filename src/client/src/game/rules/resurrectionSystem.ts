import { findLeader, getMpState, setMpState } from "../core/battleState";
import type { BattleConfig, BattleState, TeamId } from "../core/types";

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

export function tickMpRecovery(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  for (const team of ["Player", "Cpu"] as const) {
    const mpState = getMpState(state, team);
    if (mpState.current >= config.maxMp) {
      setMpState(state, team, config.maxMp, 0, mpState.leaderDamageProgress);
      continue;
    }

    const recoveryProgress = mpState.recoveryProgress + deltaSeconds;
    const recoverySeconds = mpRecoverySecondsForDefeatedLevel(defeatedLevelTotal(state, team));
    if (recoveryProgress < recoverySeconds) {
      setMpState(state, team, mpState.current, recoveryProgress, mpState.leaderDamageProgress);
      continue;
    }

    setMpState(state, team, Math.min(config.maxMp, mpState.current + 1), 0, mpState.leaderDamageProgress);
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
    setMpState(state, team, config.maxMp, mpState.recoveryProgress, 0);
    return;
  }

  const leaderDamageProgress = mpState.leaderDamageProgress + damage;
  const threshold = findLeader(state, team).maxHp * config.leaderDamageMpThresholdRatio;
  if (leaderDamageProgress < threshold) {
    setMpState(state, team, mpState.current, mpState.recoveryProgress, leaderDamageProgress);
    return;
  }

  setMpState(state, team, Math.min(config.maxMp, mpState.current + 1), mpState.recoveryProgress, 0);
}
