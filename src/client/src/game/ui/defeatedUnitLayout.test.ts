import test from "node:test";
import assert from "node:assert/strict";
import { calculateDefeatedUnitLayout } from "./defeatedUnitLayout";

test("待機カードは利用可能な縦幅へ等比縮小される", () => {
  const layouts = calculateDefeatedUnitLayout(
    { x: 120, y: 342, width: 456, height: 60 },
    ["PlayerMelee"]
  );

  assert.equal(layouts.length, 1);
  assert.equal(layouts[0].unitId, "PlayerMelee");
  assert(layouts[0].rect.height <= 44);
  assert.equal(layouts[0].rect.width / layouts[0].rect.height, 54 / 76);
});

test("3枚の待機カードは共通縮尺で待機場所の横幅へ収まる", () => {
  const layouts = calculateDefeatedUnitLayout(
    { x: 120, y: 342, width: 180, height: 116 },
    ["PlayerMelee", "PlayerSpeed", "PlayerRanged"]
  );

  assert.equal(layouts.length, 3);
  assert(layouts.every((layout) => layout.scale === layouts[0].scale));
  assert(layouts.at(-1)!.rect.x + layouts.at(-1)!.rect.width <= 294);
});
