import type { PlayerUnitId } from "../core/types";
import type { UiRect } from "./battleLayout";

export type DefeatedUnitCardLayout = {
  unitId: PlayerUnitId;
  rect: UiRect;
  scale: number;
};

const cardWidth = 54;
const cardHeight = 76;
const innerPadding = 8;
const cardGap = 8;
const labelHeight = 16;

export function calculateDefeatedUnitLayout(
  area: UiRect,
  unitIds: readonly PlayerUnitId[]
): DefeatedUnitCardLayout[] {
  if (unitIds.length === 0) {
    return [];
  }

  const availableHeight = Math.max(
    0,
    area.height - innerPadding * 2 - labelHeight
  );
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
      y: area.y + innerPadding + labelHeight,
      width: cardWidth * scale,
      height: cardHeight * scale
    },
    scale
  }));
}
