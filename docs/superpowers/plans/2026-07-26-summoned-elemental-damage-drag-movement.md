# 召喚獣の対エレメンタル攻撃・ドラッグ移動・移動先マーカー実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 召喚獣が敵エレメンタルを接触攻撃でき、プレイヤーユニットを本体から目的地までドラッグして移動指示し、到着まで移動先マーカーを表示できるようにする。

**Architecture:** 戦闘ルールは既存の `summonSystem.ts` へ敵エレメンタルの接触対象を追加する。入力の確定条件とマーカー維持条件はPhaserに依存しない `dragMovement.ts` へ分離し、`BattleScene.ts` はポインターイベント、座標変換、コマンド発行、マーカー描画だけを担当する。

**Tech Stack:** TypeScript 5.8、Phaser 3.90、Node.js test runner、tsx、Vite

## Global Constraints

- 新しいランタイム依存関係と画像アセットは追加しない。
- 召喚獣の既存パラメータ、CPU移動計画、ゲーム状態の通信型は変更しない。
- ドラッグは生存中の自軍通常ユニット本体からのみ開始できる。
- 移動先マーカーはプレイヤーユニットだけに表示し、到着または撃破で消去する。
- 既存の未コミット画像、既存の未追跡ファイルには触れず、各コミットには当該タスクのファイルだけを含める。
- 実装コードより先に失敗するテストを作成し、各RED/GREENを個別に確認する。

---

## ファイル構成

- 作成: `src/client/src/game/input/dragMovement.ts`
  - ドラッグ確定可否と移動先マーカー維持可否を判定する純粋関数を提供する。
- 作成: `src/client/src/game/input/dragMovement.test.ts`
  - 有効・無効なドラッグ解放条件と、移動中・到着・撃破のマーカー条件を検証する。
- 変更: `src/client/src/game/rules/summonSystem.ts`
  - 接触中の敵エレメンタルを抽出し、攻撃・減速へ含める。
- 変更: `src/client/src/game/rules/summonSystem.test.ts`
  - 召喚獣のエレメンタル攻撃対象、攻撃間隔、対象外条件、同時攻撃、減速を検証する。
- 変更: `src/client/src/game/scenes/BattleScene.ts`
  - クリック移動を廃止し、ドラッグ開始・解放、移動コマンド、マーカー状態と描画を接続する。

### Task 1: ドラッグ確定条件とマーカー維持条件

**Files:**

- Create: `src/client/src/game/input/dragMovement.ts`
- Test: `src/client/src/game/input/dragMovement.test.ts`

**Interfaces:**

- Consumes: `UnitState`、`distanceSq(a: Vec2, b: Vec2): number`
- Produces:
  - `DragReleaseContext`
  - `canCommitDragMovement(context: DragReleaseContext): boolean`
  - `shouldKeepMoveMarker(unit: Pick<UnitState, "currentHp" | "mode" | "position" | "destination">): boolean`

- [ ] **Step 1: ドラッグ解放条件の失敗テストを書く**

`src/client/src/game/input/dragMovement.test.ts` を作成する。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { canCommitDragMovement } from "./dragMovement";

test("進行中の試合で生存ユニットを戦場内へドラッグした場合だけ移動を確定する", () => {
  const valid = {
    matchInProgress: true,
    overHud: false,
    insideBattlefield: true,
    targetUnitAlive: true
  };

  assert.equal(canCommitDragMovement(valid), true);
  assert.equal(canCommitDragMovement({ ...valid, matchInProgress: false }), false);
  assert.equal(canCommitDragMovement({ ...valid, overHud: true }), false);
  assert.equal(canCommitDragMovement({ ...valid, insideBattlefield: false }), false);
  assert.equal(canCommitDragMovement({ ...valid, targetUnitAlive: false }), false);
});
```

- [ ] **Step 2: REDを確認する**

Run:

```powershell
node --import tsx --test src/client/src/game/input/dragMovement.test.ts
```

Expected: `Cannot find module './dragMovement'` でFAIL。

- [ ] **Step 3: ドラッグ確定条件を最小実装する**

`src/client/src/game/input/dragMovement.ts` を作成する。

```ts
import type { UnitState } from "../core/types";
import { distanceSq } from "../core/vector";

export type DragReleaseContext = {
  matchInProgress: boolean;
  overHud: boolean;
  insideBattlefield: boolean;
  targetUnitAlive: boolean;
};

export function canCommitDragMovement(context: DragReleaseContext): boolean {
  return (
    context.matchInProgress &&
    !context.overHud &&
    context.insideBattlefield &&
    context.targetUnitAlive
  );
}
```

- [ ] **Step 4: ドラッグ確定条件のGREENを確認する**

Run:

```powershell
node --import tsx --test src/client/src/game/input/dragMovement.test.ts
```

Expected: 1 test PASS。

- [ ] **Step 5: マーカー維持条件の失敗テストを追加する**

同じテストファイルへ追加する。

```ts
import type { UnitState } from "../core/types";
import { canCommitDragMovement, shouldKeepMoveMarker } from "./dragMovement";

test("生存中で目的地へ未到着のユニットだけ移動先マーカーを維持する", () => {
  assert.equal(shouldKeepMoveMarker(markerUnit()), true);
  assert.equal(
    shouldKeepMoveMarker(markerUnit({ position: { x: 1, y: 0 } })),
    false
  );
  assert.equal(shouldKeepMoveMarker(markerUnit({ currentHp: 0 })), false);
  assert.equal(shouldKeepMoveMarker(markerUnit({ mode: "Defeated" })), false);
});

function markerUnit(
  overrides: Partial<Pick<UnitState, "currentHp" | "mode" | "position" | "destination">> = {}
): Pick<UnitState, "currentHp" | "mode" | "position" | "destination"> {
  return {
    currentHp: 100,
    mode: "Active",
    position: { x: 0, y: 0 },
    destination: { x: 1, y: 0 },
    ...overrides
  };
}
```

既存の `import { canCommitDragMovement }` 行は、上記の2関数を読み込む行へ置き換える。`UnitState` の型importは他のimport群とともにファイル先頭へ置く。

- [ ] **Step 6: マーカー条件のREDを確認する**

Run:

```powershell
node --import tsx --test src/client/src/game/input/dragMovement.test.ts
```

Expected: `shouldKeepMoveMarker is not a function` または未エクスポートによるFAIL。

- [ ] **Step 7: マーカー維持条件を最小実装する**

`dragMovement.ts` へ追加する。

```ts
export function shouldKeepMoveMarker(
  unit: Pick<UnitState, "currentHp" | "mode" | "position" | "destination">
): boolean {
  return (
    unit.currentHp > 0 &&
    unit.mode !== "Defeated" &&
    distanceSq(unit.position, unit.destination) > Number.EPSILON
  );
}
```

- [ ] **Step 8: Task 1のテストと型検査を実行する**

Run:

```powershell
node --import tsx --test src/client/src/game/input/dragMovement.test.ts
npm.cmd run typecheck -w src/client
```

Expected: 2 tests PASS、型エラー0件。

- [ ] **Step 9: Task 1をコミットする**

```powershell
git add -- src/client/src/game/input/dragMovement.ts src/client/src/game/input/dragMovement.test.ts
git commit -m "feat: ドラッグ移動の判定を追加"
```

### Task 2: 召喚獣の敵エレメンタル接触攻撃

**Files:**

- Modify: `src/client/src/game/rules/summonSystem.ts:65-123`
- Test: `src/client/src/game/rules/summonSystem.test.ts`

**Interfaces:**

- Consumes: `BattleState.elementals`、`ElementalState`、`oppositeTeam(team)`、`distance(a, b)`
- Produces: `tickSummonedUnits` が接触中の完成済み・生存中の敵エレメンタルへ `attackDamage` を適用し、接触減速へ含める。

- [ ] **Step 1: エレメンタル攻撃と攻撃間隔の失敗テストを書く**

`summonSystem.test.ts` へ、ファイル末尾のヘルパー群より前に追加する。

```ts
test("召喚獣は攻撃可能時だけ接触中の敵エレメンタルへ通常ダメージを与える", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addSummonedUnit(state, "Player", 1000);
  const summoned = state.summonedUnits[0];
  summoned.position = { x: 0, y: 0 };
  summoned.destination = { x: 0, y: 0 };
  summoned.attackDamage = 99;
  summoned.attackTimerSeconds = 2;
  summoned.healthDecayPerSecond = 0;
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Cpu",
    position: { x: 0.1, y: 0 },
    maxHp: 1000,
    currentHp: 1000,
    isComplete: true
  });

  tickSummonedUnits(state, config, 1.99);
  assert.equal(state.elementals[0].currentHp, 1000);

  tickSummonedUnits(state, config, 0.01);
  assert.equal(state.elementals[0].currentHp, 901);
  assert.equal(summoned.attackTimerSeconds, 2);
});
```

- [ ] **Step 2: REDを確認する**

Run:

```powershell
node --import tsx --test src/client/src/game/rules/summonSystem.test.ts
```

Expected: エレメンタルHPが `1000` のままで、期待値 `901` に対してFAIL。

- [ ] **Step 3: 敵エレメンタル抽出とダメージ適用を最小実装する**

`summonSystem.ts` の型importへ `ElementalState` を追加し、`tickSummonedUnits` へ次の処理を組み込む。

```ts
const touchingElementals = enemyElementalsInContact(state, config, summoned);
const hasAttackTarget =
  touchingLeader ||
  touchingUnits.length > 0 ||
  touchingSummonedUnits.length > 0 ||
  touchingElementals.length > 0;

for (const target of touchingElementals) {
  target.currentHp = Math.max(0, target.currentHp - summoned.attackDamage);
}
```

ファイル末尾へ抽出関数を追加する。

```ts
function enemyElementalsInContact(
  state: BattleState,
  config: BattleConfig,
  summoned: SummonedUnitState
): ElementalState[] {
  const enemyTeam = oppositeTeam(summoned.team);
  return state.elementals.filter(
    (elemental) =>
      elemental.team === enemyTeam &&
      distance(summoned.position, elemental.position) <= config.contactSlowRadius
  );
}
```

この段階ではTDDの最小実装として、完成状態とHPによる除外、および接触減速をまだ追加しない。

- [ ] **Step 4: 最初のGREENを確認する**

Run:

```powershell
node --import tsx --test src/client/src/game/rules/summonSystem.test.ts
```

Expected: 追加した攻撃テストを含め全件PASS。

- [ ] **Step 5: 対象外・同時攻撃・減速の失敗テストを追加する**

同じテストファイルへ追加する。

```ts
test("召喚獣は対象外エレメンタルを攻撃しない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addSummonedUnit(state, "Player", 1000);
  const summoned = state.summonedUnits[0];
  summoned.position = { x: 0, y: 0 };
  summoned.attackDamage = 99;
  summoned.healthDecayPerSecond = 0;
  state.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: 0, y: 0 }, maxHp: 1000, currentHp: 1000, isComplete: true },
    { elementalId: "Elemental2", team: "Cpu", position: { x: 0, y: 0 }, maxHp: 1000, currentHp: 1000, isComplete: false },
    { elementalId: "Elemental3", team: "Cpu", position: { x: 0, y: 0 }, maxHp: 1000, currentHp: 0, isComplete: true },
    { elementalId: "Elemental4", team: "Cpu", position: { x: 2, y: 0 }, maxHp: 1000, currentHp: 1000, isComplete: true }
  );

  tickSummonedUnits(state, config, 0.1);

  assert.deepEqual(
    state.elementals.map((elemental) => elemental.currentHp),
    [1000, 1000, 0, 1000]
  );
});

test("召喚獣は撃破済みエレメンタルだけとの接触を攻撃扱いにしない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addSummonedUnit(state, "Player", 1000);
  const summoned = state.summonedUnits[0];
  summoned.position = { x: 0, y: 0 };
  summoned.destination = { x: 7, y: 0 };
  summoned.attackTimerSeconds = 0;
  summoned.moveSpeed = 1;
  summoned.healthDecayPerSecond = 0;
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Cpu",
    position: { x: 0.1, y: 0 },
    maxHp: 1000,
    currentHp: 0,
    isComplete: true
  });

  tickSummonedUnits(state, config, 1);

  assert.equal(summoned.attackTimerSeconds, 0);
  assert.equal(summoned.position.x, 1);
});

test("召喚獣は敵ユニットと敵エレメンタルを同時攻撃し接触中は減速する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addSummonedUnit(state, "Player", 1000);
  const summoned = state.summonedUnits[0];
  summoned.position = { x: 0, y: 0 };
  summoned.destination = { x: 7, y: 0 };
  summoned.moveSpeed = 1;
  summoned.attackDamage = 99;
  summoned.healthDecayPerSecond = 0;
  const enemyUnit = state.units.find((unit) => unit.unitId === "CpuMelee")!;
  enemyUnit.position = { x: 0.1, y: 0 };
  enemyUnit.destination = { ...enemyUnit.position };
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Cpu",
    position: { x: 0.1, y: 0 },
    maxHp: 1000,
    currentHp: 1000,
    isComplete: true
  });

  tickSummonedUnits(state, config, 1);

  assert.equal(enemyUnit.currentHp, enemyUnit.stats.maxHp - 99);
  assert.equal(state.elementals[0].currentHp, 901);
  assert.equal(summoned.position.x, config.contactSlowMultiplier);
});

test("召喚獣は敵エレメンタルだけに接触している場合も減速する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addSummonedUnit(state, "Player", 1000);
  const summoned = state.summonedUnits[0];
  summoned.position = { x: 0, y: 0 };
  summoned.destination = { x: 7, y: 0 };
  summoned.moveSpeed = 1;
  summoned.attackTimerSeconds = 10;
  summoned.healthDecayPerSecond = 0;
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Cpu",
    position: { x: 0.1, y: 0 },
    maxHp: 1000,
    currentHp: 1000,
    isComplete: true
  });

  tickSummonedUnits(state, config, 1);

  assert.equal(summoned.position.x, config.contactSlowMultiplier);
});
```

- [ ] **Step 6: 対象外条件と減速のREDを確認する**

Run:

```powershell
node --import tsx --test src/client/src/game/rules/summonSystem.test.ts
```

Expected: 未完成エレメンタルが攻撃されること、撃破済みエレメンタルで攻撃タイマーが再設定されること、完成済み敵エレメンタルだけとの接触で通常速度のまま移動することによりFAIL。同時攻撃の回帰テストは、この段階でもPASSしてよい。

- [ ] **Step 7: 対象外条件と接触減速を最小実装する**

`enemyElementalsInContact` のfilterへ完成状態とHP条件を追加する。

```ts
elemental.team === enemyTeam &&
elemental.isComplete &&
elemental.currentHp > 0 &&
distance(summoned.position, elemental.position) <= config.contactSlowRadius
```

速度倍率の条件を次へ置き換える。

```ts
const speedMultiplier =
  touchingUnits.length > 0 ||
  touchingSummonedUnits.length > 0 ||
  touchingElementals.length > 0
    ? config.contactSlowMultiplier
    : 1;
```

- [ ] **Step 8: Task 2のGREENとクライアント回帰を確認する**

Run:

```powershell
node --import tsx --test src/client/src/game/rules/summonSystem.test.ts
npm.cmd test -w src/client
npm.cmd run typecheck -w src/client
```

Expected: 関連テストとクライアント全テストがPASS、型エラー0件。

- [ ] **Step 9: Task 2をコミットする**

```powershell
git add -- src/client/src/game/rules/summonSystem.ts src/client/src/game/rules/summonSystem.test.ts
git commit -m "feat: 召喚獣が敵エレメンタルを攻撃"
```

### Task 3: BattleSceneのドラッグ操作と移動先マーカー

**Files:**

- Modify: `src/client/src/game/scenes/BattleScene.ts:1-149`
- Modify: `src/client/src/game/scenes/BattleScene.ts:218-233`
- Modify: `src/client/src/game/scenes/BattleScene.ts:526-559`

**Interfaces:**

- Consumes:
  - `canCommitDragMovement(context: DragReleaseContext): boolean`
  - `shouldKeepMoveMarker(unit): boolean`
  - `GameSession.applyCommand(command)`
  - `fieldBounds().contains(x, y)`
- Produces: ユニット本体から始まるドラッグ移動、プレイヤーユニット別移動先マーカー、従来の空き戦場クリック移動の廃止。

- [ ] **Step 1: 変更前のシーン型検査を基準として実行する**

Run:

```powershell
npm.cmd run typecheck -w src/client
```

Expected: 型エラー0件。既存エラーがあれば実装を始めず、その出力を記録する。

- [ ] **Step 2: フィールドとイベント接続をドラッグ方式へ変更する**

`BattleScene.ts` へimportを追加する。

```ts
import { canCommitDragMovement, shouldKeepMoveMarker } from "../input/dragMovement";
```

クラスフィールドへ追加する。

```ts
private draggedUnitId: PlayerUnitId | null = null;
private moveMarkers = new Map<PlayerUnitId, Vec2>();
```

`create()` で毎回初期化する。

```ts
this.draggedUnitId = null;
this.moveMarkers = new Map();
```

既存の `pointerdown` 接続と初期HUDメッセージを置き換え、`pointerup` を追加する。

```ts
this.hud.setStatus("Drag a player unit to move.");
this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer));
this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => this.handlePointerUp(pointer));
```

- [ ] **Step 3: 旧クリック処理をドラッグ開始・解放処理へ置き換える**

`handlePointer` を削除し、次の2メソッドを追加する。

```ts
private handlePointerDown(pointer: Phaser.Input.Pointer): void {
  this.draggedUnitId = null;
  if (this.hud.contains(pointer.x, pointer.y) || this.session.state.result !== "InProgress") {
    return;
  }

  const unit = this.findPlayerUnitNear(pointer.x, pointer.y);
  if (!unit) {
    this.hud.setStatus("Drag a player unit to move.");
    return;
  }

  this.selectedUnitId = unit.unitId;
  this.draggedUnitId = unit.unitId;
  this.hud.setStatus(`${unit.unitType} selected. Drag to move.`);
}

private handlePointerUp(pointer: Phaser.Input.Pointer): void {
  const draggedUnitId = this.draggedUnitId;
  this.draggedUnitId = null;
  if (!draggedUnitId) {
    return;
  }

  const unit = this.session.state.units.find(
    (candidate) => candidate.unitId === draggedUnitId
  );
  const canCommit = canCommitDragMovement({
    matchInProgress: this.session.state.result === "InProgress",
    overHud: this.hud.contains(pointer.x, pointer.y),
    insideBattlefield: this.fieldBounds().contains(pointer.x, pointer.y),
    targetUnitAlive: unit !== undefined && isUnitAlive(unit)
  });
  if (!canCommit || !unit) {
    return;
  }

  const targetPosition = this.screenToWorld(pointer.x, pointer.y);
  this.session.applyCommand({
    commandType: "MoveUnit",
    team: "Player",
    unitId: draggedUnitId,
    targetPosition
  });
  this.moveMarkers.set(draggedUnitId, { ...targetPosition });
  this.hud.setStatus(`${unit.unitType} moving.`);
}
```

- [ ] **Step 4: マーカーの消去と描画を追加する**

`draw()` でユニット描画前にマーカーを更新・描画する。

```ts
this.pruneMoveMarkers(state.units);
this.drawMoveMarkers();
this.drawUnits(state.units);
```

次のメソッドを追加する。

```ts
private pruneMoveMarkers(units: UnitState[]): void {
  for (const [unitId] of this.moveMarkers) {
    const unit = units.find((candidate) => candidate.unitId === unitId);
    if (!unit || !shouldKeepMoveMarker(unit)) {
      this.moveMarkers.delete(unitId);
    }
  }
}

private drawMoveMarkers(): void {
  this.battlefieldOverlay.lineStyle(2, 0xfacc15, 0.9);
  for (const marker of this.moveMarkers.values()) {
    const screen = this.worldToScreen(marker);
    this.battlefieldOverlay.strokeCircle(screen.x, screen.y, 10);
    this.battlefieldOverlay.lineBetween(screen.x - 6, screen.y, screen.x + 6, screen.y);
    this.battlefieldOverlay.lineBetween(screen.x, screen.y - 6, screen.x, screen.y + 6);
  }
}
```

- [ ] **Step 5: 型検査と関連テストを実行する**

Run:

```powershell
npm.cmd run typecheck -w src/client
node --import tsx --test src/client/src/game/input/dragMovement.test.ts
```

Expected: 型エラー0件、ドラッグ・マーカーテスト2件PASS。

- [ ] **Step 6: プロダクションビルドでPhaser接続を検証する**

Run:

```powershell
npm.cmd run build -w src/client
```

Expected: TypeScriptコンパイルとViteビルドがexit code 0。

- [ ] **Step 7: ブラウザーで操作を確認する**

Run:

```powershell
npm.cmd run dev:client
```

ブラウザーで `http://localhost:5173` を開き、次を確認する。

1. 自軍ユニットを戦場内へドラッグすると、その位置へ移動する。
2. 戦場の空き位置をクリックしても移動先が変わらない。
3. HUDまたは戦場外で離すと移動先が変わらない。
4. 移動指示位置へ黄色の円と十字が表示され、到着時に消える。
5. 移動中に同じユニットを別地点へドラッグするとマーカー位置が更新される。
6. ユニットを選択した後、既存のBuild操作が選択ユニットへ作用する。
7. 召喚獣が敵エレメンタルへ接触すると、攻撃間隔ごとにエレメンタルHPが減る。

- [ ] **Step 8: Task 3をコミットする**

```powershell
git add -- src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: ユニット移動をドラッグ操作へ変更"
```

### Task 4: 最終回帰検証

**Files:**

- Verify only: `src/client/src/game/input/dragMovement.ts`
- Verify only: `src/client/src/game/input/dragMovement.test.ts`
- Verify only: `src/client/src/game/rules/summonSystem.ts`
- Verify only: `src/client/src/game/rules/summonSystem.test.ts`
- Verify only: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**

- Consumes: Tasks 1〜3の全成果物
- Produces: テスト、型検査、全体ビルドの最新検証結果

- [ ] **Step 1: 差分の対象範囲と空白エラーを確認する**

Run:

```powershell
git status --short
git diff --check HEAD~3..HEAD
git diff --stat HEAD~3..HEAD
```

Expected: Tasks 1〜3の3コミットには上記5ソース・テストファイルだけが含まれ、空白エラー0件。ユーザー所有の未コミット画像・未追跡ファイルはコミットされていない。

- [ ] **Step 2: クライアント全テストを実行する**

Run:

```powershell
npm.cmd test -w src/client
```

Expected: FAIL 0件。

- [ ] **Step 3: リポジトリ全体の型検査を実行する**

Run:

```powershell
npm.cmd run typecheck
```

Expected: サーバー・クライアントとも型エラー0件。

- [ ] **Step 4: リポジトリ全体をビルドする**

Run:

```powershell
npm.cmd run build
```

Expected: サーバー・クライアントともexit code 0。

- [ ] **Step 5: 要件ごとの実装箇所を照合する**

次の対応を差分で確認する。

1. 召喚獣の敵エレメンタル攻撃: `summonSystem.ts` と `summonSystem.test.ts`
2. ユニット本体からのドラッグ移動: `BattleScene.ts` と `dragMovement.ts`
3. 移動先マーカーの表示・更新・消去: `BattleScene.ts` と `dragMovement.test.ts`
4. 旧クリック移動の廃止: `BattleScene.ts` に旧 `handlePointer` と空き戦場クリックからの `MoveUnit` 発行が残っていないこと

- [ ] **Step 6: 最終状態を確認する**

Run:

```powershell
git status --short
git log -4 --oneline
```

Expected: Tasks 1〜3のコミットが並び、ユーザー所有の既存変更だけが未コミット状態として残る。
