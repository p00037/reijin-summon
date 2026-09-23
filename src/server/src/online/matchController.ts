import { randomUUID } from 'node:crypto';
import { GameSession, createDefaultBattleConfig, createOnlineBattleState, tryPlaceInitialUnit, type TeamId, type UnitId, type Vec2, type MatchResult, type BattleState, type SummonId } from '@reijin-summon/shared';
import { ok, fail, parseDeck, type DeckChoice, type RoomView, type CommandEnvelope } from '@reijin-summon/shared/network/protocol';
export class MatchController {
    private decks: Partial<Record<TeamId, DeckChoice>> = {};
    private placements: Partial<Record<TeamId, Record<string, Vec2>>> = {};
    private session: GameSession | null = null;
    private sequence: Record<TeamId, number> = { Player: 0, Cpu: 0 };
    private rematch = new Set<TeamId>();
    private view: RoomView = { phase: 'Waiting', matchId: randomUUID(), countdown: 5, ready: { Player: false, Cpu: false }, connected: { Player: false, Cpu: false }, result: 'InProgress', reason: '', battle: null };
    publicView(): RoomView { return { ...this.view, ready: { ...this.view.ready }, connected: { ...this.view.connected }, battle: this.view.phase === 'Battle' || this.view.phase === 'Result' ? this.session?.state ?? null : null }; }
    privateView(team: TeamId): BattleState | null { if (!this.decks[team])
        return null; const state = this.makeState(); state.units = state.units.filter(u => u.team === team); state.cpuSummonId = team === 'Cpu' ? this.decks.Cpu!.summonId : 'raphael'; state.playerSummonId = team === 'Player' ? this.decks.Player!.summonId : 'raphael'; return state; }
    private makeState() { const fallback: DeckChoice = { cardIds: ['SC001'], summonId: 'raphael' }; const state = createOnlineBattleState(createDefaultBattleConfig(), { Player: this.decks.Player ?? fallback, Cpu: this.decks.Cpu ?? fallback }); for (const unit of state.units) {
 const position=this.placements[unit.team]?.[unit.unitId];
 if(position){unit.position={...position};unit.spawnPosition={...position};unit.destination={...position};}
}
return state; }
    setConnected(team: TeamId, connected: boolean) { this.view.connected[team] = connected; if (!connected && this.view.phase === 'Countdown') {
        this.view.phase = 'Setup';
        this.view.ready = { Player: false, Cpu: false };
        this.view.countdown = 5;
    } if (this.view.phase === 'Waiting' && this.view.connected.Player && this.view.connected.Cpu)
        this.view.phase = 'Setup'; }
    setDeck(team: TeamId, cardIds: unknown, summonId: unknown) { if (!['Waiting', 'Setup'].includes(this.view.phase) || this.view.ready[team])
        return fail('準備完了後は編成を変更できません'); const result = parseDeck({ cardIds, summonId }); if (!result.ok)
        return result; this.decks[team] = result.value; this.placements[team] = {}; return ok(undefined); }
    place(team: TeamId, unitId: UnitId, position: Vec2) { if (!['Waiting', 'Setup'].includes(this.view.phase) || this.view.ready[team] || !this.decks[team])
        return fail('配置できません'); const state = this.makeState(); if (state.units.find(u => u.unitId === unitId)?.team !== team || !tryPlaceInitialUnit(state, createDefaultBattleConfig(), unitId, position))
        return fail('配置できない場所です'); (this.placements[team] ??= {})[unitId] = { ...position }; return ok(undefined); }
    setReady(team: TeamId, ready: boolean) { if (!ready && this.view.phase === 'Countdown') {
        this.view.phase = 'Setup';
        this.view.countdown = 5;
    } if (!['Waiting', 'Setup'].includes(this.view.phase) || !this.decks[team])
        return fail('準備できません'); this.view.ready[team] = ready; if (this.view.ready.Player && this.view.ready.Cpu && this.view.connected.Player && this.view.connected.Cpu) {
        this.view.phase = 'Countdown';
        this.view.countdown = 5;
    } return ok(undefined); }
    advance(dt: number) { if (this.view.phase === 'Countdown') {
        this.view.countdown = Math.max(0, this.view.countdown - dt);
        if (this.view.countdown < 1e-8) {
            this.session = new GameSession(createDefaultBattleConfig(), this.makeState());
            this.session.state.phase = 'InProgress';
            this.view.phase = 'Battle';
        }
    }
    else if (this.view.phase === 'Battle' && this.session) {
        this.session.tick(dt);
        if (this.session.state.result !== 'InProgress')
            this.finish(this.session.state.result, this.session.state.remainingSeconds <= 0 ? 'time-limit' : 'defeat');
    } }
    apply(team: TeamId, envelope: CommandEnvelope) { if (envelope.matchId !== this.view.matchId || envelope.sequence <= this.sequence[team] || envelope.command.team !== team)
        return fail('古い操作または権限外の操作です'); this.sequence[team] = envelope.sequence; if (envelope.command.commandType === 'PlaceInitialUnit')
        return this.place(team, envelope.command.unitId, envelope.command.targetPosition); if (this.view.phase !== 'Battle' || !this.session)
        return fail('戦闘中ではありません'); const command = envelope.command; if ('unitId' in command && this.session.state.units.find(u => u.unitId === command.unitId)?.team !== team)
        return fail('操作権限がありません'); this.session.applyCommand(envelope.command); if (this.session.state.result !== 'InProgress')
        this.finish(this.session.state.result, 'defeat'); return ok(undefined); }
    finish(result: MatchResult, reason: string) { if (this.view.phase === 'Result' || this.view.phase === 'Closed')
        return; this.view.result = result; this.view.reason = reason; this.view.phase = 'Result'; if (this.session)
        this.session.state.result = result; }
    close(reason: string) { if (this.view.phase !== 'Result')
        this.view.reason = reason; this.view.phase = 'Closed'; }
    requestRematch(team: TeamId) { if (this.view.phase !== 'Result')
        return fail('再戦できません'); this.rematch.add(team); if (this.rematch.size === 2) {
        this.view = { ...this.view, phase: 'Setup', matchId: randomUUID(), ready: { Player: false, Cpu: false }, result: 'InProgress', reason: '', battle: null, countdown: 5 };
        this.session = null;
        this.sequence = { Player: 0, Cpu: 0 };
        this.rematch.clear();
        this.placements = {};
    } return ok(undefined); }
    drainEvents() { if (!this.session)
        return { attacks: [], summons: [] }; const attacks = this.session.state.recentAttackEvents.splice(0); const summons = this.session.state.recentSummonAttackEvents.splice(0); return { attacks, summons }; }
}
