import type { BattleConfig, BattleState, ElementalId, UnitId, UnitState, Vec2 } from '../core/types.js';
import { isUnitAlive } from '../core/battleState.js';
import { distanceSq } from '../core/vector.js';
import { getAbilityDefinition } from './abilityCatalog.js';
export type AbilityArea = {
  kind: 'circle';
  center: Vec2;
  radius: number;
} | {
  kind: 'rectangle';
  min: Vec2;
  max: Vec2;
};
export type AbilityTargets = {
  unitIds: UnitId[];
  elementalIds: ElementalId[];
};
export function abilityArea(state: BattleState, config: BattleConfig, unitId: UnitId, facingRotation: number): AbilityArea | null {
  const unit = state.units.find(u => u.unitId === unitId), def = getAbilityDefinition(unit?.cardId);
  if (!unit || !def || !Number.isFinite(facingRotation))
    return null;
  const area = def.area;
  if (area.kind === 'none')
    return null;
  if (area.kind === 'self')
    return { kind: 'circle', center: { ...unit.position }, radius: config.unitCardWorldHeight / 2 };
  if (area.kind === 'circle')
    return { kind: 'circle', center: { x: unit.position.x + Math.sin(facingRotation) * config.unitCardWorldHeight * area.forwardHeight, y: unit.position.y + Math.cos(facingRotation) * config.unitCardWorldHeight * area.forwardHeight }, radius: config.unitCardWorldHeight * area.radiusHeight };
  const min = { ...config.battlefieldMin }, max = { ...config.battlefieldMax };
  if (area.kind === 'half') {
    const mid = (min.y + max.y) / 2;
    const ownLeader = state.leaders.find(l => l.team === unit.team)!;
    const lower = unit.position.y === mid ? ownLeader.position.y <= mid : unit.position.y < mid;
    if (lower)
      max.y = mid;
    else
      min.y = mid;
  }
  return { kind: 'rectangle', min, max };
}
export function isInsideAbilityArea(position: Vec2, area: AbilityArea): boolean {
  return area.kind === 'circle' ? distanceSq(position, area.center) <= area.radius ** 2 + 1e-9
    : position.x >= area.min.x && position.x <= area.max.x && position.y >= area.min.y && position.y <= area.max.y;
}
export function matchingElemental(unit: UnitState, elemental: BattleState['elementals'][number]): boolean {
  return elemental.team === unit.team && elemental.nation === unit.nation && elemental.currentHp > 0 && elemental.isComplete;
}
export function abilityTargets(state: BattleState, config: BattleConfig, unitId: UnitId, facingRotation: number): AbilityTargets {
  const empty: AbilityTargets = { unitIds: [], elementalIds: [] };
  const unit = state.units.find(u => u.unitId === unitId), def = getAbilityDefinition(unit?.cardId);
  if (!unit || !def || !Number.isFinite(facingRotation))
    return empty;
  if (def.target === 'self')
    return { unitIds: [unit.unitId], elementalIds: [] };
  const area = abilityArea(state, config, unitId, facingRotation);
  if (!area || def.target === 'none')
    return empty;
  if (def.target === 'elemental')
    return { unitIds: [], elementalIds: state.elementals.filter(e => matchingElemental(unit, e) && isInsideAbilityArea(e.position, area)).map(e => e.elementalId).sort() };
  return { elementalIds: [], unitIds: state.units.filter(u => isUnitAlive(u)
      && (def.target === 'both' || (def.target === 'ally' ? u.team === unit.team : u.team !== unit.team))
      && (!def.sameNation || u.nation === unit.nation) && isInsideAbilityArea(u.position, area)).map(u => u.unitId).sort() };
}
