import type Phaser from "phaser";
import { getSummonDefinition, type SummonId } from "../core/summonCatalog";
import type { BattleConfig, BattleState, SummonAttackEvent, Vec2 } from "../core/types";
import { getSummonBeam } from "../rules/summonGeometry";
import { summonedCardPresentation, type CardPresentation } from "./cardPresentation";

export function summonCardFor(id: SummonId): CardPresentation {
  return { ...summonedCardPresentation, textureKey: `summon-${id}`, path: getSummonDefinition(id).imagePath };
}

const effectColors: Record<SummonId, number> = {
  raphael: 0xffe8ad, jackpot: 0xff6a25, yggdrasil: 0x80e3a0,
  leviathan: 0x5cceff, bahamut: 0xffa34d, dullahan: 0xc28aff
};

export class SummonEffects {
  private readonly beam: Phaser.GameObjects.Graphics;
  private readonly active = new Set<Phaser.GameObjects.Graphics>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly toScreen: (point: Vec2) => Vec2,
    private readonly mask: Phaser.Display.Masks.GeometryMask
  ) {
    this.beam = scene.add.graphics().setDepth(1.6).setMask(mask);
  }

  draw(state: BattleState, config: BattleConfig): void {
    this.beam.clear();
    if (state.result !== "InProgress") {
      state.recentSummonAttackEvents.length = 0;
      this.clearTransient();
      return;
    }
    for (const summoned of state.summonedUnits) {
      if (summoned.summonId !== "jackpot" || summoned.currentHp <= 0) continue;
      const beam = getSummonBeam(summoned, state, config);
      const start = this.toScreen(beam.start);
      const end = this.toScreen(beam.end);
      const edge = this.toScreen({ x: beam.start.x + beam.width, y: beam.start.y });
      const width = Math.abs(edge.x - start.x);
      const pulse = 0.32 + Math.sin(this.scene.time.now / 110) * 0.08;
      this.beam.lineStyle(width, 0xf54e21, pulse).lineBetween(start.x, start.y, end.x, end.y);
      this.beam.fillStyle(0xf54e21, pulse).fillCircle(start.x, start.y, width / 2).fillCircle(end.x, end.y, width / 2);
      this.beam.lineStyle(width * 0.32, 0xffce72, 0.7).lineBetween(start.x, start.y, end.x, end.y);
      this.beam.lineStyle(width * 0.08, 0xfff4d3, 0.9).lineBetween(start.x, start.y, end.x, end.y);
    }
    for (const event of state.recentSummonAttackEvents.splice(0)) this.showEvent(event);
  }

  destroy(): void {
    this.clearTransient();
    this.beam.destroy();
  }

  private clearTransient(): void {
    for (const graphic of this.active) {
      this.scene.tweens.killTweensOf(graphic);
      graphic.destroy();
    }
    this.active.clear();
  }

  private showEvent(event: SummonAttackEvent): void {
    const origin = this.toScreen(event.origin);
    const graphic = this.scene.add.graphics().setDepth(1.7).setMask(this.mask).setPosition(origin.x, origin.y);
    const color = effectColors[event.summonId];
    this.active.add(graphic);
    if (event.kind === "wave") {
      graphic.lineStyle(3, color, 0.8).strokeCircle(0, 0, 30);
      graphic.lineStyle(1, 0xd5f6ff, 0.9).strokeCircle(0, 0, 22);
      this.scene.tweens.add({ targets: graphic, scale: 20, alpha: 0, duration: 900, ease: "Quad.Out", onComplete: () => this.remove(graphic) });
      return;
    }
    for (const target of event.targets) {
      const point = this.toScreen(target);
      const x = point.x - origin.x;
      const y = point.y - origin.y;
      if (event.kind === "roots") {
        graphic.lineStyle(3, 0x446b39, 0.9).beginPath().moveTo(0, 0)
          .lineTo(x * 0.3 - 7, y * 0.3).lineTo(x * 0.65 + 7, y * 0.65).lineTo(x, y).strokePath();
        graphic.lineStyle(1, color, 0.9).lineBetween(x * 0.65 + 7, y * 0.65, x + 8, y - 8);
        graphic.fillStyle(color, 0.8).fillEllipse(x, y, 8, 4);
      } else if (event.summonId === "bahamut") {
        graphic.lineStyle(7, color, 0.55).lineBetween(0, 0, x, y);
        graphic.lineStyle(2, 0xffedd0, 0.9).lineBetween(0, 0, x, y);
        graphic.fillStyle(color, 0.8).fillTriangle(x - 8, y + 7, x, y - 15, x + 7, y + 6);
      } else {
        graphic.lineStyle(4, color, 0.8).lineBetween(x - 14, y + 11, x + 14, y - 11);
        graphic.lineStyle(1, 0xffffff, 0.9).lineBetween(x - 17, y + 9, x + 11, y - 13);
      }
    }
    if (event.kind === "roots") graphic.setScale(0.2);
    this.scene.tweens.add({ targets: graphic, scale: 1, alpha: 0, duration: event.kind === "roots" ? 650 : 320, ease: "Quad.Out", onComplete: () => this.remove(graphic) });
  }

  private remove(graphic: Phaser.GameObjects.Graphics): void {
    this.active.delete(graphic);
    graphic.destroy();
  }
}
