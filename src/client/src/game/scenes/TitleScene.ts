import Phaser from "phaser";
import {
  browserSizeCanvas,
  withCanvasTextResolution
} from "../browserSizeCanvas";
import { gameViewport } from "../gameViewport";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create(): void {
    const { width, height } = gameViewport;
    this.cameras.main
      .setOrigin(0, 0)
      .setZoom(browserSizeCanvas.renderScale)
      .setBackgroundColor("#101827");

    this.add
      .text(width / 2, height / 2 - 80, "The Eternal Wheel MVP", withCanvasTextResolution({
        color: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        fontSize: "40px"
      }))
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 30, "Command units, build elementals, and summon a decisive force.", withCanvasTextResolution({
        color: "#cbd5e1",
        fontFamily: "Arial, sans-serif",
        fontSize: "16px"
      }))
      .setOrigin(0.5);

    const buttonWidth = 190;
    const buttonHeight = 48;
    const button = this.add
      .rectangle(width / 2, height / 2 + 48, buttonWidth, buttonHeight, 0x2563eb, 1)
      .setStrokeStyle(1, 0x93c5fd, 1)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(width / 2, height / 2 + 48, "Start Battle", withCanvasTextResolution({
        color: "#ffffff",
        fontFamily: "Arial, sans-serif",
        fontSize: "18px"
      }))
      .setOrigin(0.5);

    button.on("pointerover", () => button.setFillStyle(0x1d4ed8, 1));
    button.on("pointerout", () => button.setFillStyle(0x2563eb, 1));
    button.on("pointerdown", () => this.scene.start("BattleScene"));
    label.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.scene.start("BattleScene"));
  }
}
