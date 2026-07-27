# 戦闘フィールドの円クリップとHUD配置変更 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 召喚士リングと回復エリアをフィールド内へクリップし、召喚ゲージ・HPバー・残り時間を承認済みの位置と表記へ変更する。

**Architecture:** HUDの矩形座標は `BattleLayout` に集約し、`BattleHud` は計算済み矩形だけを消費する。円の描画は専用 `Graphics` レイヤーへ分離し、フィールド矩形と同じ Geometry Mask を設定して、他のオーバーレイを巻き込まずに切り取る。

**Tech Stack:** TypeScript 5.8、Phaser 3.90、Node.js test runner、tsx、Vite

## Global Constraints

- 設計仕様は `docs/superpowers/specs/2026-07-27-battlefield-circle-clipping-and-hud-position-design.md` を正とする。
- フィールドサイズ、ユニット・召喚獣・エレメントの表示サイズ、移動速度、攻撃範囲、戦闘ルールは変更しない。
- 召喚ゲージは `360 × 28px`、フィールド下端から `8px` 下、画面中央に配置する。
- HPバーは各 `320 × 28px`、上端から `10px`、左右端から `106px` 内側に配置する。
- 残り時間は切り上げた非負の秒数を数字だけで表示する。
- 既存の未コミット画像と `.superpowers/` 配下の比較画面は変更対象およびコミット対象に含めない。
- 新規・更新する資料は日本語で記述する。

---

## File Structure

- `src/client/src/game/ui/battleLayout.ts`: フィールド、ボタン、HPバー、召喚ゲージの矩形を一元計算する。
- `src/client/src/game/ui/battleLayout.test.ts`: 960×540での矩形とHUD入力領域を検証する。
- `src/client/src/game/ui/battleHud.ts`: `BattleLayout` が返す矩形を使ってゲージを生成する。
- `src/client/src/game/ui/battleHudModel.ts`: 残り時間を数字だけに整形する。
- `src/client/src/game/ui/battleHudModel.test.ts`: 残り時間の切り上げと0下限を検証する。
- `src/client/src/game/scenes/BattleScene.ts`: 円専用 `Graphics` と Geometry Mask を生成し、回復円と召喚士リングを専用レイヤーへ描く。

### Task 1: HUD矩形をBattleLayoutへ集約する

**Files:**
- Modify: `src/client/src/game/ui/battleLayout.ts`
- Modify: `src/client/src/game/ui/battleLayout.test.ts`
- Modify: `src/client/src/game/ui/battleHud.ts`

**Interfaces:**
- Consumes: `calculateBattleLayout(width: number, height: number): BattleLayout`
- Produces: `BattleLayout.playerHp: UiRect`、`BattleLayout.cpuHp: UiRect`、`BattleLayout.summonGauge: UiRect`

- [ ] **Step 1: 期待するHUD矩形と入力領域の失敗テストを書く**

`battleLayout.test.ts` の960×540テストへ次の検証を追加し、HUD領域テストへ召喚ゲージ上の点を追加する。

```ts
assert.deepEqual(layout.playerHp, { x: 106, y: 10, width: 320, height: 28 });
assert.deepEqual(layout.cpuHp, { x: 534, y: 10, width: 320, height: 28 });
assert.deepEqual(layout.summonGauge, { x: 300, y: 432, width: 360, height: 28 });

assert.equal(
  isPointInHud(
    layout,
    layout.summonGauge.x + layout.summonGauge.width / 2,
    layout.summonGauge.y + layout.summonGauge.height / 2
  ),
  true
);
```

- [ ] **Step 2: レイアウトテストが期待どおり失敗することを確認する**

Run:

```powershell
npm test -w src/client
```

Expected: `layout.playerHp`、`layout.cpuHp`、`layout.summonGauge` が存在しないためFAIL。

- [ ] **Step 3: BattleLayoutへ矩形を追加する**

`BattleLayout` とレイアウト定数へ次を追加する。

```ts
export type BattleLayout = {
  topBar: UiRect;
  field: UiRect;
  bottomBar: UiRect;
  playerHp: UiRect;
  cpuHp: UiRect;
  summonGauge: UiRect;
  buildButton: UiRect;
  summonButton: UiRect;
  retryButton: UiRect;
};

const hpBarWidth = 320;
const hpBarHeight = 28;
const hpBarSideInset = 106;
const hpBarTopInset = 10;
const summonGaugeWidth = 360;
const summonGaugeHeight = 28;
const summonGaugeFieldGap = 8;
```

`calculateBattleLayout` でフィールド計算後に矩形を生成し、返り値へ含める。

```ts
const playerHp: UiRect = {
  x: hpBarSideInset,
  y: hpBarTopInset,
  width: hpBarWidth,
  height: hpBarHeight
};
const cpuHp: UiRect = {
  x: width - hpBarSideInset - hpBarWidth,
  y: hpBarTopInset,
  width: hpBarWidth,
  height: hpBarHeight
};
const summonGauge: UiRect = {
  x: roundToTenth((width - summonGaugeWidth) / 2),
  y: roundToTenth(field.y + field.height + summonGaugeFieldGap),
  width: summonGaugeWidth,
  height: summonGaugeHeight
};
```

`isPointInHud` の配列へ `layout.summonGauge` を追加する。

```ts
return [
  layout.topBar,
  layout.bottomBar,
  layout.summonGauge,
  layout.buildButton,
  layout.summonButton,
  layout.retryButton
].some((rect) => containsPoint(rect, x, y));
```

- [ ] **Step 4: BattleHudを計算済み矩形へ切り替える**

コンストラクター内の `hpBarWidth`、`hpBarHeight`、`hpBarY`、`playerHpX`、`cpuHpX`、`summonWidth`、`summonX`、`summonY` の局所計算を削除し、次の呼び出しに置き換える。

```ts
this.playerHp = createGauge(
  scene,
  layout.playerHp.x,
  layout.playerHp.y,
  layout.playerHp.width,
  layout.playerHp.height,
  0x22c55e
);
this.cpuHp = createGauge(
  scene,
  layout.cpuHp.x,
  layout.cpuHp.y,
  layout.cpuHp.width,
  layout.cpuHp.height,
  0xef4444
);
this.summonGauge = createGauge(
  scene,
  layout.summonGauge.x,
  layout.summonGauge.y,
  layout.summonGauge.width,
  layout.summonGauge.height,
  0xfacc15
);
```

- [ ] **Step 5: レイアウトテストと型検査を通す**

Run:

```powershell
npm test -w src/client
npm run typecheck -w src/client
```

Expected: すべてPASS、TypeScriptエラーなし。

- [ ] **Step 6: HUD配置変更をコミットする**

```powershell
git add -- src/client/src/game/ui/battleLayout.ts src/client/src/game/ui/battleLayout.test.ts src/client/src/game/ui/battleHud.ts
git commit -m "feat: 戦闘HUDを中央寄せに配置"
```

### Task 2: 残り時間を数字だけにする

**Files:**
- Modify: `src/client/src/game/ui/battleHudModel.ts`
- Modify: `src/client/src/game/ui/battleHudModel.test.ts`

**Interfaces:**
- Consumes: `BattleState.remainingSeconds: number`
- Produces: `BattleHudModel.remainingTimeText: string`

- [ ] **Step 1: 数字だけを期待する失敗テストへ更新する**

`battleHudModel.test.ts` の既存期待値を次へ変更する。

```ts
assert.equal(model.remainingTimeText, "238");
```

表示範囲テストの期待値も次へ変更する。

```ts
assert.equal(model.remainingTimeText, "0");
```

- [ ] **Step 2: HUDモデルテストが期待どおり失敗することを確認する**

Run:

```powershell
npm test -w src/client
```

Expected: 実際値が `残り 238秒` または `残り 0秒` のためFAIL。

- [ ] **Step 3: 残り時間の整形を最小変更する**

`createBattleHudModel` の `remainingTimeText` を次へ置き換える。

```ts
remainingTimeText: `${Math.max(0, Math.ceil(state.remainingSeconds))}`,
```

- [ ] **Step 4: HUDモデルテストを通す**

Run:

```powershell
npm test -w src/client
```

Expected: すべてPASS。

- [ ] **Step 5: 時間表記変更をコミットする**

```powershell
git add -- src/client/src/game/ui/battleHudModel.ts src/client/src/game/ui/battleHudModel.test.ts
git commit -m "feat: 残り時間を数字だけで表示"
```

### Task 3: 円専用レイヤーをフィールドへクリップする

**Files:**
- Modify: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**
- Consumes: `BattleLayout.field: UiRect`
- Produces: `BattleScene.circleOverlay: Phaser.GameObjects.Graphics`

- [ ] **Step 1: BattleSceneへ円専用レイヤーとGeometry Maskを追加する**

プロパティを追加する。

```ts
private circleOverlay!: Phaser.GameObjects.Graphics;
private circleMaskShape!: Phaser.GameObjects.Graphics;
```

`create()` で `layout` を一度だけ計算してから、円レイヤーとマスク形状を生成する。クリップ値は `layout.field` を直接使用し、既存の `battlefield` と `battlefieldOverlay` はそのまま維持する。

```ts
const layout = calculateBattleLayout(this.scale.width, this.scale.height);

this.battlefield = this.add.graphics();
this.battlefieldOverlay = this.add.graphics();
this.battlefieldOverlay.setDepth(battleStatusOverlayDepth);
this.circleOverlay = this.add.graphics();
this.circleOverlay.setDepth(battleStatusOverlayDepth - 0.5);
this.circleMaskShape = this.make.graphics({ add: false });
this.circleMaskShape
  .fillStyle(0xffffff, 1)
  .fillRect(
    layout.field.x,
    layout.field.y,
    layout.field.width,
    layout.field.height
  );
this.circleOverlay.setMask(this.circleMaskShape.createGeometryMask());
```

この変更に伴い、後段にある重複した `const layout = calculateBattleLayout(...)` は削除し、同じ `layout` を `BattleHud` へ渡す。

`draw()` の先頭で円レイヤーも消去する。

```ts
this.battlefield.clear();
this.battlefieldOverlay.clear();
this.circleOverlay.clear();
```

`drawHealingAreas` の塗りと枠線をすべて `circleOverlay` へ変更する。

```ts
this.circleOverlay.fillStyle(presentation.fillColor, presentation.fillAlpha);
this.circleOverlay.fillCircle(screen.x, screen.y, screenRadius);
this.circleOverlay.lineStyle(
  presentation.strokeWidth,
  presentation.strokeColor,
  presentation.strokeAlpha
);
this.circleOverlay.strokeCircle(screen.x, screen.y, screenRadius);
```

`drawLeaders` では召喚士画像とHPバーを既存のまま維持し、二重リングだけを `circleOverlay` へ変更する。

```ts
this.circleOverlay.lineStyle(3, color, 0.75);
this.circleOverlay.strokeCircle(screen.x, screen.y, 28);
this.circleOverlay.lineStyle(3, 0xf8fafc, 0.9);
this.circleOverlay.strokeCircle(screen.x, screen.y, 25);
```

- [ ] **Step 2: クライアント全体を検証する**

Run:

```powershell
npm test -w src/client
npm run typecheck -w src/client
npm run build -w src/client
```

Expected: 全テストPASS、型エラーなし、Viteビルド成功。

- [ ] **Step 3: 実画面で描画と対象外範囲を確認する**

Run:

```powershell
npm run dev:client
```

確認項目:

- プレイヤー側・敵側とも、召喚士の二重リングと回復円がフィールド外へ表示されない。
- 召喚士画像とHPバーはマスクされない。
- 召喚ゲージがフィールド下端から8px下に表示される。
- HPバーが左右端から106px内側に表示される。
- 残り時間が中央に数字だけで表示される。
- フィールド、ユニット、召喚獣、エレメントのサイズと戦闘挙動が従来どおりである。

- [ ] **Step 4: 円クリップ変更をコミットする**

```powershell
git add -- src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: 召喚士の円をフィールド内へクリップ"
```
