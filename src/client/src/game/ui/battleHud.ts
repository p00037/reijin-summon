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

const hudHeight = 122;
const buttonWidth = 150;
const buttonHeight = 38;

export class BattleHud {
  readonly top: number;

  private readonly scene: Phaser.Scene;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly unitText: Phaser.GameObjects.Text;
  private readonly playerText: Phaser.GameObjects.Text;
  private readonly cpuText: Phaser.GameObjects.Text;
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

    this.titleText = scene.add.text(24, this.top + 16, "Battle Control", titleStyle(18, "#f8fafc"));
    this.statusText = scene.add.text(24, this.top + 46, "Select a player unit.", titleStyle(14, "#cbd5e1"));
    this.unitText = scene.add.text(24, this.top + 78, "Selected: none", titleStyle(14, "#93c5fd"));
    this.playerText = scene.add.text(430, this.top + 18, "", titleStyle(14, "#bfdbfe"));
    this.cpuText = scene.add.text(430, this.top + 48, "", titleStyle(14, "#fecaca"));

    this.buildButton = this.createButton(width - 498, this.top + 68, "Build", callbacks.onBuild);
    this.summonButton = this.createButton(width - 332, this.top + 68, "Summon", callbacks.onSummon);
    this.retryButton = this.createButton(width - 166, this.top + 68, "Retry", callbacks.onRetry);
  }

  contains(x: number, y: number): boolean {
    return x >= 0 && x <= this.scene.scale.width && y >= this.top && y <= this.scene.scale.height;
  }

  setStatus(message: string): void {
    this.statusText.setText(message);
  }

  update(state: BattleState, selectedUnitId: PlayerUnitId | null): void {
    const selectedUnit = selectedUnitId ? state.units.find((unit) => unit.unitId === selectedUnitId) : null;
    this.unitText.setText(`Selected: ${formatSelectedUnit(selectedUnit)}`);
    this.playerText.setText(`Player HP ${leaderHp(state, "Player")}  Elementals ${countElementals(state, "Player")}`);
    this.cpuText.setText(`CPU HP ${leaderHp(state, "Cpu")}  Elementals ${countElementals(state, "Cpu")}`);

    const canUseUnit = Boolean(selectedUnit && selectedUnit.mode === "Active" && selectedUnit.currentHp > 0 && state.result === "InProgress");
    this.setButtonEnabled(this.buildButton, canUseUnit);
    this.setButtonEnabled(this.summonButton, state.result === "InProgress");
  }

  destroy(): void {
    this.background.destroy();
    this.titleText.destroy();
    this.statusText.destroy();
    this.unitText.destroy();
    this.playerText.destroy();
    this.cpuText.destroy();
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
