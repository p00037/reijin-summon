import { canSummon } from '../rules/summonSystem';
import { Client, Room } from 'colyseus.js';
import { createDefaultBattleConfig } from '../core/battleConfig';
import { createDefaultBattleState } from '../core/battleState';
import type { BattleState, BattleCommand, TeamId } from '../core/types';
import type { SummonId } from '../core/summonCatalog';
import { PROTOCOL_VERSION, type RoomView } from '@reijin-summon/shared/network/protocol';
import { toLocalState, toServerCommand } from './battlePerspective';
export class OnlineSession {
    readonly config = createDefaultBattleConfig();
    state = createDefaultBattleState(this.config);
    team: TeamId = 'Player';
    room?: Room;
    view?: Omit<RoomView, 'battle'> & {
        names: Record<TeamId, string>;
        expiresIn: number;
    };
    code = '';
    status = '未接続';
    error = '';
    connected = false;
    private sequence = 0;
    private stopped = false;
    private lastMatch = '';
    private lastRevision = -1;
    private effectsId = 0;
    private listeners = new Set<() => void>();
    private target: BattleState | null = null;
    private synchronized=false;
    get inputReady(){return this.connected&&this.synchronized;}
    private generation = 0;
    private reconnecting = false;
    private client: Client;
    private key = 'reijin-online-session';
    private savedSession?: { token: string | undefined; team: TeamId; sequence: number; matchId: string };
    constructor(client?: Client) { if (client) {
        this.client = client;
        this.state.units = [];
        return;
    } const url = import.meta.env.VITE_GAME_SERVER_URL || ((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.hostname + ':2567'); if (location.protocol === 'https:' && url.startsWith('ws:'))
        throw Error('公開環境はWSSで接続してください'); this.client = new Client(url); this.state.units = []; }
    subscribe(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    private notify() { for (const fn of this.listeners)
        fn(); }
    async create(name: string) { this.status = '接続中（起動に約1分かかる場合があります）'; this.notify(); await this.connect(this.client.create('arena', { name, version: PROTOCOL_VERSION }), 90000); }
    async join(name: string, code: string) { this.status = '接続中'; this.notify(); await this.connect(this.client.joinById(code, { name, version: PROTOCOL_VERSION }), 90000); }
    private async connect(request: Promise<Room>, timeoutMs: number) {
        const generation = ++this.generation;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const pending = request.then(async (room) => { if (this.stopped || generation !== this.generation) {
            await room.leave();
            return undefined;
        } return room; });
        try {
            const room = await Promise.race([pending, new Promise<never>((_, reject) => { timer = setTimeout(() => { if (generation === this.generation)
                    this.generation++; reject(Error('接続がタイムアウトしました。もう一度お試しください')); }, timeoutMs); })]);
            if (room)
                this.attach(room);
        }
        finally {
            clearTimeout(timer);
        }
    }
    private attach(room: Room) {
        this.synchronized=false;this.target=null;this.state.recentAttackEvents=[];this.state.recentSummonAttackEvents=[];
        this.room = room;
        this.connected = true;
        this.status = '接続済み';
        this.lastRevision = -1;
        this.save();
        room.onMessage('welcome', (v: any) => { this.team = v.team; this.code = v.code; this.save(); this.notify(); });
        room.onMessage('room', (v: any) => { if (v.matchId !== this.lastMatch) {
            this.sequence = 0;
            this.lastMatch = v.matchId;
            this.effectsId = 0;
            this.target = null;
            this.state.recentAttackEvents = [];
            this.state.recentSummonAttackEvents = [];
            this.save();
        } this.view = v; if (v.phase === 'Closed') {
            this.connected = false;
            this.status = v.reason === 'server-shutdown' ? 'サーバー終了のため試合を中断しました' : v.reason === 'inactive' ? '操作がないためルームを閉じました' : '相手の退出または切断により試合を終了しました';
            this.clear();
        } this.notify(); });
        room.onMessage('private', (v: BattleState | null) => { if (v && this.view?.phase !== 'Battle' && this.view?.phase !== 'Result') {
            this.state = toLocalState(v, this.team);this.synchronized=true;
            this.target = null;
            this.state.phase = this.view?.phase === 'Countdown' ? 'Countdown' : 'Setup';
            this.state.countdownRemainingSeconds = this.view?.countdown ?? 5;
            this.notify();
        } });
        room.onMessage('error', (v: string) => { this.error = v; this.notify(); });
        room.onMessage('effects', (v: any) => { if (v.id <= this.effectsId)
            return; this.effectsId = v.id; const e = toLocalState({ ...this.state, recentAttackEvents: v.attacks, recentSummonAttackEvents: v.summons }, this.team); this.state.recentAttackEvents.push(...e.recentAttackEvents); this.state.recentSummonAttackEvents.push(...e.recentSummonAttackEvents); });
        room.onStateChange((v: any) => { if (!v.battle || v.revision <= this.lastRevision)
            return; this.lastRevision = v.revision; const next = toLocalState(v.battle.toJSON(), this.team); next.recentAttackEvents = this.state.recentAttackEvents; next.recentSummonAttackEvents = this.state.recentSummonAttackEvents; this.target = structuredClone(next); for (const unit of next.units) {
            const prior = this.state.units.find(u => u.unitId === unit.unitId);
            if (prior && prior.mode === unit.mode)
                unit.position = { ...prior.position };
        } this.state = next;this.synchronized=true; this.notify(); });
        room.onLeave(() => { this.connected = false; this.notify(); if (!this.stopped && this.view?.phase !== 'Closed')
            void this.reconnect(); });
        room.send('hello');
        this.notify();
    }
    private save() {
        this.savedSession = { token: this.room?.reconnectionToken, team: this.team, sequence: this.sequence, matchId: this.lastMatch };
        try { sessionStorage.setItem(this.key, JSON.stringify(this.savedSession)); }
        catch { this.error = 'このブラウザでは再読み込みからの復帰情報を保存できません'; }
    }
    private clear() { this.savedSession=undefined; try {
        sessionStorage.removeItem(this.key);
    }
    catch { } }
    async reconnect() { if (this.reconnecting || this.stopped)
        return; this.reconnecting = true; try {
        this.status = '再接続中（30秒以内）';
        this.notify();
        let saved: any=this.savedSession;
        try {
            saved ??= JSON.parse(sessionStorage.getItem(this.key) || 'null');
        }
        catch { }
        if (!saved?.token) {
            this.status = '復帰情報がありません';
            this.notify();
            return;
        }
        this.team = saved.team;
        this.sequence = saved.sequence ?? 0;
        this.lastMatch = saved.matchId ?? '';
        const deadline = Date.now() + 30000;
        let wait = 250;
        while (Date.now() < deadline && !this.stopped) {
            try {
                await this.connect(this.client.reconnect(saved.token), Math.max(1, deadline - Date.now()));
                return;
            }
            catch {
                await new Promise(r => setTimeout(r, wait));
                wait = Math.min(2000, wait * 2);
            }
        }
        this.clear();
        this.status = '復帰できませんでした。サーバー停止時は試合中断になります';
        this.notify();
    }
    finally {
        this.reconnecting = false;
    } }
    hasSaved() { try {
        return !!sessionStorage.getItem(this.key);
    }
    catch {
        return false;
    } }
    setDeck(cardIds: string[], summonId: SummonId) { this.room?.send('deck', { cardIds, summonId }); }
    canSummon(team: TeamId) { return this.connected && canSummon(this.state, this.config, team); }
    ready(value: boolean) { if (this.connected)
        this.room?.send('ready', value); }
    applyCommand(command: BattleCommand) { if (!this.inputReady)
        return; if (command.commandType === 'StartBattle') {
        this.ready(!this.view?.ready[this.team]);
        return;
    } this.room?.send('command', { version: PROTOCOL_VERSION, matchId: this.lastMatch, sequence: ++this.sequence, command: toServerCommand(command, this.team) }); this.save(); }
    tick(dt: number) { if (!this.target)
        return; const alpha = Math.min(1, dt * 15); for (const unit of this.state.units) {
        const target = this.target.units.find(u => u.unitId === unit.unitId);
        if (target) {
            unit.position.x += (target.position.x - unit.position.x) * alpha;
            unit.position.y += (target.position.y - unit.position.y) * alpha;
        }
    } }
    rematch() { this.room?.send('rematch'); }
    async leave() { this.stopped = true; this.generation++; this.connected = false; this.clear(); if (activeOnline === this)
        setActiveOnline(null); await this.room?.leave(); }
}
export let activeOnline: OnlineSession | null = null;
export function setActiveOnline(session: OnlineSession | null) { activeOnline = session; }
