import test from "node:test";
import assert from "node:assert/strict";
import { gameViewport } from "../gameViewport";
import { calculateBattleLayout, isPointInHud } from "./battleLayout";

test("644x468 でフィールドを中央に配置する", () => {
  const layout = calculateBattleLayout(gameViewport.width, gameViewport.height);
  const fieldRight = layout.field.x + layout.field.width;
  const fieldBottom = layout.field.y + layout.field.height;

  assert.deepEqual(layout.topBar, { x: 0, y: 0, width: 644, height: 48 });
  assert.deepEqual(layout.field, { x: 64.4, y: 56, width: 515.2, height: 368 });
  assert.deepEqual(layout.bottomBar, { x: 0, y: 424, width: 644, height: 44 });
  assert.ok(Math.abs(layout.field.x - (gameViewport.width - fieldRight)) < 0.0001);
  assert.equal(layout.bottomBar.y, fieldBottom);
});

test("644x468 で HP バーを左右に均等配置する", () => {
  const layout = calculateBattleLayout(gameViewport.width, gameViewport.height);
  const cpuHpRight = layout.cpuHp.x + layout.cpuHp.width;
  const hpCenterGap = layout.cpuHp.x - (layout.playerHp.x + layout.playerHp.width);

  assert.deepEqual(layout.playerHp, { x: 4, y: 10, width: 292, height: 28 });
  assert.deepEqual(layout.cpuHp, { x: 348, y: 10, width: 292, height: 28 });
  assert.equal(layout.playerHp.width, layout.cpuHp.width);
  assert.equal(hpCenterGap, 52);
  assert.equal(cpuHpRight, 640);
});

test("644x468 で召喚ゲージをフィールドの下に配置する", () => {
  const layout = calculateBattleLayout(gameViewport.width, gameViewport.height);
  const gaugeBottomGap =
    gameViewport.height - (layout.summonGauge.y + layout.summonGauge.height);

  assert.deepEqual(layout.summonGauge, { x: 142, y: 432, width: 360, height: 28 });
  assert.equal(gaugeBottomGap, 8);
});

test("644x468 でボタンと HUD 入力範囲を正しく配置する", () => {
  const layout = calculateBattleLayout(gameViewport.width, gameViewport.height);
  const fieldRight = layout.field.x + layout.field.width;
  const fieldBottom = layout.field.y + layout.field.height;
  const buttonRight = layout.retryButton.x + layout.retryButton.width;
  const cpuHpRight = layout.cpuHp.x + layout.cpuHp.width;

  assert.deepEqual(layout.buildButton, { x: 591.6, y: 252, width: 52, height: 52 });
  assert.deepEqual(layout.summonButton, { x: 591.6, y: 312, width: 52, height: 52 });
  assert.deepEqual(layout.retryButton, { x: 591.6, y: 372, width: 52, height: 52 });
  assert.equal(layout.buildButton.x, fieldRight + 12);
  assert.equal(layout.retryButton.y + layout.retryButton.height, fieldBottom);
  assert.ok(cpuHpRight <= buttonRight);
  assert.equal(isPointInHud(layout, 10, 10), true);
  assert.equal(isPointInHud(layout, 10, 467), true);
  assert.equal(isPointInHud(layout, 600, 252), true);
  assert.equal(
    isPointInHud(
      layout,
      layout.summonGauge.x + layout.summonGauge.width / 2,
      layout.summonGauge.y + layout.summonGauge.height / 2
    ),
    true
  );
  assert.equal(isPointInHud(layout, layout.field.x + 10, layout.field.y + 10), false);
  assert.equal(isPointInHud(layout, 20, 250), false);
});
