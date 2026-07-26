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
  const inProgress = state.result === "InProgress";
  const summonGauge = clamp(state.playerSummonGauge, 0, 1);

  return {
    playerHp: leaderGauge("自分", playerLeader.currentHp, playerLeader.maxHp),
    cpuHp: leaderGauge("敵", cpuLeader.currentHp, cpuLeader.maxHp),
    remainingTimeText: `残り ${Math.max(0, Math.ceil(state.remainingSeconds))}秒`,
    summonGauge: {
      text: `召喚ゲージ ${Math.floor(summonGauge * 100)}%`,
      ratio: summonGauge
    },
    resultText: formatResult(state.result),
    canBuild: Boolean(
      inProgress
      && selectedUnit
      && selectedUnit.team === "Player"
      && selectedUnit.mode === "Active"
      && selectedUnit.currentHp > 0
    ),
    canSummon: inProgress && canSummonPlayer
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
