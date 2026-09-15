import Phaser from "phaser";
import type { BattleState, PlayerUnitId } from "../core/types";
import { gameViewport } from "../gameViewport";
import { withCanvasTextResolution } from "../browserSizeCanvas";
import { isPointInHud, type BattleLayout, type UiRect } from "./battleLayout";
import { createBattleHudModel, type HudGaugeModel } from "./battleHudModel";

export type BattleHudCallbacks = {
  onBuild: () => void;
  onAbility: () => void;
  onSummon: () => void;
  onRetry: () => void;
};

type Gauge = { fill: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; width: number };
type Button = { background: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Text; label: Phaser.GameObjects.Text; enabled: boolean };
const depth = 3;
const aqua = 0x70e5dc;
const gold = 0xf1c968;

export class BattleHud {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly playerHp: Gauge;
  private readonly cpuHp: Gauge;
  private readonly mp: Gauge;
  private readonly summonGauge: Gauge;
  private readonly abilityGauge: Gauge;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly resultText: Phaser.GameObjects.Text;
  private readonly waitingHint: Phaser.GameObjects.Text;
  private readonly buildButton: Button;
  private readonly abilityButton: Button;
  private readonly summonButton: Button;

  constructor(private readonly scene: Phaser.Scene, private readonly layout: BattleLayout, callbacks: BattleHudCallbacks) {
    this.panel(layout.leftPanel);
    this.panel(layout.waitingArea);
    this.text(31, 22, "STATUS", 6, "#9fc1d0");
    this.cpuHp = this.gauge(12, 48, 38, "敵 HP", 0xe99991);
    this.playerHp = this.gauge(12, 126, 38, "自分 HP", aqua);
    this.mp = this.gauge(12, 219, 38, "魔力 MP", 0x84bde8);
    this.summonGauge = this.gauge(12, 297, 38, "召喚", gold);
    this.text(31, 361, "◈", 12, "#f1c968");
    this.panel(layout.remainingTime);
    this.text(layout.remainingTime.x + 26, 19, "TIME", 7, "#9fc1d0");
    this.timeText = this.text(layout.remainingTime.x + 26, 39, "", 23, "#f1c968");
    this.buildButton = this.button(layout.buildButton, "◇", "魔法陣", callbacks.onBuild);
    this.abilityButton = this.button(layout.abilityButton, "✧", "アビリティ", callbacks.onAbility);
    this.summonButton = this.button(layout.summonButton, "◎", "召喚", callbacks.onSummon);
    this.button(layout.retryButton, "↻", "再配置", callbacks.onRetry);
    this.abilityGauge = this.gauge(layout.abilityButton.x + 5, layout.abilityButton.y + 42, 42, "", 0xc2acef, true);
    this.text(layout.retryButton.x + 26, 324, "COMMAND", 6, "#9fc1d0");
    this.text(layout.retryButton.x + 26, 346, "◈", 13, "#f1c968");
    this.resultText = this.text(gameViewport.width / 2, 192, "", 64, "#f1c968").setDepth(100).setStroke("#031822", 5);
    this.waitingHint = this.text(layout.waitingArea.x + layout.waitingArea.width / 2, layout.waitingArea.y + layout.waitingArea.height / 2, "", 10, "#9fc1d0");
  }

  contains(x: number, y: number): boolean { return isPointInHud(this.layout, x, y); }

  update(state: BattleState, selectedUnitId: PlayerUnitId | null, canSummonPlayer: boolean, canUseSelectedAbility: boolean): void {
    const model = createBattleHudModel(state, selectedUnitId, canSummonPlayer, canUseSelectedAbility);
    this.applyGauge(this.playerHp, model.playerHp, model.playerHp.text.replace("自分 ", ""));
    this.applyGauge(this.cpuHp, model.cpuHp, model.cpuHp.text.replace("敵 ", ""));
    this.applyGauge(this.mp, model.mp, model.mp.text.replace("MP ", ""));
    this.applyGauge(this.summonGauge, model.summonGauge, model.summonGauge.text.replace("召喚ゲージ ", ""));
    this.applyGauge(this.abilityGauge, model.abilityGauge, model.abilityGauge.text);
    this.timeText.setText(model.remainingTimeText);
    this.resultText.setText(state.phase === "Countdown" && state.result === "InProgress" ? model.resultText : "");
    this.setEnabled(this.buildButton, model.canBuild);
    this.setEnabled(this.abilityButton, model.canUseAbility);
    this.setEnabled(this.summonButton, model.canSummon);
    this.summonButton.label.setText(state.phase === "Setup" ? "戦闘開始" : "召喚");
    const hasDefeatedUnits = state.units.some(unit => unit.team === "Player" && unit.mode === "Defeated");
    this.waitingHint.setVisible(!hasDefeatedUnits && state.phase !== "Setup");
    this.waitingHint.setText("復活待機エリア  /  倒れた仲間を自分の召喚師へドラッグして復活");
  }

  destroy(): void { this.objects.forEach(object => object.destroy()); }

  private text(x: number, y: number, label: string, size: number, color: string): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, label, withCanvasTextResolution({
      fontFamily: '"Yu Mincho", Georgia, serif', fontSize: `${size}px`, color
    })).setOrigin(.5).setDepth(depth);
    this.objects.push(text);
    return text;
  }

  private rectangle(rect: UiRect, color: number): Phaser.GameObjects.Rectangle {
    const shape = this.scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, color).setOrigin(0).setDepth(depth);
    this.objects.push(shape);
    return shape;
  }

  private panel(rect: UiRect): void {
    this.rectangle(rect, 0x062432).setStrokeStyle(.6, 0x8bd6e0, .28);
    this.rectangle({ x: rect.x + 5, y: rect.y, width: Math.min(18, rect.width - 10), height: 1 }, gold).setAlpha(.65);
  }

  private gauge(x: number, y: number, width: number, label: string, color: number, compact = false): Gauge {
    if (label) this.text(x + width / 2, y, label, 8, "#9fc1d0");
    const trackY = y + (compact ? 7 : 38);
    this.rectangle({ x, y: trackY, width, height: compact ? 2 : 4 }, 0x03131f);
    const fill = this.rectangle({ x, y: trackY, width: 0, height: compact ? 2 : 4 }, color);
    const text = this.text(x + width / 2, y + (compact ? 0 : 21), "", compact ? 6 : 8, "#eaf8ff");
    return { fill, text, width };
  }

  private applyGauge(gauge: Gauge, model: HudGaugeModel, text: string): void {
    gauge.fill.width = gauge.width * model.ratio;
    gauge.text.setText(text);
  }

  private button(rect: UiRect, glyph: string, label: string, action: () => void): Button {
    const background = this.rectangle(rect, 0x0b3544).setStrokeStyle(.7, aqua, .45).setInteractive({ useHandCursor: true });
    const icon = this.text(rect.x + rect.width / 2, rect.y + 18, glyph, 23, "#f1c968");
    const caption = this.text(rect.x + rect.width / 2, rect.y + 35, label, 8, "#eaf8ff");
    const button = { background, icon, label: caption, enabled: true };
    background.on("pointerover", () => { if (button.enabled) background.setFillStyle(0x155365); });
    background.on("pointerout", () => background.setFillStyle(0x0b3544));
    background.on("pointerdown", () => { if (button.enabled) action(); });
    return button;
  }

  private setEnabled(button: Button, enabled: boolean): void {
    if (button.enabled === enabled) return;
    button.enabled = enabled;
    button.background.setAlpha(enabled ? 1 : .5).setFillStyle(0x0b3544);
    button.icon.setAlpha(enabled ? 1 : .35);
    button.label.setAlpha(enabled ? 1 : .5);
    if (enabled) button.background.setInteractive({ useHandCursor: true });
    else button.background.disableInteractive(true);
  }
}
