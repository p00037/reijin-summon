# ユニットカード攻撃力表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 味方とCPUの生存中の通常ユニットカード上部中央に、1回あたりの攻撃ダメージを数値で表示する。

**Architecture:** Phaser非依存の `unitCardAttackPowerPresentation` が、カード中心・回転角・カード高・攻撃力からテキストの内容と表示姿勢を計算する。`BattleScene` はユニットIDごとの `Phaser.GameObjects.Text` を管理し、通常カードの位置・回転・透明度・表示状態へ同期する。

**Tech Stack:** TypeScript、Node.js test runner、Phaser 3、npm workspaces

## Global Constraints

- 正式仕様は `docs/superpowers/specs/2026-08-09-unit-card-attack-power-design.md` とする。
- 表示値には `unit.stats.attackDamage` を使い、接頭辞やアイコンを付けない。
- 対象は味方とCPUの生存中の通常ユニットカードだけとする。
- 召喚獣カード、撃破されて控え欄へ移動したカード、画面上部HUDを変更しない。
- 白系文字、黒系縁取り、既存の高DPIテキスト設定を使う。
- production codeを変更する前に対応する失敗テストを実行する。

---

## ファイル構成

- Create: `src/client/src/game/render/unitCardAttackPowerPresentation.ts` — 攻撃力テキストの内容、位置、回転、描画深度を計算する。
- Create: `src/client/src/game/render/unitCardAttackPowerPresentation.test.ts` — 無回転、反転、斜め回転、表示文字列、描画深度を検証する。
- Modify: `src/client/src/game/scenes/BattleScene.ts` — Phaser Textの生成、毎フレーム同期、非表示処理を担当する。

### Task 1: 攻撃力表示の純粋なプレゼンテーション計算を追加する

**Files:**
- Create: `src/client/src/game/render/unitCardAttackPowerPresentation.ts`
- Create: `src/client/src/game/render/unitCardAttackPowerPresentation.test.ts`

**Interfaces:**
- Consumes: `cardCenter: Vec2`、`rotation: number`、`cardHeight: number`、`attackDamage: number`。
- Produces: `unitCardAttackPowerPresentation(cardCenter, rotation, cardHeight, attackDamage): UnitCardAttackPowerPresentation`。
- Produces: `{ text: string; position: Vec2; rotation: number; depth: number }`。

- [ ] **Step 1: 表示内容、上部中央位置、回転追従、描画深度を示す失敗テストを書く**

`unitCardAttackPowerPresentation.test.ts` を作成する。カード上端からテキスト中心までの内側余白は `7px` とするため、高さ92pxのカード中心 `{ x: 100, y: 200 }` では `{ x: 100, y: 161 }` になる。

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { cardImageDepth } from "./cardPresentation";

test("attack power is shown as a number at the top center of the card", async () => {
  const module: Partial<
    typeof import("./unitCardAttackPowerPresentation")
  > = await import("./unitCardAttackPowerPresentation").catch(() => ({}));

  assert.equal(typeof module.unitCardAttackPowerPresentation, "function");

  const presentation = module.unitCardAttackPowerPresentation!(
    { x: 100, y: 200 },
    0,
    92,
    61
  );

  assert.equal(presentation.text, "61");
  assert.deepEqual(presentation.position, { x: 100, y: 161 });
  assert.equal(presentation.rotation, 0);
});

test("attack power position and text rotation follow the card", async () => {
  const module: Partial<
    typeof import("./unitCardAttackPowerPresentation")
  > = await import("./unitCardAttackPowerPresentation").catch(() => ({}));

  assert.equal(typeof module.unitCardAttackPowerPresentation, "function");

  const reversed = module.unitCardAttackPowerPresentation!(
    { x: 100, y: 200 },
    Math.PI,
    92,
    53
  );
  assert.equal(reversed.text, "53");
  assert.ok(Math.abs(reversed.position.x - 100) < 1e-10);
  assert.ok(Math.abs(reversed.position.y - 239) < 1e-10);
  assert.equal(reversed.rotation, Math.PI);

  const diagonal = module.unitCardAttackPowerPresentation!(
    { x: 100, y: 200 },
    Math.PI / 2,
    92,
    36
  );
  assert.deepEqual(
    {
      x: Number(diagonal.position.x.toFixed(10)),
      y: Number(diagonal.position.y.toFixed(10))
    },
    { x: 139, y: 200 }
  );
  assert.equal(diagonal.rotation, Math.PI / 2);
  assert.equal(diagonal.text, "36");
  assert.ok(module.unitCardAttackPowerDepth! > cardImageDepth);
});
```

- [ ] **Step 2: 対象テストを実行して期待どおり失敗することを確認する**

Run: `npm.cmd test -w src/client -- src/game/render/unitCardAttackPowerPresentation.test.ts`

Expected: `unitCardAttackPowerPresentation` が存在しないため、関数型のアサーションでFAIL。

- [ ] **Step 3: 最小限の表示計算を実装する**

`unitCardAttackPowerPresentation.ts` を作成する。

```ts
import type { Vec2 } from "../core/types";
import { battleStatusOverlayDepth } from "./cardPresentation";

export interface UnitCardAttackPowerPresentation {
  text: string;
  position: Vec2;
  rotation: number;
  depth: number;
}

const attackPowerInsetFromTop = 7;
export const unitCardAttackPowerDepth = battleStatusOverlayDepth;

export function unitCardAttackPowerPresentation(
  cardCenter: Vec2,
  rotation: number,
  cardHeight: number,
  attackDamage: number
): UnitCardAttackPowerPresentation {
  const localY = -cardHeight / 2 + attackPowerInsetFromTop;
  const sine = Math.sin(rotation);
  const cosine = Math.cos(rotation);

  return {
    text: String(attackDamage),
    position: {
      x: cardCenter.x - localY * sine,
      y: cardCenter.y + localY * cosine
    },
    rotation,
    depth: unitCardAttackPowerDepth
  };
}
```

- [ ] **Step 4: 表示計算の全テストが通ることを確認する**

Run: `npm.cmd test -w src/client -- src/game/render/unitCardAttackPowerPresentation.test.ts`

Expected: 2件PASS、警告とエラーなし。

- [ ] **Step 5: 表示計算をコミットする**

```bash
git add src/client/src/game/render/unitCardAttackPowerPresentation.ts src/client/src/game/render/unitCardAttackPowerPresentation.test.ts
git commit -m "feat: ユニットカード攻撃力の配置を計算"
```

### Task 2: BattleSceneで攻撃力テキストをカードへ同期する

**Files:**
- Modify: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**
- Consumes: Task 1の `unitCardAttackPowerPresentation(cardCenter, rotation, cardHeight, attackDamage)`。
- Produces: ユニットIDをキーとする `unitAttackPowerLabels: Map<string, Phaser.GameObjects.Text>`。
- Produces: 生存中の通常カードへ同期し、撃破時に隠れる攻撃力テキスト。

- [ ] **Step 1: BattleScene連携前の型チェック基準を確認する**

Run: `npm.cmd run typecheck -w src/client`

Expected: exit 0。Task 1のexportに型エラーがない。

- [ ] **Step 2: プレゼンテーション関数をimportし、テキストMapを追加する**

`BattleScene.ts` へ次を追加する。

```ts
import { unitCardAttackPowerPresentation } from "../render/unitCardAttackPowerPresentation";
```

クラスのカード関連フィールドへMapを追加し、`create()` のリセット処理でも新しいMapへ差し替える。

```ts
private unitAttackPowerLabels = new Map<
  string,
  Phaser.GameObjects.Text
>();
```

- [ ] **Step 3: 通常ユニット画像と同時に攻撃力テキストを生成する**

`createUnitImages()` の通常ユニットループ内で、画像・枠と同時に次のTextを生成する。

```ts
const attackPowerLabel = this.add
  .text(
    0,
    0,
    String(unit.stats.attackDamage),
    withCanvasTextResolution({
      color: "#f8fafc",
      fontFamily: "Arial, sans-serif",
      fontSize: "8px"
    })
  )
  .setOrigin(0.5)
  .setStroke("#020617", 2);

const attackPower = unitCardAttackPowerPresentation(
  { x: 0, y: 0 },
  rotation,
  presentation.displayHeight,
  unit.stats.attackDamage
);
attackPowerLabel
  .setDepth(attackPower.depth)
  .setRotation(attackPower.rotation);
this.unitAttackPowerLabels.set(unit.unitId, attackPowerLabel);
```

召喚獣生成処理にはTextを追加しない。

- [ ] **Step 4: 毎フレーム、攻撃力表示を通常カードへ同期する**

`updateUnitImage()` でカード回転角を確定した後、Mapからラベルを取得して同期する。

```ts
const attackPowerLabel = this.unitAttackPowerLabels.get(unit.unitId);
if (attackPowerLabel) {
  const attackPower = unitCardAttackPowerPresentation(
    screen,
    rotation,
    presentation.displayHeight,
    unit.stats.attackDamage
  );
  attackPowerLabel
    .setText(attackPower.text)
    .setPosition(attackPower.position.x, attackPower.position.y)
    .setRotation(attackPower.rotation)
    .setDepth(attackPower.depth)
    .setAlpha(alpha)
    .setVisible(true);
}
```

- [ ] **Step 5: カードを隠す経路で攻撃力表示も隠す**

`hideUnitImage()` に次を追加する。

```ts
this.unitAttackPowerLabels.get(unitId)?.setVisible(false);
```

`drawDefeatedUnit()` は先に `updateUnitImage()` を通らず、撃破分岐から `hideUnitImage()` または `updateDefeatedUnitImage()` に入る。`updateDefeatedUnitImage()` の冒頭でも控え欄対象のラベルを明示的に隠す。

```ts
this.unitAttackPowerLabels.get(unit.unitId)?.setVisible(false);
```

これにより復活して通常描画へ戻ったときだけ、`updateUnitImage()` が再表示する。

- [ ] **Step 6: 型チェックでPhaser APIと呼び出しを検証する**

Run: `npm.cmd run typecheck -w src/client`

Expected: exit 0。`Text`、`setStroke`、`setRotation`、プレゼンテーション関数の型エラーなし。

- [ ] **Step 7: 関連テストを実行する**

Run: `npm.cmd test -w src/client -- src/game/render/unitCardAttackPowerPresentation.test.ts src/game/render/cardPresentation.test.ts src/game/render/unitCardRenderState.test.ts`

Expected: 対象ファイルの全テストPASS。

- [ ] **Step 8: BattleScene連携をコミットする**

```bash
git add src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: ユニットカードに攻撃力を表示"
```

### Task 3: 全体回帰とproduction buildを検証する

**Files:**
- Verify only: repository working tree

**Interfaces:**
- Consumes: Task 1とTask 2の完成状態。
- Produces: クライアント全テスト、全workspace型チェック、production build、差分健全性の検証証跡。

- [ ] **Step 1: クライアント全テストを実行する**

Run: `npm.cmd test -w src/client`

Expected: 失敗0件、警告とエラーなし。

- [ ] **Step 2: 全workspaceの型チェックを実行する**

Run: `npm.cmd run typecheck`

Expected: exit 0。

- [ ] **Step 3: production buildを実行する**

Run: `npm.cmd run build`

Expected: exit 0。既知のVite chunk size警告以外のエラーなし。

- [ ] **Step 4: 差分の健全性と作業ツリーを確認する**

Run: `git diff --check`

Expected: 出力なし、exit 0。

Run: `git status --short`

Expected: 計画どおりの変更以外がない。
