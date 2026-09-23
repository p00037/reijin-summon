import type { BattleState, BattleCommand, TeamId, Vec2 } from '../core/types';
export function perspectivePoint(p: Vec2, team: TeamId): Vec2 { return team === 'Player' ? { ...p } : { x: -p.x, y: -p.y }; }
const swapId = (id: string) => id.startsWith('Player') ? 'Cpu' + id.slice(6) : id.startsWith('Cpu') ? 'Player' + id.slice(3) : id;
export function toLocalState(source: BattleState, team: TeamId): BattleState {
    const state = structuredClone(source);
    for (const u of state.units) {
        if (u.defeatedOrder === -1)
            u.defeatedOrder = null;
        if ((u.pendingElementalId as unknown) === '')
            u.pendingElementalId = null;
    }
    if (team === 'Player')
        return state;
    const transform = (value: any): any => { if (!value || typeof value !== 'object')
        return value; if (Array.isArray(value))
        return value.map(transform); if (typeof value.x === 'number' && typeof value.y === 'number')
        return perspectivePoint(value, team); const out: any = {}; for (const [k, v] of Object.entries(value)) {
        out[k] = ['team', 'leaderId'].includes(k) ? v === 'Player' ? 'Cpu' : 'Player' : ['unitId', 'attackerUnitId'].includes(k) ? swapId(v as string) : transform(v);
    } return out; };
    const local = transform(state) as BattleState;
    for (const key of Object.keys(state)) {
        if (key.startsWith('player')) {
            const other = 'cpu' + key.slice(6);
            (local as any)[key] = (state as any)[other];
            (local as any)[other] = (state as any)[key];
        }
    }
    local.result = state.result === 'PlayerWin' ? 'CpuWin' : state.result === 'CpuWin' ? 'PlayerWin' : state.result;
    return local;
}
export function toServerCommand(command: BattleCommand, team: TeamId): BattleCommand { if (team === 'Player')
    return command; const result: any = { ...command, team }; if ('unitId' in command)
    result.unitId = swapId(command.unitId); if ('targetPosition' in command)
    result.targetPosition = perspectivePoint(command.targetPosition, team); if ('facingRotation' in command)
    result.facingRotation = command.facingRotation + Math.PI; return result; }
