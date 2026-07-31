# ユニットカードサイズ変更 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通常ユニットのカード外枠を 51.52 × 92px、召喚獣をその 1.3 倍へ変更し、画像を縦横比維持で枠内の下端へ配置する。

**Architecture:** `cardPresentation.ts` がカード外枠寸法と、元画像を枠内へ収める純粋なレイアウト計算を担当する。`BattleScene.ts` は計算結果だけを Phaser の画像・枠線へ適用し、カードの回転に合わせて画像の下寄せオフセットも回転させる。

**Tech Stack:** TypeScript、Phaser 3、Node.js test runner、tsx、Vite

## Global Constraints

- 戦闘フィールドの基準寸法は 515.2 × 368px。
- 通常ユニットのカード外枠は 51.52 × 92px。
- 召喚獣のカード外枠は通常ユニットの縦横それぞれ 1.3 倍（66.976 × 119.6px）。
- 枠線の外寸をカード外枠寸法に一致させる。
- 画像は縦横比を維持して枠線の内側へ収め、カード座標系の下端へ揃える。
- カード上部の空き領域は透明なまま残す。
- HPバー、選択判定、戦闘上の当たり判定、初期配置間隔、能力表示は変更しない。

---

## ファイル構成

- `src/client/src/game/render/cardPresentation.ts`
  - 通常ユニットと召喚獣の外枠寸法を保持する。
  - 元画像の寸法から、縦横比を維持した表示寸法と下寄せ位置を算出する。
- `src/client/src/game/render/cardPresentation.test.ts`
  - 外枠寸法、1.3 倍の関係、画像の縦横比維持、下寄せ、回転後の位置を検証する。
- `src/client/src/game/scenes/BattleScene.ts`
  - カード設定とレイアウト計算を Phaser の画像・枠線へ適用する。

### Task 1: カード寸法と下寄せ描画を実装する

**Files:**

- Modify: `src/client/src/game/render/cardPresentation.test.ts`
- Modify: `src/client/src/game/render/cardPresentation.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**

- Consumes: Phaser 画像の元寸法 `sourceWidth: number`、`sourceHeight: number`、カード中心座標、カード回転角。
- Produces:
  - `CardPresentation.displayWidth: number`
  - `CardPresentation.displayHeight: number`
  - `calculateCardImageLayout(presentation, sourceWidth, sourceHeight): CardImageLayout`
  - `cardImageCenterAt(cardCenter, rotation, offsetY): { x: number; y: number }`

- [ ] **Step 1: カード寸法と画像レイアウトの失敗するテストを書く**

`src/client/src/game/render/cardPresentation.test.ts` の既存寸法テストを更新し、次の検証を追加する。

```ts
import {
  calculateCardImageLayout,
  cardImageCenterAt,
  // 既存の import
} from "./cardPresentation";

test("unit cards use ten percent field width and twenty-five percent field height", () => {
  for (const presentation of Object.values(unitCardPresentation)) {
    assert.equal(presentation.displayWidth, 51.52);
    assert.equal(presentation.displayHeight, 92);
  }
});

test("summoned card is 1.3 times the unit card size", () => {
  assert.equal(
    summonedCardPresentation.displayWidth,
    unitCardPresentation.Melee.displayWidth * 1.3
  );
  assert.equal(
    summonedCardPresentation.displayHeight,
    unitCardPresentation.Melee.displayHeight * 1.3
  );
});

test("card image keeps its aspect ratio and aligns to the inner bottom edge", () => {
  const layout = calculateCardImageLayout(
    unitCardPresentation.Melee,
    318,
    444
  );

  assert.equal(layout.displayWidth, 47.52);
  assert.ok(Math.abs(layout.displayHeight - (47.52 * 444) / 318) < 1e-10);
  assert.ok(
    Math.abs(
      layout.offsetY -
        (92 - cardBorderWidth * 2 - layout.displayHeight) / 2
    ) < 1e-10
  );
});

test("card image bottom offset follows card rotation", () => {
  assert.deepEqual(cardImageCenterAt({ x: 100, y: 200 }, 0, 10), {
    x: 100,
    y: 210
  });
  const reversed = cardImageCenterAt({ x: 100, y: 200 }, Math.PI, 10);
  assert.ok(Math.abs(reversed.x - 100) < 1e-10);
  assert.ok(Math.abs(reversed.y - 190) < 1e-10);
});
```

- [ ] **Step 2: 対象テストを実行して期待どおり失敗することを確認する**

Run:

```powershell
Set-Location src/client
node --import tsx --test src/game/render/cardPresentation.test.ts
```

Expected: `displayWidth`、`calculateCardImageLayout`、`cardImageCenterAt` が未定義であるため FAIL。

- [ ] **Step 3: カード設定と純粋なレイアウト計算を最小実装する**

`src/client/src/game/render/cardPresentation.ts` へ外枠寸法と次の型・関数を追加する。

```ts
export interface CardPresentation {
  textureKey: string;
  path: string;
  displayWidth: number;
  displayHeight: number;
}

export interface CardImageLayout {
  displayWidth: number;
  displayHeight: number;
  offsetY: number;
}

const unitCardDisplayWidth = 515.2 * 0.1;
const unitCardDisplayHeight = 368 * 0.25;
const summonedCardScale = 1.3;

export function calculateCardImageLayout(
  presentation: CardPresentation,
  sourceWidth: number,
  sourceHeight: number
): CardImageLayout {
  const innerWidth = presentation.displayWidth - cardBorderWidth * 2;
  const innerHeight = presentation.displayHeight - cardBorderWidth * 2;
  const scale = Math.min(innerWidth / sourceWidth, innerHeight / sourceHeight);
  const displayWidth = sourceWidth * scale;
  const displayHeight = sourceHeight * scale;

  return {
    displayWidth,
    displayHeight,
    offsetY: (innerHeight - displayHeight) / 2
  };
}

export function cardImageCenterAt(
  cardCenter: { x: number; y: number },
  rotation: number,
  offsetY: number
): { x: number; y: number } {
  return {
    x: cardCenter.x - Math.sin(rotation) * offsetY,
    y: cardCenter.y + Math.cos(rotation) * offsetY
  };
}
```

通常ユニット3種へ `displayWidth: unitCardDisplayWidth` と `displayHeight: unitCardDisplayHeight` を設定する。召喚獣にはそれぞれ `unitCardDisplayWidth * summonedCardScale`、`unitCardDisplayHeight * summonedCardScale` を設定する。

- [ ] **Step 4: 戦闘シーンへ外枠寸法と画像レイアウトを適用する**

`src/client/src/game/scenes/BattleScene.ts` で `calculateCardImageLayout` と `cardImageCenterAt` を import する。

通常ユニットと召喚獣の画像作成時は、元画像寸法と設定値から表示寸法を計算する。

```ts
const imageLayout = calculateCardImageLayout(
  presentation,
  image.width,
  image.height
);
image.setDisplaySize(imageLayout.displayWidth, imageLayout.displayHeight);

const border = this.add.rectangle(
  0,
  0,
  presentation.displayWidth,
  presentation.displayHeight,
  cardBorderColorForTeam(unit.team)
);
```

各画像の位置更新時は、カード中心に枠線を置き、画像中心をカードの回転に合わせて下側へずらす。

```ts
const imageLayout = calculateCardImageLayout(
  presentation,
  image.width,
  image.height
);
const imageCenter = cardImageCenterAt(screen, rotation, imageLayout.offsetY);
image.setPosition(imageCenter.x, imageCenter.y);
```

召喚獣にも `summonedCardPresentation` を使って同じ処理を適用する。既存の透明度、チーム色、回転、位置履歴の更新は維持する。

- [ ] **Step 5: 対象テストを実行して通過を確認する**

Run:

```powershell
Set-Location src/client
node --import tsx --test src/game/render/cardPresentation.test.ts
```

Expected: 対象テストがすべて PASS。

- [ ] **Step 6: クライアント全体を検証する**

Run:

```powershell
Set-Location src/client
npm test
npm run typecheck
npm run build
```

Expected: 全テストが PASSし、型チェックとビルドが終了コード 0。

- [ ] **Step 7: 差分を確認してコミットする**

Run:

```powershell
git diff --check
git diff -- src/client/src/game/render/cardPresentation.ts src/client/src/game/render/cardPresentation.test.ts src/client/src/game/scenes/BattleScene.ts
git status --short
git add src/client/src/game/render/cardPresentation.ts src/client/src/game/render/cardPresentation.test.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: ユニットカードの表示サイズを変更"
```

Expected: 対象3ファイルだけが実装コミットへ含まれ、無関係な作業ツリー変更は残したままになる。
