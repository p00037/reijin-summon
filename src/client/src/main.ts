import Phaser from "phaser";
import "./style.css";
import { browserSizeCanvas } from "./game/browserSizeCanvas";
import { TitleScene } from "./game/scenes/TitleScene";
import { BattleScene } from "./game/scenes/BattleScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: browserSizeCanvas.width,
  height: browserSizeCanvas.height,
  backgroundColor: "#101827",
  input: {
    activePointers: 10
  },
  scene: [TitleScene, BattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});
