import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDefeatedUnitLayout,
  createDefeatedUnitCardPresentation
} from "./defeatedUnitLayout";

test("撤退ユニットが0枚なら空のレイアウトを返す", () => {
  assert.deepEqual(
    calculateDefeatedUnitLayout(
      { x: 120, y: 342, width: 456, height: 60 },
      []
    ),
    []
  );
});

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

test("待機カードは74pxの待機場所へ上端揃えで縮小される", () => {
  const layouts = calculateDefeatedUnitLayout(
    { x: 64.4, y: 384, width: 515.2, height: 74 },
    ["PlayerMelee"]
  );

  assert.equal(layouts.length, 1);
  assert.equal(layouts[0].unitId, "PlayerMelee");
  assert.equal(layouts[0].rect.y, 392);
  assert(layouts[0].rect.height <= 58);
  assert.equal(layouts[0].rect.width / layouts[0].rect.height, 54 / 76);
});

test("待機カードは74pxの待機場所からはみ出さない", () => {
  const layouts = calculateDefeatedUnitLayout(
    { x: 64.4, y: 384, width: 515.2, height: 74 },
    ["PlayerMelee", "PlayerSpeed", "PlayerRanged"]
  );

  assert(layouts.every((layout) => layout.rect.y + layout.rect.height <= 458));
});

for (const testCase of [
  {
    label: "戦闘中かつMP充足",
    result: "InProgress" as const,
    phase: "InProgress" as const,
    currentMp: 3,
    expected: { available: true, alpha: 0.78 }
  },
  {
    label: "MP不足",
    result: "InProgress" as const,
    phase: "InProgress" as const,
    currentMp: 2,
    expected: { available: false, alpha: 0.35 }
  },
  {
    label: "Setup中",
    result: "InProgress" as const,
    phase: "Setup" as const,
    currentMp: 3,
    expected: { available: false, alpha: 0.35 }
  },
  {
    label: "Countdown中",
    result: "InProgress" as const,
    phase: "Countdown" as const,
    currentMp: 3,
    expected: { available: false, alpha: 0.35 }
  },
  {
    label: "試合終了後",
    result: "PlayerWin" as const,
    phase: "InProgress" as const,
    currentMp: 3,
    expected: { available: false, alpha: 0.35 }
  }
]) {
  test(`待機カード表示モデル: ${testCase.label}`, () => {
    assert.deepEqual(
      createDefeatedUnitCardPresentation(
        testCase.result,
        testCase.phase,
        testCase.currentMp,
        3
      ),
      testCase.expected
    );
  });
}
