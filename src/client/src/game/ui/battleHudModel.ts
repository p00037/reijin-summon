import { findLeader } from "../core/battleState";
import type { BattleState, PlayerUnitId } from "../core/types";
import { abilityApCost } from "../rules/abilitySystem";
import { getAbilityDefinition, getSkillDefinition, skillModifiers } from '@reijin-summon/shared';

export const elementButtonTextureKey = "hud-element-button";
export const abilityButtonTextureKey = "hud-ability-button";
export const summonButtonTextureKey = "hud-summon-button";

export type HudGaugeModel = {
  text: string;
  ratio: number;
};

export type BattleHudModel = {
  abilityName: string;
  abilityDescription: string;
  skillName: string;
  skillDescription: string;
  skillStatus: string;
  weatherText: string;
  playerHp: HudGaugeModel;
  cpuHp: HudGaugeModel;
  mp: HudGaugeModel;
  remainingTimeText: string;
  summonGauge: HudGaugeModel;
  abilityGauge: HudGaugeModel;
  resultText: string;
  canBuild: boolean;
  canUseAbility: boolean;
  canSummon: boolean;
};

export function createBattleHudModel(
  state: BattleState,
  selectedUnitId: PlayerUnitId | null,
  canSummonPlayer: boolean,
  canUseSelectedAbility: boolean
): BattleHudModel {
  const playerLeader = findLeader(state, "Player");
  const cpuLeader = findLeader(state, "Cpu");
  const selectedUnit = selectedUnitId
    ? state.units.find((unit) => unit.unitId === selectedUnitId)
    : undefined;
  const battleInProgress = state.result === "InProgress" && state.phase === "InProgress";
  const skill = getSkillDefinition(selectedUnit?.cardId);
  const skillStatus = !skill || !selectedUnit ? ''
    : skill.effect.kind === 'killAp' ? '撃破時'
    : ['deathGauge', 'deathAp', 'deathHealing', 'deathMp', 'revive'].includes(skill.effect.kind) ? '死亡時'
    : skillModifiers(selectedUnit, state).active ? '発動中' : '条件待ち';
  const selectedUnitCanBuild =
    selectedUnit
    && selectedUnit.team === "Player"
    && selectedUnit.mode === "Active"
    && selectedUnit.currentHp > 0;
  const selectedUnitCanUseAbility =
    selectedUnit
    && selectedUnit.team === "Player"
    && selectedUnit.mode !== "Defeated"
    && selectedUnit.currentHp > 0;
  const abilityGauge = selectedUnit
    ? createAbilityGauge(
      selectedUnit.abilityAp,
      selectedUnit.abilityRecoverySeconds,
      abilityApCost(selectedUnit)
    )
    : { text: "AP - / -", ratio: 0 };
  const summonGauge = clamp(state.playerSummonGauge, 0, 1);
  const maxMp = 10;
  const playerMp = clamp(state.playerMp, 0, maxMp);
  const resultText =
    state.result !== "InProgress"
      ? formatResult(state.result)
      : state.phase === "Countdown"
        ? `${Math.max(1, Math.ceil(state.countdownRemainingSeconds))}`
        : "";

  return {
    abilityName: selectedUnit ? getAbilityDefinition(selectedUnit.cardId)?.name ?? 'アビリティなし' : 'カードを選択',
    abilityDescription: getAbilityDefinition(selectedUnit?.cardId)?.description ?? '',
    skillName: skill?.name ?? (selectedUnit ? 'スキルなし' : ''),
    skillDescription: skill?.description ?? '',
    skillStatus,
    weatherText: state.rainRemainingSeconds > 0 ? '雨' : '晴れ',
    playerHp: leaderGauge("自分", playerLeader.currentHp, playerLeader.maxHp),
    cpuHp: leaderGauge("敵", cpuLeader.currentHp, cpuLeader.maxHp),
    mp: {
      text: `MP ${playerMp} / ${maxMp}`,
      ratio: playerMp / maxMp
    },
    remainingTimeText: `${Math.max(0, Math.ceil(state.remainingSeconds))}`,
    summonGauge: {
      text: `召喚ゲージ ${Math.floor(summonGauge * 100)}%`,
      ratio: summonGauge
    },
    abilityGauge,
    resultText,
    canBuild: Boolean(battleInProgress && selectedUnitCanBuild),
    canUseAbility: Boolean(
      battleInProgress && selectedUnitCanUseAbility && canUseSelectedAbility && selectedUnit && abilityApCost(selectedUnit) !== null
    ),
    canSummon: battleInProgress && canSummonPlayer
  };
}

function createAbilityGauge(
  currentAp: number,
  recoverySeconds: number,
  requiredAp: number | null
): HudGaugeModel {
  if (requiredAp === null) return {text: 'AP - / -', ratio: 0};
  return {
    text: `AP ${currentAp} / ${requiredAp}`,
    ratio: clamp((currentAp + recoverySeconds / 20) / requiredAp, 0, 1)
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
