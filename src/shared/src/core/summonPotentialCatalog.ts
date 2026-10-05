import type { SummonId } from './summonCatalog.js';

// 出典と承認済みの仮値: docs/summon-potential.md
export const summonPotentialSettings = {
  leaderHpRatio: .3,
  revivalProtectionSeconds: 1,
  raphael: { heal: 500, revivedHpRatio: .6 },
  jackpot: { unitDamage: 600, summonDamage: 600 },
  yggdrasil: { mp: 3, mpRecoveryMultiplier: 1.5, slowMultiplier: .75, slowSeconds: 3 },
  leviathan: { seconds: 20, attack: 15, speedMultiplier: 1.125, defenseMultiplier: .95, unitDamage: 400, leaderDamage: 100, summonDamage: 100 },
  bahamut: { attack: 40, pullSeconds: 12, pullSpeed: .41 },
  dullahan: { seconds: 17, attack: -20 }
} as const;

export const summonPotentialDescriptions: Record<SummonId, string> = {
  raphael: '味方HPを500回復し、戦闘不能の味方をHP60%・最大APの半分で無料復活。',
  jackpot: '敵ユニットに防御無視の600ダメージとAPリセット。敵召喚獣にもダメージ。',
  yggdrasil: '味方APを最大化し、MPを3回復。召喚中はMP回復が加速し、攻撃した敵の移動速度を下げる。',
  leviathan: '20秒間、味方と自身のATK・速度・防御を強化。敵ユニットに400ダメージ、敵召喚士・召喚獣にも追加ダメージ。',
  bahamut: '自身のATKを40上げ、敵ユニットを12秒間引き寄せる。',
  dullahan: '17秒間、敵ユニットのATKを20下げ、戦闘不能の味方を召喚士の位置でHP満タン・無料復活。'
};
