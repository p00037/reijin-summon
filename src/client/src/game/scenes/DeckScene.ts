import {mountOnlineBattleStatus} from '../ui/onlineLobby';
import {activeOnline} from '../network/onlineSession';
import Phaser from "phaser";
import { mountDeckEditor } from "../deck/deckEditor";

export class DeckScene extends Phaser.Scene {
  constructor() { super("DeckScene"); }

  create(): void {
    const onlineCleanup=activeOnline?mountOnlineBattleStatus(activeOnline,()=>{},()=>this.scene.start("TitleScene"),false):()=>{};
    const host = document.createElement("div");
    document.body.append(host);
    const cleanup = mountDeckEditor(host, (cardIds, playerSummonId) => {
      activeOnline?.setDeck([...cardIds], playerSummonId);
      this.scene.start("BattleScene", { playerCardIds: [...cardIds], playerSummonId });
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      onlineCleanup();
      cleanup();
      host.remove();
    });
  }
}
