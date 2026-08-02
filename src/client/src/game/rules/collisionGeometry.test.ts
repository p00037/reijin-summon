import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBattleConfig } from "../core/battleConfig";
import {
  summonedCardPresentation,
  unitCardPresentation
} from "../render/cardPresentation";
import {
  areCollisionCirclesTouching,
  collisionRadiusForKind,
  combinedCollisionRadius
} from "./collisionGeometry";

const screenUnitsPerWorldUnit = 515.2 / 12.6;

test("カード接触半径はカード横幅の1.2倍を直径にする", () => {
  const config = createDefaultBattleConfig();

  assert.equal(collisionRadiusForKind(config, "Unit"), 0.756);
  assert.equal(collisionRadiusForKind(config, "SummonedUnit"), 0.9828);
  assert.equal(collisionRadiusForKind(config, "Point"), 0);
  assert.equal(
    Number((config.unitCollisionRadius * 2 * screenUnitsPerWorldUnit).toFixed(4)),
    unitCardPresentation.Melee.displayWidth * 1.2
  );
  assert.equal(
    Number(
      (config.summonedUnitCollisionRadius * 2 * screenUnitsPerWorldUnit).toFixed(
        4
      )
    ),
    Number((summonedCardPresentation.displayWidth * 1.2).toFixed(4))
  );
});

test("接触半径は双方の半径を合計する", () => {
  const config = createDefaultBattleConfig();

  assert.equal(combinedCollisionRadius(config, "Unit", "Unit"), 1.512);
  assert.equal(
    combinedCollisionRadius(config, "Unit", "SummonedUnit"),
    1.7388
  );
  assert.equal(
    combinedCollisionRadius(config, "SummonedUnit", "SummonedUnit"),
    1.9656
  );
  assert.equal(combinedCollisionRadius(config, "Unit", "Point"), 0.756);
  assert.equal(
    combinedCollisionRadius(config, "SummonedUnit", "Point"),
    0.9828
  );
});

test("円形の接触判定は半径の和と境界で接触する", () => {
  const config = createDefaultBattleConfig();
  const origin = { x: 0, y: 0 };

  assert.equal(
    areCollisionCirclesTouching(
      config,
      origin,
      "Unit",
      { x: 1.7388, y: 0 },
      "SummonedUnit"
    ),
    true
  );
  assert.equal(
    areCollisionCirclesTouching(
      config,
      origin,
      "SummonedUnit",
      { x: 1.7388 + 0.0001, y: 0 },
      "Unit"
    ),
    false
  );
});
