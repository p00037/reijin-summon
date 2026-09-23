import type { TeamId } from '@reijin-summon/shared';
export class ConnectionLifecycle {
    private deadlines = new Map<TeamId, number>();
    disconnect(team: TeamId, now: number) { this.deadlines.set(team, now + 30000); }
    reconnect(team: TeamId, now: number) { const deadline = this.deadlines.get(team); if (deadline !== undefined && now >= deadline)
        return false; this.deadlines.delete(team); return true; }
    advance(now: number): TeamId[] { return [...this.deadlines].filter(([, deadline]) => now >= deadline).map(([team]) => team); }
}
