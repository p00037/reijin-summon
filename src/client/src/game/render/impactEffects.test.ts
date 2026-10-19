import assert from 'node:assert/strict';
import test from 'node:test';
import type Phaser from 'phaser';
import { ImpactEffects } from './impactEffects';

test('命中の火花は480ms、薄い白いフラッシュは200msかけて消える', () => {
  let lines = 0;
  let circles = 0;
  const colors: { color: number; alpha: number }[] = [];
  const graphic = {
    clear() { lines = 0; circles = 0; colors.length = 0; },
    fillStyle(color: number, alpha: number) { colors.push({ color, alpha }); },
    fillCircle() { circles++; },
    lineStyle() {},
    lineBetween() { lines++; }
  } as unknown as Phaser.GameObjects.Graphics;
  const effects = new ImpactEffects(graphic);
  effects.add({ x: 10, y: 20 }, 1000);
  effects.draw(999, point => point);
  assert.equal(lines, 0, '着弾前には光らない');
  assert.equal(circles, 0);
  effects.draw(1000, point => point);
  assert.equal(lines, 7);
  assert.equal(circles, 1);
  assert.ok(colors.every(({ color, alpha }) => color === 0xffffff && alpha <= .28));
  effects.draw(1100, point => point);
  assert.equal(circles, 1, '100ms後もフラッシュが残る');
  assert.equal(lines, 7);
  effects.draw(1200, point => point);
  assert.equal(circles, 0, '200msでフラッシュが消える');
  assert.equal(lines, 7);
  effects.draw(1240, point => point);
  assert.equal(lines, 7, '以前の240msを過ぎても火花が残る');
  effects.draw(1479, point => point);
  assert.equal(lines, 7);
  effects.draw(1480, point => point);
  assert.equal(lines, 0, '480msで火花が消える');
  assert.equal(circles, 0);
});
