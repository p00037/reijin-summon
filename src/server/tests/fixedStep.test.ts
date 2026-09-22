import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedStep } from '../src/online/fixedStep.js';
test('更新間隔の遅れを次回へ持ち越し、試合時間を遅らせない', () => { const clock = new FixedStep(); let elapsed = 0; clock.advance(60, dt => elapsed += dt); clock.advance(90, dt => elapsed += dt); assert.ok(Math.abs(elapsed - .15) < 1e-8); assert.equal(clock.pendingMs, 0); });
