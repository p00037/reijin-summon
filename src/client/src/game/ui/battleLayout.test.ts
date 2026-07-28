import test from "node:test";
import assert from "node:assert/strict";
import { calculateBattleLayout, isPointInHud } from "./battleLayout";

test("960x540 でフィールドを中央配置して固定バーと右ボタンを返す", () => {
  const layout = calculateBattleLayout(960, 540);

  assert.deepEqual(layout.topBar, { x: 0, y: 0, width: 960, height: 48 });
  assert.deepEqual(layout.field, { x: 222.4, y: 56, width: 515.2, height: 368 });
  assert.deepEqual(layout.bottomBar, { x: 0, y: 492, width: 960, height: 48 });
  assert.deepEqual(layout.playerHp, { x: 106, y: 10, width: 320, height: 28 });
  assert.deepEqual(layout.cpuHp, { x: 534, y: 10, width: 320, height: 28 });
  assert.deepEqual(layout.summonGauge, { x: 300, y: 432, width: 360, height: 28 });
  assert.deepEqual(layout.buildButton, { x: 749.6, y: 252, width: 52, height: 52 });
  assert.deepEqual(layout.summonButton, { x: 749.6, y: 312, width: 52, height: 52 });
  assert.deepEqual(layout.retryButton, { x: 749.6, y: 372, width: 52, height: 52 });
});

test("バーとボタンだけを HUD 入力範囲として返す", () => {
  const layout = calculateBattleLayout(960, 540);

  assert.equal(isPointInHud(layout, 10, 10), true);
  assert.equal(isPointInHud(layout, 10, 510), true);
  assert.equal(isPointInHud(layout, 760, 252), true);
  assert.equal(
    isPointInHud(
      layout,
      layout.summonGauge.x + layout.summonGauge.width / 2,
      layout.summonGauge.y + layout.summonGauge.height / 2
    ),
    true
  );
  assert.equal(isPointInHud(layout, layout.field.x + 10, layout.field.y + 10), false);
  assert.equal(isPointInHud(layout, 900, 250), false);
});

test("右ボタン列がフィールド右端に整列する", () => {
  const layout = calculateBattleLayout(960, 540);
  const fieldRight = layout.field.x + layout.field.width;
  const fieldBottom = layout.field.y + layout.field.height;

  assert.equal(layout.buildButton.x, fieldRight + 12);
  assert.equal(layout.retryButton.y + layout.retryButton.height, fieldBottom);
  assert.ok(layout.field.y >= layout.topBar.y + layout.topBar.height);
  assert.ok(fieldBottom <= layout.bottomBar.y);
});
