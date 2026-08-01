# 高DPI Canvas対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 論理画面サイズ `644 × 468` と既存の操作感を維持したまま、ブラウザの `devicePixelRatio` に応じて内部Canvasを最大2倍で描画する。

**Architecture:** DPI計算と物理・論理座標変換を純粋関数へ分離し、Phaserには高解像度の物理Canvas寸法を渡す。各シーンは左上原点のカメラ倍率によって従来の論理座標で描画し、独自のPointer判定だけを物理座標から論理座標へ戻す。Textには同じ解像度を指定し、カメラ拡大によるぼけを防ぐ。

**Tech Stack:** TypeScript 5.8、Phaser 3.90、Vite 7、Node.js Test Runner、tsx

## Global Constraints

- 論理画面サイズは `644 × 468` のまま変更しない。
- 描画倍率は `window.devicePixelRatio` に追従し、下限 `1`、上限 `2` とする。
- `devicePixelRatio` が未定義、非有限値、または `1` 未満の場合は倍率 `1` とする。
- 戦闘フィールド、HUD、タイトル画面、画像アセット、ゲームルールの論理寸法を変更しない。
- 既存の `Phaser.Scale.FIT` と `Phaser.Scale.CENTER_BOTH` を維持する。
- 実行中のモニター移動やブラウザ倍率変更への動的追従は対象外とする。

---

## File Structure

- Create: `src/client/src/game/highDpiCanvas.ts`
  - DPI倍率、物理Canvas寸法、物理Pointer座標から論理座標への変換を担当する。
- Create: `src/client/src/game/highDpiCanvas.test.ts`
  - 上限・下限・異常値・Canvas寸法・座標変換を純粋関数として検証する。
- Modify: `src/client/src/main.ts`
  - 起動時のDPI設定をPhaserの物理Canvas寸法へ適用する。
- Modify: `src/client/src/game/scenes/TitleScene.ts`
  - カメラ倍率、論理レイアウト、Text解像度を適用する。
- Modify: `src/client/src/game/scenes/BattleScene.ts`
  - カメラ倍率、論理レイアウト、Pointer座標変換を適用する。
- Modify: `src/client/src/game/ui/battleHud.ts`
  - HUDの中央位置を論理レイアウトから求め、すべてのTextへ描画倍率を渡す。

---

### Task 1: DPI設定と物理Canvas寸法

**Files:**
- Create: `src/client/src/game/highDpiCanvas.ts`
- Create: `src/client/src/game/highDpiCanvas.test.ts`

**Interfaces:**
- Consumes: `gameViewport: Readonly<{ width: 644; height: 468 }>`
- Produces: `normalizeRenderScale(devicePixelRatio: number | undefined): number`
- Produces: `calculateHighDpiCanvas(devicePixelRatio: number | undefined): HighDpiCanvas`
- Produces: `highDpiCanvas: HighDpiCanvas`
- Produces: `HighDpiCanvas = Readonly<{ renderScale: number; width: number; height: number }>`

- [ ] **Step 1: 倍率とCanvas寸法の失敗テストを書く**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateHighDpiCanvas,
  normalizeRenderScale
} from "./highDpiCanvas";

test("端末DPIを1倍から2倍の範囲へ制限する", () => {
  assert.equal(normalizeRenderScale(1), 1);
  assert.equal(normalizeRenderScale(1.5), 1.5);
  assert.equal(normalizeRenderScale(2), 2);
  assert.equal(normalizeRenderScale(3), 2);
});

test("未定義または不正な端末DPIは1倍へ戻す", () => {
  assert.equal(normalizeRenderScale(undefined), 1);
  assert.equal(normalizeRenderScale(Number.NaN), 1);
  assert.equal(normalizeRenderScale(Number.POSITIVE_INFINITY), 1);
  assert.equal(normalizeRenderScale(0.75), 1);
});

test("論理画面を端末DPIに応じた物理Canvas寸法へ変換する", () => {
  assert.deepEqual(calculateHighDpiCanvas(1), {
    renderScale: 1,
    width: 644,
    height: 468
  });
  assert.deepEqual(calculateHighDpiCanvas(1.5), {
    renderScale: 1.5,
    width: 966,
    height: 702
  });
  assert.deepEqual(calculateHighDpiCanvas(3), {
    renderScale: 2,
    width: 1288,
    height: 936
  });
});
```

- [ ] **Step 2: 新しいテストが期待どおり失敗することを確認する**

Run: `npm test -w src/client`

Expected: FAIL。`./highDpiCanvas` が存在しないためモジュール解決エラーになる。

- [ ] **Step 3: DPI設定の最小実装を書く**

```ts
import { gameViewport } from "./gameViewport";

export type HighDpiCanvas = Readonly<{
  renderScale: number;
  width: number;
  height: number;
}>;

const maximumRenderScale = 2;

export function normalizeRenderScale(
  devicePixelRatio: number | undefined
): number {
  if (
    devicePixelRatio === undefined
    || !Number.isFinite(devicePixelRatio)
    || devicePixelRatio < 1
  ) {
    return 1;
  }
  return Math.min(devicePixelRatio, maximumRenderScale);
}

export function calculateHighDpiCanvas(
  devicePixelRatio: number | undefined
): HighDpiCanvas {
  const renderScale = normalizeRenderScale(devicePixelRatio);
  return {
    renderScale,
    width: Math.round(gameViewport.width * renderScale),
    height: Math.round(gameViewport.height * renderScale)
  };
}

export const highDpiCanvas = calculateHighDpiCanvas(
  typeof window === "undefined" ? undefined : window.devicePixelRatio
);
```

- [ ] **Step 4: DPI設定テストが成功することを確認する**

Run: `npm test -w src/client`

Expected: 新規3テストを含む全テストPASS。

- [ ] **Step 5: Task 1をコミットする**

```powershell
git add -- src/client/src/game/highDpiCanvas.ts src/client/src/game/highDpiCanvas.test.ts
git commit -m "feat: 高DPI Canvas設定を追加"
```

---

### Task 2: 物理Canvas設定と論理座標カメラ

**Files:**
- Modify: `src/client/src/game/highDpiCanvas.ts`
- Modify: `src/client/src/game/highDpiCanvas.test.ts`
- Modify: `src/client/src/main.ts`
- Modify: `src/client/src/game/scenes/TitleScene.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**
- Consumes: `highDpiCanvas: HighDpiCanvas`
- Consumes: `gameViewport: Readonly<{ width: 644; height: 468 }>`
- Produces: `toLogicalCanvasPoint(point: Readonly<{ x: number; y: number }>, renderScale: number): { x: number; y: number }`
- Produces: 両シーンのメインカメラ設定 `origin = (0, 0)`、`zoom = highDpiCanvas.renderScale`

- [ ] **Step 1: Pointer座標変換の失敗テストを書く**

`src/client/src/game/highDpiCanvas.test.ts` へ追加する。

```ts
import {
  calculateHighDpiCanvas,
  normalizeRenderScale,
  toLogicalCanvasPoint
} from "./highDpiCanvas";

test("物理Pointer座標を従来の論理座標へ戻す", () => {
  assert.deepEqual(toLogicalCanvasPoint({ x: 128.8, y: 112 }, 2), {
    x: 64.4,
    y: 56
  });
  assert.deepEqual(toLogicalCanvasPoint({ x: 96.6, y: 84 }, 1.5), {
    x: 64.4,
    y: 56
  });
});
```

既存の複数行importを上記へ置き換え、同じ識別子を重複importしない。

- [ ] **Step 2: Pointer座標変換テストが期待どおり失敗することを確認する**

Run: `npm test -w src/client`

Expected: FAIL。`toLogicalCanvasPoint` がexportされていない。

- [ ] **Step 3: Pointer座標変換を実装する**

`src/client/src/game/highDpiCanvas.ts` へ追加する。

```ts
export function toLogicalCanvasPoint(
  point: Readonly<{ x: number; y: number }>,
  renderScale: number
): { x: number; y: number } {
  return {
    x: point.x / renderScale,
    y: point.y / renderScale
  };
}
```

- [ ] **Step 4: Pointer座標変換テストが成功することを確認する**

Run: `npm test -w src/client`

Expected: 新規4テストを含む全テストPASS。

- [ ] **Step 5: Phaser起動設定へ物理Canvas寸法を適用する**

`src/client/src/main.ts` で `highDpiCanvas` をimportし、Phaser設定を次のように変更する。

```ts
import { highDpiCanvas } from "./game/highDpiCanvas";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: highDpiCanvas.width,
  height: highDpiCanvas.height,
  backgroundColor: "#101827",
  scene: [TitleScene, BattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});
```

`gameViewport` の未使用importは削除する。

- [ ] **Step 6: タイトル画面を論理座標カメラへ変更する**

`src/client/src/game/scenes/TitleScene.ts` へ `gameViewport` と `highDpiCanvas` をimportする。`create()` 冒頭を次の形に変更し、既存のオブジェクト配置コードは維持する。

```ts
const { width, height } = gameViewport;
this.cameras.main
  .setOrigin(0, 0)
  .setZoom(highDpiCanvas.renderScale)
  .setBackgroundColor("#101827");
```

- [ ] **Step 7: 戦闘画面を論理座標カメラと論理レイアウトへ変更する**

`src/client/src/game/scenes/BattleScene.ts` へ次をimportする。

```ts
import { gameViewport } from "../gameViewport";
import {
  highDpiCanvas,
  toLogicalCanvasPoint
} from "../highDpiCanvas";
```

`create()` の背景色設定を次へ置き換える。

```ts
this.cameras.main
  .setOrigin(0, 0)
  .setZoom(highDpiCanvas.renderScale)
  .setBackgroundColor("#101827");

const layout = calculateBattleLayout(gameViewport.width, gameViewport.height);
```

`handlePointerDown()` と `handlePointerUp()` の先頭で論理座標を作り、既存の `pointer.x`、`pointer.y` をすべて `point.x`、`point.y` へ置き換える。

```ts
const point = toLogicalCanvasPoint(pointer, highDpiCanvas.renderScale);
```

`fieldBounds()` も論理画面サイズを使う。

```ts
private fieldBounds(): Phaser.Geom.Rectangle {
  const field = calculateBattleLayout(
    gameViewport.width,
    gameViewport.height
  ).field;
  return new Phaser.Geom.Rectangle(field.x, field.y, field.width, field.height);
}
```

- [ ] **Step 8: Task 2のテストと型チェックを実行する**

Run: `npm test -w src/client`

Expected: 新規4テストを含む全テストPASS。

Run: `npm run typecheck -w src/client`

Expected: PASS。TypeScriptエラーなし。

- [ ] **Step 9: Task 2をコミットする**

```powershell
git add -- src/client/src/game/highDpiCanvas.ts src/client/src/game/highDpiCanvas.test.ts src/client/src/main.ts src/client/src/game/scenes/TitleScene.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: Phaserを論理座標のまま高DPI描画する"
```

---

### Task 3: 高DPI TextとHUD中央位置

**Files:**
- Modify: `src/client/src/game/highDpiCanvas.ts`
- Modify: `src/client/src/game/highDpiCanvas.test.ts`
- Modify: `src/client/src/game/scenes/TitleScene.ts`
- Modify: `src/client/src/game/ui/battleHud.ts`

**Interfaces:**
- Consumes: `highDpiCanvas.renderScale: number`
- Consumes: `BattleLayout`
- Produces: `withHighDpiTextResolution<T extends object>(style: T, renderScale?: number): T & { resolution: number }`
- Produces: すべてのPhaser Textへ `resolution: highDpiCanvas.renderScale` を含むTextStyle

- [ ] **Step 1: Text解像度の型検証を先に失敗させる**

`src/client/src/game/highDpiCanvas.test.ts` の `highDpiCanvas` importへ `withHighDpiTextResolution` を追加し、次のテストを書く。

```ts
test("HUD文字は高DPI描画倍率をText解像度へ設定する", () => {
  assert.deepEqual(
    withHighDpiTextResolution(
      { color: "#ffffff", fontSize: "18px" },
      1.5
    ),
    {
      color: "#ffffff",
      fontSize: "18px",
      resolution: 1.5
    }
  );
});
```

- [ ] **Step 2: Text解像度テストが期待どおり失敗することを確認する**

Run: `npm test -w src/client`

Expected: FAIL。`withHighDpiTextResolution` がexportされていない。

- [ ] **Step 3: TextStyleへ解像度を付与する純粋関数を実装する**

`src/client/src/game/highDpiCanvas.ts` へ追加する。

```ts
export function withHighDpiTextResolution<T extends object>(
  style: T,
  renderScale = highDpiCanvas.renderScale
): T & { resolution: number } {
  return {
    ...style,
    resolution: renderScale
  };
}
```

- [ ] **Step 4: HUD TextStyleへ解像度を追加する**

`src/client/src/game/ui/battleHud.ts` へ `gameViewport` と `withHighDpiTextResolution` をimportする。

```ts
import { gameViewport } from "../gameViewport";
import { withHighDpiTextResolution } from "../highDpiCanvas";
```

結果表示の中心座標を物理画面ではなく論理画面から求める。

```ts
this.resultText = scene.add.text(
  gameViewport.width / 2,
  gameViewport.height / 2,
  "",
  titleStyle(48, "#f8fafc")
);
```

`titleStyle` を次へ変更する。

```ts
function titleStyle(
  fontSize: number,
  color: string
): Phaser.Types.GameObjects.Text.TextStyle {
  return withHighDpiTextResolution({
    color,
    fontFamily: "Arial, sans-serif",
    fontSize: `${fontSize}px`
  });
}
```

既存の `titleStyle(...)` 呼び出しはヘルパー経由で高DPI化されるため、個別変更しない。

- [ ] **Step 5: タイトル画面のTextへ解像度を設定する**

`src/client/src/game/scenes/TitleScene.ts` で `withHighDpiTextResolution` をimportし、3つのTextStyleをそれぞれ次の形で包む。

```ts
withHighDpiTextResolution({
  color: "#f8fafc",
  fontFamily: "Arial, sans-serif",
  fontSize: "40px"
})
```

- [ ] **Step 6: Text解像度テストと型チェックを実行する**

Run: `npm test -w src/client`

Expected: 新規5テストを含む全テストPASS。

Run: `npm run typecheck -w src/client`

Expected: PASS。TypeScriptエラーなし。

- [ ] **Step 7: Task 3をコミットする**

```powershell
git add -- src/client/src/game/highDpiCanvas.ts src/client/src/game/highDpiCanvas.test.ts src/client/src/game/scenes/TitleScene.ts src/client/src/game/ui/battleHud.ts
git commit -m "feat: 高DPI環境で文字を鮮明に描画する"
```

---

### Task 4: 回帰検証とブラウザ確認

**Files:**
- Verify: `src/client/src/**/*.test.ts`
- Verify: `src/client/dist/**`

**Interfaces:**
- Consumes: Tasks 1–3の完成状態
- Produces: 自動テスト・型チェック・プロダクションビルド・実ブラウザ確認の結果

- [ ] **Step 1: クライアントテストをすべて実行する**

Run: `npm test -w src/client`

Expected: 全テストPASS。失敗、未処理例外、警告なし。

- [ ] **Step 2: リポジトリ全体の型チェックを実行する**

Run: `npm run typecheck`

Expected: server、clientともにPASS。

- [ ] **Step 3: プロダクションビルドを実行する**

Run: `npm run build`

Expected: server、clientともにPASSし、Viteが `src/client/dist` を生成する。

- [ ] **Step 4: ブラウザで物理寸法と表示・入力を確認する**

Run: `npm run dev:client`

ブラウザのコンソールで次を実行する。

```js
const canvas = document.querySelector("canvas");
({
  devicePixelRatio: window.devicePixelRatio,
  canvasWidth: canvas?.width,
  canvasHeight: canvas?.height,
  cssWidth: canvas?.getBoundingClientRect().width,
  cssHeight: canvas?.getBoundingClientRect().height
});
```

Expected:

- `devicePixelRatio >= 2` の環境では `canvasWidth === 1288`、`canvasHeight === 936`。
- `devicePixelRatio === 1.5` の環境では `canvasWidth === 966`、`canvasHeight === 702`。
- CanvasのCSS表示領域、タイトル要素、戦闘フィールド、HUDは変更前と同じ比率・位置に見える。
- タイトルの開始ボタン、HUDボタン、ユニット選択、フィールドへのドラッグ移動が正しい位置で反応する。

- [ ] **Step 5: 差分と作業ツリーを確認する**

Run: `git diff --check`

Expected: 出力なし。

Run: `git status --short`

Expected: 意図したファイルだけが表示される。Task 1–3で全変更をコミット済みなら出力なし。
