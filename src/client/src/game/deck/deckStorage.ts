import { standardDeckCardIds } from "./cardCatalog";
import type { DeckLibrary, SavedDeck } from "./deckModel";

export const deckLibraryStorageKey = "reijin-summon.deck-library";

function createInitialLibrary(): DeckLibrary {
  return {
    version: 1,
    selectedDeckId: "standard",
    decks: [{ id: "standard", name: "標準デッキ", cardIds: [...standardDeckCardIds] }]
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSavedDeck(value: unknown): value is SavedDeck {
  return isRecord(value)
    && typeof value.id === "string"
    && value.id.trim().length > 0
    && typeof value.name === "string"
    && Array.isArray(value.cardIds)
    && value.cardIds.every((cardId) => typeof cardId === "string");
}

function isDeckLibrary(value: unknown): value is DeckLibrary {
  if (!isRecord(value)
    || value.version !== 1
    || (value.selectedDeckId !== null && typeof value.selectedDeckId !== "string")
    || !Array.isArray(value.decks)
    || !value.decks.every(isSavedDeck)) {
    return false;
  }

  const deckIds = new Set(value.decks.map((deck) => deck.id));
  if (deckIds.size !== value.decks.length) return false;

  return value.selectedDeckId === null || deckIds.has(value.selectedDeckId);
}

export function loadDeckLibrary(
  storage: Pick<Storage, "getItem">
): { library: DeckLibrary; error: string | null } {
  let raw: string | null;
  try {
    raw = storage.getItem(deckLibraryStorageKey);
  } catch {
    return { library: createInitialLibrary(), error: "保存済みデッキを読み込めませんでした。" };
  }

  if (raw === null) return { library: createInitialLibrary(), error: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { library: createInitialLibrary(), error: "保存済みデッキを読み込めませんでした。データが破損しています。" };
  }

  if (!isDeckLibrary(parsed)) {
    return { library: createInitialLibrary(), error: "保存済みデッキの形式が正しくありません。" };
  }

  return { library: parsed, error: null };
}

export function saveDeckLibrary(
  storage: Pick<Storage, "setItem">,
  library: DeckLibrary
): { error: string | null } {
  if (!isDeckLibrary(library)) {
    return { error: "デッキの形式が正しくないため保存できません。" };
  }

  try {
    storage.setItem(deckLibraryStorageKey, JSON.stringify(library));
    return { error: null };
  } catch {
    return { error: "デッキを保存できませんでした。ブラウザの保存設定や空き容量を確認してください。" };
  }
}
