import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader, findUnit } from "../core/battleState";
import type { BattleCommand, BattleConfig, BattleState, MatchResult, TeamId } from "../core/types";
import { countCompletedElementals, removeDestroyedElementals, tickElementalBuilds, tryBeginElementalBuild } from "./elementalSystem";
import { canSummon, tickSummonCooldowns, tickSummonedUnits, tryExecuteSummon } from "./summonSystem";
import { applyMoveCommand, tickCombat, tickLeaderHealing, tickMovement, tickRespawns } from "./unitSystem";

export class GameSession {
  readonly config: BattleConfig;
  readonly state: BattleState;

  constructor(config = createDefaultBattleConfig(), state = createDefaultBattleState(config)) {
    this.config = config;
    this.state = state;
  }

  applyCommand(command: BattleCommand): void {
    if (this.state.result !== "InProgress") {
      return;
    }

    switch (command.commandType) {
      case "MoveUnit":
        applyMoveCommand(this.state, this.config, command);
        break;
      case "BeginElementalBuild":
        if (findUnit(this.state, command.unitId).team !== command.team) {
          return;
        }
        tryBeginElementalBuild(this.state, this.config, command.unitId);
        break;
      case "Summon":
        tryExecuteSummon(this.state, this.config, command.team);
        this.updateResult();
        break;
    }
  }

  tick(deltaSeconds: number): void {
    if (this.state.result !== "InProgress") {
      return;
    }

    this.state.remainingSeconds = Math.max(0, this.state.remainingSeconds - deltaSeconds);
    tickSummonCooldowns(this.state, deltaSeconds);
    tickElementalBuilds(this.state, this.config, deltaSeconds);
    tickMovement(this.state, this.config, deltaSeconds);
    tickLeaderHealing(this.state, this.config, deltaSeconds);
    tickRespawns(this.state, deltaSeconds);
    tickCombat(this.state, this.config, deltaSeconds);
    tickSummonedUnits(this.state, this.config, deltaSeconds);
    removeDestroyedElementals(this.state);
    this.updateResult();
  }

  canSummon(team: TeamId): boolean {
    return canSummon(this.state, this.config, team);
  }

  countCompletedElementals(team: TeamId): number {
    return countCompletedElementals(this.state, team);
  }

  private updateResult(): void {
    this.state.result = determineResult(this.state);
  }
}

function determineResult(state: BattleState): MatchResult {
  const playerLeader = findLeader(state, "Player");
  const cpuLeader = findLeader(state, "Cpu");
  const isPlayerDefeated = playerLeader.currentHp <= 0;
  const isCpuDefeated = cpuLeader.currentHp <= 0;

  if (isPlayerDefeated && isCpuDefeated) {
    return "Draw";
  }
  if (isCpuDefeated) {
    return "PlayerWin";
  }
  if (isPlayerDefeated) {
    return "CpuWin";
  }
  if (state.remainingSeconds > 0) {
    return "InProgress";
  }
  if (playerLeader.currentHp > cpuLeader.currentHp) {
    return "PlayerWin";
  }
  if (cpuLeader.currentHp > playerLeader.currentHp) {
    return "CpuWin";
  }
  return "Draw";
}
