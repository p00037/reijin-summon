# ユニット・召喚獣の静止カード画像化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 戦闘画面の3種のユニットと召喚獣を、指定された縦長カード画像による静止表示へ置き換える。

**Architecture:** 画像パス・テクスチャキー・表示高・チーム tint を Phaser 非依存の表示設定モジュールへ集約し、Node.js テストで固定する。`BattleScene` は設定を使って `Phaser.GameObjects.Image` を生成・同期し、既存のスプライトシートおよびアニメーション判定を削除する。

**Tech Stack:** TypeScript、Phaser 3.90、Node.js test runner、Vite

## Global Constraints

- 設計仕様は `docs/superpowers/specs/2026-07-17-static-card-unit-images-design.md` に従う。
- Player と CPU は同じカード画像を使用し、チーム別 tint で区別する。
- 通常ユニットの表示高は 72px、召喚獣の表示高は 144px とし、元画像の縦横比を維持する。
- 移動、攻撃、被ダメージ、撃破・復活、召喚、AI、HUD、当たり判定、選択範囲は変更しない。
- モーション、左右反転、アニメーション終了待ちは残さない。
- 既存の召喚者画像とエレメント画像は変更しない。

---

## ファイル構成

- Create: `src/client/src/game/render/cardPresentation.ts` — カード画像のキー、パス、表示高、チーム tint を提供する。
- Create: `src/client/src/game/render/cardPresentation.test.ts` — 表示設定を Phaser なしで検証する。
- Modify: `src/client/src/game/scenes/BattleScene.ts` — 静止画像の読み込み、生成、状態同期を担当する。
- Delete: `src/client/src/game/render/unitAnimation.ts` — 不要になるアニメーション判定を削除する。
- Delete: `src/client/src/game/render/unitAnimation.test.ts` — 削除対象だけを検証していたテストを削除する。
- Add: `src/client/public/assets/summons/summon01.png`、`src/client/public/assets/units/blue/blue001.png`、`blue002.png`、`blue003.png` — ユーザー提供のカード画像を成果物へ含める。

### Task 1: カード表示設定をテスト駆動で追加する

**Files:**
- Create: `src/client/src/game/render/cardPresentation.test.ts`
- Create: `src/client/src/game/render/cardPresentation.ts`

**Interfaces:**
- Consumes: `UnitType`、`TeamId` from `src/client/src/game/core/types.ts`
- Produces: `unitCardPresentation: Record<UnitType, CardPresentation>`、`summonedCardPresentation: CardPresentation`、`cardTintForTeam(team: TeamId): number`

- [ ] **Step 1: 失敗する表示設定テストを書く**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { cardTintForTeam, summonedCardPresentation, unitCardPresentation } from "./cardPresentation";

test("ユニット種別を指定された静止カード画像と72px表示へ割り当てる", () => {
  assert.deepEqual(unitCardPresentation.Speed, {
    textureKey: "unit-card-speed",
    path: "/assets/units/blue/blue001.png",
    displayHeight: 72
  });
  assert.deepEqual(unitCardPresentation.Melee, {
    textureKey: "unit-card-melee",
    path: "/assets/units/blue/blue002.png",
    displayHeight: 72
  });
  assert.deepEqual(unitCardPresentation.Ranged, {
    textureKey: "unit-card-ranged",
    path: "/assets/units/blue/blue003.png",
    displayHeight: 72
  });
});

test("召喚獣を指定された静止カード画像と144px表示へ割り当てる", () => {
  assert.deepEqual(summonedCardPresentation, {
    textureKey: "summoned-card",
    path: "/assets/summons/summon01.png",
    displayHeight: 144
  });
});

test("PlayerとCPUに異なるチームtintを返す", () => {
  assert.equal(cardTintForTeam("Player"), 0x7dd3fc);
  assert.equal(cardTintForTeam("Cpu"), 0xfda4af);
});
```

- [ ] **Step 2: テストを実行し、モジュール未作成で失敗することを確認する**

Run: `npm test -- src/game/render/cardPresentation.test.ts`（workdir: `src/client`）

Expected: FAIL。`Cannot find module './cardPresentation'` を含む。

- [ ] **Step 3: 最小限の表示設定を実装する**

```ts
import type { TeamId, UnitType } from "../core/types";

export interface CardPresentation {
  textureKey: string;
  path: string;
  displayHeight: number;
}

export const unitCardPresentation = {
  Speed: {
    textureKey: "unit-card-speed",
    path: "/assets/units/blue/blue001.png",
    displayHeight: 72
  },
  Melee: {
    textureKey: "unit-card-melee",
    path: "/assets/units/blue/blue002.png",
    displayHeight: 72
  },
  Ranged: {
    textureKey: "unit-card-ranged",
    path: "/assets/units/blue/blue003.png",
    displayHeight: 72
  }
} satisfies Record<UnitType, CardPresentation>;

export const summonedCardPresentation: CardPresentation = {
  textureKey: "summoned-card",
  path: "/assets/summons/summon01.png",
  displayHeight: 144
};

export function cardTintForTeam(team: TeamId): number {
  return team === "Player" ? 0x7dd3fc : 0xfda4af;
}
```

- [ ] **Step 4: 対象テストを実行して成功を確認する**

Run: `npm test -- src/game/render/cardPresentation.test.ts`（workdir: `src/client`）

Expected: PASS。3 tests、0 failures。

- [ ] **Step 5: 設定とテストをコミットする**

```powershell
git add -- src/client/src/game/render/cardPresentation.ts src/client/src/game/render/cardPresentation.test.ts
git commit -m "test: カード画像の表示設定を追加"
```

### Task 2: BattleScene を静止カード表示へ変更する

**Files:**
- Modify: `src/client/src/game/scenes/BattleScene.ts`
- Delete: `src/client/src/game/render/unitAnimation.ts`
- Delete: `src/client/src/game/render/unitAnimation.test.ts`
- Add: `src/client/public/assets/summons/summon01.png`
- Add: `src/client/public/assets/units/blue/blue001.png`
- Add: `src/client/public/assets/units/blue/blue002.png`
- Add: `src/client/public/assets/units/blue/blue003.png`

**Interfaces:**
- Consumes: `unitCardPresentation`、`summonedCardPresentation`、`cardTintForTeam(team)` from Task 1
- Produces: `BattleScene` が通常画像を読み込み、縦横比を維持した静止カードとして描画する。

- [ ] **Step 1: 画像ファイルが存在し、PNGとして空でないことを確認する**

Run:

```powershell
Get-ChildItem src/client/public/assets/summons/summon01.png,src/client/public/assets/units/blue/blue001.png,src/client/public/assets/units/blue/blue002.png,src/client/public/assets/units/blue/blue003.png | Select-Object FullName,Length
```

Expected: 4ファイルが表示され、すべての `Length` が 0 より大きい。

- [ ] **Step 2: スプライト設定を静止画像設定へ置換する**

`BattleScene.ts` では `unitAnimation` の import と4つの旧テクスチャ定数・正方形表示サイズ定数を削除し、次を import する。

```ts
import { cardTintForTeam, summonedCardPresentation, unitCardPresentation } from "../render/cardPresentation";
```

Map は次の型へ統合する。

```ts
private unitImages = new Map<string, Phaser.GameObjects.Image>();
private summonedUnitImages = new Map<number, Phaser.GameObjects.Image>();
```

`preload()` の4つの `spritesheet` 読み込みを次へ置換する。

```ts
for (const presentation of Object.values(unitCardPresentation)) {
  this.load.image(presentation.textureKey, presentation.path);
}
this.load.image(summonedCardPresentation.textureKey, summonedCardPresentation.path);
```

`create()` では2つの Map を初期化し、アニメーション作成呼び出しを削除して `createUnitImages()` だけを呼ぶ。

- [ ] **Step 3: 通常ユニットを静止画像として生成・同期する**

3種類別の生成・同期メソッドとアニメーション生成メソッドを削除し、次のメソッドへ置換する。

```ts
private createUnitImages(): void {
  for (const unit of this.session.state.units) {
    const presentation = unitCardPresentation[unit.unitType];
    const image = this.add.image(0, 0, presentation.textureKey);
    const displayWidth = image.width / image.height * presentation.displayHeight;
    image.setDisplaySize(displayWidth, presentation.displayHeight);
    image.setDepth(1);
    image.setTint(cardTintForTeam(unit.team));
    this.unitImages.set(unit.unitId, image);
  }
}

private updateUnitImage(unit: UnitState, screen: Vec2, alpha: number): void {
  const image = this.unitImages.get(unit.unitId);
  if (!image) {
    return;
  }

  image.setPosition(screen.x, screen.y);
  image.setAlpha(alpha);
  image.setTint(cardTintForTeam(unit.team));
}
```

`drawUnits()` では3つの更新呼び出しを `this.updateUnitImage(unit, screen, alpha)` に置換し、フォールバック条件は `!this.unitImages.has(unit.unitId)` に統一する。選択円、建築中表示、HPバーは変更しない。

- [ ] **Step 4: 召喚獣を静止画像として生成・同期する**

```ts
private updateSummonedUnitImage(summoned: SummonedUnitState, screen: Vec2): void {
  let image = this.summonedUnitImages.get(summoned.summonedUnitId);
  if (!image) {
    image = this.add.image(0, 0, summonedCardPresentation.textureKey);
    const displayWidth = image.width / image.height * summonedCardPresentation.displayHeight;
    image.setDisplaySize(displayWidth, summonedCardPresentation.displayHeight);
    image.setDepth(1);
    this.summonedUnitImages.set(summoned.summonedUnitId, image);
  }

  image.setPosition(screen.x, screen.y);
  image.setAlpha(summoned.currentHp > 0 ? 1 : 0.25);
  image.setTint(cardTintForTeam(summoned.team));
}
```

`drawSummonedUnits()` からこのメソッドを呼ぶ。削除同期メソッドも `summonedUnitImages` を参照するよう変更し、ゲーム状態から消えた画像を `destroy()` して Map から削除する。

- [ ] **Step 5: 不要になったアニメーションモジュールと左右反転処理を削除する**

`src/client/src/game/render/unitAnimation.ts` と `unitAnimation.test.ts` を削除する。`BattleScene.ts` に `this.anims`、`.play(`、`.anims`、ユニット・召喚獣に対する `.setFlipX(`、`unitAnimation` import が残っていないことを確認する。

Run:

```powershell
rg -n "unitAnimation|this\.anims|\.play\(|\.anims|spriteFlipXForMovement" src/client/src/game
```

Expected: 対象なし。召喚者の既存 `setFlipX` は対象外なので残してよい。

- [ ] **Step 6: 対象テストと型検査を実行する**

Run: `npm test`（workdir: `src/client`）

Expected: 全テスト PASS、0 failures。

Run: `npm run typecheck`（workdir: `src/client`）

Expected: exit code 0、TypeScript error なし。

- [ ] **Step 7: 実装と画像をコミットする**

```powershell
git add -- src/client/src/game/scenes/BattleScene.ts src/client/src/game/render/unitAnimation.ts src/client/src/game/render/unitAnimation.test.ts src/client/public/assets/summons/summon01.png src/client/public/assets/units/blue/blue001.png src/client/public/assets/units/blue/blue002.png src/client/public/assets/units/blue/blue003.png
git commit -m "feat: ユニットと召喚獣を静止カード画像へ変更"
```

### Task 3: 成果物を最終検証する

**Files:**
- Verify: `src/client/src/game/scenes/BattleScene.ts`
- Verify: `src/client/src/game/render/cardPresentation.ts`
- Verify: `src/client/public/assets/summons/summon01.png`
- Verify: `src/client/public/assets/units/blue/*.png`

**Interfaces:**
- Consumes: Task 1、Task 2 の完成成果物
- Produces: ビルド可能で、仕様との対応が確認されたクライアント成果物

- [ ] **Step 1: クライアントの全テストを再実行する**

Run: `npm test`（workdir: `src/client`）

Expected: 全テスト PASS、0 failures。

- [ ] **Step 2: 本番ビルドを実行する**

Run: `npm run build`（workdir: `src/client`）

Expected: exit code 0。`tsc` と `vite build` が成功する。

- [ ] **Step 3: 仕様との対応と差分品質を確認する**

Run:

```powershell
git diff --check HEAD~2..HEAD
git status --short
```

Expected: `git diff --check` は出力なし。`git status --short` は計画書以外の未コミット変更なし。

確認項目:

- 4つの指定パスが `cardPresentation.ts` に存在する。
- 通常ユニット 72px、召喚獣 144px がテストで固定されている。
- Player / CPU の tint が異なる。
- `BattleScene` のユニット・召喚獣にアニメーションや左右反転が残っていない。
- 戦闘ルール、AI、HUD、召喚者、エレメントには不要な変更がない。

- [ ] **Step 4: 実機表示を確認する**

Run: `npm run dev`（workdir: `src/client`）

ブラウザで、Speed / Melee / Ranged / 召喚獣が縦横比を保った静止カードで表示されること、Player / CPU の tint、選択、移動、攻撃、撃破・復活、召喚獣の生成・消滅を確認する。確認後に開発サーバーを停止する。
