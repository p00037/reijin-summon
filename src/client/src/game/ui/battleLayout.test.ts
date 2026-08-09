import test from "node:test";
import assert from "node:assert/strict";
import { gameViewport } from "../gameViewport";
import { calculateBattleLayout, isPointInHud } from "./battleLayout";

test("644x468内に左2列上下HUD・上詰めフィールド・待機場所を配置する", () => {
  const layout = calculateBattleLayout(gameViewport.width, gameViewport.height);

  assert.deepEqual(layout.leftPanel, { x: 6, y: 8, width: 50, height: 368 });
  assert.deepEqual(layout.cpuHp, { x: 15, y: 28, width: 8, height: 146 });
  assert.deepEqual(layout.playerHp, { x: 15, y: 202, width: 8, height: 146 });
  assert.deepEqual(layout.mp, { x: 43, y: 28, width: 8, height: 146 });
  assert.deepEqual(layout.summonGauge, { x: 43, y: 202, width: 8, height: 146 });
  assert.deepEqual(layout.field, { x: 64.4, y: 8, width: 515.2, height: 368 });
  assert.deepEqual(layout.waitingArea, { x: 64.4, y: 384, width: 515.2, height: 74 });
  assert.deepEqual(layout.remainingTime, { x: 591.6, y: 8, width: 52, height: 53 });
  assert.deepEqual(layout.buildButton, { x: 591.6, y: 69, width: 52, height: 52 });
  assert.deepEqual(layout.summonButton, { x: 591.6, y: 129, width: 52, height: 52 });
  assert.deepEqual(layout.retryButton, { x: 591.6, y: 189, width: 52, height: 52 });
  assert.equal(layout.waitingArea.y + layout.waitingArea.height, 458);
});

test("待機場所と左HUDと時間表示はHUD入力範囲で戦場は操作可能である", () => {
  const layout = calculateBattleLayout(gameViewport.width, gameViewport.height);

  assert.equal(isPointInHud(layout, 10, 10), true);
  assert.equal(isPointInHud(layout, 70, 390), true);
  assert.equal(isPointInHud(layout, 600, 20), true);
  assert.equal(isPointInHud(layout, 70, 20), false);
});
