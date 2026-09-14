import type { TeamId, UnitType, UnitState } from "../core/types";
import { findCard } from "../deck/cardCatalog";

export interface CardPresentation {
  textureKey: string;
  path: string;
  displayWidth: number;
  displayHeight: number;
}

export interface CardImageLayout {
  displayWidth: number;
  displayHeight: number;
  offsetY: number;
}

export const cardBorderDepth = 0;
export const cardImageDepth = 1;
export const battleStatusOverlayDepth = 2;
export const cardBorderWidth = 2;
export const cardBorderFillAlpha = 0;
export const unitCardImageTopOffset = 5;
const unitCardDisplayWidth = 51.52;
const unitCardDisplayHeight = 368 * 0.25;
const summonedCardScale = 1.3;

export const unitCardPresentation = {
  Speed: {
    textureKey: "unit-card-speed",
    path: "/assets/units/cards/SC009.png",
    displayWidth: unitCardDisplayWidth,
    displayHeight: unitCardDisplayHeight
  },
  Melee: {
    textureKey: "unit-card-melee",
    path: "/assets/units/cards/SC012.png",
    displayWidth: unitCardDisplayWidth,
    displayHeight: unitCardDisplayHeight
  },
  Ranged: {
    textureKey: "unit-card-ranged",
    path: "/assets/units/cards/SC017.png",
    displayWidth: unitCardDisplayWidth,
    displayHeight: unitCardDisplayHeight
  }
} satisfies Record<UnitType, CardPresentation>;

export function presentationForUnit(unit: Pick<UnitState, "cardId" | "unitType">): CardPresentation {
  const card = unit.cardId ? findCard(unit.cardId) : undefined;
  return card ? {
    ...unitCardPresentation[unit.unitType],
    textureKey: `card-${card.id}`,
    path: card.imagePath
  } : unitCardPresentation[unit.unitType];
}

export const summonedCardPresentation: CardPresentation = {
  textureKey: "summoned-card",
  path: "/assets/summons/summon01.png",
  displayWidth: unitCardDisplayWidth * summonedCardScale,
  displayHeight: unitCardDisplayHeight * summonedCardScale
};

export function calculateCardImageLayout(
  presentation: CardPresentation,
  sourceWidth: number,
  sourceHeight: number
): CardImageLayout {
  const innerWidth = presentation.displayWidth - cardBorderWidth * 2;
  const innerHeight = presentation.displayHeight - cardBorderWidth * 2;
  const scale = Math.min(innerWidth / sourceWidth, innerHeight / sourceHeight);
  const displayWidth = sourceWidth * scale;
  const displayHeight = sourceHeight * scale;

  return {
    displayWidth,
    displayHeight,
    offsetY: (innerHeight - displayHeight) / 2
  };
}

export function calculateCardBorderGeometry(
  presentation: CardPresentation
): { width: number; height: number } {
  return {
    width: presentation.displayWidth - cardBorderWidth,
    height: presentation.displayHeight - cardBorderWidth
  };
}

export function cardImageCenterAt(
  cardCenter: { x: number; y: number },
  rotation: number,
  offsetY: number,
  topOffset = 0
): { x: number; y: number } {
  const adjustedOffsetY = offsetY - topOffset;
  return {
    x: cardCenter.x - Math.sin(rotation) * adjustedOffsetY,
    y: cardCenter.y + Math.cos(rotation) * adjustedOffsetY
  };
}

export function cardBorderColorForTeam(team: TeamId): number {
  return team === "Player" ? 0x7dd3fc : 0xfda4af;
}
