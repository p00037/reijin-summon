import type { Vec2 } from "../core/types";
import {
  cardBorderWidth,
  unitCardPresentation
} from "./cardPresentation";

export type BattlefieldHpBarKind =
  | "Leader"
  | "Elemental"
  | "SummonedUnit";

export interface BattlefieldHpBarLayout {
  x: number;
  y: number;
  width: number;
}

export interface UnitCardHpBarPresentation {
  background: Vec2[];
  fill: Vec2[];
}

const unitHpBarWidth = 40;
const unitHpBarHeight = 5;

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
  }
}

export function unitCardHpBarPresentation(
  cardCenter: Vec2,
  rotation: number,
  ratio: number
): UnitCardHpBarPresentation {
  const localLeft = -unitHpBarWidth / 2;
  const localTop =
    unitCardPresentation.Melee.displayHeight / 2 -
    cardBorderWidth -
    unitHpBarHeight;
  const clampedRatio = Math.min(1, Math.max(0, ratio));

  return {
    background: rotatedRectangle(
      cardCenter,
      rotation,
      localLeft,
      localTop,
      unitHpBarWidth,
      unitHpBarHeight
    ),
    fill: rotatedRectangle(
      cardCenter,
      rotation,
      localLeft,
      localTop,
      unitHpBarWidth * clampedRatio,
      unitHpBarHeight
    )
  };
}

function rotatedRectangle(
  center: Vec2,
  rotation: number,
  x: number,
  y: number,
  width: number,
  height: number
): Vec2[] {
  return [
    rotateLocalPoint(center, rotation, x, y),
    rotateLocalPoint(center, rotation, x + width, y),
    rotateLocalPoint(center, rotation, x + width, y + height),
    rotateLocalPoint(center, rotation, x, y + height)
  ];
}

function rotateLocalPoint(
  center: Vec2,
  rotation: number,
  x: number,
  y: number
): Vec2 {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return {
    x: center.x + x * cosine - y * sine,
    y: center.y + x * sine + y * cosine
  };
}
