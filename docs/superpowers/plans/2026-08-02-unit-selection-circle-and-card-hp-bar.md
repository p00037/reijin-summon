# ユニット選択円とカード内HPバー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユニット選択円を論理当たり判定と同じ大きさにし、通常ユニットのHPバーをカード下端内側へ配置してカードと一緒に回転させる。

**Architecture:** 選択円と回転HPバーの座標計算をPhaser非依存の純粋な描画プレゼンテーション関数へ分離する。`BattleScene` は現在の戦場寸法、カード中心、回転角、HP比率を渡し、返された半径または四角形を既存の共通Graphicsへ描画する。

**Tech Stack:** TypeScript、Phaser 3、Node.js built-in test runner、tsx、Vite

## Global Constraints

- 選択中に表示する円は `contactSlowRadius` の `0.54` を画面座標へ変換した半径とする。
- クリックによるユニット取得範囲 `selectionRadiusPx` は変更しない。
- 選択円の線幅3px、色 `0xfacc15`、不透明度1は変更しない。
- 通常ユニット画像のカード上端方向への移動量を4pxから5pxへ変更する。
- 通常ユニット画像とカード枠の表示寸法は変更しない。
- 通常ユニットHPバーは幅40px、高さ5pxのままカード下端内側へ配置し、カードと一緒に回転させる。
- エレメンタル、召喚獣、召喚士、画面上部HUDのHP表示は変更しない。

---

### Task 1: 選択円を論理当たり判定半径から算出する

**Files:**
- Create: `src/client/src/game/render/unitSelectionPresentation.ts`
- Create: `src/client/src/game/render/unitSelectionPresentation.test.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts:424-429`

**Interfaces:**
- Consumes: `contactRadius: number`、`battlefieldScreenWidth: number`、`battlefieldWorldWidth: number`
- Produces: `unitSelectionCirclePresentation(contactRadius, battlefieldScreenWidth, battlefieldWorldWidth): { radius: number; strokeWidth: number; strokeColor: number; strokeAlpha: number }`

- [ ] **Step 1: 画面倍率へ追従する選択円の失敗テストを書く**

`unitSelectionPresentation.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

async function loadSelectionPresentation(): Promise<
  Partial<typeof import("./unitSelectionPresentation")>
> {
  return await import("./unitSelectionPresentation").catch(() => ({}));
}

test("unit selection circle converts the contact radius to screen pixels", async () => {
  const module = await loadSelectionPresentation();
  assert.equal(typeof module.unitSelectionCirclePresentation, "function");
  const presentation = module.unitSelectionCirclePresentation!(
    0.54,
    515.2,
    12.6
  );

  assert.equal(Number(presentation.radius.toFixed(2)), 22.08);
  assert.equal(presentation.strokeWidth, 3);
  assert.equal(presentation.strokeColor, 0xfacc15);
  assert.equal(presentation.strokeAlpha, 1);
});

test("unit selection circle scales with the rendered battlefield width", async () => {
  const module = await loadSelectionPresentation();
  assert.equal(typeof module.unitSelectionCirclePresentation, "function");
  const presentation = module.unitSelectionCirclePresentation!(
    0.54,
    1030.4,
    12.6
  );

  assert.equal(Number(presentation.radius.toFixed(2)), 44.16);
});
```

- [ ] **Step 2: 新規モジュールが存在せず失敗することを確認する**

Run:

```powershell
node --import tsx --test src/game/render/unitSelectionPresentation.test.ts
```

Working directory: `src/client`

Expected: 例外ではなく、`actual: "undefined"` と `expected: "function"` のアサーションでFAILする。

- [ ] **Step 3: 選択円プレゼンテーションを最小実装する**

`unitSelectionPresentation.ts`:

```ts
export interface UnitSelectionCirclePresentation {
  radius: number;
  strokeWidth: number;
  strokeColor: number;
  strokeAlpha: number;
}

export function unitSelectionCirclePresentation(
  contactRadius: number,
  battlefieldScreenWidth: number,
  battlefieldWorldWidth: number
): UnitSelectionCirclePresentation {
  return {
    radius: Math.abs(
      contactRadius * battlefieldScreenWidth / battlefieldWorldWidth
    ),
    strokeWidth: 3,
    strokeColor: 0xfacc15,
    strokeAlpha: 1
  };
}
```

- [ ] **Step 4: `BattleScene` の固定半径をプレゼンテーション利用へ置き換える**

インポートを追加する。

```ts
import { unitSelectionCirclePresentation } from "../render/unitSelectionPresentation";
```

選択中の描画を次へ変更する。

```ts
if (isSelected) {
  const bounds = this.fieldBounds();
  const { battlefieldMin, battlefieldMax, contactSlowRadius } =
    this.session.config;
  const presentation = unitSelectionCirclePresentation(
    contactSlowRadius,
    bounds.width,
    battlefieldMax.x - battlefieldMin.x
  );
  this.battlefieldOverlay.lineStyle(
    presentation.strokeWidth,
    presentation.strokeColor,
    presentation.strokeAlpha
  );
  this.battlefieldOverlay.strokeCircle(
    screen.x,
    screen.y,
    presentation.radius
  );
}
```

固定値 `24` だけを廃止し、クリック取得用の `selectionRadiusPx` は維持する。

- [ ] **Step 5: 対象テストとクライアント全テストを実行する**

Run:

```powershell
node --import tsx --test src/game/render/unitSelectionPresentation.test.ts
npm.cmd run test -w src/client
```

Expected: 対象2件とクライアント全テストがPASSする。

- [ ] **Step 6: Task 1をコミットする**

```powershell
git add src/client/src/game/render/unitSelectionPresentation.ts src/client/src/game/render/unitSelectionPresentation.test.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: 選択円を当たり判定半径へ合わせる"
```

### Task 2: 通常ユニットHPバーをカード下端内側へ回転配置する

**Files:**
- Modify: `src/client/src/game/render/cardPresentation.test.ts:93-106`
- Modify: `src/client/src/game/render/hpBarPresentation.ts`
- Modify: `src/client/src/game/render/hpBarPresentation.test.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts:416-445, 548, 637-655`

**Interfaces:**
- Consumes: `cardCenter: Vec2`、`rotation: number`、`ratio: number`
- Produces: `unitCardHpBarPresentation(cardCenter, rotation, ratio): { background: Vec2[]; fill: Vec2[] }`
- Preserves: `battlefieldHpBarLayout(kind, screen)` for `"Leader" | "Elemental" | "SummonedUnit"`

- [ ] **Step 1: 画像の5px上移動と回転HPバーの失敗テストを書く**

`cardPresentation.test.ts` で通常ユニット用オフセットAPIと画像位置を検証する。既存の静的インポートには未実装名を追加せず、テスト内でモジュールを読み込む。

```ts
test("unit card image uses the five pixel top offset", async () => {
  const presentation = await import("./cardPresentation");
  assert.equal(typeof presentation.unitCardImageTopOffset, "number");
  assert.equal(presentation.unitCardImageTopOffset, 5);

  assert.deepEqual(cardImageCenterAt({ x: 100, y: 200 }, 0, 10), {
    x: 100,
    y: 210
  });
  assert.deepEqual(cardImageCenterAt(
    { x: 100, y: 200 },
    0,
    10,
    presentation.unitCardImageTopOffset!
  ), {
    x: 100,
    y: 205
  });

  const reversed = cardImageCenterAt(
    { x: 100, y: 200 },
    Math.PI,
    10,
    presentation.unitCardImageTopOffset!
  );
  assert.ok(Math.abs(reversed.x - 100) < 1e-10);
  assert.ok(Math.abs(reversed.y - 195) < 1e-10);
});
```

`hpBarPresentation.test.ts` の通常ユニット用画面水平レイアウト期待を削除し、テスト内の動的インポートで回転HPバーAPIと四角形を検証する。

```ts
import { battlefieldHpBarLayout } from "./hpBarPresentation";

test("unit card HP bar occupies the inner bottom strip", async () => {
  const module = await import("./hpBarPresentation");
  assert.equal(typeof module.unitCardHpBarPresentation, "function");
  const presentation = module.unitCardHpBarPresentation!(
    { x: 100, y: 200 },
    0,
    0.5
  );

  assert.deepEqual(presentation.background, [
    { x: 80, y: 239 },
    { x: 120, y: 239 },
    { x: 120, y: 244 },
    { x: 80, y: 244 }
  ]);
  assert.deepEqual(presentation.fill, [
    { x: 80, y: 239 },
    { x: 100, y: 239 },
    { x: 100, y: 244 },
    { x: 80, y: 244 }
  ]);
});

test("unit card HP bar rotates with the card", async () => {
  const module = await import("./hpBarPresentation");
  assert.equal(typeof module.unitCardHpBarPresentation, "function");
  const presentation = module.unitCardHpBarPresentation!(
    { x: 100, y: 200 },
    Math.PI / 2,
    1
  );
  const rounded = presentation.background.map((point) => ({
    x: Number(point.x.toFixed(10)),
    y: Number(point.y.toFixed(10))
  }));

  assert.deepEqual(rounded, [
    { x: 61, y: 180 },
    { x: 61, y: 220 },
    { x: 56, y: 220 },
    { x: 56, y: 180 }
  ]);
});

test("unit card HP fill ratio is clamped", async () => {
  const module = await import("./hpBarPresentation");
  assert.equal(typeof module.unitCardHpBarPresentation, "function");
  const empty = module.unitCardHpBarPresentation!({ x: 0, y: 0 }, 0, -1);
  const full = module.unitCardHpBarPresentation!({ x: 0, y: 0 }, 0, 2);

  assert.equal(empty.fill[1].x - empty.fill[0].x, 0);
  assert.equal(full.fill[1].x - full.fill[0].x, 40);
});
```

既存の対象別テストは次の3種だけを検証する。

```ts
assert.deepEqual(battlefieldHpBarLayout("Elemental", screen), {
  x: 82,
  y: 218,
  width: 36
});
assert.deepEqual(battlefieldHpBarLayout("SummonedUnit", screen), {
  x: 72,
  y: 234,
  width: 56
});
assert.equal(battlefieldHpBarLayout("Leader", screen), null);
```

- [ ] **Step 2: 期待値変更と未実装APIで失敗することを確認する**

Run:

```powershell
node --import tsx --test src/game/render/cardPresentation.test.ts src/game/render/hpBarPresentation.test.ts
```

Working directory: `src/client`

Expected: `unitCardImageTopOffset` と `unitCardHpBarPresentation` が未定義のため、型確認アサーションでFAILする。

- [ ] **Step 3: 画像オフセット定数と回転HPバーの純粋な座標計算を実装する**

`cardPresentation.ts` に通常ユニット専用の値を追加する。

```ts
export const unitCardImageTopOffset = 5;
```

`hpBarPresentation.ts` から `"Unit"` を画面水平HPバー種別から外し、回転矩形を追加する。

```ts
import type { Vec2 } from "../core/types";
import {
  cardBorderWidth,
  unitCardPresentation
} from "./cardPresentation";

export type BattlefieldHpBarKind =
  | "Leader"
  | "Elemental"
  | "SummonedUnit";

export interface UnitCardHpBarPresentation {
  background: Vec2[];
  fill: Vec2[];
}

const unitHpBarWidth = 40;
const unitHpBarHeight = 5;

export function unitCardHpBarPresentation(
  cardCenter: Vec2,
  rotation: number,
  ratio: number
): UnitCardHpBarPresentation {
  const localLeft = -unitHpBarWidth / 2;
  const localTop =
    unitCardPresentation.Melee.displayHeight / 2 -
    cardBorderWidth -
    unitHpBarHeight;
  const clampedRatio = Math.min(1, Math.max(0, ratio));

  return {
    background: rotatedRectangle(
      cardCenter,
      rotation,
      localLeft,
      localTop,
      unitHpBarWidth,
      unitHpBarHeight
    ),
    fill: rotatedRectangle(
      cardCenter,
      rotation,
      localLeft,
      localTop,
      unitHpBarWidth * clampedRatio,
      unitHpBarHeight
    )
  };
}

function rotatedRectangle(
  center: Vec2,
  rotation: number,
  x: number,
  y: number,
  width: number,
  height: number
): Vec2[] {
  return [
    rotateLocalPoint(center, rotation, x, y),
    rotateLocalPoint(center, rotation, x + width, y),
    rotateLocalPoint(center, rotation, x + width, y + height),
    rotateLocalPoint(center, rotation, x, y + height)
  ];
}

function rotateLocalPoint(
  center: Vec2,
  rotation: number,
  x: number,
  y: number
): Vec2 {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return {
    x: center.x + x * cosine - y * sine,
    y: center.y + x * sine + y * cosine
  };
}
```

- [ ] **Step 4: `BattleScene` を回転HPバーの描画へ接続する**

`unitCardHpBarPresentation` をインポートする。

`unitCardImageTopOffset` も `cardPresentation.ts` からインポートする。

通常ユニット画像の呼び出しを5pxへ変更する。

```ts
const imageCenter = cardImageCenterAt(
  screen,
  rotation,
  imageLayout.offsetY,
  unitCardImageTopOffset
);
```

`drawUnits` では通常ユニット用の画面水平HPバーを廃止し、現在のカード回転角を渡す。

```ts
const rotation =
  this.unitCardRotations.get(unit.unitId) ??
  initialCardRotation(unit.team);
this.drawUnitCardHpBar(
  screen,
  rotation,
  unit.currentHp / unit.stats.maxHp,
  color
);
```

描画ヘルパーを追加する。

```ts
private drawUnitCardHpBar(
  screen: Vec2,
  rotation: number,
  ratio: number,
  color: number
): void {
  const presentation = unitCardHpBarPresentation(screen, rotation, ratio);
  this.battlefieldOverlay.fillStyle(0x020617, 0.9);
  this.battlefieldOverlay.fillPoints(presentation.background, true);
  this.battlefieldOverlay.fillStyle(color, 1);
  this.battlefieldOverlay.fillPoints(presentation.fill, true);
}
```

エレメンタルと召喚獣は既存の `drawBattlefieldHpBar` と `drawHpBar` を維持する。召喚士は `battlefieldHpBarLayout("Leader", ...)` が `null` のため引き続き非表示とする。

- [ ] **Step 5: 対象テストとクライアント全テストを実行する**

Run:

```powershell
node --import tsx --test src/game/render/cardPresentation.test.ts src/game/render/hpBarPresentation.test.ts
npm.cmd run test -w src/client
```

Expected: 回転0、90度、比率境界を含む対象テストとクライアント全テストがPASSする。

- [ ] **Step 6: 型チェックとproduction buildを実行する**

Run:

```powershell
npm.cmd run typecheck -w src/client
npm.cmd run build -w src/client
```

Expected: 型エラー0件、production buildがexit code 0で完了する。既存のVite chunk size warningは許容する。

- [ ] **Step 7: Task 2をコミットする**

```powershell
git add src/client/src/game/render/cardPresentation.test.ts src/client/src/game/render/hpBarPresentation.ts src/client/src/game/render/hpBarPresentation.test.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: ユニットHPバーをカード内へ配置"
```

### Task 3: 最終回帰検証を行う

**Files:**
- Verify: `src/client/src/game/render`
- Verify: `src/client/src/game/scenes/BattleScene.ts`
- Verify: `docs/superpowers/specs/2026-08-02-unit-selection-circle-and-card-hp-bar-design.md`

**Interfaces:**
- Consumes: Task 1〜2の全変更
- Produces: 型チェック、全テスト、production build、差分確認の結果

- [ ] **Step 1: 設計要件を実装開始点からの差分と照合する**

Run:

```powershell
git diff --check ee2b832..HEAD
git diff --stat ee2b832..HEAD
```

Expected: 選択円の論理半径変換、画像5px上移動、回転HPバーだけが変更され、対象外表示の変更がない。

- [ ] **Step 2: クライアントの完全検証を新しく実行する**

Run:

```powershell
npm.cmd run typecheck -w src/client
npm.cmd run test -w src/client
npm.cmd run build -w src/client
```

Expected: すべてexit code 0で、テスト失敗・型エラー・ビルドエラーがない。既存のVite chunk size warningは許容する。

- [ ] **Step 3: 作業ツリーとコミット履歴を確認する**

Run:

```powershell
git status --short
git log -5 --oneline
```

Expected: 意図しない未コミット変更がなく、設計・実装計画・Task 1・Task 2のコミットが確認できる。
