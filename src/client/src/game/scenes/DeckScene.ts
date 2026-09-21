import Phaser from "phaser";
import { mountDeckEditor } from "../deck/deckEditor";

export class DeckScene extends Phaser.Scene {
  constructor() { super("DeckScene"); }

  create(): void {
    const host = document.createElement("div");
    document.body.append(host);
    const cleanup = mountDeckEditor(host, (cardIds, playerSummonId) => {
      this.scene.start("BattleScene", { playerCardIds: [...cardIds], playerSummonId });
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      cleanup();
      host.remove();
    });
  }
}
