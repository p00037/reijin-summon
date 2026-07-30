import Phaser from "phaser";
import "./style.css";
import { gameViewport } from "./game/gameViewport";
import { TitleScene } from "./game/scenes/TitleScene";
import { BattleScene } from "./game/scenes/BattleScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: gameViewport.width,
  height: gameViewport.height,
  backgroundColor: "#101827",
  scene: [TitleScene, BattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});
