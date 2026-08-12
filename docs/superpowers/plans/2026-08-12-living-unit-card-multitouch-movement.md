# 生存ユニットカードのマルチタッチ移動 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生存プレイヤーユニットカードをポインターごとに独立して保持し、カード枚数に固定上限を設けず複数カードへ同時に移動命令を設定できるようにする。

**Architecture:** Phaserに依存しない`dragMovement.ts`で、`Map<pointerId, unitId>`の開始・解除・解放遷移を純粋関数として管理する。`BattleScene`はポインターイベントと座標変換を担当し、既存の移動コマンド処理を再利用する。復活ドラッグは単一操作のまま、開始したポインターIDだけを追加で追跡する。

**Tech Stack:** TypeScript、Phaser 3.90.0、Node.js test runner、tsx、Vite

## Global Constraints

- 設計書は`docs/superpowers/specs/2026-08-12-living-unit-card-multitouch-movement-design.md`を正とする。
- 生存カードのドラッグ状態は`Map<number, PlayerUnitId>`で保持し、カード枚数を固定値で制限しない。
- Phaserの`input.activePointers`はフレームワーク上限の`10`とする。
- 同じ生存カードを複数ポインターへ割り当てない。
- あるポインターの解放や無効操作は、ほかのポインターの状態を変更しない。
- 復活カードは既存の単一ドラッグ仕様を維持する。
- リポジトリ内の設計書、計画書、調査メモは日本語で記述する。

---

### Task 1: ポインター単位のドラッグ状態遷移

**Files:**
- Modify: `src/client/src/game/input/dragMovement.ts:26-77`
- Test: `src/client/src/game/input/dragMovement.test.ts`

**Interfaces:**
- Consumes: 既存の`PlayerUnitId`、`Vec2`、`DragReleaseContext`、`transitionDragRelease`
- Produces: `PointerDragState`、`transitionPointerDragStart`、`clearPointerDrag`、`transitionPointerDragRelease`

- [ ] **Step 1: 開始状態遷移の失敗テストを書く**

`dragMovement.test.ts`のimportへ新しい関数を追加し、異なるポインターには異なるユニットを割り当てられ、同じユニットの重複割り当ては拒否されるテストを書く。

```ts
test("assigns different living units to independent pointers", () => {
  const first = transitionPointerDragStart(new Map(), 17, "PlayerMelee");
  const second = transitionPointerDragStart(
    first.draggedUnitIdsByPointer,
    99,
    "PlayerSpeed"
  );

  assert.equal(first.started, true);
  assert.equal(second.started, true);
  assert.deepEqual([...second.draggedUnitIdsByPointer], [
    [17, "PlayerMelee"],
    [99, "PlayerSpeed"]
  ]);
});

test("does not assign one unit to multiple pointers", () => {
  const first = transitionPointerDragStart(new Map(), 1, "PlayerMelee");
  const duplicate = transitionPointerDragStart(
    first.draggedUnitIdsByPointer,
    2,
    "PlayerMelee"
  );

  assert.equal(duplicate.started, false);
  assert.deepEqual([...duplicate.draggedUnitIdsByPointer], [[1, "PlayerMelee"]]);
});
```

- [ ] **Step 2: テストを実行して期待どおり失敗することを確認する**

Run: `npm.cmd test -w src/client -- --test-name-pattern="independent pointers|multiple pointers"`

Expected: `transitionPointerDragStart`がexportされていないためFAIL。

- [ ] **Step 3: 開始状態遷移を最小実装する**

`dragMovement.ts`へ次の型と関数を追加する。元のMapは変更しない。同じポインターの古い割り当ては削除し、別ポインターに同じユニットが存在すれば開始を拒否する。

```ts
export type PointerDragState = ReadonlyMap<number, PlayerUnitId>;

export type PointerDragStartTransition = {
  draggedUnitIdsByPointer: Map<number, PlayerUnitId>;
  started: boolean;
};

export function transitionPointerDragStart(
  state: PointerDragState,
  pointerId: number,
  unitId: PlayerUnitId
): PointerDragStartTransition {
  const draggedUnitIdsByPointer = new Map(state);
  draggedUnitIdsByPointer.delete(pointerId);
  if ([...draggedUnitIdsByPointer.values()].includes(unitId)) {
    return { draggedUnitIdsByPointer, started: false };
  }
  draggedUnitIdsByPointer.set(pointerId, unitId);
  return { draggedUnitIdsByPointer, started: true };
}
```

- [ ] **Step 4: 開始状態遷移テストが通ることを確認する**

Run: `npm.cmd test -w src/client -- --test-name-pattern="independent pointers|multiple pointers"`

Expected: 2 tests PASS。

- [ ] **Step 5: 個別解除と解放順序の失敗テストを書く**

```ts
test("clears only the specified pointer drag", () => {
  const prior = new Map<number, PlayerUnitId>([
    [1, "PlayerMelee"],
    [2, "PlayerSpeed"]
  ]);

  const next = clearPointerDrag(prior, 1);

  assert.deepEqual([...next], [[2, "PlayerSpeed"]]);
  assert.equal(prior.size, 2);
});

test("releases pointers in any order for their assigned units", () => {
  const state = {
    draggedUnitIdsByPointer: new Map<number, PlayerUnitId>([
      [1, "PlayerMelee"],
      [2, "PlayerSpeed"]
    ]),
    moveMarkers: new Map<PlayerUnitId, Vec2>()
  };
  const speed = transitionPointerDragRelease(
    state,
    2,
    validRelease,
    { x: 3, y: -1 }
  );
  const melee = transitionPointerDragRelease(
    {
      draggedUnitIdsByPointer: speed.draggedUnitIdsByPointer,
      moveMarkers: speed.moveMarkers
    },
    1,
    validRelease,
    { x: 4, y: -2 }
  );

  assert.equal(speed.command?.unitId, "PlayerSpeed");
  assert.deepEqual([...speed.draggedUnitIdsByPointer], [[1, "PlayerMelee"]]);
  assert.equal(melee.command?.unitId, "PlayerMelee");
  assert.equal(melee.draggedUnitIdsByPointer.size, 0);
});

test("invalid release clears only its pointer", () => {
  const transition = transitionPointerDragRelease(
    {
      draggedUnitIdsByPointer: new Map<number, PlayerUnitId>([
        [1, "PlayerMelee"],
        [2, "PlayerSpeed"]
      ]),
      moveMarkers: new Map()
    },
    1,
    { ...validRelease, insideBattlefield: false },
    { x: 4, y: -2 }
  );

  assert.equal(transition.command, null);
  assert.deepEqual([...transition.draggedUnitIdsByPointer], [[2, "PlayerSpeed"]]);
});
```

テストファイルの型importへ`PlayerUnitId`と`Vec2`を追加する。

- [ ] **Step 6: 個別解除と解放順序テストを実行して期待どおり失敗することを確認する**

Run: `npm.cmd test -w src/client -- --test-name-pattern="specified pointer|any order|invalid release clears only"`

Expected: `clearPointerDrag`と`transitionPointerDragRelease`がexportされていないためFAIL。

- [ ] **Step 7: 個別解除と解放遷移を最小実装する**

```ts
export function clearPointerDrag(
  state: PointerDragState,
  pointerId: number
): Map<number, PlayerUnitId> {
  const draggedUnitIdsByPointer = new Map(state);
  draggedUnitIdsByPointer.delete(pointerId);
  return draggedUnitIdsByPointer;
}

export type PointerDragMovementState = {
  draggedUnitIdsByPointer: PointerDragState;
  moveMarkers: ReadonlyMap<PlayerUnitId, Vec2>;
};

export type PointerDragReleaseTransition = {
  draggedUnitIdsByPointer: Map<number, PlayerUnitId>;
  moveMarkers: Map<PlayerUnitId, Vec2>;
  command: DragReleaseTransition["command"];
};

export function transitionPointerDragRelease(
  state: PointerDragMovementState,
  pointerId: number,
  context: DragReleaseContext,
  targetPosition: Vec2
): PointerDragReleaseTransition {
  const draggedUnitId = state.draggedUnitIdsByPointer.get(pointerId) ?? null;
  const release = transitionDragRelease(
    { draggedUnitId, moveMarkers: state.moveMarkers },
    context,
    targetPosition
  );
  return {
    draggedUnitIdsByPointer: clearPointerDrag(
      state.draggedUnitIdsByPointer,
      pointerId
    ),
    moveMarkers: release.moveMarkers,
    command: release.command
  };
}
```

- [ ] **Step 8: 入力モジュールの全テストを実行する**

Run: `node --import tsx --test src/client/src/game/input/dragMovement.test.ts`

Expected: 全テストPASS。既存の単一ドラッグ、Setup初期配置、マーカー更新テストも維持される。

- [ ] **Step 9: Task 1をコミットする**

```powershell
git add -- src/client/src/game/input/dragMovement.ts src/client/src/game/input/dragMovement.test.ts
git commit -m "生存カードのポインター別ドラッグ状態を追加"
```

---

### Task 2: Phaser入力とBattleSceneのマルチタッチ統合

**Files:**
- Modify: `src/client/src/main.ts:7-19`
- Modify: `src/client/src/game/scenes/BattleScene.ts:4-8,114-120,143-209,228-380`

**Interfaces:**
- Consumes: Task 1の`transitionPointerDragStart`、`clearPointerDrag`、`transitionPointerDragRelease`
- Produces: ポインター単位で独立した生存カード移動と、開始ポインターを識別する単一復活ドラッグ

- [ ] **Step 1: Phaserの入力ポインター上限を設定する**

`main.ts`のGame Configへ次を追加する。

```ts
input: {
  activePointers: 10
},
```

設定値自体はPhaserの構成宣言なのでTDD対象外とし、Task末尾の型検査とビルドで検証する。

- [ ] **Step 2: BattleSceneの状態とイベント接続をポインター単位へ変更する**

importを次の関数へ置き換える。

```ts
import {
  clearPointerDrag,
  shouldKeepMoveMarker,
  transitionPointerDragRelease,
  transitionPointerDragStart
} from "../input/dragMovement";
```

フィールドと初期化を次の形にする。

```ts
private draggedUnitIdsByPointer = new Map<number, PlayerUnitId>();
private revivalDraggedUnitId: PlayerUnitId | null = null;
private revivalDragPointerId: number | null = null;
```

```ts
this.draggedUnitIdsByPointer = new Map();
this.revivalDraggedUnitId = null;
this.revivalDragPointerId = null;
```

`pointerupoutside`はpointerを受け取り、該当ポインターだけを解除する。

```ts
this.input.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => {
  this.draggedUnitIdsByPointer = clearPointerDrag(
    this.draggedUnitIdsByPointer,
    pointer.id
  );
  if (this.revivalDragPointerId === pointer.id) {
    this.clearRevivalDrag();
  }
});
```

試合終了時は`this.draggedUnitIdsByPointer.clear()`を実行し、全生存カードドラッグを解除する。

- [ ] **Step 3: pointerdownとpointermoveを独立処理へ変更する**

`handlePointerDown`の冒頭では、押下したポインターだけを解除する。

```ts
this.draggedUnitIdsByPointer = clearPointerDrag(
  this.draggedUnitIdsByPointer,
  pointer.id
);
if (this.revivalDragPointerId === pointer.id) {
  this.clearRevivalDrag();
}
```

利用可能な復活カードを掴んだときは、復活ドラッグが未開始の場合だけ次を設定する。

```ts
this.revivalDraggedUnitId = defeatedCard.unitId;
this.revivalDragPointerId = pointer.id;
this.revivalPointerPosition = point;
```

生存カードのヒット時は開始遷移を実行し、成功した場合だけ選択状態を更新する。

```ts
const transition = transitionPointerDragStart(
  this.draggedUnitIdsByPointer,
  pointer.id,
  unit.unitId
);
this.draggedUnitIdsByPointer = transition.draggedUnitIdsByPointer;
if (transition.started) {
  this.selectedUnitId = unit.unitId;
}
```

復活カードの`pointermove`は開始ポインターだけを受け付ける。

```ts
if (
  !this.revivalDraggedUnitId
  || this.revivalDragPointerId !== pointer.id
) {
  return;
}
```

- [ ] **Step 4: pointerupを生存カード優先の独立解放へ変更する**

`handlePointerUp`では最初に`pointer.id`の生存カード割り当てを取得する。割り当てがある場合だけ`transitionPointerDragRelease`を呼び、結果を保存してコマンドを適用してからreturnする。

```ts
const draggedUnitId = this.draggedUnitIdsByPointer.get(pointer.id) ?? null;
if (draggedUnitId) {
  const unit = this.session.state.units.find(
    (candidate) => candidate.unitId === draggedUnitId
  );
  const transition = transitionPointerDragRelease(
    {
      draggedUnitIdsByPointer: this.draggedUnitIdsByPointer,
      moveMarkers: this.moveMarkers
    },
    pointer.id,
    {
      phase: this.session.state.phase,
      overHud: this.hud.contains(point.x, point.y),
      insideBattlefield: this.fieldBounds().contains(point.x, point.y),
      targetUnitAlive: unit !== undefined && isUnitAlive(unit)
    },
    this.screenToWorld(point.x, point.y)
  );
  this.draggedUnitIdsByPointer = transition.draggedUnitIdsByPointer;
  this.moveMarkers = transition.moveMarkers;
  if (transition.command && unit) {
    this.session.applyCommand(transition.command);
  }
  return;
}
```

生存カード割り当てがない場合は、`this.revivalDragPointerId === pointer.id`のときだけ既存の復活解放処理を呼ぶ。それ以外のpointerupは何もしない。

`clearRevivalDrag`へ次を追加する。

```ts
this.revivalDragPointerId = null;
```

- [ ] **Step 5: 型検査で統合漏れを確認する**

Run: `npm.cmd run typecheck -w src/client`

Expected: PASS。古い`draggedUnitId`または`transitionDragRelease`参照が残っている場合は、ポインター単位の状態へ置き換えて再実行する。

- [ ] **Step 6: クライアント単体テストを実行する**

Run: `npm.cmd test -w src/client`

Expected: 全テストPASS。

- [ ] **Step 7: プロダクションビルドを実行する**

Run: `npm.cmd run build -w src/client`

Expected: TypeScriptとViteビルドが成功し、エラーと警告がない。

- [ ] **Step 8: Task 2をコミットする**

```powershell
git add -- src/client/src/main.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "生存カードのマルチタッチ移動に対応"
```

---

### Task 3: 最終回帰検証

**Files:**
- Verify: `src/client/src/game/input/dragMovement.ts`
- Verify: `src/client/src/game/input/dragMovement.test.ts`
- Verify: `src/client/src/game/scenes/BattleScene.ts`
- Verify: `src/client/src/main.ts`

**Interfaces:**
- Consumes: Task 1とTask 2の完成物
- Produces: 検証済みのマルチタッチ移動機能

- [ ] **Step 1: 差分の整合性を確認する**

Run: `git diff HEAD~2 --check`

Expected: 空出力。

Run: `rg -n "draggedUnitId|draggedUnitIdsByPointer|revivalDragPointerId|activePointers" src/client/src/main.ts src/client/src/game/scenes/BattleScene.ts src/client/src/game/input/dragMovement.ts`

Expected: 生存カードのScene状態に単一`draggedUnitId`が残らず、`transitionDragRelease`内の局所状態と復活用`revivalDraggedUnitId`だけが単一IDとして残る。

- [ ] **Step 2: クライアントの全テストとワークスペース全体の型検査を実行する**

Run: `npm.cmd test -w src/client`

Expected: クライアントの全テストPASS。

Run: `npm.cmd run typecheck`

Expected: サーバーとクライアントの型検査PASS。

- [ ] **Step 3: ワークスペース全体をビルドする**

Run: `npm.cmd run build`

Expected: 全ワークスペースのビルドが成功する。

- [ ] **Step 4: 作業ツリーを確認する**

Run: `git status --short`

Expected: 意図した変更がすべてコミット済みで空出力。
