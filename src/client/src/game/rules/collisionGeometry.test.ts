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

test("接触半径と円形接触判定は全組み合わせで境界と対称性を満たす", () => {
  const config = createDefaultBattleConfig();
  const origin = { x: 0, y: 0 };
  const cases = [
    ["Unit", "Unit", 1.512],
    ["Unit", "SummonedUnit", 1.7388],
    ["SummonedUnit", "SummonedUnit", 1.9656],
    ["Unit", "Point", 0.756],
    ["SummonedUnit", "Point", 0.9828]
  ] as const;

  for (const [firstKind, secondKind, radius] of cases) {
    assert.equal(combinedCollisionRadius(config, firstKind, secondKind), radius);
    assert.equal(
      areCollisionCirclesTouching(
        config,
        origin,
        firstKind,
        { x: radius, y: 0 },
        secondKind
      ),
      true
    );
    assert.equal(
      areCollisionCirclesTouching(
        config,
        origin,
        firstKind,
        { x: radius + 0.0001, y: 0 },
        secondKind
      ),
      false
    );
    assert.equal(
      areCollisionCirclesTouching(
        config,
        { x: radius, y: 0 },
        secondKind,
        origin,
        firstKind
      ),
      true
    );
  }
});
