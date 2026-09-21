import assert from "node:assert/strict";
import test from "node:test";
import type { DeckLibrary } from "./deckModel";
import { deckLibraryStorageKey, loadDeckLibrary, saveDeckLibrary } from "./deckStorage";

function memoryStorage(initialValue: string | null = null) {
  let value = initialValue;
  return {
    getItem(key: string) {
      assert.equal(key, deckLibraryStorageKey);
      return value;
    },
    setItem(key: string, next: string) {
      assert.equal(key, deckLibraryStorageKey);
      value = next;
    }
  };
}

test("保存がない場合は標準デッキを選択した初期ライブラリを返す", () => {
  const result = loadDeckLibrary(memoryStorage());
  assert.equal(result.error, null);
  assert.deepEqual(result.library, {
    version: 2,
    selectedDeckId: "standard",
    decks: [{ id: "standard", name: "標準デッキ", cardIds: ["SC020", "SC019", "SC014"], summonId: "raphael" }]
  });
});

test("複数デッキを保存して順序ごと復元する", () => {
  const storage = memoryStorage();
  const library: DeckLibrary = {
    version: 2,
    selectedDeckId: "second",
    decks: [
      { id: "first", name: "低コスト", cardIds: ["SC002", "SC004"], summonId: "bahamut" },
      { id: "second", name: "標準デッキ", cardIds: ["SC020", "SC019", "SC014"], summonId: "leviathan" }
    ]
  };
  assert.deepEqual(saveDeckLibrary(storage, library), { error: null });
  assert.deepEqual(loadDeckLibrary(storage), { library, error: null });
});

test("version 1をカード・名前・選択状態を保ってラファエルへ移行する", () => {
  const storage = memoryStorage(JSON.stringify({
    version: 1,
    selectedDeckId: "old",
    decks: [{ id: "old", name: "旧デッキ", cardIds: ["SC999", "SC002"] }]
  }));
  const result = loadDeckLibrary(storage);
  assert.equal(result.error, null);
  assert.equal(result.library.version, 2);
  assert.equal(result.library.selectedDeckId, "old");
  assert.equal(result.library.decks[0]?.name, "旧デッキ");
  assert.deepEqual(result.library.decks[0]?.cardIds, ["SC999", "SC002"]);
  assert.equal(result.library.decks[0]?.summonId, "raphael");
});

test("version 2の不明な召喚獣IDだけをラファエルへ補完して通知する", () => {
  const result = loadDeckLibrary(memoryStorage(JSON.stringify({
    version: 2,
    selectedDeckId: "saved",
    decks: [{ id: "saved", name: "保存", cardIds: ["SC002"], summonId: "future-summon" }]
  })));
  assert.equal(result.library.decks[0]?.summonId, "raphael");
  assert.deepEqual(result.library.decks[0]?.cardIds, ["SC002"]);
  assert.equal(result.error, null);
  assert.match(result.notice ?? "", /召喚獣/);
});

test("破損JSONは起動を妨げず初期ライブラリと原因を返す", () => {
  const result = loadDeckLibrary(memoryStorage("{broken"));
  assert.equal(result.library.decks[0]?.name, "標準デッキ");
  assert.match(result.error ?? "", /読み込めません/);
});

test("構造が不正な保存値は起動を妨げず初期ライブラリと原因を返す", () => {
  const result = loadDeckLibrary(memoryStorage(JSON.stringify({ version: 1, decks: "invalid" })));
  assert.equal(result.library.decks[0]?.name, "標準デッキ");
  assert.match(result.error ?? "", /形式/);
});

test("保存先が例外を投げてもクラッシュせず失敗を報告する", () => {
  const result = saveDeckLibrary({ setItem() { throw new DOMException("quota", "QuotaExceededError"); } }, {
    version: 2, selectedDeckId: null, decks: []
  });
  assert.match(result.error ?? "", /保存できません/);
});

test("不正なライブラリは保存先を上書きせず失敗を報告する", () => {
  let writes = 0;
  const invalid = { version: 2, selectedDeckId: null, decks: [{ id: "x", name: "x", cardIds: "SC001", summonId: "raphael" }] };
  const result = saveDeckLibrary({ setItem() { writes += 1; } }, invalid as unknown as DeckLibrary);
  assert.equal(writes, 0);
  assert.match(result.error ?? "", /形式/);
});

test("空または重複したデッキIDは保存先を上書きせず拒否する", () => {
  const invalidLibraries = [
    {
      version: 2,
      selectedDeckId: null,
      decks: [{ id: "", name: "名前なし", cardIds: ["SC001"], summonId: "raphael" }]
    },
    {
      version: 2,
      selectedDeckId: null,
      decks: [{ id: "   ", name: "空白ID", cardIds: ["SC001"], summonId: "raphael" }]
    },
    {
      version: 2,
      selectedDeckId: "same",
      decks: [
        { id: "same", name: "一つ目", cardIds: ["SC001"], summonId: "raphael" },
        { id: "same", name: "二つ目", cardIds: ["SC002"], summonId: "raphael" }
      ]
    }
  ];

  for (const library of invalidLibraries) {
    let writes = 0;
    const result = saveDeckLibrary(
      { setItem() { writes += 1; } },
      library as DeckLibrary
    );
    assert.equal(writes, 0);
    assert.match(result.error ?? "", /形式/);
  }
});

test("選択中IDが保存済みデッキを参照しないライブラリを拒否する", () => {
  const raw = JSON.stringify({
    version: 1,
    selectedDeckId: "draft",
    decks: [{ id: "saved", name: "保存済み", cardIds: ["SC001"] }]
  });

  const result = loadDeckLibrary(memoryStorage(raw));
  assert.equal(result.library.decks[0]?.name, "標準デッキ");
  assert.match(result.error ?? "", /形式/);
});

test("読み込み時のセキュリティ例外を報告して初期ライブラリを返す", () => {
  const result = loadDeckLibrary({ getItem() { throw new DOMException("blocked", "SecurityError"); } });
  assert.equal(result.library.decks[0]?.name, "標準デッキ");
  assert.match(result.error ?? "", /読み込めません/);
});
