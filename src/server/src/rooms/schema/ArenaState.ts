import { Schema, ArraySchema, defineTypes } from '@colyseus/schema';
import { createDefaultBattleConfig, createDefaultBattleState, type BattleState } from '@reijin-summon/shared';
// Build a typed Colyseus schema from the complete battle data shape. Empty arrays have explicit element templates.
const base = createDefaultBattleState(createDefaultBattleConfig());
const summon = { summonedUnitId: 0, summonId: 'raphael', damageMultiplier: 1, specialAttackTimerSeconds: 0, team: 'Player', position: { x: 0, y: 0 }, destination: { x: 0, y: 0 }, maxHp: 0, currentHp: 0, attackDamage: 0, leaderAttackDamage: 0, attackIntervalSeconds: 0, attackTimerSeconds: 0, leaderAttackIntervalSeconds: 0, leaderAttackTimerSeconds: 0, moveSpeed: 0, healthDecayPerSecond: 0 };
const template = { ...base, units: base.units.map(u => ({ ...u, cardId: '', defeatedOrder: -1, pendingElementalId: '' })), elementals: [{ elementalId: '', team: 'Player', position: { x: 0, y: 0 }, maxHp: 0, currentHp: 0, isComplete: false, hasKeeperSpeedAura: false }], summonedUnits: [summon], recentAttackEvents: [{ attackerUnitId: '', origin: { x: 0, y: 0 }, targetPosition: { x: 0, y: 0 } }], recentSummonAttackEvents: [{ summonId: '', team: 'Player', origin: { x: 0, y: 0 }, targets: [{ x: 0, y: 0 }], kind: '' }] };
type Data = Record<string, any>;
function sync(target: Data, source: Data, sample: Data) {
    for (const [k, model] of Object.entries(sample)) {
        let value = source[k];
        if (Array.isArray(model)) {
            if (!target[k])
                target[k] = new ArraySchema();
            // Runtime constructors are retained in the registry below.
            const C = constructors.get(sample)?.get(k)!;
            while (target[k].length > value.length)
                target[k].pop();
            value.forEach((item: Data, i: number) => { if (!target[k][i])
                target[k].push(new C()); sync(target[k][i], item, model[0]); });
        }
        else if (model && typeof model === 'object') {
            const C = constructors.get(sample)?.get(k)!;
            if (!target[k])
                target[k] = new C();
            sync(target[k], value, model);
        }
        else
            target[k] = value ?? (typeof model === 'number' ? -1 : typeof model === 'boolean' ? false : '');
    }
}
const constructors = new Map<Data, Map<string, typeof Schema>>();
function registeredFactory(sample: Data): typeof Schema { const fields: Data = {}; const map = new Map<string, typeof Schema>(); constructors.set(sample, map); for (const [k, v] of Object.entries(sample)) {
    if (v && typeof v === 'object') {
        const C = registeredFactory(Array.isArray(v) ? v[0] : v);
        map.set(k, C);
        fields[k] = Array.isArray(v) ? [C] : C;
    }
    else
        fields[k] = typeof v;
} class Node extends Schema {
} defineTypes(Node, fields); return Node; }
const RegisteredBattle = registeredFactory(template);
export class ArenaState extends Schema {
    declare battle: Schema | undefined;
    declare revision: number;
    constructor() { super(); this.revision = 0; }
}
defineTypes(ArenaState, { battle: RegisteredBattle, revision: 'number' });
export function publishBattle(target: ArenaState, battle: BattleState | null) { if (!battle) {
    target.battle = undefined;
    return;
} if (!target.battle)
    target.battle = new RegisteredBattle(); sync(target.battle, battle, template); target.revision++; }
