import { findLeader, oppositeTeam } from "../core/battleState";
import type { BattleConfig, BattleState, SummonedUnitState, Vec2 } from "../core/types";

export type SummonBeam = { start: Vec2; end: Vec2; width: number };

export function getSummonBeam(summoned: SummonedUnitState, state: BattleState, config: BattleConfig): SummonBeam {
  return {
    start: summoned.position,
    end: findLeader(state, oppositeTeam(summoned.team)).position,
    width: config.unitCollisionRadius * 2
  };
}

// A capsule: the renderer uses the same segment, width and round end caps.
export function isCircleInBeam(position: Vec2, radius: number, beam: SummonBeam): boolean {
  const dx = beam.end.x - beam.start.x;
  const dy = beam.end.y - beam.start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((position.x - beam.start.x) * dx + (position.y - beam.start.y) * dy) / lengthSquared))
    : 0;
  const x = beam.start.x + t * dx;
  const y = beam.start.y + t * dy;
  return (position.x - x) ** 2 + (position.y - y) ** 2 <= (beam.width / 2 + radius) ** 2 + 1e-10;
}
