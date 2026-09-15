import Phaser from "phaser";
import { mountTitleScreen } from "../ui/titleScreen";

export class TitleScene extends Phaser.Scene {
  constructor() { super("TitleScene"); }

  create(): void {
    const cleanup = mountTitleScreen(() => this.scene.start("DeckScene"));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  }
}
