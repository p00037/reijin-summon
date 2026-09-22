import { FixedStep } from '../online/fixedStep.js';
import { metrics } from '../online/metrics.js';
import { Client, Room } from 'colyseus';
import type { TeamId } from '@reijin-summon/shared';
import { parseCommandEnvelope, parseName, PROTOCOL_VERSION, record } from '@reijin-summon/shared/network/protocol';
import { ArenaState, publishBattle } from './schema/ArenaState.js';
import { MatchController } from '../online/matchController.js';
import { roomRegistry } from '../online/roomRegistry.js';
import { ConnectionLifecycle } from '../online/connectionLifecycle.js';
import { RateLimit } from '../online/requestLimits.js';
export class ArenaRoom extends Room<ArenaState> {
    maxClients = 2;
    private fixedStep = new FixedStep();
    private notifyElapsed = 0;
    private code = '';
    private match = new MatchController();
    private lifecycle = new ConnectionLifecycle();
    private seats = new Map<string, {
        team: TeamId;
        seat: string;
        name: string;
    }>();
    private limits = new RateLimit(30, 1000);
    private violations = new Map<string, {
        first: number;
        last: number;
    }>();
    private lastActivity = Date.now();
    private phaseStart = Date.now();
    private lastPhase = 'Waiting';
    private eventId = 0;
    private shutting = false;
    onCreate() {
        this.code = roomRegistry.create();
        this.roomId = this.code;
        this.setMetadata({ code: this.code });
        this.setState(new ArenaState());
        this.setPatchRate(100);
        this.onMessage('*', (client, type, value) => this.message(client, String(type), value));
        this.setSimulationInterval(elapsed => { const start = performance.now(); this.fixedStep.advance(elapsed, () => this.step()); metrics.record(performance.now() - start, this.fixedStep.pendingMs); }, 50);
    }
    onAuth(_client: Client, options: any) { if (options?.version !== PROTOCOL_VERSION)
        throw Error('再読み込みしてください'); const parsed = parseName(options?.name); if (!parsed.ok)
        throw Error(parsed.reason); return { name: parsed.value }; }
    onJoin(client: Client, _options: any, auth: {
        name: string;
    }) { if (!['Waiting', 'Setup'].includes(this.match.publicView().phase))
        throw Error('試合開始後は参加できません'); const team: TeamId = [...this.seats.values()].some(s => s.team === 'Player') ? 'Cpu' : 'Player'; const seat = roomRegistry.reserve(this.code); this.seats.set(client.sessionId, { team, seat, name: auth.name }); this.match.setConnected(team, true); client.send('welcome', { team, code: this.code, version: PROTOCOL_VERSION }); this.notify(); }
    private message(client: Client, type: string, value: unknown) {
        const seat = this.seats.get(client.sessionId);
        if (!seat)
            return;
        if (!this.limits.allow(client.sessionId)) {
            const now = Date.now();
            const old = this.violations.get(client.sessionId);
            const first = old && now - old.last < 1500 ? old.first : now;
            this.violations.set(client.sessionId, { first, last: now });
            if (now - first >= 3000)
                client.leave(4008);
            return;
        }
        this.lastActivity = Date.now();
        let result;
        if (type === 'hello') {
            client.send('welcome', { team: seat.team, code: this.code, version: PROTOCOL_VERSION });
            this.notify();
            return;
        }
        if (type === 'deck' && record(value))
            result = this.match.setDeck(seat.team, value.cardIds, value.summonId);
        else if (type === 'ready' && typeof value === 'boolean')
            result = this.match.setReady(seat.team, value);
        else if (type === 'command') {
            const parsed = parseCommandEnvelope(value);
            result = parsed.ok ? this.match.apply(seat.team, parsed.value) : parsed;
        }
        else if (type === 'rematch')
            result = this.match.requestRematch(seat.team);
        else if (type === 'surrender') {
            this.match.finish(seat.team === 'Player' ? 'CpuWin' : 'PlayerWin', 'surrender');
        }
        else
            return;
        if (result && !result.ok)
            client.send('error', result.reason);
        this.notify();
    }
    private step() {
        this.match.advance(.05);
        const view = this.match.publicView();
        const now = Date.now();
        const expired = this.lifecycle.advance(now);
        if (view.phase === 'Battle' && view.result === 'InProgress') {
            if (!view.connected.Player && !view.connected.Cpu) {
                if (expired.length === 2)
                    this.match.close('both-disconnected');
            }
            else
                for (const team of expired)
                    if (!view.connected[team])
                        this.match.finish(team === 'Player' ? 'CpuWin' : 'PlayerWin', 'disconnect');
        }
        if (['Waiting', 'Setup'].includes(view.phase) && expired.length)
            this.match.close('disconnected-before-start');
        if (view.phase !== this.lastPhase) {
            this.lastPhase = view.phase;
            this.phaseStart = now;
        }
        const limit = view.phase === 'Result' ? 120000 : 600000;
        const start = view.phase === 'Setup' ? this.lastActivity : this.phaseStart;
        if (['Waiting', 'Setup', 'Result'].includes(view.phase) && now - start >= limit)
            this.match.close('inactive');
        const events = this.match.drainEvents();
        if (events.attacks.length || events.summons.length)
            this.broadcast('effects', { id: ++this.eventId, ...events });
        this.notifyElapsed += 50;
        if (this.notifyElapsed >= 100) {
            this.notifyElapsed = 0;
            this.notify();
        }
        if (this.match.publicView().phase === 'Closed' && !this.shutting) {
            this.shutting = true;
            void this.disconnect();
        }
    }
    private notify() { const view = this.match.publicView(); publishBattle(this.state, view.battle); const { battle, ...info } = view; this.broadcast('room', { ...info, code: this.code, names: Object.fromEntries([...this.seats.values()].map(s => [s.team, s.name])), expiresIn: Math.max(0, Math.ceil(((view.phase === 'Result' ? 120000 : 600000) - (Date.now() - (view.phase === 'Setup' ? this.lastActivity : this.phaseStart))) / 1000)) }); if (!battle)
        for (const client of this.clients) {
            const seat = this.seats.get(client.sessionId);
            if (seat)
                client.send('private', this.match.privateView(seat.team));
        } }
    async onLeave(client: Client, consented: boolean) {
        const seat = this.seats.get(client.sessionId);
        if (!seat)
            return;
        this.match.setConnected(seat.team, false);
        this.lifecycle.disconnect(seat.team, Date.now());
        this.notify();
        if (!consented && !this.shutting) {
            try {
                const restored = await this.allowReconnection(client, 30);
                if (!this.lifecycle.reconnect(seat.team, Date.now())) {
                    restored.leave(4000);
                    return;
                }
                this.match.setConnected(seat.team, true);
                restored.send('welcome', { team: seat.team, code: this.code, version: PROTOCOL_VERSION });
                this.notify();
                return;
            }
            catch { }
        }
        if (consented && !this.shutting) {
            const v = this.match.publicView();
            if (v.phase === 'Battle')
                this.match.finish(seat.team === 'Player' ? 'CpuWin' : 'PlayerWin', 'surrender');
            else
                this.match.close('opponent-left');
        }
        roomRegistry.release(seat.seat);
        if (this.match.publicView().phase !== 'Battle')
            this.seats.delete(client.sessionId);
        this.notify();
    }
    onBeforeShutdown() { this.shutting=true; this.match.close('server-shutdown'); this.notify(); void this.disconnect(); }
    onDispose() { roomRegistry.close(this.code); }
}
