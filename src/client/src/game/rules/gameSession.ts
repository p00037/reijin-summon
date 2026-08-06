import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader, findUnit, isUnitAlive } from "../core/battleState";
import type { BattleCommand, BattleConfig, BattleState, MatchResult, TeamId, UnitId } from "../core/types";
import { countCompletedElementals, removeDestroyedElementals, tickElementalBuilds, tryBeginElementalBuild } from "./elementalSystem";
import { canSummon, tickSummonGauges, tickSummonedUnits, tryExecuteSummon } from "./summonSystem";
import { applyMoveCommand, calculateUnitHealingElapsed, tickCombat, tickMovement, tickRespawns, tickUnitHealing } from "./unitSystem";
import { tryPlaceInitialUnit } from "./initialPlacement";

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
      case "PlaceInitialUnit":
        if (command.team === "Player" && this.state.phase === "Setup") {
          tryPlaceInitialUnit(this.state, this.config, command.unitId, command.targetPosition);
        }
        break;
      case "StartBattle":
        if (command.team === "Player" && this.state.phase === "Setup") {
          this.state.phase = "Countdown";
          this.state.countdownRemainingSeconds = this.config.countdownSeconds;
        }
        break;
      case "MoveUnit":
        if (this.state.phase === "InProgress") {
          applyMoveCommand(this.state, this.config, command);
        }
        break;
      case "BeginElementalBuild":
        if (this.state.phase !== "InProgress" || findUnit(this.state, command.unitId).team !== command.team) {
          return;
        }
        tryBeginElementalBuild(this.state, this.config, command.unitId);
        break;
      case "Summon":
        if (this.state.phase === "InProgress") {
          tryExecuteSummon(this.state, this.config, command.team);
          this.updateResult();
        }
        break;
    }
  }

  tick(deltaSeconds: number): void {
    this.state.recentAttackEvents = [];
    if (this.state.result !== "InProgress") {
      return;
    }
    if (this.state.phase === "Setup") {
      return;
    }
    if (this.state.phase === "Countdown") {
      this.state.countdownRemainingSeconds = Math.max(
        0,
        this.state.countdownRemainingSeconds - Math.max(0, deltaSeconds)
      );
      if (this.state.countdownRemainingSeconds === 0) {
        this.state.phase = "InProgress";
      }
      return;
    }

    const activityStarts = activityStartSecondsByUnit(this.state, deltaSeconds);
    this.state.remainingSeconds = Math.max(0, this.state.remainingSeconds - deltaSeconds);
    tickElementalBuilds(this.state, this.config, deltaSeconds);
    tickSummonGauges(this.state, this.config, deltaSeconds);
    const movementTimelines = tickMovement(this.state, this.config, deltaSeconds, activityStarts);
    const healingElapsed = calculateUnitHealingElapsed(this.state, this.config, movementTimelines);
    tickUnitHealing(this.state, this.config, deltaSeconds, healingElapsed);
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

function activityStartSecondsByUnit(state: BattleState, deltaSeconds: number): ReadonlyMap<UnitId, number> {
  const offsets = new Map<UnitId, number>();
  for (const unit of state.units) {
    if (!isUnitAlive(unit) || unit.mode === "Defeated") {
      offsets.set(unit.unitId, deltaSeconds);
      continue;
    }
    if (unit.mode === "BuildingElemental") {
      offsets.set(unit.unitId, Math.min(deltaSeconds, Math.max(0, unit.buildTimerSeconds)));
      continue;
    }
    offsets.set(unit.unitId, 0);
  }
  return offsets;
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
