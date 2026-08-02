import type { Vec2 } from "../core/types";

export type BattlefieldHpBarKind =
  | "Leader"
  | "Elemental"
  | "SummonedUnit"
  | "Unit";

export interface BattlefieldHpBarLayout {
  x: number;
  y: number;
  width: number;
}

export function battlefieldHpBarLayout(
  kind: BattlefieldHpBarKind,
  screen: Vec2
): BattlefieldHpBarLayout | null {
  switch (kind) {
    case "Leader":
      return null;
    case "Elemental":
      return { x: screen.x - 18, y: screen.y + 18, width: 36 };
    case "SummonedUnit":
      return { x: screen.x - 28, y: screen.y + 34, width: 56 };
    case "Unit":
      return { x: screen.x - 20, y: screen.y + 27, width: 40 };
  }
}
