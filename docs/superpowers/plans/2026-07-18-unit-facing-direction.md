# ユニット向き表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通常ユニットと召喚獣がCPU側で上下逆に待機し、移動方向へ回転して停止後も最後の向きを維持する。

**Architecture:** `cardFacing.ts` に初期角度と画面上の移動差分から角度を求める純粋関数を置く。`BattleScene` はIDごとの前回座標・角度を持ち、画像と外枠を同じ角度へ更新する。

**Tech Stack:** TypeScript、Phaser 3、Node.js built-in test runner、tsx、Vite

## Global Constraints

- Playerは初期0度、Cpuは初期πラジアンとする。
- 上方向の移動は0度、下方向の移動はπラジアンとする。
- 停止時は最後の角度を維持する。
- 通常ユニットと召喚獣の画像・外枠を同じ角度へ回転する。
- HPバーなどの状態表示は回転しない。
- 既存の画像アセットにある未コミット変更には触れない。

---

## File Structure

- Create: `src/client/src/game/render/cardFacing.ts` — 初期角度と移動角度を計算する純粋関数。
- Create: `src/client/src/game/render/cardFacing.test.ts` — 向き計算の回帰テスト。
- Modify: `src/client/src/game/scenes/BattleScene.ts` — 前回座標・最後の角度の保持と画像・外枠への回転適用。

### Task 1: 向き計算を追加する

**Files:**
- Create: `src/client/src/game/render/cardFacing.ts`
- Create: `src/client/src/game/render/cardFacing.test.ts`

**Interfaces:**
- Produces: `initialCardRotation(team: TeamId): number`
- Produces: `cardRotationForMovement(previous: Vec2, current: Vec2, previousRotation: number): number`

- [ ] **Step 1: 失敗するテストを書く**

```ts
test("CPU cards start upside down", () => {
  assert.equal(initialCardRotation("Player"), 0);
  assert.equal(initialCardRotation("Cpu"), Math.PI);
});

test("movement faces direction and stops retain the last rotation", () => {
  assert.equal(cardRotationForMovement({ x: 10, y: 10 }, { x: 10, y: 4 }, Math.PI), 0);
  assert.equal(cardRotationForMovement({ x: 10, y: 10 }, { x: 10, y: 16 }, 0), Math.PI);
  assert.equal(cardRotationForMovement({ x: 10, y: 10 }, { x: 10, y: 10 }, Math.PI / 2), Math.PI / 2);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm.cmd run test -w src/client`

Expected: `cardFacing` モジュールが存在しないためFAIL。

- [ ] **Step 3: 最小の向き計算を実装する**

```ts
import type { TeamId, Vec2 } from "../core/types";

export function initialCardRotation(team: TeamId): number {
  return team === "Player" ? 0 : Math.PI;
}

export function cardRotationForMovement(previous: Vec2, current: Vec2, previousRotation: number): number {
  const deltaX = current.x - previous.x;
  const deltaY = current.y - previous.y;
  return deltaX === 0 && deltaY === 0 ? previousRotation : Math.atan2(deltaY, deltaX) + Math.PI / 2;
}
```

- [ ] **Step 4: 全テストで成功を確認する**

Run: `npm.cmd run test -w src/client`

Expected: 向き計算テストを含む全テストPASS。

### Task 2: BattleSceneで向きを適用する

**Files:**
- Modify: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**
- Consumes: `initialCardRotation(team)`、`cardRotationForMovement(previous, current, previousRotation)`
- Produces: IDごとに保持された前回座標と最後の角度を画像・外枠に反映する描画処理

- [ ] **Step 1: 向き保持用のMapと初期化を追加する**

```ts
private unitCardPositions = new Map<string, Vec2>();
private unitCardRotations = new Map<string, number>();
private summonedCardPositions = new Map<number, Vec2>();
private summonedCardRotations = new Map<number, number>();
```

`create` で4つのMapを空Mapへ初期化する。

- [ ] **Step 2: 通常ユニットと召喚獣の画像・外枠を回転する**

各更新処理で前回画面座標と最後の角度から新しい角度を求め、画像と外枠へ設定する。

```ts
const previous = positions.get(id) ?? screen;
const previousRotation = rotations.get(id) ?? initialCardRotation(team);
const rotation = cardRotationForMovement(previous, screen, previousRotation);
image.setRotation(rotation);
border?.setRotation(rotation);
positions.set(id, { ...screen });
rotations.set(id, rotation);
```

新規生成時にもチーム別の初期角度を画像・外枠へ設定する。召喚獣の消滅時は対応する位置・角度の記録を削除する。

- [ ] **Step 3: 型チェック、全テスト、ビルドを確認する**

Run: `npm.cmd run typecheck -w src/client; npm.cmd run test -w src/client; npm.cmd run build -w src/client`

Expected: 型エラー0件、全テストPASS、Viteビルドがexit code 0で完了。

- [ ] **Step 4: コミットする**

```powershell
git add src/client/src/game/render/cardFacing.ts src/client/src/game/render/cardFacing.test.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: ユニットの向きを移動方向へ同期"
```
