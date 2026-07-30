# 戦闘画面キャンバス・HUD余白縮小 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 戦闘フィールドと右側ボタンを原寸のまま維持し、ゲーム画面を644×468pxへ縮小してHPバーと召喚ゲージ周辺の余白を整える。

**Architecture:** 基準画面サイズを専用定数へ切り出し、Phaser設定とレイアウトテストで共有する。`calculateBattleLayout` は基準画面上でフィールド、ボタン、HPバー、召喚ゲージ、下部HUDを明示的な関係から配置し、既存の描画処理と入力判定には変更を加えない。

**Tech Stack:** TypeScript 5.8、Phaser 3.90、Node.js Test Runner、tsx、Vite

## Global Constraints

- 設計書、計画書、調査メモなどの資料は日本語で記述する。
- Phaserゲーム画面の基準サイズは `644 × 468px` とする。
- 戦闘フィールドは `515.2 × 368px`、右側ボタンは `52 × 52px` のまま維持する。
- 戦闘フィールドから画面左右端までの距離はそれぞれ `64.4px` とする。
- 召喚ゲージは `360 × 28px` のまま維持し、画面下端との間隔を `8px` とする。
- 左右HPバーは同じ幅にし、敵HPバー右端を右側ボタン列の右端以内に収める。
- ゲームルール、操作方法、ゲージ値の更新処理は変更しない。
- 新しい依存パッケージは追加しない。

---

## ファイル構成

- `src/client/src/game/gameViewport.ts`
  - Phaserゲーム画面の基準幅と基準高さだけを公開する。
- `src/client/src/main.ts`
  - `gameViewport` をPhaser設定の `width` と `height` に使用する。
- `src/client/src/game/ui/battleLayout.ts`
  - 基準画面内の戦闘HUD矩形と入力範囲を計算する。
- `src/client/src/game/ui/battleLayout.test.ts`
  - 基準画面サイズ、各矩形の座標、原寸維持、余白、整列、入力範囲を検証する。

### Task 1: 基準画面と戦闘HUDを余白のない配置へ変更する

**Files:**
- Create: `src/client/src/game/gameViewport.ts`
- Modify: `src/client/src/main.ts:1-17`
- Modify: `src/client/src/game/ui/battleLayout.ts:20-92`
- Test: `src/client/src/game/ui/battleLayout.test.ts`

**Interfaces:**
- Produces: `gameViewport: Readonly<{ width: 644; height: 468 }>`
- Consumes: `calculateBattleLayout(width: number, height: number): BattleLayout`
- Preserves: `isPointInHud(layout: BattleLayout, x: number, y: number): boolean`

- [ ] **Step 1: 基準画面と新しい矩形を表す失敗テストを書く**

`src/client/src/game/ui/battleLayout.test.ts` の960×540前提を削除し、基準画面と期待矩形を次の内容で検証する。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { gameViewport } from "../gameViewport";
import { calculateBattleLayout, isPointInHud } from "./battleLayout";

test("ゲーム画面の基準サイズを644x468にする", () => {
  assert.deepEqual(gameViewport, { width: 644, height: 468 });
});

test("644x468でフィールドを原寸のまま中央配置する", () => {
  const layout = calculateBattleLayout(gameViewport.width, gameViewport.height);

  assert.deepEqual(layout.topBar, { x: 0, y: 0, width: 644, height: 48 });
  assert.deepEqual(layout.field, { x: 64.4, y: 56, width: 515.2, height: 368 });
  assert.deepEqual(layout.bottomBar, { x: 0, y: 424, width: 644, height: 44 });
  assert.deepEqual(layout.playerHp, { x: 4, y: 10, width: 292, height: 28 });
  assert.deepEqual(layout.cpuHp, { x: 348, y: 10, width: 292, height: 28 });
  assert.deepEqual(layout.summonGauge, { x: 142, y: 432, width: 360, height: 28 });
  assert.deepEqual(layout.buildButton, { x: 591.6, y: 252, width: 52, height: 52 });
  assert.deepEqual(layout.summonButton, { x: 591.6, y: 312, width: 52, height: 52 });
  assert.deepEqual(layout.retryButton, { x: 591.6, y: 372, width: 52, height: 52 });
});

test("フィールドとボタンを原寸で保ち、余白とHUDを整列する", () => {
  const layout = calculateBattleLayout(gameViewport.width, gameViewport.height);
  const fieldRight = layout.field.x + layout.field.width;
  const fieldBottom = layout.field.y + layout.field.height;
  const buttonRight = layout.retryButton.x + layout.retryButton.width;
  const cpuHpRight = layout.cpuHp.x + layout.cpuHp.width;
  const hpCenterGap = layout.cpuHp.x - (layout.playerHp.x + layout.playerHp.width);
  const gaugeBottomGap =
    gameViewport.height - (layout.summonGauge.y + layout.summonGauge.height);

  assert.equal(layout.field.width, 515.2);
  assert.equal(layout.field.height, 368);
  assert.equal(layout.field.x, gameViewport.width - fieldRight);
  assert.equal(layout.buildButton.width, 52);
  assert.equal(layout.buildButton.height, 52);
  assert.equal(layout.buildButton.x, fieldRight + 12);
  assert.equal(layout.retryButton.y + layout.retryButton.height, fieldBottom);
  assert.equal(layout.playerHp.width, layout.cpuHp.width);
  assert.ok(cpuHpRight <= buttonRight);
  assert.equal(hpCenterGap, 52);
  assert.equal(gaugeBottomGap, 8);
  assert.equal(layout.bottomBar.y, fieldBottom);
});

test("バーとボタンだけをHUD入力範囲として返す", () => {
  const layout = calculateBattleLayout(gameViewport.width, gameViewport.height);

  assert.equal(isPointInHud(layout, 10, 10), true);
  assert.equal(isPointInHud(layout, 10, 467), true);
  assert.equal(isPointInHud(layout, 600, 252), true);
  assert.equal(
    isPointInHud(
      layout,
      layout.summonGauge.x + layout.summonGauge.width / 2,
      layout.summonGauge.y + layout.summonGauge.height / 2
    ),
    true
  );
  assert.equal(isPointInHud(layout, layout.field.x + 10, layout.field.y + 10), false);
  assert.equal(isPointInHud(layout, 20, 250), false);
});
```

- [ ] **Step 2: 対象テストを実行して失敗を確認する**

Run:

```powershell
npm.cmd test -w src/client
```

Expected: `gameViewport` が存在しないためコンパイルまたはモジュール解決でFAILする。

- [ ] **Step 3: 基準画面サイズの共有定数を実装する**

`src/client/src/game/gameViewport.ts` を作成する。

```ts
export const gameViewport = {
  width: 644,
  height: 468
} as const;
```

`src/client/src/main.ts` で定数を読み込み、数値リテラルを置き換える。

```ts
import { gameViewport } from "./game/gameViewport";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: gameViewport.width,
  height: gameViewport.height,
  backgroundColor: "#101827",
  scene: [TitleScene, BattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});
```

- [ ] **Step 4: 戦闘フィールド、HP、ゲージ、下部HUDの新しい配置を実装する**

`src/client/src/game/ui/battleLayout.ts` の旧画面余白計算を、次の定数と計算へ置き換える。`BattleLayout`、`isPointInHud`、`containsPoint` の公開・内部インターフェースは維持する。

```ts
const topBarHeight = 48;
const fieldTopGap = 8;
const fieldWidth = 515.2;
const fieldHeight = 368;
const buttonSize = 52;
const buttonGap = 8;
const buttonFieldGap = 12;
const hpBarOuterInset = 4;
const remainingTimeWidth = 52;
const hpBarHeight = 28;
const hpBarTopInset = 10;
const summonGaugeWidth = 360;
const summonGaugeHeight = 28;
const summonGaugeFieldGap = 8;

export function calculateBattleLayout(width: number, height: number): BattleLayout {
  const field: UiRect = {
    x: roundToTenth((width - fieldWidth) / 2),
    y: topBarHeight + fieldTopGap,
    width: fieldWidth,
    height: fieldHeight
  };
  const fieldBottom = roundToTenth(field.y + field.height);
  const buttonX = roundToTenth(field.x + field.width + buttonFieldGap);
  const retryY = roundToTenth(fieldBottom - buttonSize);
  const hpBarWidth = roundToTenth(
    (width - hpBarOuterInset * 2 - remainingTimeWidth) / 2
  );
  const playerHp: UiRect = {
    x: hpBarOuterInset,
    y: hpBarTopInset,
    width: hpBarWidth,
    height: hpBarHeight
  };
  const cpuHp: UiRect = {
    x: roundToTenth(width - hpBarOuterInset - hpBarWidth),
    y: hpBarTopInset,
    width: hpBarWidth,
    height: hpBarHeight
  };
  const summonGauge: UiRect = {
    x: roundToTenth((width - summonGaugeWidth) / 2),
    y: roundToTenth(fieldBottom + summonGaugeFieldGap),
    width: summonGaugeWidth,
    height: summonGaugeHeight
  };

  return {
    topBar: { x: 0, y: 0, width, height: topBarHeight },
    field,
    bottomBar: {
      x: 0,
      y: fieldBottom,
      width,
      height: roundToTenth(height - fieldBottom)
    },
    playerHp,
    cpuHp,
    summonGauge,
    buildButton: {
      x: buttonX,
      y: retryY - (buttonSize + buttonGap) * 2,
      width: buttonSize,
      height: buttonSize
    },
    summonButton: {
      x: buttonX,
      y: retryY - buttonSize - buttonGap,
      width: buttonSize,
      height: buttonSize
    },
    retryButton: { x: buttonX, y: retryY, width: buttonSize, height: buttonSize }
  };
}
```

- [ ] **Step 5: 対象テストを再実行して成功を確認する**

Run:

```powershell
npm.cmd test -w src/client
```

Expected: 新しい4テストを含むクライアントテストがすべてPASSする。

- [ ] **Step 6: クライアント全体の回帰テストとビルドを実行する**

Run:

```powershell
npm.cmd test -w src/client
npm.cmd run typecheck -w src/client
npm.cmd run build -w src/client
```

Expected: 全テスト、型検査、Viteビルドがすべてexit code 0で完了する。

- [ ] **Step 7: 実画面でレイアウトを確認する**

Run:

```powershell
npm.cmd run dev:client
```

ブラウザで `http://localhost:5173` を開き、タイトル画面から戦闘画面へ遷移して次を確認する。

- 戦闘フィールドと右側ボタンの見た目の大きさが変更前と同等である
- 戦闘フィールドの左右余白が等しく見える
- HPバーの文字が切れず、左右が同じ幅である
- 敵HPバー右端が右側ボタン列より右へ張り出していない
- 残り時間が左右HPバーと重ならない
- 召喚ゲージ下に約8pxの余白がある
- 下部HUD背景が戦闘フィールドへ重ならない
- 生成、召喚、Retry、フィールド上のドラッグ操作が動作する

- [ ] **Step 8: 変更をコミットする**

```powershell
git add -- src/client/src/game/gameViewport.ts src/client/src/main.ts src/client/src/game/ui/battleLayout.ts src/client/src/game/ui/battleLayout.test.ts
git commit -m "fix: 戦闘画面の余白とHUD配置を調整"
```
