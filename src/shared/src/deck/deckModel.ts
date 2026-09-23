import { findCard } from "./cardCatalog.js";
import type { SummonId } from "../core/summonCatalog.js";

export type SavedDeck = {
  id: string;
  name: string;
  cardIds: string[];
  summonId: SummonId;
};

export type DeckLibrary = {
  version: 2;
  selectedDeckId: string | null;
  decks: SavedDeck[];
};

export type DeckValidation = {
  valid: boolean;
  cost: number;
  errors: string[];
};

export function validateDeck(cardIds: readonly string[]): DeckValidation {
  const errors: string[] = [];
  let cost = 0;

  if (cardIds.length < 1) errors.push("デッキには1枚以上必要です。");
  if (cardIds.length > 5) errors.push("デッキは5枚までです。");

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const cardId of cardIds) {
    if (seen.has(cardId)) duplicates.add(cardId);
    seen.add(cardId);

    const card = findCard(cardId);
    if (card === undefined) errors.push(`不明なカードIDです: ${cardId}`);
    else cost += card.cost;
  }

  if (duplicates.size > 0) {
    errors.push(`同一カードを重複して編成できません: ${[...duplicates].join(", ")}`);
  }
  if (cost > 10) errors.push(`合計コストは10以下にしてください（現在${cost}）。`);

  return { valid: errors.length === 0, cost, errors };
}
