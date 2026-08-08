import test from "node:test";
import assert from "node:assert/strict";
import { gameViewport } from "../gameViewport";
import { calculateBattleLayout, isPointInHud } from "./battleLayout";

test("644x468内に左2列上下HUD・上詰めフィールド・待機場所を配置する", () => {
  const layout = calculateBattleLayout(gameViewport.width, gameViewport.height);

  assert.deepEqual(layout.leftPanel, { x: 6, y: 8, width: 106, height: 326 });
  assert.deepEqual(layout.cpuHp, { x: 25, y: 28, width: 12, height: 118 });
  assert.deepEqual(layout.playerHp, { x: 25, y: 174, width: 12, height: 118 });
  assert.deepEqual(layout.mp, { x: 75, y: 28, width: 12, height: 118 });
  assert.deepEqual(layout.summonGauge, { x: 75, y: 174, width: 12, height: 118 });
  assert.deepEqual(layout.field, { x: 120, y: 8, width: 456, height: 326 });
  assert.deepEqual(layout.waitingArea, { x: 120, y: 342, width: 456, height: 116 });
  assert.deepEqual(layout.remainingTime, { x: 591.6, y: 8, width: 52, height: 53 });
  assert.deepEqual(layout.buildButton, { x: 591.6, y: 69, width: 52, height: 52 });
  assert.deepEqual(layout.summonButton, { x: 591.6, y: 129, width: 52, height: 52 });
  assert.deepEqual(layout.retryButton, { x: 591.6, y: 189, width: 52, height: 52 });
  assert.equal(layout.waitingArea.y + layout.waitingArea.height, 458);
});

test("待機場所と左HUDと時間表示はHUD入力範囲で戦場は操作可能である", () => {
  const layout = calculateBattleLayout(gameViewport.width, gameViewport.height);

  assert.equal(isPointInHud(layout, 10, 10), true);
  assert.equal(isPointInHud(layout, 130, 350), true);
  assert.equal(isPointInHud(layout, 600, 20), true);
  assert.equal(isPointInHud(layout, 130, 20), false);
});
