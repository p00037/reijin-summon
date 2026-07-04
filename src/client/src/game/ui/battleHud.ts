import Phaser from "phaser";
import type { BattleState, PlayerUnitId, UnitState } from "../core/types";

export type BattleHudCallbacks = {
  onBuild: () => void;
  onSummon: () => void;
  onRetry: () => void;
};

type HudButton = {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

const hudHeight = 132;
const buttonWidth = 88;
const buttonHeight = 38;

export class BattleHud {
  readonly top: number;

  private readonly scene: Phaser.Scene;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly unitText: Phaser.GameObjects.Text;
  private readonly cooldownText: Phaser.GameObjects.Text;
  private readonly playerText: Phaser.GameObjects.Text;
  private readonly cpuText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly resultText: Phaser.GameObjects.Text;
  private readonly buildButton: HudButton;
  private readonly summonButton: HudButton;
  private readonly retryButton: HudButton;

  constructor(scene: Phaser.Scene, callbacks: BattleHudCallbacks) {
    this.scene = scene;
    const { width, height } = scene.scale;
    this.top = height - hudHeight;

    this.background = scene.add
      .rectangle(0, this.top, width, hudHeight, 0x0f172a, 0.94)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x334155, 1);

    this.titleText = scene.add.text(24, this.top + 10, "Battle Control", titleStyle(17, "#f8fafc"));
    this.statusText = scene.add.text(24, this.top + 34, "Status: Select a player unit.", titleStyle(13, "#cbd5e1"));
    this.unitText = scene.add.text(24, this.top + 58, "Selected: none", titleStyle(13, "#93c5fd"));
    this.cooldownText = scene.add.text(24, this.top + 82, "", titleStyle(13, "#fde68a"));
    this.playerText = scene.add.text(330, this.top + 18, "", titleStyle(13, "#bfdbfe"));
    this.cpuText = scene.add.text(330, this.top + 42, "", titleStyle(13, "#fecaca"));
    this.timeText = scene.add.text(330, this.top + 66, "", titleStyle(13, "#f8fafc"));
    this.resultText = scene.add.text(330, this.top + 90, "", titleStyle(13, "#cbd5e1"));

    this.buildButton = this.createButton(width - 306, this.top + 48, "Build", callbacks.onBuild);
    this.summonButton = this.createButton(width - 202, this.top + 48, "Summon", callbacks.onSummon);
    this.retryButton = this.createButton(width - 98, this.top + 48, "Retry", callbacks.onRetry);
  }

  contains(x: number, y: number): boolean {
    return x >= 0 && x <= this.scene.scale.width && y >= this.top && y <= this.scene.scale.height;
  }

  setStatus(message: string): void {
    this.statusText.setText(`Status: ${message}`);
  }

  update(state: BattleState, selectedUnitId: PlayerUnitId | null): void {
    const selectedUnit = selectedUnitId ? state.units.find((unit) => unit.unitId === selectedUnitId) : null;
    this.unitText.setText(`Selected: ${formatSelectedUnit(selectedUnit)}`);
    this.cooldownText.setText(`Summon CD: ${state.playerSummonCooldownSeconds.toFixed(1)}s`);
    this.playerText.setText(`Player HP: ${leaderHp(state, "Player")}  Elem: ${countElementals(state, "Player")}`);
    this.cpuText.setText(`CPU HP: ${leaderHp(state, "Cpu")}  Elem: ${countElementals(state, "Cpu")}`);
    this.timeText.setText(`Time: ${Math.ceil(state.remainingSeconds)}s`);
    this.resultText.setText(`Result: ${formatResult(state.result)}`);

    const canUseUnit = Boolean(selectedUnit && selectedUnit.mode === "Active" && selectedUnit.currentHp > 0 && state.result === "InProgress");
    this.setButtonEnabled(this.buildButton, canUseUnit);
    this.setButtonEnabled(this.summonButton, state.result === "InProgress");
  }

  destroy(): void {
    this.background.destroy();
    this.titleText.destroy();
    this.statusText.destroy();
    this.unitText.destroy();
    this.cooldownText.destroy();
    this.playerText.destroy();
    this.cpuText.destroy();
    this.timeText.destroy();
    this.resultText.destroy();
    this.buildButton.background.destroy();
    this.buildButton.label.destroy();
    this.summonButton.background.destroy();
    this.summonButton.label.destroy();
    this.retryButton.background.destroy();
    this.retryButton.label.destroy();
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): HudButton {
    const background = this.scene.add
      .rectangle(x, y, buttonWidth, buttonHeight, 0x1e293b, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x60a5fa, 1)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add
      .text(x + buttonWidth / 2, y + buttonHeight / 2, label, titleStyle(15, "#f8fafc"))
      .setOrigin(0.5);

    background.on("pointerover", () => background.setFillStyle(0x334155, 1));
    background.on("pointerout", () => background.setFillStyle(0x1e293b, 1));
    background.on("pointerdown", onClick);

    return { background, label: text };
  }

  private setButtonEnabled(button: HudButton, enabled: boolean): void {
    button.background.setAlpha(enabled ? 1 : 0.45);
    button.label.setAlpha(enabled ? 1 : 0.6);
  }
}

function titleStyle(fontSize: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    color,
    fontFamily: "Arial, sans-serif",
    fontSize: `${fontSize}px`
  };
}

function formatSelectedUnit(unit: UnitState | null | undefined): string {
  if (!unit) {
    return "none";
  }
  if (unit.mode === "Defeated") {
    return `${unit.unitType} respawn ${unit.respawnTimerSeconds.toFixed(1)}s`;
  }
  if (unit.mode === "BuildingElemental") {
    return `${unit.unitType} building ${unit.buildTimerSeconds.toFixed(1)}s`;
  }
  return `${unit.unitType} HP ${Math.ceil(unit.currentHp)}/${unit.stats.maxHp}`;
}

function leaderHp(state: BattleState, team: "Player" | "Cpu"): string {
  const leader = state.leaders.find((candidate) => candidate.team === team);
  return leader ? `${Math.ceil(leader.currentHp)}/${leader.maxHp}` : "-";
}

function countElementals(state: BattleState, team: "Player" | "Cpu"): number {
  return state.elementals.filter((elemental) => elemental.team === team && elemental.isComplete && elemental.currentHp > 0).length;
}

function formatResult(result: BattleState["result"]): string {
  switch (result) {
    case "PlayerWin":
      return "Player victory";
    case "CpuWin":
      return "CPU victory";
    case "Draw":
      return "Draw";
    case "InProgress":
      return "In progress";
  }
}
