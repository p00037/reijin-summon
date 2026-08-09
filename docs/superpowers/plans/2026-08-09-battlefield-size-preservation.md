# 戦闘フィールド寸法維持と復活方向調整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 画面全体を `644×468` のまま、戦闘フィールドを `515.2×368` へ戻し、低い待機場所へ撤退カードを縮小表示するとともに、味方カードを復活直後に上向きへ戻す。

**Architecture:** 固定UI座標は `battleLayout`、待機カード縮尺は `defeatedUnitLayout` に集約する。Phaser固有の生成・破棄は `BattleScene` に残し、復活時の回転角は純粋関数として `cardFacing` に定義してから描画状態へ適用する。

**Tech Stack:** TypeScript、Phaser 3、Node.js Test Runner、tsx、Vite

## Global Constraints

- ゲーム画面全体の論理解像度は `644×468` のまま変更しない。
- 戦闘フィールドは `x=64.4`、`y=8`、`width=515.2`、`height=368` とする。
- 左HUDは敵・味方HPの上下列と、味方MP・召喚ゲージの上下列を維持する。
- 待機場所は `x=64.4`、`y=384`、`width=515.2`、`height=74` とする。
- 待機場所の案内文字「撤退中」は削除するが、カード内のLV、COST、MP不足時の暗転は維持する。
- 味方ユニットだけを復活直後に上向き（回転角0）へ戻し、CPUの方向は変更しない。
- MP回復、復活COST、回復エリア制限、CPU復活順序は変更しない。
- 既存の未追跡ファイルはステージ・変更しない。

---

## ファイル構成

- `src/client/src/game/ui/battleLayout.ts`: 画面内のフィールド、左HUD、待機場所、時間、ボタンの固定矩形を返す。
- `src/client/src/game/ui/battleLayout.test.ts`: `644×468` における固定矩形とHUD入力境界を検証する。
- `src/client/src/game/ui/defeatedUnitLayout.ts`: 待機場所の利用可能な縦横幅から全撤退カード共通の縮尺と矩形を返す。
- `src/client/src/game/ui/defeatedUnitLayout.test.ts`: 74px高での縦幅優先縮小と複数カード収容を検証する。
- `src/client/src/game/render/cardFacing.ts`: 初期方向、移動方向、復活直後の方向を純粋関数として返す。
- `src/client/src/game/render/cardFacing.test.ts`: 味方復活時の回転角0とCPU方向不変を検証する。
- `src/client/src/game/scenes/BattleScene.ts`: 「撤退中」文字を生成せず、復活コマンド成功時に味方カードの追跡位置と回転角をリセットする。

### Task 1: 戦闘フィールドを旧寸法へ戻してHUDを再配置する

**Files:**
- Modify: `src/client/src/game/ui/battleLayout.test.ts`
- Modify: `src/client/src/game/ui/battleLayout.ts`

**Interfaces:**
- Consumes: `calculateBattleLayout(width: number, height: number): BattleLayout`
- Produces: `field={x:64.4,y:8,width:515.2,height:368}`、`waitingArea={x:64.4,y:384,width:515.2,height:74}` を含む `BattleLayout`

- [ ] **Step 1: 固定寸法の失敗テストを書く**

`battleLayout.test.ts` の先頭テストを次の期待値へ更新する。

```ts
test("644x468内で旧フィールド寸法と細い左HUDと待機場所を配置する", () => {
  const layout = calculateBattleLayout(gameViewport.width, gameViewport.height);

  assert.deepEqual(layout.leftPanel, { x: 6, y: 8, width: 50, height: 368 });
  assert.deepEqual(layout.cpuHp, { x: 15, y: 28, width: 8, height: 146 });
  assert.deepEqual(layout.playerHp, { x: 15, y: 202, width: 8, height: 146 });
  assert.deepEqual(layout.mp, { x: 43, y: 28, width: 8, height: 146 });
  assert.deepEqual(layout.summonGauge, { x: 43, y: 202, width: 8, height: 146 });
  assert.deepEqual(layout.field, { x: 64.4, y: 8, width: 515.2, height: 368 });
  assert.deepEqual(layout.waitingArea, { x: 64.4, y: 384, width: 515.2, height: 74 });
  assert.deepEqual(layout.remainingTime, { x: 591.6, y: 8, width: 52, height: 53 });
  assert.deepEqual(layout.buildButton, { x: 591.6, y: 69, width: 52, height: 52 });
  assert.deepEqual(layout.summonButton, { x: 591.6, y: 129, width: 52, height: 52 });
  assert.deepEqual(layout.retryButton, { x: 591.6, y: 189, width: 52, height: 52 });
  assert.equal(layout.waitingArea.y + layout.waitingArea.height, 458);
});
```

HUD入力テストの待機場所点を `(70, 390)`、戦場内点を `(70, 20)` へ更新する。

- [ ] **Step 2: レイアウトテストを実行して正しく失敗することを確認する**

Run: `node --import tsx --test src/client/src/game/ui/battleLayout.test.ts`

Expected: 旧実装の `field.width` が `456` のため、期待値 `515.2` との比較でFAILする。

- [ ] **Step 3: 固定矩形を最小変更する**

`calculateBattleLayout` の返却値を次の値へ変更する。

```ts
return {
  leftPanel: { x: 6, y: 8, width: 50, height: 368 },
  cpuHp: { x: 15, y: 28, width: 8, height: 146 },
  playerHp: { x: 15, y: 202, width: 8, height: 146 },
  mp: { x: 43, y: 28, width: 8, height: 146 },
  summonGauge: { x: 43, y: 202, width: 8, height: 146 },
  field: { x: 64.4, y: 8, width: 515.2, height: 368 },
  waitingArea: {
    x: 64.4,
    y: 384,
    width: 515.2,
    height: roundToTenth(height - 384 - 10)
  },
  remainingTime: { x: buttonX, y: 8, width: buttonSize, height: 53 },
  buildButton: { x: buttonX, y: 69, width: buttonSize, height: buttonSize },
  summonButton: { x: buttonX, y: 129, width: buttonSize, height: buttonSize },
  retryButton: { x: buttonX, y: 189, width: buttonSize, height: buttonSize }
};
```

- [ ] **Step 4: レイアウトテストを再実行する**

Run: `node --import tsx --test src/client/src/game/ui/battleLayout.test.ts`

Expected: PASS。

- [ ] **Step 5: Task 1をコミットする**

```powershell
git add -- src/client/src/game/ui/battleLayout.ts src/client/src/game/ui/battleLayout.test.ts
git commit -m "fix: 戦闘フィールドの旧寸法を維持"
```

### Task 2: 待機カードを低い領域へ縮小して「撤退中」を削除する

**Files:**
- Modify: `src/client/src/game/ui/defeatedUnitLayout.test.ts`
- Modify: `src/client/src/game/ui/defeatedUnitLayout.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**
- Consumes: `calculateDefeatedUnitLayout(area: UiRect, unitIds: readonly PlayerUnitId[]): DefeatedUnitCardLayout[]`
- Produces: 上部ラベル用領域を予約せず、内側余白8pxを除く縦幅へ収まる共通縮尺

- [ ] **Step 1: 74px高の待機場所を表す失敗テストを書く**

`defeatedUnitLayout.test.ts` の縦幅テストを次の内容へ更新する。

```ts
test("待機カードは74pxの待機場所へ上部ラベルなしで等比縮小される", () => {
  const layouts = calculateDefeatedUnitLayout(
    { x: 64.4, y: 384, width: 515.2, height: 74 },
    ["PlayerMelee"]
  );

  assert.equal(layouts.length, 1);
  assert.equal(layouts[0].unitId, "PlayerMelee");
  assert.equal(layouts[0].rect.y, 392);
  assert(layouts[0].rect.height <= 58);
  assert.equal(layouts[0].rect.width / layouts[0].rect.height, 54 / 76);
});
```

3枚テストの待機場所を `{ x: 64.4, y: 384, width: 515.2, height: 74 }` に変更し、全矩形の下端が `458` 以下であることも追加する。

```ts
assert(layouts.every((layout) => layout.rect.y + layout.rect.height <= 458));
```

- [ ] **Step 2: 待機カードテストを実行して正しく失敗することを確認する**

Run: `node --import tsx --test src/client/src/game/ui/defeatedUnitLayout.test.ts`

Expected: 現実装が `labelHeight=16` を加算するため `rect.y` が `408` となり、期待値 `392` との比較でFAILする。

- [ ] **Step 3: 上部ラベル用領域の予約を削除する**

`defeatedUnitLayout.ts` から `labelHeight` を削除し、利用可能高とY座標を次の式へ変更する。

```ts
const availableHeight = Math.max(0, area.height - innerPadding * 2);

// map内
y: area.y + innerPadding,
```

- [ ] **Step 4: 待機場所の「撤退中」オブジェクトを削除する**

`BattleScene.ts` から次を削除する。

- `waitingAreaStatusLabel` フィールド。
- `create()` 内の `this.add.text(..., "撤退中", ...)` 生成処理。
- `draw()` 内の `this.waitingAreaStatusLabel.setVisible(...)`。

`defeatedUnitLabels` と `LV${unit.stats.level} / COST${unit.stats.revivalCost}` は削除しない。

- [ ] **Step 5: 待機カードテストと型検査を実行する**

Run: `node --import tsx --test src/client/src/game/ui/defeatedUnitLayout.test.ts`

Expected: PASS。

Run: `npm.cmd run typecheck -w src/client`

Expected: `waitingAreaStatusLabel` の残存参照がなくPASS。

- [ ] **Step 6: Task 2をコミットする**

```powershell
git add -- src/client/src/game/ui/defeatedUnitLayout.ts src/client/src/game/ui/defeatedUnitLayout.test.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "fix: 待機カードを低い領域へ収める"
```

### Task 3: 味方カードを復活直後に上向きへ戻す

**Files:**
- Modify: `src/client/src/game/render/cardFacing.test.ts`
- Modify: `src/client/src/game/render/cardFacing.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**
- Consumes: `initialCardRotation(team: TeamId): number`
- Produces: `cardRotationAfterRevival(team: TeamId): number`
- Scene integration: 復活コマンド成功後、`unitCardPositions` から対象IDを削除し、`unitCardRotations` に復活回転角を保存する。

- [ ] **Step 1: 復活方向の失敗テストを書く**

`cardFacing.test.ts` のimportへ `cardRotationAfterRevival` を追加し、次のテストを書く。

```ts
test("player revival faces upward without changing CPU orientation", () => {
  assert.equal(cardRotationAfterRevival("Player"), 0);
  assert.equal(cardRotationAfterRevival("Cpu"), Math.PI);
});
```

- [ ] **Step 2: カード方向テストを実行して正しく失敗することを確認する**

Run: `node --import tsx --test src/client/src/game/render/cardFacing.test.ts`

Expected: `cardRotationAfterRevival` がexportされていないためFAILする。

- [ ] **Step 3: 復活回転角の純粋関数を追加する**

`cardFacing.ts` へ次を追加する。

```ts
export function cardRotationAfterRevival(team: TeamId): number {
  return initialCardRotation(team);
}
```

- [ ] **Step 4: 復活成功時に描画追跡状態をリセットする**

`BattleScene.ts` のimportへ `cardRotationAfterRevival` を追加する。`handleRevivalPointerUp` で `this.session.applyCommand(transition.command)` が成功条件内で呼ばれた直後に、次を追加する。

```ts
this.unitCardPositions.delete(transition.command.unitId);
this.unitCardRotations.set(
  transition.command.unitId,
  cardRotationAfterRevival("Player")
);
```

位置追跡を削除することで、次回描画時は復活地点を直前位置として扱い、瞬間移動方向による回転を発生させない。回転角0を保存するため、停止中は上向きを維持し、その後の実移動では既存の `cardRotationForMovement` が方向を更新する。

- [ ] **Step 5: カード方向テストと復活関連テストを実行する**

Run: `node --import tsx --test src/client/src/game/render/cardFacing.test.ts src/client/src/game/input/revivalDrag.test.ts src/client/src/game/rules/resurrectionSystem.test.ts`

Expected: PASS。

Run: `npm.cmd run typecheck -w src/client`

Expected: PASS。

- [ ] **Step 6: Task 3をコミットする**

```powershell
git add -- src/client/src/game/render/cardFacing.ts src/client/src/game/render/cardFacing.test.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "fix: 味方カードを復活時に上向きへ戻す"
```

### Task 4: 全体回帰と画面確認を行う

**Files:**
- Verify: `src/client/src/game/**`

**Interfaces:**
- Consumes: Tasks 1〜3の変更済みレイアウト、待機カード縮尺、復活回転角
- Produces: 自動検証と手動画面確認の証跡

- [ ] **Step 1: クライアント全テストを実行する**

Run: `npm.cmd test -w src/client`

Expected: 全テストPASS、fail 0。

- [ ] **Step 2: リポジトリ全体の型検査を実行する**

Run: `npm.cmd run typecheck`

Expected: server、clientともにPASS。

- [ ] **Step 3: プロダクションビルドを実行する**

Run: `npm.cmd run build`

Expected: exit code 0。既存のViteチャンクサイズ警告は許容する。

- [ ] **Step 4: 差分品質を確認する**

Run: `git diff --check`

Expected: 出力なし、exit code 0。

- [ ] **Step 5: ローカル画面を確認する**

`http://localhost:65351/` を `644×468` の論理画面で開き、次を確認する。

- フィールドが変更前と同じ `515.2×368` で表示される。
- 左に2列の細い縦ゲージ、右に時間とボタン、下に待機場所が収まる。
- 撤退ユニットが3体でもカード全体が待機場所へ収まる。
- 「撤退中」が表示されないが、LV/COSTは表示される。
- 味方カードを回復エリアへ復活させると上向きになり、次に移動すると移動方向を向く。
- 回復エリア外へのドロップでは復活しない。

- [ ] **Step 6: 最終状態を確認する**

Run: `git status --short --branch`

Expected: 実装対象ファイルに未コミット差分がなく、作業開始前から存在する未追跡ファイルだけが残る。
