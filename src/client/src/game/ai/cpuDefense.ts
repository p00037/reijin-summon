import { findLeader, isUnitAlive } from "../core/battleState";
import type { BattleConfig, BattleState, UnitId, UnitState, Vec2 } from "../core/types";
import { distanceSq } from "@reijin-summon/shared/core/vector";
import { meleeAttackRange } from "@reijin-summon/shared/core/battleConfig";
import { effectiveAttackRange } from "../rules/abilitySystem";
import { calculateSummonArea } from "../rules/areaCalculator";
import { completedElementalsForTeam } from "../rules/elementalSystem";
import { getSummonDefinition } from "../core/summonCatalog";
import { getSummonBeam, isCircleInBeam, type SummonBeam } from "@reijin-summon/shared/rules/summonGeometry";
import { activeFormationBeams, avoidFormationBeams } from "./cpuFormationGeometry";

export function shouldRetreatFromSummon(state: BattleState, config: BattleConfig, unit: UnitState): boolean {
  return state.summonedUnits.some(summon => {
    if (summon.team !== "Player" || summon.currentHp <= 0) return false;
    const style = getSummonDefinition(summon.summonId).attackStyle;
    const escapeSeconds = meleeAttackRange * 2
      / Math.max(.01, (unit.stats.moveSpeed + summon.moveSpeed) * config.contactSlowMultiplier);
    const unsafeToEngage = style === "melee" && unit.unitType !== "Ranged"
      && unit.currentHp <= summon.attackDamage * Math.ceil(escapeSeconds / summon.attackIntervalSeconds);
    const exposed = style === "beam"
      ? isCircleInBeam(unit.position, config.unitCollisionRadius, getSummonBeam(summon, state, config))
      : distanceSq(unit.position, summon.position) <= (unsafeToEngage
        ? config.unitCollisionRadius + config.summonedUnitCollisionRadius + 1 + summon.moveSpeed * 2
        : Math.max(meleeAttackRange, effectiveAttackRange(unit, config)) + .75) ** 2;
    return exposed && (unsafeToEngage || unit.currentHp <= unit.stats.maxHp * .95 || unit.currentHp <= summon.attackDamage * 2);
  });
}

export function cpuRetreatPosition(state: BattleState, config: BattleConfig, unit: UnitState, beams: readonly SummonBeam[] = []): Vec2 {
  const leader = findLeader(state, "Cpu").position;
  const summon = state.summonedUnits.find(enemy => enemy.team === "Player" && enemy.currentHp > 0
    && getSummonDefinition(enemy.summonId).attackStyle === "melee"
    && distanceSq(unit.position, enemy.position)
      <= (config.unitCollisionRadius + config.summonedUnitCollisionRadius + 1 + enemy.moveSpeed * 2) ** 2);
  if (summon) {
    const dx = leader.x - summon.position.x, dy = leader.y - summon.position.y;
    const length = Math.hypot(dx, dy);
    const forward = length > 1e-8 ? { x: dx / length, y: dy / length } : { x: 0, y: 1 };
    const side = (unit.position.x - summon.position.x) * forward.y - (unit.position.y - summon.position.y) * forward.x >= 0 ? 1 : -1;
    // 召喚士へ直進すると敵と同じ進路で追い付かれる。まず側面・後方へ抜ける。
    const healing = chooseCpuHealingPosition(state, config, unit.destination, beams, unit.position);
    const contact = distanceSq(unit.position, summon.position) <= (meleeAttackRange + .25) ** 2;
    const lateral = Math.abs((unit.position.x - summon.position.x) * forward.y - (unit.position.y - summon.position.y) * forward.x);
    if (!contact && lateral >= meleeAttackRange + .25 && healing) return healing;
    const sideways = contact ? .35 : 1.8;
    const backward = contact ? 1.4 : 0;
    const escape = { x: unit.position.x + forward.y * side * sideways - forward.x * backward,
      y: unit.position.y - forward.x * side * sideways - forward.y * backward };
    return { x: Math.max(config.battlefieldMin.x, Math.min(config.battlefieldMax.x, escape.x)),
      y: Math.max(config.battlefieldMin.y, Math.min(config.battlefieldMax.y, escape.y)) };
  }
  return chooseCpuHealingPosition(state, config, unit.destination, beams, unit.position) ?? unit.position;
}

function isSafePosition(state: BattleState, config: BattleConfig, position: Vec2, beams: readonly SummonBeam[]): boolean {
  if (position.x < config.battlefieldMin.x || position.x > config.battlefieldMax.x
    || position.y < config.battlefieldMin.y || position.y > config.battlefieldMax.y) return false;
  if (beams.some(beam => isCircleInBeam(position, config.unitCollisionRadius, beam))) return false;
  if (state.units.some(unit => unit.team === "Player" && isUnitAlive(unit) && unit.mode === "Active"
    && distanceSq(position, unit.position) <= (effectiveAttackRange(unit, config) + .15) ** 2)) return false;
  return !state.summonedUnits.some(summon => {
    if (summon.currentHp <= 0) return false;
    const style = getSummonDefinition(summon.summonId).attackStyle;
    if (style === "beam") return isCircleInBeam(position, config.unitCollisionRadius, getSummonBeam(summon, state, config));
    // 全体攻撃は移動で回避できないため、復活地点の候補を除外しない。
    if (summon.team !== "Player" || style !== "melee") return false;
    if (distanceSq(position, summon.position) <= (meleeAttackRange + .25) ** 2) return true;
    const leader = findLeader(state, "Cpu").position;
    const distance = Math.sqrt(distanceSq(summon.position, leader));
    const t = distance > 0 ? Math.min(1, summon.moveSpeed * 2 / distance) : 0;
    const predicted = { x: summon.position.x + (leader.x - summon.position.x) * t,
      y: summon.position.y + (leader.y - summon.position.y) * t };
    return distanceSq(position, predicted) <= (meleeAttackRange + .25) ** 2;
  });
}

export function chooseCpuHealingPosition(
  state: BattleState, config: BattleConfig, preferred?: Vec2, beams: readonly SummonBeam[] = [], origin?: Vec2
): Vec2 | undefined {
  const leader = findLeader(state, "Cpu").position;
  const candidates = [...(preferred ? [preferred] : []), leader];
  for (const radius of [.5, .9]) {
    for (let index = 0; index < 24; index++) {
      const angle = index * Math.PI / 12;
      candidates.push({ x: leader.x + Math.cos(angle) * config.leaderHealingRadius * radius,
        y: leader.y + Math.sin(angle) * config.leaderHealingRadius * radius });
    }
  }
  const allBeams = [...activeFormationBeams(state, config), ...beams];
  const pathSafe = (point: Vec2): boolean => {
    if (!origin) return true;
    if (distanceSq(avoidFormationBeams(origin, point, allBeams, config), point) >= 1e-8) return false;
    const steps = Math.max(1, Math.ceil(Math.sqrt(distanceSq(origin, point)) / .2));
    let escaped = isSafePosition(state, config, origin, allBeams);
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const safe = isSafePosition(state, config, { x: origin.x + (point.x - origin.x) * t,
        y: origin.y + (point.y - origin.y) * t }, allBeams);
      if (escaped && !safe) return false;
      escaped ||= safe;
    }
    return true;
  };
  return candidates.find(point => distanceSq(point, leader) <= config.leaderHealingRadius ** 2
    && isSafePosition(state, config, point, allBeams)
    && pathSafe(point));
}

export function cpuElementalDefenders(
  state: BattleState, config: BattleConfig, retreating: ReadonlySet<UnitId>
): Map<UnitId, Vec2> {
  const leader = findLeader(state, "Cpu").position;
  const points = [leader, ...completedElementalsForTeam(state, "Cpu").map(elemental => elemental.position)];
  const area = calculateSummonArea(points);
  const middle = (leader.y + findLeader(state, "Player").position.y) / 2;
  const intruders = state.elementals.filter(elemental => elemental.team === "Player" && elemental.currentHp > 0
    && (elemental.position.y >= middle || area > 0 && calculateSummonArea([...points, elemental.position]) <= area + 1e-8))
    .sort((left, right) => distanceSq(left.position, leader) - distanceSq(right.position, leader));
  const goals = new Map<UnitId, Vec2>();
  for (const intruder of intruders) {
    const defender = state.units.filter(unit => unit.team === "Cpu" && isUnitAlive(unit)
      && !retreating.has(unit.unitId) && !goals.has(unit.unitId))
      .sort((left, right) => score(left) - score(right))[0];
    if (defender) goals.set(defender.unitId, intruder.position);
    function score(unit: UnitState): number {
      return Math.sqrt(distanceSq(unit.position, intruder.position)) / unit.stats.moveSpeed
        + (unit.unitType === "Ranged" ? 20 : 0);
    }
  }
  return goals;
}

export function cpuElementalAttackPosition(unit: UnitState, position: Vec2, config: BattleConfig): Vec2 {
  if (unit.unitType !== "Ranged") return position;
  const range = effectiveAttackRange(unit, config) * .9;
  if (distanceSq(unit.position, position) <= range ** 2) return unit.position;
  const length = Math.sqrt(distanceSq(unit.position, position));
  return { x: position.x + (unit.position.x - position.x) / length * range,
    y: position.y + (unit.position.y - position.y) / length * range };
}
