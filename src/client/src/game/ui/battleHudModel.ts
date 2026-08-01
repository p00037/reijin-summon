import { findLeader } from "../core/battleState";
import type { BattleState, PlayerUnitId } from "../core/types";

export const elementButtonTextureKey = "hud-element-button";
export const summonButtonTextureKey = "hud-summon-button";

export type HudGaugeModel = {
  text: string;
  ratio: number;
};

export type BattleHudModel = {
  playerHp: HudGaugeModel;
  cpuHp: HudGaugeModel;
  remainingTimeText: string;
  summonGauge: HudGaugeModel;
  resultText: string;
  canBuild: boolean;
  canSummon: boolean;
};

export function createBattleHudModel(
  state: BattleState,
  selectedUnitId: PlayerUnitId | null,
  canSummonPlayer: boolean
): BattleHudModel {
  const playerLeader = findLeader(state, "Player");
  const cpuLeader = findLeader(state, "Cpu");
  const selectedUnit = selectedUnitId
    ? state.units.find((unit) => unit.unitId === selectedUnitId)
    : undefined;
  const battleInProgress = state.result === "InProgress" && state.phase === "InProgress";
  const selectedUnitIsUsable =
    selectedUnit
    && selectedUnit.team === "Player"
    && selectedUnit.mode === "Active"
    && selectedUnit.currentHp > 0;
  const summonGauge = clamp(state.playerSummonGauge, 0, 1);
  const resultText =
    state.result !== "InProgress"
      ? formatResult(state.result)
      : state.phase === "Countdown"
        ? `${Math.max(1, Math.ceil(state.countdownRemainingSeconds))}`
        : "";

  return {
    playerHp: leaderGauge("自分", playerLeader.currentHp, playerLeader.maxHp),
    cpuHp: leaderGauge("敵", cpuLeader.currentHp, cpuLeader.maxHp),
    remainingTimeText: `${Math.max(0, Math.ceil(state.remainingSeconds))}`,
    summonGauge: {
      text: `召喚ゲージ ${Math.floor(summonGauge * 100)}%`,
      ratio: summonGauge
    },
    resultText,
    canBuild: Boolean(battleInProgress && selectedUnitIsUsable),
    canSummon:
      state.result === "InProgress"
      && (
        state.phase === "Setup"
        || (state.phase === "InProgress" && canSummonPlayer)
      )
  };
}

function leaderGauge(label: "自分" | "敵", currentHp: number, maxHp: number): HudGaugeModel {
  return {
    text: `${label} ${Math.ceil(currentHp)} / ${maxHp}`,
    ratio: clamp(maxHp > 0 ? currentHp / maxHp : 0, 0, 1)
  };
}

function formatResult(result: BattleState["result"]): string {
  switch (result) {
    case "PlayerWin":
      return "勝利";
    case "CpuWin":
      return "敗北";
    case "Draw":
      return "引き分け";
    case "InProgress":
      return "";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
