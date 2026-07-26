# HUD日本語化・再配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 戦闘フィールドの幅と高さを維持したまま、召喚士HPと実際の残り時間を上部、召喚ゲージを下部、画像操作ボタンをフィールド外右側へ配置した日本語HUDを実装する。

**Architecture:** Phaserに依存しない `battleLayout.ts` が画面内の全矩形とHUD入力判定を計算し、`battleHudModel.ts` が `BattleState` から表示文字列・比率・ボタン有効状態を生成する。`BattleHud` は両者の結果だけを描画し、`BattleScene` は同じレイアウトのフィールド矩形、既存の召喚可否判定、コールバックを渡す。

**Tech Stack:** TypeScript、Phaser 3.90、Node.js test runner、tsx、Vite

## Global Constraints

- 960×540で戦闘フィールドを `x = 222.4`、`y = 56`、`width = 515.2`、`height = 368` とし、現行の幅と高さを変更しない。
- 上部固定バーは `x = 0`、`y = 0`、`width = 960`、`height = 48`、下部固定バーは `x = 0`、`y = 492`、`width = 960`、`height = 48` とする。
- ボタンは52×52px、間隔8px、フィールド右端から12px外側、フィールド下端揃えで、上からエレメント生成、召喚、Retryの順とする。
- エレメント生成には `/assets/buttons/element_button.png`、召喚には `/assets/buttons/summon_button.png` を使用し、Retryは `R` の1文字だけを表示する。
- `/assets/buttons/skill_button.png` は読み込みも表示も行わない。
- HUDに表示する文言は `自分`、`敵`、`残り N秒`、`召喚ゲージ N%`、`勝利`、`敗北`、`引き分け` に限定する。
- 残り時間は `BattleState.remainingSeconds` を毎フレーム整数へ切り上げ、0未満を `残り 0秒` に制限する。
- 下部固定バーには自分の召喚ゲージだけを表示する。
- HUD入力範囲は上部バー、下部バー、右側ボタン列だけとし、戦闘フィールド上の選択とドラッグ移動を妨げない。
- 召喚可否は `GameSession.canSummon("Player")` を使用し、HUDへゲームルールを複製しない。
- ゲームルール、攻撃間隔、HP、召喚ゲージ速度、ボタン画像自体は変更しない。
- ユーザーが変更中の `src/client/public/assets/elements/` と `src/client/public/assets/units/blue/` は編集、ステージ、コミットしない。
- `npm` と `node` のコマンドは `src/client`、`git` のコマンドはリポジトリルート `C:\10.Github\reijin-summon` で実行する。

---

## ファイル構成

- Create: `src/client/src/game/ui/battleLayout.ts`
  - HUDバー、戦闘フィールド、右側ボタン列の純粋な矩形計算とHUD入力判定を担当する。
- Create: `src/client/src/game/ui/battleLayout.test.ts`
  - 960×540の厳密な座標、非重複、HUD入力範囲を固定する。
- Create: `src/client/src/game/ui/battleHudModel.ts`
  - `BattleState` と選択状態から、日本語文字列、ゲージ比率、勝敗、ボタン有効状態を作る。
- Create: `src/client/src/game/ui/battleHudModel.test.ts`
  - HP、時間、召喚ゲージ、勝敗、ボタン条件の境界値を検証する。
- Modify: `src/client/src/game/ui/battleHud.ts`
  - 上部・下部HUD、画像ボタン、Retry、勝敗オーバーレイを描画・更新・破棄する。
- Modify: `src/client/src/game/scenes/BattleScene.ts`
  - ボタン画像をpreloadし、共有レイアウトをフィールド座標変換へ使用し、HUDへ召喚可否を渡す。
- Add: `src/client/public/assets/buttons/element_button.png`
  - エレメント生成ボタンの既存提供画像をクライアント成果物へ含める。
- Add: `src/client/public/assets/buttons/summon_button.png`
  - 召喚ボタンの既存提供画像をクライアント成果物へ含める。

### Task 1: 共有レイアウト計算とHUD入力範囲

**Files:**
- Create: `src/client/src/game/ui/battleLayout.ts`
- Create: `src/client/src/game/ui/battleLayout.test.ts`

**Interfaces:**
- Consumes: 画面の `width: number` と `height: number`
- Produces: `calculateBattleLayout(width: number, height: number): BattleLayout`
- Produces: `isPointInHud(layout: BattleLayout, x: number, y: number): boolean`
- Produces: `BattleLayout` の `topBar`、`field`、`bottomBar`、`buildButton`、`summonButton`、`retryButton`

- [ ] **Step 1: 960×540の矩形を固定する失敗テストを書く**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { calculateBattleLayout, isPointInHud } from "./battleLayout";

test("960×540でフィールド寸法を維持して固定バーと右ボタンを配置する", () => {
  const layout = calculateBattleLayout(960, 540);

  assert.deepEqual(layout.topBar, { x: 0, y: 0, width: 960, height: 48 });
  assert.deepEqual(layout.field, { x: 222.4, y: 56, width: 515.2, height: 368 });
  assert.deepEqual(layout.bottomBar, { x: 0, y: 492, width: 960, height: 48 });
  assert.deepEqual(layout.buildButton, { x: 749.6, y: 252, width: 52, height: 52 });
  assert.deepEqual(layout.summonButton, { x: 749.6, y: 312, width: 52, height: 52 });
  assert.deepEqual(layout.retryButton, { x: 749.6, y: 372, width: 52, height: 52 });
});

test("固定バーとボタンだけをHUD入力範囲として扱う", () => {
  const layout = calculateBattleLayout(960, 540);

  assert.equal(isPointInHud(layout, 10, 10), true);
  assert.equal(isPointInHud(layout, 10, 510), true);
  assert.equal(isPointInHud(layout, 760, 250), true);
  assert.equal(isPointInHud(layout, layout.field.x + 10, layout.field.y + 10), false);
  assert.equal(isPointInHud(layout, 900, 250), false);
});

test("各矩形がフィールドへ重ならずボタン下端が揃う", () => {
  const layout = calculateBattleLayout(960, 540);
  const fieldRight = layout.field.x + layout.field.width;
  const fieldBottom = layout.field.y + layout.field.height;

  assert.equal(layout.buildButton.x, fieldRight + 12);
  assert.equal(layout.retryButton.y + layout.retryButton.height, fieldBottom);
  assert.ok(layout.field.y >= layout.topBar.y + layout.topBar.height);
  assert.ok(fieldBottom <= layout.bottomBar.y);
});
```

- [ ] **Step 2: 新規テストを実行して未実装による失敗を確認する**

Run: `node --import tsx --test src/game/ui/battleLayout.test.ts`

Expected: FAIL with `Cannot find module './battleLayout'`

- [ ] **Step 3: 純粋なレイアウト計算と矩形判定を実装する**

```ts
export type UiRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BattleLayout = {
  topBar: UiRect;
  field: UiRect;
  bottomBar: UiRect;
  buildButton: UiRect;
  summonButton: UiRect;
  retryButton: UiRect;
};

const topBarHeight = 48;
const bottomBarHeight = 48;
const fieldTopGap = 8;
const legacyHudHeight = 132;
const legacyVerticalPadding = 20;
const legacyHorizontalAllowance = 68;
const battlefieldAspectRatio = 1.4;
const buttonSize = 52;
const buttonGap = 8;
const buttonFieldGap = 12;

export function calculateBattleLayout(width: number, height: number): BattleLayout {
  const legacyHudTop = height - legacyHudHeight;
  const availableHeight = legacyHudTop - legacyVerticalPadding * 2;
  const availableWidth = width - legacyHorizontalAllowance;
  const fieldHeight = roundToTenth(
    Math.min(availableHeight, availableWidth / battlefieldAspectRatio)
  );
  const fieldWidth = roundToTenth(fieldHeight * battlefieldAspectRatio);
  const field: UiRect = {
    x: roundToTenth((width - fieldWidth) / 2),
    y: topBarHeight + fieldTopGap,
    width: fieldWidth,
    height: fieldHeight
  };
  const buttonX = roundToTenth(field.x + field.width + buttonFieldGap);
  const retryY = roundToTenth(field.y + field.height - buttonSize);

  return {
    topBar: { x: 0, y: 0, width, height: topBarHeight },
    field,
    bottomBar: { x: 0, y: height - bottomBarHeight, width, height: bottomBarHeight },
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

export function isPointInHud(layout: BattleLayout, x: number, y: number): boolean {
  return [
    layout.topBar,
    layout.bottomBar,
    layout.buildButton,
    layout.summonButton,
    layout.retryButton
  ].some((rect) => containsPoint(rect, x, y));
}

function containsPoint(rect: UiRect, x: number, y: number): boolean {
  return x >= rect.x
    && x <= rect.x + rect.width
    && y >= rect.y
    && y <= rect.y + rect.height;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
```

- [ ] **Step 4: レイアウトテストを実行して成功を確認する**

Run: `node --import tsx --test src/game/ui/battleLayout.test.ts`

Expected: 3 tests PASS

- [ ] **Step 5: Task 1をコミットする**

```powershell
git add src/client/src/game/ui/battleLayout.ts src/client/src/game/ui/battleLayout.test.ts
git commit -m "test: HUDレイアウト計算を固定"
```

### Task 2: 日本語HUD表示モデル

**Files:**
- Create: `src/client/src/game/ui/battleHudModel.ts`
- Create: `src/client/src/game/ui/battleHudModel.test.ts`

**Interfaces:**
- Consumes: `createBattleHudModel(state: BattleState, selectedUnitId: PlayerUnitId | null, canSummonPlayer: boolean)`
- Produces: `BattleHudModel` の `playerHp`、`cpuHp`、`remainingTimeText`、`summonGauge`、`resultText`、`canBuild`、`canSummon`
- Produces: 画像キー `elementButtonTextureKey = "hud-element-button"` と `summonButtonTextureKey = "hud-summon-button"`

- [ ] **Step 1: 日本語表示、制限値、勝敗、ボタン状態の失敗テストを書く**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState } from "../core/battleState";
import {
  createBattleHudModel,
  elementButtonTextureKey,
  summonButtonTextureKey
} from "./battleHudModel";

test("HP・残り時間・召喚ゲージを日本語へ整形する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.leaders[0].currentHp = 1799.2;
  state.leaders[1].currentHp = 1650;
  state.remainingSeconds = 237.01;
  state.playerSummonGauge = 0.639;

  const model = createBattleHudModel(state, "PlayerMelee", false);

  assert.deepEqual(model.playerHp, {
    text: "自分 1800 / 2000",
    ratio: 1799.2 / 2000
  });
  assert.deepEqual(model.cpuHp, {
    text: "敵 1650 / 2000",
    ratio: 0.825
  });
  assert.equal(model.remainingTimeText, "残り 238秒");
  assert.deepEqual(model.summonGauge, { text: "召喚ゲージ 63%", ratio: 0.639 });
});

test("HP・時間・召喚ゲージを表示範囲へ制限する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.leaders[0].currentHp = -10;
  state.leaders[1].currentHp = 3000;
  state.remainingSeconds = -0.2;
  state.playerSummonGauge = 1.4;

  const model = createBattleHudModel(state, null, false);

  assert.equal(model.playerHp.ratio, 0);
  assert.equal(model.cpuHp.ratio, 1);
  assert.equal(model.remainingTimeText, "残り 0秒");
  assert.deepEqual(model.summonGauge, { text: "召喚ゲージ 100%", ratio: 1 });
});

test("勝敗を日本語へ変換して戦闘中は空文字にする", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());

  assert.equal(createBattleHudModel(state, null, false).resultText, "");
  state.result = "PlayerWin";
  assert.equal(createBattleHudModel(state, null, false).resultText, "勝利");
  state.result = "CpuWin";
  assert.equal(createBattleHudModel(state, null, false).resultText, "敗北");
  state.result = "Draw";
  assert.equal(createBattleHudModel(state, null, false).resultText, "引き分け");
});

test("有効な選択ユニットと既存召喚判定をボタン状態へ反映する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());

  assert.equal(createBattleHudModel(state, "PlayerMelee", true).canBuild, true);
  assert.equal(createBattleHudModel(state, "PlayerMelee", true).canSummon, true);

  state.units.find((unit) => unit.unitId === "PlayerMelee")!.mode = "Defeated";
  assert.equal(createBattleHudModel(state, "PlayerMelee", true).canBuild, false);

  state.result = "CpuWin";
  const finished = createBattleHudModel(state, "PlayerSpeed", true);
  assert.equal(finished.canBuild, false);
  assert.equal(finished.canSummon, false);
});

test("使用する画像キーはエレメント生成と召喚だけである", () => {
  assert.equal(elementButtonTextureKey, "hud-element-button");
  assert.equal(summonButtonTextureKey, "hud-summon-button");
  assert.equal(
    [elementButtonTextureKey, summonButtonTextureKey].some((key) => key.includes("skill")),
    false
  );
});
```

- [ ] **Step 2: 新規テストを実行して未実装による失敗を確認する**

Run: `node --import tsx --test src/game/ui/battleHudModel.test.ts`

Expected: FAIL with `Cannot find module './battleHudModel'`

- [ ] **Step 3: 表示モデルを最小実装する**

```ts
import { findLeader } from "../core/battleState";
import type { BattleState, PlayerUnitId } from "../core/types";

export const elementButtonTextureKey = "hud-element-button";
export const summonButtonTextureKey = "hud-summon-button";

export type HudGaugeModel = {
  text: string;
  ratio: number;
};

export type BattleHudModel = {
  playerHp: HudGaugeModel;
  cpuHp: HudGaugeModel;
  remainingTimeText: string;
  summonGauge: HudGaugeModel;
  resultText: string;
  canBuild: boolean;
  canSummon: boolean;
};

export function createBattleHudModel(
  state: BattleState,
  selectedUnitId: PlayerUnitId | null,
  canSummonPlayer: boolean
): BattleHudModel {
  const playerLeader = findLeader(state, "Player");
  const cpuLeader = findLeader(state, "Cpu");
  const selectedUnit = selectedUnitId
    ? state.units.find((unit) => unit.unitId === selectedUnitId)
    : undefined;
  const inProgress = state.result === "InProgress";
  const summonGauge = clamp(state.playerSummonGauge, 0, 1);

  return {
    playerHp: leaderGauge("自分", playerLeader.currentHp, playerLeader.maxHp),
    cpuHp: leaderGauge("敵", cpuLeader.currentHp, cpuLeader.maxHp),
    remainingTimeText: `残り ${Math.max(0, Math.ceil(state.remainingSeconds))}秒`,
    summonGauge: {
      text: `召喚ゲージ ${Math.floor(summonGauge * 100)}%`,
      ratio: summonGauge
    },
    resultText: formatResult(state.result),
    canBuild: Boolean(
      inProgress
      && selectedUnit
      && selectedUnit.team === "Player"
      && selectedUnit.mode === "Active"
      && selectedUnit.currentHp > 0
    ),
    canSummon: inProgress && canSummonPlayer
  };
}

function leaderGauge(label: "自分" | "敵", currentHp: number, maxHp: number): HudGaugeModel {
  return {
    text: `${label} ${Math.ceil(currentHp)} / ${maxHp}`,
    ratio: clamp(maxHp > 0 ? currentHp / maxHp : 0, 0, 1)
  };
}

function formatResult(result: BattleState["result"]): string {
  switch (result) {
    case "PlayerWin":
      return "勝利";
    case "CpuWin":
      return "敗北";
    case "Draw":
      return "引き分け";
    case "InProgress":
      return "";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
```

- [ ] **Step 4: 表示モデルテストを実行して成功を確認する**

Run: `node --import tsx --test src/game/ui/battleHudModel.test.ts`

Expected: 5 tests PASS

- [ ] **Step 5: Task 2をコミットする**

```powershell
git add src/client/src/game/ui/battleHudModel.ts src/client/src/game/ui/battleHudModel.test.ts
git commit -m "test: 日本語HUD表示モデルを追加"
```

### Task 3: 上下固定HUDと正方形画像ボタン

**Files:**
- Modify: `src/client/src/game/ui/battleHud.ts`
- Add: `src/client/public/assets/buttons/element_button.png`
- Add: `src/client/public/assets/buttons/summon_button.png`

**Interfaces:**
- Consumes: `BattleHud` constructor `(scene: Phaser.Scene, layout: BattleLayout, callbacks: BattleHudCallbacks)`
- Consumes: `BattleHud.update(state: BattleState, selectedUnitId: PlayerUnitId | null, canSummonPlayer: boolean): void`
- Consumes: `BattleLayout` と `createBattleHudModel(...)`
- Produces: `BattleHud.contains(x: number, y: number): boolean`
- Produces: `BattleHud.destroy(): void`

- [ ] **Step 1: `BattleHud` の公開契約を新しいレイアウトと表示モデルへ切り替える**

`setStatus()`、英語のタイトル・ステータス・選択ユニット・エレメント数表示を削除し、次のシグネチャへ変更する。

```ts
import type { BattleLayout, UiRect } from "./battleLayout";
import { isPointInHud } from "./battleLayout";
import type { BattleHudModel } from "./battleHudModel";
import {
  createBattleHudModel,
  elementButtonTextureKey,
  summonButtonTextureKey
} from "./battleHudModel";

constructor(
  scene: Phaser.Scene,
  layout: BattleLayout,
  callbacks: BattleHudCallbacks
) {
  this.scene = scene;
  this.layout = layout;
}

contains(x: number, y: number): boolean {
  return isPointInHud(this.layout, x, y);
}

update(
  state: BattleState,
  selectedUnitId: PlayerUnitId | null,
  canSummonPlayer: boolean
): void {
  const model = createBattleHudModel(state, selectedUnitId, canSummonPlayer);
  this.applyModel(model);
}
```

- [ ] **Step 2: 上部HPバー、時間、下部召喚ゲージ、勝敗表示を生成する**

`BattleHud` のconstructorで `layout.topBar` と `layout.bottomBar` を背景に使い、次の配置で生成する。

```ts
const hpBarWidth = 320;
const hpBarHeight = 28;
const hpBarY = layout.topBar.y + 10;
const playerHpX = 20;
const cpuHpX = layout.topBar.x + layout.topBar.width - 20 - hpBarWidth;

this.topBackground = createPanel(scene, layout.topBar);
this.bottomBackground = createPanel(scene, layout.bottomBar);
this.playerHp = createGauge(scene, playerHpX, hpBarY, hpBarWidth, hpBarHeight, 0x22c55e);
this.cpuHp = createGauge(scene, cpuHpX, hpBarY, hpBarWidth, hpBarHeight, 0xef4444);
this.timeText = scene.add
  .text(layout.topBar.x + layout.topBar.width / 2, layout.topBar.y + layout.topBar.height / 2, "", titleStyle(18, "#f8fafc"))
  .setOrigin(0.5);

const summonWidth = 360;
const summonX = (layout.bottomBar.width - summonWidth) / 2;
const summonY = layout.bottomBar.y + 10;
this.summonGauge = createGauge(scene, summonX, summonY, summonWidth, 28, 0xfacc15);
this.resultText = scene.add
  .text(scene.scale.width / 2, scene.scale.height / 2, "", titleStyle(48, "#f8fafc"))
  .setOrigin(0.5)
  .setDepth(100)
  .setStroke("#020617", 8);
```

パネルとゲージの型・生成・破棄は次の形で定義する。

```ts
type HudGauge = {
  background: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  width: number;
};

function createPanel(scene: Phaser.Scene, rect: UiRect): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(rect.x, rect.y, rect.width, rect.height, 0x0f172a, 0.94)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x334155, 1);
}

function createGauge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number
): HudGauge {
  const innerWidth = width - 4;
  const background = scene.add
    .rectangle(x, y, width, height, 0x020617, 1)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x475569, 1);
  const fill = scene.add
    .rectangle(x + 2, y + 2, 0, height - 4, color, 1)
    .setOrigin(0, 0);
  const text = scene.add
    .text(x + width / 2, y + height / 2, "", titleStyle(15, "#f8fafc"))
    .setOrigin(0.5);
  return { background, fill, text, width: innerWidth };
}

function destroyGauge(gauge: HudGauge): void {
  gauge.background.destroy();
  gauge.fill.destroy();
  gauge.text.destroy();
}
```

`battleHud.ts` では `UiRect`、`BattleLayout`、`BattleHudModel` をそれぞれの純粋モジュールからimportする。`applyModel()` は次の完全な形で表示とボタン状態を反映する。

```ts
private applyModel(model: BattleHudModel): void {
  this.playerHp.text.setText(model.playerHp.text);
  this.playerHp.fill.width = this.playerHp.width * model.playerHp.ratio;
  this.cpuHp.text.setText(model.cpuHp.text);
  this.cpuHp.fill.width = this.cpuHp.width * model.cpuHp.ratio;
  this.timeText.setText(model.remainingTimeText);
  this.summonGauge.text.setText(model.summonGauge.text);
  this.summonGauge.fill.width = this.summonGauge.width * model.summonGauge.ratio;
  this.resultText.setText(model.resultText);
  this.setImageButtonEnabled(this.buildButton, model.canBuild);
  this.setImageButtonEnabled(this.summonButton, model.canSummon);
}
```

- [ ] **Step 3: エレメント生成・召喚を画像だけ、RetryをRだけで描画する**

画像ボタン型は文字を含めず、Retry型は `R` のテキストを持つ。

```ts
type ImageHudButton = {
  background: Phaser.GameObjects.Rectangle;
  image: Phaser.GameObjects.Image;
  enabled: boolean;
};

type RetryHudButton = {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

this.buildButton = this.createImageButton(
  layout.buildButton,
  elementButtonTextureKey,
  callbacks.onBuild
);
this.summonButton = this.createImageButton(
  layout.summonButton,
  summonButtonTextureKey,
  callbacks.onSummon
);
this.retryButton = this.createRetryButton(layout.retryButton, callbacks.onRetry);
```

画像は正方形内へ収め、クリック対象を背景矩形へ限定する。

```ts
const image = this.scene.add
  .image(rect.x + rect.width / 2, rect.y + rect.height / 2, textureKey)
  .setDisplaySize(rect.width - 6, rect.height - 6);
```

ボタン生成メソッドを次の形で実装する。

```ts
private createImageButton(
  rect: UiRect,
  textureKey: string,
  onClick: () => void
): ImageHudButton {
  const background = this.createButtonBackground(rect, onClick);
  const image = this.scene.add
    .image(rect.x + rect.width / 2, rect.y + rect.height / 2, textureKey)
    .setDisplaySize(rect.width - 6, rect.height - 6);
  return { background, image, enabled: true };
}

private createRetryButton(rect: UiRect, onClick: () => void): RetryHudButton {
  const background = this.createButtonBackground(rect, onClick);
  const label = this.scene.add
    .text(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      "R",
      titleStyle(24, "#f8fafc")
    )
    .setOrigin(0.5);
  return { background, label };
}

private createButtonBackground(
  rect: UiRect,
  onClick: () => void
): Phaser.GameObjects.Rectangle {
  const background = this.scene.add
    .rectangle(rect.x, rect.y, rect.width, rect.height, 0x1e293b, 1)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x60a5fa, 1)
    .setInteractive({ useHandCursor: true });
  background.on("pointerover", () => {
    if (background.input?.enabled) {
      background.setFillStyle(0x334155, 1);
    }
  });
  background.on("pointerout", () => background.setFillStyle(0x1e293b, 1));
  background.on("pointerdown", () => {
    if (background.input?.enabled) {
      onClick();
    }
  });
  return background;
}
```

無効時は背景と画像のalphaを下げ、入力を停止する。有効へ戻ると入力を復元する。

```ts
private setImageButtonEnabled(button: ImageHudButton, enabled: boolean): void {
  if (button.enabled === enabled) {
    return;
  }
  button.enabled = enabled;
  button.background.setAlpha(enabled ? 1 : 0.45);
  button.image.setAlpha(enabled ? 1 : 0.45);
  if (enabled) {
    button.background.setInteractive({ useHandCursor: true });
  } else {
    button.background.disableInteractive();
  }
}
```

Retryは常時有効のため、constructorで一度だけinteractiveにし、`update()` では変更しない。

- [ ] **Step 4: HUDが作成した全オブジェクトを破棄する**

`destroy()` で次を明示的に破棄する。

```ts
this.topBackground.destroy();
this.bottomBackground.destroy();
destroyGauge(this.playerHp);
destroyGauge(this.cpuHp);
this.timeText.destroy();
destroyGauge(this.summonGauge);
this.resultText.destroy();
this.buildButton.background.destroy();
this.buildButton.image.destroy();
this.summonButton.background.destroy();
this.summonButton.image.destroy();
this.retryButton.background.destroy();
this.retryButton.label.destroy();
```

- [ ] **Step 5: 型検査と既存テストを実行する**

Run: `npm run typecheck`

Expected: exit code 0

Run: `npm test`

Expected: all tests PASS

- [ ] **Step 6: HUD描画と使用画像だけをコミットする**

`skill_button.png` とユーザーが変更中の他画像はステージしない。

```powershell
git add src/client/src/game/ui/battleHud.ts src/client/public/assets/buttons/element_button.png src/client/public/assets/buttons/summon_button.png
git commit -m "feat: 戦闘HUDを日本語表示へ刷新"
```

### Task 4: BattleSceneへの共有レイアウト統合

**Files:**
- Modify: `src/client/src/game/scenes/BattleScene.ts`
- Test: `src/client/src/game/ui/battleLayout.test.ts`
- Test: `src/client/src/game/ui/battleHudModel.test.ts`

**Interfaces:**
- Consumes: `calculateBattleLayout(this.scale.width, this.scale.height)`
- Consumes: `BattleHud(scene, layout, callbacks)`
- Consumes: `BattleHud.update(state, selectedUnitId, this.session.canSummon("Player"))`
- Produces: 全描画と `worldToScreen()`、`screenToWorld()` が共有する `fieldBounds()`

- [ ] **Step 1: 画像preloadと共有レイアウトをBattleSceneへ接続する**

importと定数を追加する。

```ts
import {
  elementButtonTextureKey,
  summonButtonTextureKey
} from "../ui/battleHudModel";
import { calculateBattleLayout } from "../ui/battleLayout";

const elementButtonPath = "/assets/buttons/element_button.png";
const summonButtonPath = "/assets/buttons/summon_button.png";
```

`preload()` へ使用する2画像だけを追加する。

```ts
this.load.image(elementButtonTextureKey, elementButtonPath);
this.load.image(summonButtonTextureKey, summonButtonPath);
```

`create()` で同じレイアウトをHUDへ渡す。

```ts
const layout = calculateBattleLayout(this.scale.width, this.scale.height);
this.hud = new BattleHud(this, layout, {
  onBuild: () => this.handleBuild(),
  onSummon: () => this.handleSummon(),
  onRetry: () => this.scene.restart()
});
```

- [ ] **Step 2: フィールド座標変換を共有レイアウトへ切り替える**

旧 `hud.top` と `verticalPadding` による計算を削除し、次だけを使用する。

```ts
private fieldBounds(): Phaser.Geom.Rectangle {
  const field = calculateBattleLayout(this.scale.width, this.scale.height).field;
  return new Phaser.Geom.Rectangle(field.x, field.y, field.width, field.height);
}
```

`BattleScene.ts` 内で不要になる `battlefieldAspectRatio` 定数も削除する。

これにより `drawField()`、`worldToScreen()`、`screenToWorld()`、ドラッグ解放のフィールド判定が同じ矩形を参照する。

- [ ] **Step 3: ステータスメッセージを削除し、実際の召喚可否をHUDへ渡す**

`this.hud.setStatus(...)` の全呼び出しと `summonBlockerText()` を削除する。`handleBuild()` と `handleSummon()` の既存guard、コマンド送信は維持する。

`draw()` の末尾を次へ変更する。

```ts
this.hud.update(
  state,
  this.selectedUnitId,
  this.session.canSummon("Player")
);
```

- [ ] **Step 4: 回帰テスト、型検査、production buildを実行する**

Run: `npm test`

Expected: all tests PASS

Run: `npm run typecheck`

Expected: exit code 0

Run: `npm run build`

Expected: TypeScript compilation and Vite build complete with exit code 0

- [ ] **Step 5: 960×540の実画面を確認する**

Run: `npm run dev -- --host 127.0.0.1`

ブラウザのviewportを960×540にして、次を確認する。

- 上部左に `自分 現在HP / 最大HP`、中央に実際の `残り N秒`、右に `敵 現在HP / 最大HP` が表示される。
- 残り時間がゲーム進行に合わせて減少し、固定の238秒ではない。
- フィールドが `x = 222.4`、`y = 56`、`width = 515.2`、`height = 368` で表示される。
- 下部には `召喚ゲージ N%` だけが表示される。
- 右外側のボタンが上からエレメント画像、召喚画像、`R` の順で、フィールド下端へ揃う。
- 通常ユニットをドラッグして移動先マーカーを表示できる。
- 上部、下部、右ボタン上からドラッグ移動が開始されない。
- 選択前はエレメント生成が無効、通常ユニット選択後は有効になる。
- 召喚条件未達では召喚が無効、`GameSession.canSummon("Player")` がtrueになると有効になる。
- Retryで再開した後にHUDが二重表示されない。
- 試合結果が中央へ `勝利`、`敗北`、`引き分け` のいずれかで表示される。

- [ ] **Step 6: BattleScene統合をコミットする**

```powershell
git add src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: 戦闘シーンへ再配置HUDを統合"
```

### Task 5: 最終検証と差分監査

**Files:**
- Verify: `src/client/src/game/ui/battleLayout.ts`
- Verify: `src/client/src/game/ui/battleLayout.test.ts`
- Verify: `src/client/src/game/ui/battleHudModel.ts`
- Verify: `src/client/src/game/ui/battleHudModel.test.ts`
- Verify: `src/client/src/game/ui/battleHud.ts`
- Verify: `src/client/src/game/scenes/BattleScene.ts`
- Verify: `src/client/public/assets/buttons/element_button.png`
- Verify: `src/client/public/assets/buttons/summon_button.png`

**Interfaces:**
- Consumes: Task 1〜4の完成差分
- Produces: テスト、型検査、build、対象ファイル監査の証跡

- [ ] **Step 1: 全自動検証を新しいプロセスで実行する**

Run: `npm test`

Expected: all tests PASS

Run: `npm run typecheck`

Expected: exit code 0

Run: `npm run build`

Expected: exit code 0 and `dist` generated

- [ ] **Step 2: 英語HUDと未使用画像参照が残っていないことを確認する**

Run: `rg -n '"(Battle Control|Status:|Selected:|Player HP:|CPU HP:|Time:|Result:|Build|Summon|Retry)"|skill_button' src/client/src/game/ui src/client/src/game/scenes/BattleScene.ts`

Expected: no matches

- [ ] **Step 3: 対象外ファイルがコミットへ混入していないことを確認する**

Run: `git status --short`

Expected: ユーザー所有の変更として `src/client/public/assets/elements/crystal.png`、`src/client/public/assets/units/blue/`、`skill_button.png`、`.superpowers/` が残っていてもよい。Task 1〜4の対象コードと2つの使用画像に未コミット差分がない。

Run: `git diff --check HEAD~4..HEAD`

Expected: no output and exit code 0

- [ ] **Step 4: コミット履歴と最終差分を確認する**

Run: `git log -4 --oneline`

Expected: Task 1〜4の4コミットが意図した順序で並ぶ。

Run: `git diff --stat HEAD~4..HEAD`

Expected: HUD、BattleScene、2つのテスト、2つの純粋モジュール、2つの使用画像だけが実装差分に含まれる。
