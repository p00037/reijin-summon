import type Phaser from 'phaser';
import type { Vec2 } from '../core/types';
import { hitFlashAlpha } from './battleFeedback';

// 火花は480ms、フラッシュは200msかけて滑らかに消す。
export class ImpactEffects {
  private impacts: { point: Vec2; at: number }[] = [];
  constructor(private graphic: Phaser.GameObjects.Graphics) {}

  add(point: Vec2, at: number): void {
    this.impacts.push({ point: { ...point }, at });
    if (this.impacts.length > 64) this.impacts.shift();
  }

  draw(now: number, toScreen: (point: Vec2) => Vec2): void {
    this.graphic.clear();
    this.impacts = this.impacts.filter(hit => now - hit.at < 480);
    for (const hit of this.impacts) {
      const age = now - hit.at;
      if (age < 0) continue;
      const alpha = hitFlashAlpha(hit.at, now);
      const point = toScreen(hit.point);
      if (alpha > 0) {
        this.graphic.fillStyle(0xffffff, alpha);
        this.graphic.fillCircle(point.x, point.y, 9);
      }
      const progress = age / 480;
      this.graphic.lineStyle(2, 0xffdf91, 1 - progress);
      for (let index = 0; index < 7; index++) {
        const angle = index * Math.PI * 2 / 7 + hit.at * .01;
        const radius = 5 + progress * 22;
        const endRadius = radius + 5 * (1 - progress);
        this.graphic.lineBetween(
          point.x + Math.cos(angle) * radius, point.y + Math.sin(angle) * radius,
          point.x + Math.cos(angle) * endRadius, point.y + Math.sin(angle) * endRadius
        );
      }
    }
  }

  destroy(): void { this.impacts = []; this.graphic.destroy(); }
}
