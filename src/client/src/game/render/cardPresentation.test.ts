import assert from "node:assert/strict";
import test from "node:test";
import {
  cardTintForTeam,
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

test("summoned card uses the specified static image presentation", () => {
  assert.deepEqual(summonedCardPresentation, {
    textureKey: "summoned-card",
    path: "/assets/summons/summon01.png",
    displayHeight: 144
  });
});

test("card tint distinguishes player and CPU teams", () => {
  assert.equal(cardTintForTeam("Player"), 0x7dd3fc);
  assert.equal(cardTintForTeam("Cpu"), 0xfda4af);
});
