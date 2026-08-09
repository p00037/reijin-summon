import type { MatchPhase, MatchResult, PlayerUnitId } from "../core/types";
import type { UiRect } from "./battleLayout";

export type DefeatedUnitCardLayout = {
  unitId: PlayerUnitId;
  rect: UiRect;
  scale: number;
};

export type DefeatedUnitCardPresentation = {
  available: boolean;
  alpha: number;
};

const cardWidth = 54;
const cardHeight = 76;
const innerPadding = 8;
const cardGap = 8;

export function createDefeatedUnitCardPresentation(
  result: MatchResult,
  phase: MatchPhase,
  currentMp: number,
  revivalCost: number
): DefeatedUnitCardPresentation {
  const available =
    result === "InProgress"
    && phase === "InProgress"
    && currentMp >= revivalCost;
  return {
    available,
    alpha: available ? 0.78 : 0.35
  };
}

export function calculateDefeatedUnitLayout(
  area: UiRect,
  unitIds: readonly PlayerUnitId[]
): DefeatedUnitCardLayout[] {
  if (unitIds.length === 0) {
    return [];
  }

  const availableHeight = Math.max(0, area.height - innerPadding * 2);
  const availableWidthForCards = Math.max(
    0,
    area.width - innerPadding * 2 - cardGap * (unitIds.length - 1)
  );
  const scale = Math.min(
    1,
    availableHeight / cardHeight,
    availableWidthForCards / (cardWidth * unitIds.length)
  );

  return unitIds.map((unitId, index) => ({
    unitId,
    rect: {
      x: area.x + innerPadding + index * (cardWidth * scale + cardGap),
      y: area.y + innerPadding,
      width: cardWidth * scale,
      height: cardHeight * scale
    },
    scale
  }));
}
