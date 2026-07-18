import assert from "node:assert/strict";
import test from "node:test";
import {
  battleStatusOverlayDepth,
  cardBorderColorForTeam,
  cardBorderDepth,
  cardBorderWidth,
  cardImageDepth,
  summonedCardPresentation,
  unitCardPresentation
} from "./cardPresentation";

test("unit cards use the specified static image presentations", () => {
  assert.deepEqual(unitCardPresentation.Speed, {
    textureKey: "unit-card-speed",
    path: "/assets/units/blue/blue001.png",
    displayHeight: 72
  });
  assert.deepEqual(unitCardPresentation.Melee, {
    textureKey: "unit-card-melee",
    path: "/assets/units/blue/blue002.png",
    displayHeight: 72
  });
  assert.deepEqual(unitCardPresentation.Ranged, {
    textureKey: "unit-card-ranged",
    path: "/assets/units/blue/blue003.png",
    displayHeight: 72
  });
});

test("summoned card is one and a half times the unit card height", () => {
  assert.deepEqual(summonedCardPresentation, {
    textureKey: "summoned-card",
    path: "/assets/summons/summon01.png",
    displayHeight: 108
  });
  assert.equal(summonedCardPresentation.displayHeight, unitCardPresentation.Melee.displayHeight * 1.5);
});

test("card borders distinguish player and CPU teams", () => {
  assert.equal(cardBorderWidth, 4);
  assert.equal(cardBorderColorForTeam("Player"), 0x7dd3fc);
  assert.equal(cardBorderColorForTeam("Cpu"), 0xfda4af);
});

test("card border is behind cards and status overlay is in front", () => {
  assert.ok(cardBorderDepth < cardImageDepth);
  assert.ok(battleStatusOverlayDepth > cardImageDepth);
});
