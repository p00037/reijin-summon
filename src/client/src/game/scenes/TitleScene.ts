import Phaser from "phaser";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#101827");

    this.add
      .text(width / 2, height / 2 - 80, "The Eternal Wheel MVP", {
        color: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        fontSize: "40px"
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 30, "Command units, build elementals, and summon a decisive force.", {
        color: "#cbd5e1",
        fontFamily: "Arial, sans-serif",
        fontSize: "16px"
      })
      .setOrigin(0.5);

    const buttonWidth = 190;
    const buttonHeight = 48;
    const button = this.add
      .rectangle(width / 2, height / 2 + 48, buttonWidth, buttonHeight, 0x2563eb, 1)
      .setStrokeStyle(1, 0x93c5fd, 1)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(width / 2, height / 2 + 48, "Start Battle", {
        color: "#ffffff",
        fontFamily: "Arial, sans-serif",
        fontSize: "18px"
      })
      .setOrigin(0.5);

    button.on("pointerover", () => button.setFillStyle(0x1d4ed8, 1));
    button.on("pointerout", () => button.setFillStyle(0x2563eb, 1));
    button.on("pointerdown", () => this.scene.start("BattleScene"));
    label.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.scene.start("BattleScene"));
  }
}
