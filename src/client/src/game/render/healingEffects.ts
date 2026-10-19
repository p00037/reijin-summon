import type Phaser from 'phaser';
import { HealingFeedback } from './battleFeedback';

export type HealingSubject = {
  id: string;
  hp: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export class HealingEffects {
  private readonly feedback = new HealingFeedback();

  constructor(private readonly graphic: Phaser.GameObjects.Graphics) {}

  draw(subjects: readonly HealingSubject[], now: number): void {
    this.graphic.clear();
    const byId = new Map(subjects.map(subject => [subject.id, subject]));
    for (const effect of this.feedback.update(subjects, now)) {
      const subject = byId.get(effect.id)!;
      const strength = Math.sin(effect.progress * Math.PI);
      if (strength <= 0) continue;
      const { x, y, width, height } = subject;
      this.graphic.fillStyle(0x86efac, .12 * strength);
      this.graphic.fillEllipse(x, y + height * .12, width * .9, height * .65);
      this.graphic.fillStyle(0xb6fbd0, .65 * strength);
      for (let index = 0; index < 3; index++) {
        const moteX = x + (index - 1) * Math.min(width * .2, 9)
          + Math.sin(effect.progress * Math.PI + index) * 2;
        const moteY = y + height * .2 - effect.progress * 25 - (index % 2) * 5;
        this.graphic.fillCircle(moteX, moteY, index === 1 ? 1.8 : 1.3);
      }
    }
  }

  clear(): void { this.feedback.clear(); this.graphic.clear(); }
  destroy(): void { this.feedback.clear(); this.graphic.destroy(); }
}
