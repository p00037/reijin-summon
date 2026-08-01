import Phaser from "phaser";
import "./style.css";
import { highDpiCanvas } from "./game/highDpiCanvas";
import { TitleScene } from "./game/scenes/TitleScene";
import { BattleScene } from "./game/scenes/BattleScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: highDpiCanvas.width,
  height: highDpiCanvas.height,
  backgroundColor: "#101827",
  scene: [TitleScene, BattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});
