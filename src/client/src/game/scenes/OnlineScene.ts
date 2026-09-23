import Phaser from 'phaser';
import { mountOnlineLobby } from '../ui/onlineLobby';
import { OnlineSession, activeOnline, setActiveOnline } from '../network/onlineSession';
export class OnlineScene extends Phaser.Scene {
    constructor() { super('OnlineScene'); }
    create() { const session = activeOnline ?? new OnlineSession(); setActiveOnline(session); const cleanup = mountOnlineLobby(session, () => this.scene.start(session.view?.phase === 'Battle' || session.view?.phase === 'Result' || session.view?.phase === 'Countdown' ? 'BattleScene' : 'DeckScene'), () => { setActiveOnline(null); this.scene.start('TitleScene'); }); this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup); }
}
