# カード陣営色外枠化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通常ユニットと召喚獣の画像色を保持し、青・赤の外枠で陣営を示す。召喚獣の表示高は通常ユニットの1.5倍（108px）にする。

**Architecture:** 表示設定に外枠の幅・深度・陣営色を集約する。`BattleScene` はカード画像ごとに背面矩形を保持し、位置・透明度・ライフサイクルを画像と同期する。画像には tint を設定しない。

**Tech Stack:** TypeScript、Phaser 3、Node.js built-in test runner、tsx、Vite

## Global Constraints

- 通常ユニットの表示高は72px、召喚獣の表示高は108pxとする。
- 外枠幅は4pxとし、Playerは `0x7dd3fc`、Cpuは `0xfda4af` を使う。
- 外枠は画像の背面、状態表示は画像より前面に置く。
- 画像の `setTint` は通常ユニット・召喚獣のどちらにも使用しない。
- 設計・計画書を含むドキュメントは日本語で書く。

---

## File Structure

- Modify: `src/client/src/game/render/cardPresentation.ts` — カード表示サイズ、外枠幅・深度・陣営色を公開する。
- Modify: `src/client/src/game/render/cardPresentation.test.ts` — 表示設定の回帰テストを追加・更新する。
- Modify: `src/client/src/game/scenes/BattleScene.ts` — 外枠矩形の生成、更新、削除をカード画像と同期する。

### Task 1: カード表示設定を外枠仕様へ更新する

**Files:**
- Modify: `src/client/src/game/render/cardPresentation.ts`
- Test: `src/client/src/game/render/cardPresentation.test.ts`

**Interfaces:**
- Produces: `cardBorderDepth: number`、`cardBorderWidth: number`、`cardBorderColorForTeam(team: TeamId): number`
- Produces: `summonedCardPresentation.displayHeight === 108`
- Consumed by: `BattleScene` の外枠矩形の作成・更新処理

- [ ] **Step 1: 表示設定の失敗テストを書く**

`cardPresentation.test.ts` の import と召喚獣・陣営色・深度のテストを次の内容へ更新する。

```ts
import {
  battleStatusOverlayDepth,
  cardBorderColorForTeam,
  cardBorderDepth,
  cardBorderWidth,
  cardImageDepth,
  summonedCardPresentation,
  unitCardPresentation
} from "./cardPresentation";

test("summoned card is one and a half times the unit card height", () => {
  assert.equal(summonedCardPresentation.displayHeight, 108);
  assert.equal(summonedCardPresentation.displayHeight, unitCardPresentation.Melee.displayHeight * 1.5);
});

test("card borders distinguish player and CPU teams", () => {
  assert.equal(cardBorderWidth, 4);
  assert.equal(cardBorderColorForTeam("Player"), 0x7dd3fc);
  assert.equal(cardBorderColorForTeam("Cpu"), 0xfda4af);
});

test("card border is behind cards and status overlay is in front", () => {
  assert.ok(cardBorderDepth < cardImageDepth);
  assert.ok(cardImageDepth < battleStatusOverlayDepth);
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -w src/client -- src/game/render/cardPresentation.test.ts`

Expected: `cardBorderColorForTeam` などの export 不足、または召喚獣の高さが144pxであることによる失敗。

- [ ] **Step 3: 最小の表示設定を実装する**

`cardPresentation.ts` を次の定義に更新する。`cardTintForTeam` は削除し、画像への色加工の入口をなくす。

```ts
export const cardBorderDepth = 0;
export const cardImageDepth = 1;
export const battleStatusOverlayDepth = 2;
export const cardBorderWidth = 4;

export const summonedCardPresentation: CardPresentation = {
  textureKey: "summoned-card",
  path: "/assets/summons/summon01.png",
  displayHeight: 108
};

export function cardBorderColorForTeam(team: TeamId): number {
  return team === "Player" ? 0x7dd3fc : 0xfda4af;
}
```

- [ ] **Step 4: 表示設定テストの成功を確認する**

Run: `npm run test -w src/client -- src/game/render/cardPresentation.test.ts`

Expected: 4件のテストがすべてPASS。

- [ ] **Step 5: コミットする**

```powershell
git add src/client/src/game/render/cardPresentation.ts src/client/src/game/render/cardPresentation.test.ts
git commit -m "feat: カードの陣営色外枠設定を追加"
```

### Task 2: BattleSceneで外枠をカードと同期する

**Files:**
- Modify: `src/client/src/game/scenes/BattleScene.ts`
- Test: `src/client/src/game/render/cardPresentation.test.ts`

**Interfaces:**
- Consumes: `cardBorderDepth`、`cardBorderWidth`、`cardBorderColorForTeam(team)`、`CardPresentation.displayHeight`
- Produces: 通常ユニットと召喚獣の各カードに追従する `Phaser.GameObjects.Rectangle`

- [ ] **Step 1: シーン実装の契約をテストへ記録する**

`cardPresentation.test.ts` に、画像 tint 用の設定関数が公開されず、外枠設定が表示設定の唯一の陣営色インターフェースであることを検証するテストを追加する。

```ts
test("card presentation exposes border colors instead of image tint settings", () => {
  assert.equal(typeof cardBorderColorForTeam, "function");
});
```

- [ ] **Step 2: テストの成功を確認する**

Run: `npm run test -w src/client -- src/game/render/cardPresentation.test.ts`

Expected: Task 1の設定実装により、追加したテストを含む全テストがPASS。

- [ ] **Step 3: 外枠矩形を実装する**

`BattleScene.ts` に次のメンバーを追加し、`create` でMapを初期化する。

```ts
private unitCardBorders = new Map<string, Phaser.GameObjects.Rectangle>();
private summonedUnitCardBorders = new Map<number, Phaser.GameObjects.Rectangle>();
```

`createUnitImages` では、画像の表示サイズを求めた直後に、外枠を生成して画像より背面に置く。

```ts
const border = this.add.rectangle(
  0,
  0,
  displayWidth + cardBorderWidth * 2,
  presentation.displayHeight + cardBorderWidth * 2,
  cardBorderColorForTeam(unit.team)
);
border.setDepth(cardBorderDepth);
this.unitCardBorders.set(unit.unitId, border);
```

`updateUnitImage` では画像に `setTint` を呼ばず、画像と外枠を同じ位置・透明度にする。

```ts
const border = this.unitCardBorders.get(unit.unitId);
if (border) {
  border.setPosition(screen.x, screen.y);
  border.setAlpha(alpha);
  border.setFillStyle(cardBorderColorForTeam(unit.team));
}
image.setPosition(screen.x, screen.y);
image.setAlpha(alpha);
```

召喚獣では上記と同じ寸法計算で `summonedUnitCardBorders` を生成・更新する。`destroyRemovedSummonedUnitImages` は対応する外枠を `destroy()` し、Mapから削除する。

importは次のように更新する。

```ts
import {
  battleStatusOverlayDepth,
  cardBorderColorForTeam,
  cardBorderDepth,
  cardBorderWidth,
  cardImageDepth,
  summonedCardPresentation,
  unitCardPresentation
} from "../render/cardPresentation";
```

- [ ] **Step 4: 型検査と全テストを実行する**

Run: `npm run typecheck -w src/client; npm run test -w src/client`

Expected: 型エラー0件、クライアントの全テストPASS。

- [ ] **Step 5: プロダクションビルドを実行する**

Run: `npm run build -w src/client`

Expected: TypeScriptコンパイルとViteビルドがexit code 0で完了。

- [ ] **Step 6: コミットする**

```powershell
git add src/client/src/game/scenes/BattleScene.ts src/client/src/game/render/cardPresentation.test.ts
git commit -m "feat: カードを陣営色の外枠で表示"
```
