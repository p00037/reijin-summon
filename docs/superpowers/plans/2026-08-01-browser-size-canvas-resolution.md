# ブラウザサイズ連動Canvas解像度 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 端末DPIではなくページ読込時のブラウザ表示領域から内部Canvas解像度を1〜2倍で決定し、論理ゲームサイズ644×468を保ったまま描画を高精細化する。

**Architecture:** `browserSizeCanvas.ts` をブラウザサイズから描画倍率と物理解像度を計算する唯一の責務にし、Phaser設定・カメラ・ポインター・テキストが同じ `renderScale` を参照する。倍率は `min(innerWidth / 644, innerHeight / 468)` を1〜2に制限し、モジュール初期化時に一度だけ計算するため、ブラウザのリサイズでは変更せず再読込時に再計算する。

**Tech Stack:** TypeScript 5、Phaser 3.90、Node.js test runner、tsx、Vite

## Global Constraints

- 論理ゲームサイズは幅644px、高さ468pxから変更しない。
- `window.devicePixelRatio` は使用しない。
- 描画倍率は `min(window.innerWidth / 644, window.innerHeight / 468)` とし、最小1、最大2に制限する。
- 幅または高さが未定義、非有限値、0以下の場合は描画倍率1へフォールバックする。
- 物理Canvasサイズは論理サイズと描画倍率の積を `Math.round` して求める。
- Phaserのスケールモードは既存の `Phaser.Scale.FIT` と `Phaser.Scale.CENTER_BOTH` を維持する。
- カメラ、ポインター座標、テキスト解像度には同一の描画倍率を使用する。
- 描画倍率はページ読込時に一度だけ計算し、ブラウザのリサイズ中は変更しない。変更の反映にはページ再読込を必要とする。
- `highDpi`、`HighDpi`、`devicePixelRatio` という旧方式の識別子を残さない。
- 新しい外部依存関係は追加しない。

---

## File Structure

- Create: `src/client/src/game/browserSizeCanvas.ts`
  - ブラウザ表示領域から描画倍率と物理Canvasサイズを計算し、座標変換とテキスト解像度付与を提供する。
- Create: `src/client/src/game/browserSizeCanvas.test.ts`
  - 境界値、異常値、代表的なブラウザサイズ、座標変換、テキスト解像度を検証する。
- Delete: `src/client/src/game/highDpiCanvas.ts`
  - DPI基準の旧計算を削除する。
- Delete: `src/client/src/game/highDpiCanvas.test.ts`
  - DPI基準の旧テストをブラウザサイズ基準のテストへ置き換える。
- Modify: `src/client/src/main.ts`
  - Phaserの物理Canvasサイズを `browserSizeCanvas` から取得する。
- Modify: `src/client/src/game/scenes/TitleScene.ts`
  - カメラ倍率とテキスト解像度をブラウザサイズ基準のAPIへ切り替える。
- Modify: `src/client/src/game/scenes/BattleScene.ts`
  - カメラ倍率とポインター座標変換をブラウザサイズ基準のAPIへ切り替える。
- Modify: `src/client/src/game/ui/battleHud.ts`
  - HUDテキスト解像度をブラウザサイズ基準のAPIへ切り替える。

### Task 1: ブラウザサイズ基準のCanvas解像度へ置き換える

**Files:**
- Create: `src/client/src/game/browserSizeCanvas.ts`
- Create: `src/client/src/game/browserSizeCanvas.test.ts`
- Delete: `src/client/src/game/highDpiCanvas.ts`
- Delete: `src/client/src/game/highDpiCanvas.test.ts`
- Modify: `src/client/src/main.ts`
- Modify: `src/client/src/game/scenes/TitleScene.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts`
- Modify: `src/client/src/game/ui/battleHud.ts`

**Interfaces:**
- Consumes: `gameViewport: { readonly width: 644; readonly height: 468 }` from `src/client/src/game/gameViewport.ts`
- Produces: `calculateBrowserRenderScale(viewportWidth: number | undefined, viewportHeight: number | undefined): number`
- Produces: `calculateBrowserSizeCanvas(viewportWidth: number | undefined, viewportHeight: number | undefined): BrowserSizeCanvas`
- Produces: `toLogicalCanvasPoint(point: Readonly<{ x: number; y: number }>, renderScale: number): { x: number; y: number }`
- Produces: `withCanvasTextResolution<T extends object>(style: T, renderScale?: number): T & { resolution: number }`
- Produces: `browserSizeCanvas: BrowserSizeCanvas`

- [ ] **Step 1: ブラウザサイズ基準の失敗テストを書く**

`src/client/src/game/highDpiCanvas.test.ts` を `src/client/src/game/browserSizeCanvas.test.ts` に移動し、内容を次へ置き換える。実装ファイルはまだ作らない。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBrowserRenderScale,
  calculateBrowserSizeCanvas,
  toLogicalCanvasPoint,
  withCanvasTextResolution
} from "./browserSizeCanvas";

test("calculates the render scale from the browser viewport", () => {
  assert.equal(calculateBrowserRenderScale(644, 468), 1);
  assert.equal(calculateBrowserRenderScale(1280, 720), 720 / 468);
  assert.equal(calculateBrowserRenderScale(1920, 1080), 2);
});

test("clamps browser viewports smaller than the logical viewport to one", () => {
  assert.equal(calculateBrowserRenderScale(320, 240), 1);
  assert.equal(calculateBrowserRenderScale(643, 468), 1);
});

test("uses a render scale of one for invalid browser viewport dimensions", () => {
  const invalidDimensions: ReadonlyArray<
    readonly [number | undefined, number | undefined]
  > = [
    [undefined, 468],
    [644, undefined],
    [Number.NaN, 468],
    [644, Number.NaN],
    [Number.POSITIVE_INFINITY, 468],
    [644, Number.POSITIVE_INFINITY],
    [0, 468],
    [644, 0],
    [-1, 468],
    [644, -1]
  ];

  for (const [width, height] of invalidDimensions) {
    assert.equal(calculateBrowserRenderScale(width, height), 1);
  }
});

test("calculates rounded physical canvas dimensions", () => {
  assert.deepEqual(calculateBrowserSizeCanvas(644, 468), {
    renderScale: 1,
    width: 644,
    height: 468
  });
  assert.deepEqual(calculateBrowserSizeCanvas(1280, 720), {
    renderScale: 720 / 468,
    width: 991,
    height: 720
  });
  assert.deepEqual(calculateBrowserSizeCanvas(1920, 1080), {
    renderScale: 2,
    width: 1288,
    height: 936
  });
});

test("converts physical pointer coordinates to logical canvas coordinates", () => {
  assert.deepEqual(toLogicalCanvasPoint({ x: 128.8, y: 112 }, 2), {
    x: 64.4,
    y: 56
  });
  const point = toLogicalCanvasPoint({ x: 96.6, y: 84 }, 1.5);
  assert.ok(Math.abs(point.x - 64.4) < 1e-10);
  assert.ok(Math.abs(point.y - 56) < 1e-10);
});

test("adds the browser-size render scale to text styles", () => {
  assert.deepEqual(
    withCanvasTextResolution(
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

- [ ] **Step 2: 新しいテストが意図した理由で失敗することを確認する**

Run:

```powershell
npm.cmd test -w src/client -- --test-name-pattern="browser viewport|physical canvas"
```

Expected: FAIL。`browserSizeCanvas` モジュールが存在しないというエラーが表示される。

- [ ] **Step 3: ブラウザサイズからCanvas解像度を計算する最小実装を書く**

`src/client/src/game/browserSizeCanvas.ts` を次の内容で作成する。

```ts
import { gameViewport } from "./gameViewport";

export type BrowserSizeCanvas = Readonly<{
  renderScale: number;
  width: number;
  height: number;
}>;

const minimumRenderScale = 1;
const maximumRenderScale = 2;

export function calculateBrowserRenderScale(
  viewportWidth: number | undefined,
  viewportHeight: number | undefined
): number {
  if (
    viewportWidth === undefined
    || viewportHeight === undefined
    || !Number.isFinite(viewportWidth)
    || !Number.isFinite(viewportHeight)
    || viewportWidth <= 0
    || viewportHeight <= 0
  ) {
    return minimumRenderScale;
  }

  const renderScale = Math.min(
    viewportWidth / gameViewport.width,
    viewportHeight / gameViewport.height
  );
  return Math.min(
    Math.max(renderScale, minimumRenderScale),
    maximumRenderScale
  );
}

export function calculateBrowserSizeCanvas(
  viewportWidth: number | undefined,
  viewportHeight: number | undefined
): BrowserSizeCanvas {
  const renderScale = calculateBrowserRenderScale(
    viewportWidth,
    viewportHeight
  );
  return {
    renderScale,
    width: Math.round(gameViewport.width * renderScale),
    height: Math.round(gameViewport.height * renderScale)
  };
}

export function toLogicalCanvasPoint(
  point: Readonly<{ x: number; y: number }>,
  renderScale: number
): { x: number; y: number } {
  return {
    x: point.x / renderScale,
    y: point.y / renderScale
  };
}

export function withCanvasTextResolution<T extends object>(
  style: T,
  renderScale = browserSizeCanvas.renderScale
): T & { resolution: number } {
  return {
    ...style,
    resolution: renderScale
  };
}

export const browserSizeCanvas = calculateBrowserSizeCanvas(
  typeof window === "undefined" ? undefined : window.innerWidth,
  typeof window === "undefined" ? undefined : window.innerHeight
);
```

このモジュールには `resize` イベントリスナーを追加しない。末尾の定数初期化だけで、ページ読込時に一度だけ値を決定する。

- [ ] **Step 4: 新しい単体テストが通ることを確認する**

Run:

```powershell
npm.cmd test -w src/client -- --test-name-pattern="browser viewport|physical canvas|pointer coordinates|text styles"
```

Expected: PASS。6件すべての新しいテストが成功する。

- [ ] **Step 5: Phaser利用箇所を新しいAPIへ切り替える**

次の置換を行う。

`src/client/src/main.ts`:

```ts
import { browserSizeCanvas } from "./game/browserSizeCanvas";
```

Phaser設定のCanvasサイズ:

```ts
width: browserSizeCanvas.width,
height: browserSizeCanvas.height,
```

`src/client/src/game/scenes/TitleScene.ts`:

```ts
import {
  browserSizeCanvas,
  withCanvasTextResolution
} from "../browserSizeCanvas";
```

カメラ倍率は次に置き換える。

```ts
.setZoom(browserSizeCanvas.renderScale)
```

3箇所の `withHighDpiTextResolution(...)` はすべて次へ置き換える。

```ts
withCanvasTextResolution(...)
```

`src/client/src/game/scenes/BattleScene.ts`:

```ts
import {
  browserSizeCanvas,
  toLogicalCanvasPoint
} from "../browserSizeCanvas";
```

カメラ倍率は次に置き換える。

```ts
.setZoom(browserSizeCanvas.renderScale)
```

2箇所のポインター変換は次に置き換える。

```ts
const point = toLogicalCanvasPoint(
  pointer,
  browserSizeCanvas.renderScale
);
```

`src/client/src/game/ui/battleHud.ts`:

```ts
import { withCanvasTextResolution } from "../browserSizeCanvas";
```

`withHighDpiTextResolution(...)` は次へ置き換える。

```ts
withCanvasTextResolution(...)
```

最後に `src/client/src/game/highDpiCanvas.ts` を削除する。

- [ ] **Step 6: 旧DPI方式の識別子が残っていないことを確認する**

Run:

```powershell
rg -n "highDpi|HighDpi|devicePixelRatio" src/client/src
```

Expected: 終了コード1、出力なし。該当する識別子が0件である。

- [ ] **Step 7: クライアントの全テストと型検査を実行する**

Run:

```powershell
npm.cmd test -w src/client
npm.cmd run typecheck -w src/client
```

Expected: 両方とも終了コード0。全テストがPASSし、TypeScriptエラーがない。

- [ ] **Step 8: 実装をコミットする**

```powershell
git add src/client/src/game/browserSizeCanvas.ts src/client/src/game/browserSizeCanvas.test.ts src/client/src/main.ts src/client/src/game/scenes/TitleScene.ts src/client/src/game/scenes/BattleScene.ts src/client/src/game/ui/battleHud.ts src/client/src/game/highDpiCanvas.ts src/client/src/game/highDpiCanvas.test.ts
git commit -m "feat: Canvas解像度をブラウザサイズに連動"
```

### Task 2: ビルドと実ブラウザで描画倍率を検証する

**Files:**
- Verify: `src/client/src/game/browserSizeCanvas.ts`
- Verify: `src/client/src/main.ts`
- Verify: `src/client/src/game/scenes/TitleScene.ts`
- Verify: `src/client/src/game/scenes/BattleScene.ts`
- Verify: `src/client/src/game/ui/battleHud.ts`

**Interfaces:**
- Consumes: Task 1の `browserSizeCanvas: BrowserSizeCanvas`
- Produces: ビルド成功と、ブラウザ表示領域に応じたCanvas属性・表示・操作の検証結果

- [ ] **Step 1: クライアントの本番ビルドを実行する**

Run:

```powershell
npm.cmd run build -w src/client
```

Expected: 終了コード0。TypeScriptコンパイルとViteビルドが成功する。

- [ ] **Step 2: 開発サーバーを起動する**

Run:

```powershell
npm.cmd run dev:client
```

Expected: ViteがローカルURLを表示し、接続待ちになる。このプロセスは実ブラウザ検証が終わるまで維持する。

- [ ] **Step 3: ブラウザの表示領域とCanvas属性を照合する**

開発サーバーのURLをブラウザで開き、DevToolsコンソールで次を評価する。

```js
const logicalWidth = 644;
const logicalHeight = 468;
const expectedScale = Math.min(
  Math.max(
    Math.min(
      window.innerWidth / logicalWidth,
      window.innerHeight / logicalHeight
    ),
    1
  ),
  2
);
const canvas = document.querySelector("canvas");
({
  viewport: [window.innerWidth, window.innerHeight],
  expectedScale,
  expectedCanvas: [
    Math.round(logicalWidth * expectedScale),
    Math.round(logicalHeight * expectedScale)
  ],
  actualCanvas: canvas
    ? [canvas.width, canvas.height]
    : null
});
```

Expected: `actualCanvas` と `expectedCanvas` が一致する。表示領域が1280×720の場合は `expectedScale` が `720 / 468`、Canvas属性が991×720になる。表示領域が論理サイズ以下なら644×468、十分に大きければ最大1288×936になる。

- [ ] **Step 4: リサイズ時には固定され、再読込後に再計算されることを確認する**

ブラウザウィンドウのサイズを変更し、再読込前後でStep 3のコードを実行する。

Expected:

- 再読込前: `canvas.width` と `canvas.height` は変更前の値を維持する。
- 再読込後: 新しい `window.innerWidth` と `window.innerHeight` から計算した値へ変わる。
- CanvasのCSS表示は `FIT` により表示領域内へ収まり、中央配置を維持する。

- [ ] **Step 5: ゲーム画面と入力を手動確認する**

タイトル画面から戦闘画面へ進み、次を確認する。

- タイトルとHUDの文字が、倍率変更後も論理サイズを維持しつつ鮮明に表示される。
- ユニット、フィールド、HUDが欠けたり二重に拡大されたりしない。
- フィールド上のユニット選択や配置で、ポインター位置と反応位置が一致する。
- 画面のアスペクト比は644:468のままである。

- [ ] **Step 6: リポジトリ全体の回帰検証を実行する**

開発サーバーを終了してから実行する。

```powershell
npm.cmd test -w src/client
npm.cmd run typecheck
npm.cmd run build
git status --short
```

Expected: テスト、型検査、ビルドがすべて終了コード0。`git status --short` に意図しない変更がない。

- [ ] **Step 7: 検証で修正が必要だった場合だけ追加コミットする**

Step 1〜6で修正したファイルがある場合のみ、そのファイルを明示的にステージしてコミットする。

```powershell
git add src/client/src/game/browserSizeCanvas.ts src/client/src/game/browserSizeCanvas.test.ts src/client/src/main.ts src/client/src/game/scenes/TitleScene.ts src/client/src/game/scenes/BattleScene.ts src/client/src/game/ui/battleHud.ts
git commit -m "fix: ブラウザサイズ連動Canvasの検証結果を反映"
```

修正がなければコミットは作成しない。
