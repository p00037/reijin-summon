import { findCard } from './cardCatalog.js';
import { getSummonDefinition, type SummonDefinition, type SummonId } from '../core/summonCatalog.js';

export type SummonCustomization = {
  attackBonus: number;
  defenseReduction: number;
  hpBonus: number;
};

// 効果種類はWiki、数値はユーザー指定。docs/summon-customization-research-and-questions.mdを参照。
const kinds: Record<string, 'attack' | 'defense' | 'attackDefense' | 'hp'> = {
  SC001: 'defense', SC002: 'defense', SC003: 'defense', SC004: 'defense',
  SC005: 'attack', SC006: 'defense', SC007: 'attack', SC008: 'defense',
  SC009: 'attack', SC010: 'defense', SC011: 'defense', SC012: 'defense',
  SC013: 'defense', SC014: 'defense', SC015: 'attackDefense', SC016: 'hp',
  SC017: 'defense', SC018: 'defense', SC019: 'attack', SC020: 'defense'
};

export function getCardSummonCustomization(cardId: string): SummonCustomization {
  const card = findCard(cardId);
  const kind = kinds[cardId];
  return {
    attackBonus: card && (kind === 'attack' || kind === 'attackDefense') ? card.level + 1 : 0,
    defenseReduction: kind === 'attackDefense' ? .10 : card && kind === 'defense' ? .04 * card.cost : 0,
    hpBonus: kind === 'hp' ? 500 : 0
  };
}

export function getDeckSummonCustomization(cardIds: readonly string[]): SummonCustomization {
  const total: SummonCustomization = { attackBonus: 0, defenseReduction: 0, hpBonus: 0 };
  for (const cardId of new Set(cardIds)) {
    const effect = getCardSummonCustomization(cardId);
    total.attackBonus += effect.attackBonus;
    total.defenseReduction += effect.defenseReduction;
    total.hpBonus += effect.hpBonus;
  }
  return total;
}

export function getCustomizedSummonDefinition(
  summonId: SummonId, customization: SummonCustomization
): SummonDefinition & { customizationAttackRatio: number } {
  const definition = getSummonDefinition(summonId);
  const attackDamage = definition.attackDamage + customization.attackBonus;
  // 潜在ATKは含めない。召喚時に固定し、波動や初回レーザーにだけ使う。
  const customizationAttackRatio = attackDamage / definition.attackDamage;
  return {
    ...definition,
    baseHp: definition.baseHp + customization.hpBonus,
    attackDamage,
    leaderAttackDamage: definition.leaderAttackDamage * customizationAttackRatio,
    damageMultiplier: Math.max(.05, definition.damageMultiplier - customization.defenseReduction),
    customizationAttackRatio
  };
}
