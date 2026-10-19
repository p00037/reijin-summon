export function hitFlashAlpha(at: number | undefined, now: number): number {
  if (at === undefined || now < at) return 0;
  return .28 * Math.max(0, 1 - (now - at) / 200);
}

export function otherHpLoss(previousHp: number, hp: number, normalAttackDamage: number): number {
  return Math.max(0, previousHp - hp - normalAttackDamage);
}

export class HealingFeedback {
  private readonly previousHp = new Map<string, number>();
  private readonly startedAt = new Map<string, number>();

  update(subjects: readonly { id: string; hp: number }[], now: number): { id: string; progress: number }[] {
    const ids = new Set(subjects.map(subject => subject.id));
    for (const id of this.previousHp.keys()) {
      if (!ids.has(id)) { this.previousHp.delete(id); this.startedAt.delete(id); }
    }
    for (const [id, at] of this.startedAt) {
      if (now - at >= 800) this.startedAt.delete(id);
    }
    for (const { id, hp } of subjects) {
      const previous = this.previousHp.get(id);
      if (hp <= 0) this.startedAt.delete(id);
      else if (previous !== undefined && previous > 0 && hp > previous && !this.startedAt.has(id)) {
        this.startedAt.set(id, now);
      }
      this.previousHp.set(id, hp);
    }
    return [...this.startedAt].map(([id, at]) => ({ id, progress: Math.max(0, (now - at) / 800) }));
  }

  clear(): void { this.previousHp.clear(); this.startedAt.clear(); }
}

export class HpTrail {
  private entries = new Map<string, { hp: number; from: number; at: number }>();

  sample(id: string, ratio: number, now: number): number {
    const hp = Math.max(0, Math.min(1, ratio));
    const previous = this.entries.get(id);
    if (!previous || hp > previous.hp) {
      this.entries.set(id, { hp, from: hp, at: now });
      return hp;
    }
    const visible = previous.hp + (previous.from - previous.hp) * Math.max(0, 1 - (now - previous.at) / 300);
    if (hp < previous.hp) this.entries.set(id, { hp, from: visible, at: now });
    return Math.max(hp, visible);
  }

  clear(): void { this.entries.clear(); }
}
