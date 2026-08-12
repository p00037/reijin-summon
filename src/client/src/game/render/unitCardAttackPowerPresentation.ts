import type { Vec2 } from "../core/types";
import { battleStatusOverlayDepth } from "./cardPresentation";

export interface UnitCardAttackPowerPresentation {
  text: string;
  position: Vec2;
  rotation: number;
  depth: number;
}

const attackPowerInsetFromTop = 7;
export const unitCardAttackPowerDepth = battleStatusOverlayDepth;

export function unitCardAttackPowerPresentation(
  cardCenter: Vec2,
  rotation: number,
  cardHeight: number,
  attackDamage: number
): UnitCardAttackPowerPresentation {
  const localY = -cardHeight / 2 + attackPowerInsetFromTop;
  const sine = Math.sin(rotation);
  const cosine = Math.cos(rotation);

  return {
    text: String(attackDamage),
    position: {
      x: cardCenter.x - localY * sine,
      y: cardCenter.y + localY * cosine
    },
    rotation,
    depth: unitCardAttackPowerDepth
  };
}
