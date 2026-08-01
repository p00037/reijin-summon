import Phaser from "phaser";
import type { BattleState, PlayerUnitId } from "../core/types";
import { gameViewport } from "../gameViewport";
import { withHighDpiTextResolution } from "../highDpiCanvas";
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
  private readonly topBackground: Phaser.GameObjects.Rectangle;
  private readonly bottomBackground: Phaser.GameObjects.Rectangle;
  private readonly playerHp: HudGauge;
  private readonly cpuHp: HudGauge;
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

    this.topBackground = createPanel(scene, layout.topBar);
    this.bottomBackground = createPanel(scene, layout.bottomBar);
    this.playerHp = createGauge(
      scene,
      layout.playerHp.x,
      layout.playerHp.y,
      layout.playerHp.width,
      layout.playerHp.height,
      0x22c55e
    );
    this.cpuHp = createGauge(
      scene,
      layout.cpuHp.x,
      layout.cpuHp.y,
      layout.cpuHp.width,
      layout.cpuHp.height,
      0xef4444
    );
    this.timeText = scene.add
      .text(
        layout.topBar.x + layout.topBar.width / 2,
        layout.topBar.y + layout.topBar.height / 2,
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
      0xfacc15
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
    this.topBackground.destroy();
    this.bottomBackground.destroy();
    destroyGauge(this.playerHp);
    destroyGauge(this.cpuHp);
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
    this.playerHp.text.setText(model.playerHp.text);
    this.playerHp.fill.width = this.playerHp.width * model.playerHp.ratio;
    this.cpuHp.text.setText(model.cpuHp.text);
    this.cpuHp.fill.width = this.cpuHp.width * model.cpuHp.ratio;
    this.timeText.setText(model.remainingTimeText);
    this.summonGauge.text.setText(model.summonGauge.text);
    this.summonGauge.fill.width = this.summonGauge.width * model.summonGauge.ratio;
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
  color: number
): HudGauge {
  const innerWidth = width - 4;
  const background = scene.add
    .rectangle(x, y, width, height, 0x020617, 1)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x475569, 1)
    .setDepth(hudDepth);
  const fill = scene.add
    .rectangle(x + 2, y + 2, 0, height - 4, color, 1)
    .setOrigin(0, 0)
    .setDepth(hudDepth);
  const text = scene.add
    .text(x + width / 2, y + height / 2, "", titleStyle(15, "#f8fafc"))
    .setOrigin(0.5)
    .setDepth(hudDepth);
  return { background, fill, text, width: innerWidth };
}

function destroyGauge(gauge: HudGauge): void {
  gauge.background.destroy();
  gauge.fill.destroy();
  gauge.text.destroy();
}

function titleStyle(fontSize: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
  return withHighDpiTextResolution({
    color,
    fontFamily: "Arial, sans-serif",
    fontSize: `${fontSize}px`
  });
}
