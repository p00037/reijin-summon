# カードサイズ縮小 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通常ユニットカードを48px、召喚獣カードを72px、陣営色外枠を2pxへ縮小する。

**Architecture:** `cardPresentation.ts` の表示設定だけを変更し、既存の `BattleScene` がその表示高と外枠幅から画像と外枠矩形のサイズを計算する仕組みを再利用する。

**Tech Stack:** TypeScript、Phaser 3、Node.js built-in test runner、tsx、Vite

## Global Constraints

- 通常ユニットの表示高は48pxとする。
- 召喚獣の表示高は72pxとし、通常ユニットの1.5倍を維持する。
- 陣営色外枠の幅は2pxとする。
- 画像本体へ陣営色の tint を適用しない。
- 既存の画像アセットにある未コミット変更には触れない。

---

## File Structure

- Modify: `src/client/src/game/render/cardPresentation.ts` — カード表示高と外枠幅の定数を変更する。
- Modify: `src/client/src/game/render/cardPresentation.test.ts` — 表示設定の期待値を48px、72px、2pxへ更新する。

### Task 1: カード表示設定を2/3サイズへ変更する

**Files:**
- Modify: `src/client/src/game/render/cardPresentation.ts`
- Modify: `src/client/src/game/render/cardPresentation.test.ts`

**Interfaces:**
- Produces: `unitCardPresentation[type].displayHeight === 48`
- Produces: `summonedCardPresentation.displayHeight === 72`
- Produces: `cardBorderWidth === 2`
- Consumed by: `BattleScene` のカード画像・外枠矩形のサイズ計算

- [ ] **Step 1: 失敗する表示設定テストを書く**

`cardPresentation.test.ts` のカード表示高と外枠幅の期待値を次のとおり更新する。

```ts
assert.deepEqual(unitCardPresentation.Speed, {
  textureKey: "unit-card-speed",
  path: "/assets/units/blue/blue001.png",
  displayHeight: 48
});

assert.deepEqual(summonedCardPresentation, {
  textureKey: "summoned-card",
  path: "/assets/summons/summon01.png",
  displayHeight: 72
});
assert.equal(summonedCardPresentation.displayHeight, unitCardPresentation.Melee.displayHeight * 1.5);
assert.equal(cardBorderWidth, 2);
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm.cmd run test -w src/client`

Expected: 通常ユニットの72px、召喚獣の108px、外枠幅4pxが新しい期待値と一致せず、`cardPresentation.test.ts` がFAIL。

- [ ] **Step 3: 最小の表示設定を実装する**

`cardPresentation.ts` を次の値へ変更する。

```ts
export const cardBorderWidth = 2;

export const unitCardPresentation = {
  Speed: { textureKey: "unit-card-speed", path: "/assets/units/blue/blue001.png", displayHeight: 48 },
  Melee: { textureKey: "unit-card-melee", path: "/assets/units/blue/blue002.png", displayHeight: 48 },
  Ranged: { textureKey: "unit-card-ranged", path: "/assets/units/blue/blue003.png", displayHeight: 48 }
} satisfies Record<UnitType, CardPresentation>;

export const summonedCardPresentation: CardPresentation = {
  textureKey: "summoned-card",
  path: "/assets/summons/summon01.png",
  displayHeight: 72
};
```

- [ ] **Step 4: 型チェック、全テスト、ビルドを確認する**

Run: `npm.cmd run typecheck -w src/client; npm.cmd run test -w src/client; npm.cmd run build -w src/client`

Expected: 型エラー0件、全テストPASS、Viteビルドがexit code 0で完了。

- [ ] **Step 5: コミットする**

```powershell
git add src/client/src/game/render/cardPresentation.ts src/client/src/game/render/cardPresentation.test.ts
git commit -m "feat: カード表示を2/3へ縮小"
```
