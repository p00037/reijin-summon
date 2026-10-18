import { findLeader } from "../core/battleState";
import type { BattleConfig, BattleState, Vec2 } from "../core/types";
import { clampVec2, distanceSq } from "@reijin-summon/shared/core/vector";
import { calculateSummonCentroid } from "../rules/areaCalculator";
import { completedElementalsForTeam } from "../rules/elementalSystem";
import { getSummonBeam, isCircleInBeam, type SummonBeam } from "@reijin-summon/shared/rules/summonGeometry";
import { cpuFieldPosition } from "./cpuDeck";

export function formationBuildSites(config: BattleConfig): Vec2[] {
  return [cpuFieldPosition(config, -.092, .305), cpuFieldPosition(config, .092, .305),
    cpuFieldPosition(config, -.294, .44), cpuFieldPosition(config, .294, .44),
    cpuFieldPosition(config, -.365, .55), cpuFieldPosition(config, .365, .55)];
}

export function formationCenter(state: BattleState, config: BattleConfig): Vec2 {
  const bases = completedElementalsForTeam(state, "Cpu").filter(elemental =>
    Math.abs(elemental.position.x - config.cpuLeaderPosition.x) < 2.5);
  if (bases.length === 0) return cpuFieldPosition(config, 0, .305);
  return { x: bases.reduce((sum, base) => sum + base.position.x, 0) / bases.length,
    y: bases.reduce((sum, base) => sum + base.position.y, 0) / bases.length };
}

export function plannedFormationBeam(state: BattleState, config: BattleConfig): SummonBeam {
  const leader = findLeader(state, "Cpu");
  return { start: calculateSummonCentroid([leader.position,
    ...completedElementalsForTeam(state, "Cpu").map(elemental => elemental.position)], leader.position),
    end: { ...findLeader(state, "Player").position }, width: config.unitCollisionRadius * 2 };
}

export function activeFormationBeams(state: BattleState, config: BattleConfig): SummonBeam[] {
  return state.summonedUnits.filter(summon => summon.summonId === "jackpot" && summon.currentHp > 0)
    .map(summon => getSummonBeam(summon, state, config));
}

export function inFormationBeam(point: Vec2, beams: readonly SummonBeam[], config: BattleConfig): boolean {
  return beams.some(beam => isCircleInBeam(point, config.unitCollisionRadius, beam));
}

export function avoidFormationBeams(
  position: Vec2, goal: Vec2, beams: readonly SummonBeam[], config: BattleConfig
): Vec2 {
  const destination = clampVec2(goal, config.battlefieldMin, config.battlefieldMax);
  if (beams.length === 0) return destination;
  const escaping = inFormationBeam(position, beams, config);
  const pathClear = (point: Vec2): boolean => {
    if (escaping) return true;
    const steps = Math.max(1, Math.ceil(Math.sqrt(distanceSq(position, point)) / .4));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      if (inFormationBeam({ x: position.x + (point.x - position.x) * t,
        y: position.y + (point.y - position.y) * t }, beams, config)) return false;
    }
    return true;
  };
  if (!escaping && !inFormationBeam(destination, beams, config) && pathClear(destination)) return destination;
  const candidates = [position];
  for (const beam of beams) {
    const dx = beam.end.x - beam.start.x, dy = beam.end.y - beam.start.y;
    const length = Math.hypot(dx, dy) || 1;
    for (const point of [destination, position]) {
      const t = Math.max(0, Math.min(1, ((point.x - beam.start.x) * dx + (point.y - beam.start.y) * dy) / (length * length)));
      for (const side of [-1, 1]) {
        const offset = side * (beam.width / 2 + config.unitCollisionRadius + .25);
        candidates.push({ x: beam.start.x + dx * t - dy / length * offset,
          y: beam.start.y + dy * t + dx / length * offset });
      }
    }
  }
  const healing = distanceSq(destination, config.cpuLeaderPosition) < .01;
  if (healing) {
    for (let index = 0; index < 12; index++) {
      const angle = index * Math.PI / 6;
      candidates.push({ x: destination.x + Math.cos(angle) * config.leaderHealingRadius * .9,
        y: destination.y + Math.sin(angle) * config.leaderHealingRadius * .9 });
    }
  }
  return candidates.map(point => clampVec2(point, config.battlefieldMin, config.battlefieldMax))
    .filter(point => !inFormationBeam(point, beams, config) && pathClear(point))
    .filter(point => escaping || !healing || distanceSq(point, config.cpuLeaderPosition) <= config.leaderHealingRadius ** 2)
    .sort((left, right) => score(left) - score(right))[0] ?? { ...position };

  function score(point: Vec2): number {
    // 被弾中は回復地点より先に、最も近い経路の外へ抜ける。
    return escaping ? distanceSq(point, position) + distanceSq(point, destination) * .01
      : distanceSq(point, destination) + distanceSq(point, position) * .2;
  }
}
