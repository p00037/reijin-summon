import type { TeamId, UnitType } from "../core/types";

export interface CardPresentation {
  textureKey: string;
  path: string;
  displayHeight: number;
}

export const cardBorderDepth = 0;
export const cardImageDepth = 1;
export const battleStatusOverlayDepth = 2;
export const cardBorderWidth = 2;

export const unitCardPresentation = {
  Speed: { textureKey: "unit-card-speed", path: "/assets/units/blue/blue001.png", displayHeight: 48 },
  Melee: { textureKey: "unit-card-melee", path: "/assets/units/blue/blue002.png", displayHeight: 48 },
  Ranged: { textureKey: "unit-card-ranged", path: "/assets/units/blue/blue003.png", displayHeight: 48 }
} satisfies Record<UnitType, CardPresentation>;

export const summonedCardPresentation: CardPresentation = {
  textureKey: "summoned-card",
  path: "/assets/summons/summon01.png",
  displayHeight: 58
};

export function cardBorderColorForTeam(team: TeamId): number {
  return team === "Player" ? 0x7dd3fc : 0xfda4af;
}
