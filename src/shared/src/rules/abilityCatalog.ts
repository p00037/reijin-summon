import type { EnchantmentKind, TimedAbilityEffect } from '../core/types.js';
export type AbilityAreaDefinition = {
  kind: 'circle';
  forwardHeight: number;
  radiusHeight: number;
} | {
  kind: 'none' | 'self' | 'half' | 'all';
};
type Effect = {
  kind: 'timed';
  duration: number;
  intelligenceScaled?: boolean;
  modifiers: {
    kind: TimedAbilityEffect['kind'];
    amount: number;
  }[];
} | {
  kind: 'enchant';
  enchantment: EnchantmentKind;
  auraRadiusHeight?: number;
  auraRadiusWorld?: number;
} | {
  kind: 'dispel' | 'rain' | 'gauge' | 'rose' | 'wave' | 'absorb';
};
export type AbilityDefinition = {
  id: string;
  name: string;
  description: string;
  apCost: number;
  area: AbilityAreaDefinition;
  target: 'enemy' | 'ally' | 'both' | 'elemental' | 'self' | 'none';
  random?: boolean;
  rainOnly?: boolean;
  sameNation?: boolean;
  effect: Effect;
};
const F: AbilityAreaDefinition = { kind: 'circle', forwardHeight: 1, radiusHeight: 1 };
const S: AbilityAreaDefinition = { kind: 'circle', forwardHeight: 1, radiusHeight: .5 };
const L: AbilityAreaDefinition = { kind: 'circle', forwardHeight: 1, radiusHeight: 1.5 };
const C: AbilityAreaDefinition = { kind: 'circle', forwardHeight: 0, radiusHeight: 1.5 };
const timed = (duration: number, modifiers: {
  kind: TimedAbilityEffect['kind'];
  amount: number;
}[], intelligenceScaled = false): Effect => ({ kind: 'timed', duration, modifiers, intelligenceScaled });
export const abilityCatalog: readonly AbilityDefinition[] = [
  { id: 'SC001', name: '力の徴収', description: '前方の敵1体を抽選し、時間制の強化・弱体を解除。', apCost: 1, area: { ...F }, target: 'enemy', random: true, effect: { kind: 'dispel' } },
  { id: 'SC002', name: '占術の力', description: '前方の敵1体のATK−14。基準13秒、INT差で時間が変化。', apCost: 1, area: { ...F }, target: 'enemy', random: true, effect: timed(13, [{ kind: 'attack', amount: -14 }], true) },
  { id: 'SC003', name: '水の精霊の召喚', description: '同国の味方エレメントへ周辺味方の速度加算を付与。キーパー基礎速度の50％分、重複なし。', apCost: 2, area: { ...C }, target: 'elemental', effect: { kind: 'enchant', enchantment: 'speed', auraRadiusHeight: 1.5 } },
  { id: 'SC004', name: '人魚の儀式', description: '100秒間の雨。再使用で100秒に更新。', apCost: 3, area: { kind: 'none' }, target: 'none', effect: { kind: 'rain' } },
  { id: 'SC005', name: '暴力的な戦略', description: '前方の敵全員の速度×0.5。基準11秒、INT差で時間が変化。', apCost: 2, area: { ...F }, target: 'enemy', effect: timed(11, [{ kind: 'speed', amount: .5 }], true) },
  { id: 'SC006', name: '王宮魔導師の誇り', description: '前方小円の味方1体を抽選し、10秒間速度×1.5。', apCost: 1, area: { ...S }, target: 'ally', random: true, effect: timed(10, [{ kind: 'speed', amount: 1.5 }]) },
  { id: 'SC007', name: '鮮血の誘い', description: '10秒間、自身の速度×(1＋同国味方エレメント数÷6)、通常・召喚獣攻撃を1基5％軽減（最大30％）。', apCost: 1, area: { kind: 'self' }, target: 'self', effect: { kind: 'rose' } },
  { id: 'SC008', name: '猛る潮流', description: '前方の敵1体を抽選し速度×0.4。基準20秒、INT差で時間が変化。', apCost: 2, area: { ...F }, target: 'enemy', random: true, effect: timed(20, [{ kind: 'speed', amount: .4 }], true) },
  { id: 'SC009', name: '鮫王の暴令', description: '雨限定。同国の味方全員の速度を13秒間×1.5。', apCost: 3, area: { kind: 'all' }, target: 'ally', sameNation: true, rainOnly: true, effect: timed(13, [{ kind: 'speed', amount: 1.5 }]) },
  { id: 'SC011', name: '紫海の防衛術', description: '前方大円の敵全員にATK−9、速度×0.5。基準16秒、INT差で時間が変化。', apCost: 3, area: { ...L }, target: 'enemy', effect: timed(16, [{ kind: 'attack', amount: -9 }, { kind: 'speed', amount: .5 }], true) },
  { id: 'SC012', name: '限界への挑戦', description: '召喚ゲージを最大値の30％回復。満タン・召喚獣出現中は不可。', apCost: 2, area: { kind: 'none' }, target: 'none', effect: { kind: 'gauge' } },
  { id: 'SC013', name: '弔いの歌', description: '前方の味方全員の速度を10秒間×1.5。', apCost: 2, area: { ...F }, target: 'ally', effect: timed(10, [{ kind: 'speed', amount: 1.5 }]) },
  { id: 'SC014', name: 'シードラゴンの召喚', description: '同国の味方エレメントへ、20秒ごとに周辺味方1体につき召喚ゲージ5％回復を付与。', apCost: 4, area: { ...C }, target: 'elemental', effect: { kind: 'enchant', enchantment: 'gauge', auraRadiusHeight: 1 } },
  { id: 'SC015', name: '大津波', description: '自身のいる半面の敵全員へ同INTで415ダメージ。INT差1につき10％補正。', apCost: 3, area: { kind: 'half' }, target: 'enemy', effect: { kind: 'wave' } },
  { id: 'SC016', name: '際限なき食欲', description: '前方の敵1体を抽選し実効ATKの半分（切り捨て）を22秒間吸収。再使用で再計算。', apCost: 2, area: { ...F }, target: 'enemy', random: true, effect: { kind: 'absorb' } },
  { id: 'SC017', name: '三日月の秘法', description: '雨限定。敵全員の時間制の強化・弱体を解除。', apCost: 1, area: { kind: 'all' }, target: 'enemy', rainOnly: true, effect: { kind: 'dispel' } },
  { id: 'SC018', name: '魅惑の幻術', description: '前方の味方1体を抽選し70秒間INT＋3。累積可、期限は独立。', apCost: 3, area: { ...F }, target: 'ally', random: true, effect: timed(70, [{ kind: 'intelligence', amount: 3 }]) },
  { id: 'SC019', name: 'シャコ貝の召喚', description: '同国の味方エレメントへ周辺の敵ATK−11を付与。複数基で加算、下限0。', apCost: 5, area: { ...C }, target: 'elemental', effect: { kind: 'enchant', enchantment: 'shell', auraRadiusWorld: 2 } },
  { id: 'SC020', name: '緑海の戦術', description: '前方の敵味方から1体を抽選し速度×0.28。自身も候補。基準18秒、INT差で時間が変化。', apCost: 3, area: { ...F }, target: 'both', random: true, effect: timed(18, [{ kind: 'speed', amount: .28 }], true) }
];
const byId = new Map(abilityCatalog.map(ability => [ability.id, ability]));
export function getAbilityDefinition(cardId: string | undefined): AbilityDefinition | null {
  return cardId ? byId.get(cardId) ?? null : null;
}
