import assert from "node:assert/strict";
import test from "node:test";
import {
  battleStatusOverlayDepth,
  calculateCardBorderGeometry,
  calculateCardImageLayout,
  cardBorderColorForTeam,
  cardBorderDepth,
  cardBorderFillAlpha,
  cardBorderWidth,
  cardImageCenterAt,
  cardImageDepth,
  summonedCardPresentation,
  unitCardPresentation
} from "./cardPresentation";

test("unit cards use ten percent field width and twenty-five percent field height", () => {
  for (const presentation of Object.values(unitCardPresentation)) {
    assert.equal(presentation.displayWidth, 51.52);
    assert.equal(presentation.displayHeight, 92);
  }
});

test("summoned card is 1.3 times the unit card size", () => {
  assert.equal(
    summonedCardPresentation.displayWidth,
    unitCardPresentation.Melee.displayWidth * 1.3
  );
  assert.equal(
    summonedCardPresentation.displayHeight,
    unitCardPresentation.Melee.displayHeight * 1.3
  );
});

test("card image textures retain their static mappings", () => {
  assert.deepEqual(
    {
      Speed: {
        textureKey: unitCardPresentation.Speed.textureKey,
        path: unitCardPresentation.Speed.path
      },
      Melee: {
        textureKey: unitCardPresentation.Melee.textureKey,
        path: unitCardPresentation.Melee.path
      },
      Ranged: {
        textureKey: unitCardPresentation.Ranged.textureKey,
        path: unitCardPresentation.Ranged.path
      },
      Summoned: {
        textureKey: summonedCardPresentation.textureKey,
        path: summonedCardPresentation.path
      }
    },
    {
      Speed: {
        textureKey: "unit-card-speed",
        path: "/assets/units/blue/blue001.png"
      },
      Melee: {
        textureKey: "unit-card-melee",
        path: "/assets/units/blue/blue002.png"
      },
      Ranged: {
        textureKey: "unit-card-ranged",
        path: "/assets/units/blue/blue003.png"
      },
      Summoned: {
        textureKey: "summoned-card",
        path: "/assets/summons/summon01.png"
      }
    }
  );
});

test("card image keeps its aspect ratio and aligns to the inner bottom edge", () => {
  const layout = calculateCardImageLayout(
    unitCardPresentation.Melee,
    318,
    444
  );

  assert.equal(layout.displayWidth, 47.52);
  assert.ok(Math.abs(layout.displayHeight - (47.52 * 444) / 318) < 1e-10);
  assert.ok(
    Math.abs(
      layout.offsetY -
        (92 - cardBorderWidth * 2 - layout.displayHeight) / 2
    ) < 1e-10
  );
});

test("card image bottom offset follows card rotation", () => {
  assert.deepEqual(cardImageCenterAt({ x: 100, y: 200 }, 0, 10), {
    x: 100,
    y: 210
  });
  const reversed = cardImageCenterAt({ x: 100, y: 200 }, Math.PI, 10);
  assert.ok(Math.abs(reversed.x - 100) < 1e-10);
  assert.ok(Math.abs(reversed.y - 190) < 1e-10);
});

test("card borders distinguish player and CPU teams", () => {
  assert.equal(cardBorderWidth, 2);
  assert.equal(cardBorderColorForTeam("Player"), 0x7dd3fc);
  assert.equal(cardBorderColorForTeam("Cpu"), 0xfda4af);
});

test("card borders leave unused inner space transparent", () => {
  assert.equal(cardBorderFillAlpha, 0);
});

test("card border geometry keeps rendered outer size within presentation", () => {
  for (const presentation of [
    unitCardPresentation.Melee,
    summonedCardPresentation
  ]) {
    const geometry = calculateCardBorderGeometry(presentation);
    assert.equal(geometry.width + cardBorderWidth, presentation.displayWidth);
    assert.equal(geometry.height + cardBorderWidth, presentation.displayHeight);
  }
});

test("card border is behind cards and status overlay is in front", () => {
  assert.ok(cardBorderDepth < cardImageDepth);
  assert.ok(battleStatusOverlayDepth > cardImageDepth);
});
