import Phaser from "phaser";
import type { BattleState, PlayerUnitId } from "../core/types";
import { gameViewport } from "../gameViewport";
import { withCanvasTextResolution } from "../browserSizeCanvas";
import type { BattleLayout, UiRect } from "./battleLayout";
import { isPointInHud } from "./battleLayout";
import type { BattleHudModel } from "./battleHudModel";
import {
  createBattleHudModel,
  elementButtonTextureKey,
  summonButtonTextureKey
} from "./battleHudModel";

export type BattleHudCallbacks = {
  onBuild: () => void;
  onSummon: () => void;
  onRetry: () => void;
};

type HudGauge = {
  background: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  width: number;
  height: number;
  orientation: "Horizontal" | "Vertical";
};

type ImageHudButton = {
  background: Phaser.GameObjects.Rectangle;
  image: Phaser.GameObjects.Image;
  enabled: boolean;
};

type RetryHudButton = {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

const hudDepth = 3;

export class BattleHud {
  private readonly scene: Phaser.Scene;
  private readonly layout: BattleLayout;
  private readonly leftBackground: Phaser.GameObjects.Rectangle;
  private readonly waitingBackground: Phaser.GameObjects.Rectangle;
  private readonly playerHp: HudGauge;
  private readonly cpuHp: HudGauge;
  private readonly mp: HudGauge;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly summonGauge: HudGauge;
  private readonly resultText: Phaser.GameObjects.Text;
  private readonly buildButton: ImageHudButton;
  private readonly summonButton: ImageHudButton;
  private readonly retryButton: RetryHudButton;

  constructor(
    scene: Phaser.Scene,
    layout: BattleLayout,
    callbacks: BattleHudCallbacks
  ) {
    this.scene = scene;
    this.layout = layout;

    this.leftBackground = createPanel(scene, layout.leftPanel);
    this.waitingBackground = createPanel(scene, layout.waitingArea);
    this.playerHp = createGauge(
      scene,
      layout.playerHp.x,
      layout.playerHp.y,
      layout.playerHp.width,
      layout.playerHp.height,
      0x22c55e,
      "Vertical"
    );
    this.cpuHp = createGauge(
      scene,
      layout.cpuHp.x,
      layout.cpuHp.y,
      layout.cpuHp.width,
      layout.cpuHp.height,
      0xef4444,
      "Vertical"
    );
    this.mp = createGauge(
      scene,
      layout.mp.x,
      layout.mp.y,
      layout.mp.width,
      layout.mp.height,
      0x3b82f6,
      "Vertical"
    );
    this.timeText = scene.add
      .text(
        layout.remainingTime.x + layout.remainingTime.width / 2,
        layout.remainingTime.y + layout.remainingTime.height / 2,
        "",
        titleStyle(18, "#f8fafc")
      )
      .setOrigin(0.5)
      .setDepth(hudDepth);

    this.summonGauge = createGauge(
      scene,
      layout.summonGauge.x,
      layout.summonGauge.y,
      layout.summonGauge.width,
      layout.summonGauge.height,
      0xfacc15,
      "Vertical"
    );
    this.resultText = scene.add
      .text(
        gameViewport.width / 2,
        gameViewport.height / 2,
        "",
        titleStyle(48, "#f8fafc")
      )
      .setOrigin(0.5)
      .setDepth(100)
      .setStroke("#020617", 8);

    this.buildButton = this.createImageButton(
      layout.buildButton,
      elementButtonTextureKey,
      callbacks.onBuild
    );
    this.summonButton = this.createImageButton(
      layout.summonButton,
      summonButtonTextureKey,
      callbacks.onSummon
    );
    this.retryButton = this.createRetryButton(layout.retryButton, callbacks.onRetry);
  }

  contains(x: number, y: number): boolean {
    return isPointInHud(this.layout, x, y);
  }

  update(
    state: BattleState,
    selectedUnitId: PlayerUnitId | null,
    canSummonPlayer: boolean
  ): void {
    const model = createBattleHudModel(state, selectedUnitId, canSummonPlayer);
    this.applyModel(model);
  }

  destroy(): void {
    this.leftBackground.destroy();
    this.waitingBackground.destroy();
    destroyGauge(this.playerHp);
    destroyGauge(this.cpuHp);
    destroyGauge(this.mp);
    this.timeText.destroy();
    destroyGauge(this.summonGauge);
    this.resultText.destroy();
    this.buildButton.background.destroy();
    this.buildButton.image.destroy();
    this.summonButton.background.destroy();
    this.summonButton.image.destroy();
    this.retryButton.background.destroy();
    this.retryButton.label.destroy();
  }

  private applyModel(model: BattleHudModel): void {
    applyGaugeModel(this.playerHp, model.playerHp);
    applyGaugeModel(this.cpuHp, model.cpuHp);
    applyGaugeModel(this.mp, model.mp);
    this.timeText.setText(model.remainingTimeText);
    applyGaugeModel(this.summonGauge, model.summonGauge);
    this.resultText.setText(model.resultText);
    this.setImageButtonEnabled(this.buildButton, model.canBuild);
    this.setImageButtonEnabled(this.summonButton, model.canSummon);
  }

  private createImageButton(
    rect: UiRect,
    textureKey: string,
    onClick: () => void
  ): ImageHudButton {
    const background = this.createButtonBackground(rect, onClick);
    const image = this.scene.add
      .image(rect.x + rect.width / 2, rect.y + rect.height / 2, textureKey)
      .setDisplaySize(rect.width - 6, rect.height - 6)
      .setDepth(hudDepth);
    return { background, image, enabled: true };
  }

  private createRetryButton(rect: UiRect, onClick: () => void): RetryHudButton {
    const background = this.createButtonBackground(rect, onClick);
    const label = this.scene.add
      .text(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        "R",
        titleStyle(24, "#f8fafc")
      )
      .setOrigin(0.5)
      .setDepth(hudDepth);
    return { background, label };
  }

  private createButtonBackground(
    rect: UiRect,
    onClick: () => void
  ): Phaser.GameObjects.Rectangle {
    const background = this.scene.add
      .rectangle(rect.x, rect.y, rect.width, rect.height, 0x1e293b, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x60a5fa, 1)
      .setDepth(hudDepth)
      .setInteractive({ useHandCursor: true });
    background.on("pointerover", () => {
      if (background.input?.enabled) {
        background.setFillStyle(0x334155, 1);
      }
    });
    background.on("pointerout", () => background.setFillStyle(0x1e293b, 1));
    background.on("pointerdown", () => {
      if (background.input?.enabled) {
        onClick();
      }
    });
    return background;
  }

  private setImageButtonEnabled(button: ImageHudButton, enabled: boolean): void {
    if (button.enabled === enabled) {
      return;
    }
    button.enabled = enabled;
    button.background.setAlpha(enabled ? 1 : 0.45);
    button.image.setAlpha(enabled ? 1 : 0.45);
    if (enabled) {
      button.background.setInteractive({ useHandCursor: true });
    } else {
      button.background.setFillStyle(0x1e293b, 1).disableInteractive(true);
    }
  }
}

function createPanel(scene: Phaser.Scene, rect: UiRect): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(rect.x, rect.y, rect.width, rect.height, 0x0f172a, 0.94)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x334155, 1)
    .setDepth(hudDepth);
}

function createGauge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  orientation: "Horizontal" | "Vertical"
): HudGauge {
  const innerWidth = width - 4;
  const innerHeight = height - 4;
  const background = scene.add
    .rectangle(x, y, width, height, 0x020617, 1)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x475569, 1)
    .setDepth(hudDepth);
  const fill = scene.add
    .rectangle(
      x + 2,
      orientation === "Vertical" ? y + height - 2 : y + 2,
      orientation === "Vertical" ? innerWidth : 0,
      orientation === "Vertical" ? 0 : innerHeight,
      color,
      1
    )
    .setOrigin(0, 0)
    .setDepth(hudDepth);
  const text = scene.add
    .text(x + width / 2, y + height / 2, "", titleStyle(12, "#f8fafc"))
    .setOrigin(0.5)
    .setDepth(hudDepth)
    .setStroke("#020617", 3);
  if (orientation === "Vertical") {
    text.setAngle(-90);
  }
  return {
    background,
    fill,
    text,
    width: innerWidth,
    height: innerHeight,
    orientation
  };
}

function applyGaugeModel(gauge: HudGauge, model: BattleHudModel["playerHp"]): void {
  gauge.text.setText(model.text);
  if (gauge.orientation === "Vertical") {
    const fillHeight = gauge.height * model.ratio;
    gauge.fill.height = fillHeight;
    gauge.fill.y = gauge.background.y + gauge.background.height - 2 - fillHeight;
    return;
  }
  gauge.fill.width = gauge.width * model.ratio;
}

function destroyGauge(gauge: HudGauge): void {
  gauge.background.destroy();
  gauge.fill.destroy();
  gauge.text.destroy();
}

function titleStyle(fontSize: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
  return withCanvasTextResolution({
    color,
    fontFamily: "Arial, sans-serif",
    fontSize: `${fontSize}px`
  });
}
