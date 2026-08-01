# ユニット・召喚獣の当たり判定とHP表示調整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユニットと召喚獣の接触半径を1.2倍にし、通常ユニットのカード内画像とHPバー位置を調整し、召喚士直上のHPバーを廃止する。

**Architecture:** 接触判定は既存の共通設定値を変更し、ルール層の判定構造は維持する。描画位置は純粋関数へ集約して回転や対象種別ごとの違いをテスト可能にし、`BattleScene` は計算結果の描画だけを担当する。

**Tech Stack:** TypeScript、Phaser 3、Node.js built-in test runner、tsx、Vite

## Global Constraints

- 通常ユニットと召喚獣の共通接触半径は `0.54` とする。
- エレメンタル専用の配置半径および接触半径は変更しない。
- 攻撃射程、画像サイズ、カード枠サイズは変更しない。
- 通常ユニット画像だけをカード上端方向へ4px移動する。
- 通常ユニットHPバーだけを画面下方向へ6px移動する。
- 召喚士直上のHPバーを非表示にし、画面上部HUDは変更しない。

---

### Task 1: ユニットと召喚獣の共通接触半径を拡大する

**Files:**
- Modify: `src/client/src/game/core/battleConfig.ts:57`
- Test: `src/client/src/game/core/battleState.test.ts:37`
- Test: `src/client/src/game/rules/unitSystem.test.ts:322-340`
- Test: `src/client/src/game/rules/summonSystem.test.ts:307-337`

**Interfaces:**
- Consumes: `BattleConfig.contactSlowRadius: number`
- Produces: `createDefaultBattleConfig().contactSlowRadius === 0.54`

- [ ] **Step 1: 新しい半径の境界で失敗するテストへ更新する**

`battleState.test.ts` の既定値期待を更新する。

```ts
assert.equal(config.contactSlowRadius, 0.54);
```

`unitSystem.test.ts` の「移動中でも接敵中のマスターは射程内の敵を攻撃する」で、敵を旧半径外かつ新半径内へ置く。

```ts
enemy.position = { x: 0.5, y: 0 };
enemy.destination = { ...enemy.position };
```

`summonSystem.test.ts` の「召喚ユニットは接触した敵通常ユニットへ攻撃し、移動速度が低下する」で、召喚獣と敵通常ユニットの距離を `0.5` にする。

```ts
enemyUnit.position = { x: -5.5, y: 0 };
enemyUnit.destination = { x: -5.5, y: 0 };
```

- [ ] **Step 2: 対象テストを実行して期待どおり失敗することを確認する**

Run:

```powershell
npm.cmd run test -w src/client
```

Expected: `contactSlowRadius` が `0.45` のため、設定値と距離 `0.5` の接触テストがFAILする。

- [ ] **Step 3: 共通接触半径を最小変更で更新する**

`battleConfig.ts`:

```ts
contactSlowRadius: 0.54,
```

ルール層の比較式は既に `config.contactSlowRadius` を参照しているため変更しない。

- [ ] **Step 4: 対象テストとクライアント全テストを実行する**

Run:

```powershell
npm.cmd run test -w src/client
```

Expected: 対象テストとクライアント全テストがPASSする。

- [ ] **Step 5: Task 1をコミットする**

```powershell
git add src/client/src/game/core/battleConfig.ts src/client/src/game/core/battleState.test.ts src/client/src/game/rules/unitSystem.test.ts src/client/src/game/rules/summonSystem.test.ts
git commit -m "feat: ユニットと召喚獣の当たり判定を拡大"
```

### Task 2: 通常ユニット画像をカード上端方向へ移動する

**Files:**
- Modify: `src/client/src/game/render/cardPresentation.ts:80-89`
- Modify: `src/client/src/game/scenes/BattleScene.ts:544`
- Test: `src/client/src/game/render/cardPresentation.test.ts:93-101`

**Interfaces:**
- Consumes: `cardCenter: { x: number; y: number }`、`rotation: number`、`offsetY: number`
- Produces: `cardImageCenterAt(cardCenter, rotation, offsetY, topOffset?: number): { x: number; y: number }`

- [ ] **Step 1: カード回転に追従する4px上移動の失敗テストを書く**

既存テスト名を「card image offsets follow card rotation」に変更し、既存挙動と追加オフセットを同時に検証する。

```ts
test("card image offsets follow card rotation", () => {
  assert.deepEqual(cardImageCenterAt({ x: 100, y: 200 }, 0, 10), {
    x: 100,
    y: 210
  });
  assert.deepEqual(cardImageCenterAt({ x: 100, y: 200 }, 0, 10, 4), {
    x: 100,
    y: 206
  });

  const reversed = cardImageCenterAt({ x: 100, y: 200 }, Math.PI, 10, 4);
  assert.ok(Math.abs(reversed.x - 100) < 1e-10);
  assert.ok(Math.abs(reversed.y - 194) < 1e-10);
});
```

- [ ] **Step 2: 対象テストを実行してAPI不足で失敗することを確認する**

Run:

```powershell
npm.cmd run test -w src/client
```

Expected: 第4引数が位置計算へ反映されず、期待座標との差でFAILする。

- [ ] **Step 3: カード座標系の上方向オフセットを実装する**

`cardPresentation.ts`:

```ts
export function cardImageCenterAt(
  cardCenter: { x: number; y: number },
  rotation: number,
  offsetY: number,
  topOffset = 0
): { x: number; y: number } {
  const adjustedOffsetY = offsetY - topOffset;
  return {
    x: cardCenter.x - Math.sin(rotation) * adjustedOffsetY,
    y: cardCenter.y + Math.cos(rotation) * adjustedOffsetY
  };
}
```

`BattleScene.ts` の通常ユニットだけへ4pxを渡し、召喚獣側は既定値のままにする。

```ts
const imageCenter = cardImageCenterAt(
  screen,
  rotation,
  imageLayout.offsetY,
  4
);
```

- [ ] **Step 4: 描画位置テストとクライアント全テストを実行する**

Run:

```powershell
npm.cmd run test -w src/client
```

Expected: プレイヤー向きとCPU向きの座標テストを含む全テストがPASSする。

- [ ] **Step 5: Task 2をコミットする**

```powershell
git add src/client/src/game/render/cardPresentation.ts src/client/src/game/render/cardPresentation.test.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: ユニット画像をカード内で上へ調整"
```

### Task 3: 対象別HPバーレイアウトを集約して召喚士バーを廃止する

**Files:**
- Create: `src/client/src/game/render/hpBarPresentation.ts`
- Create: `src/client/src/game/render/hpBarPresentation.test.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts:357-440`

**Interfaces:**
- Consumes: `kind: "Leader" | "Elemental" | "SummonedUnit" | "Unit"`、`screen: Vec2`
- Produces: `battlefieldHpBarLayout(kind, screen): { x: number; y: number; width: number } | null`

- [ ] **Step 1: 新規レイアウトAPIの存在を要求する失敗テストを書く**

`hpBarPresentation.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

test("battlefield HP bar presentation exposes a layout calculator", async () => {
  const presentation = await import("./hpBarPresentation").catch(() => ({}));
  assert.equal(typeof presentation.battlefieldHpBarLayout, "function");
});
```

- [ ] **Step 2: モジュール不足を捕捉したアサーションが失敗することを確認する**

Run:

```powershell
npm.cmd run test -w src/client
```

Expected: 例外ではなく、`actual: "undefined"` と `expected: "function"` のアサーションでFAILする。

- [ ] **Step 3: 最小のAPIを追加して存在確認テストを通す**

`hpBarPresentation.ts`:

```ts
import type { Vec2 } from "../core/types";

export type BattlefieldHpBarKind =
  | "Leader"
  | "Elemental"
  | "SummonedUnit"
  | "Unit";

export interface BattlefieldHpBarLayout {
  x: number;
  y: number;
  width: number;
}

export function battlefieldHpBarLayout(
  _kind: BattlefieldHpBarKind,
  _screen: Vec2
): BattlefieldHpBarLayout | null {
  return null;
}
```

Run:

```powershell
npm.cmd run test -w src/client
```

Expected: API存在確認テストがPASSする。

- [ ] **Step 4: 対象別HPバー位置の失敗テストを追加する**

`hpBarPresentation.test.ts` の先頭で通常インポートへ切り替え、位置テストを追加する。

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { battlefieldHpBarLayout } from "./hpBarPresentation";

test("unit HP bar is six pixels lower while other battlefield bars keep their positions", () => {
  const screen = { x: 100, y: 200 };

  assert.deepEqual(battlefieldHpBarLayout("Unit", screen), {
    x: 80,
    y: 227,
    width: 40
  });
  assert.deepEqual(battlefieldHpBarLayout("Elemental", screen), {
    x: 82,
    y: 218,
    width: 36
  });
  assert.deepEqual(battlefieldHpBarLayout("SummonedUnit", screen), {
    x: 72,
    y: 234,
    width: 56
  });
});

test("leader has no battlefield HP bar", () => {
  assert.equal(battlefieldHpBarLayout("Leader", { x: 100, y: 200 }), null);
});
```

- [ ] **Step 5: 最小実装が位置要件を満たさず失敗することを確認する**

Run:

```powershell
npm.cmd run test -w src/client
```

Expected: `"Unit"`、`"Elemental"`、`"SummonedUnit"` が `null` を返すため、座標比較でFAILする。

- [ ] **Step 6: 対象別の純粋なレイアウト計算を実装する**

`hpBarPresentation.ts`:

```ts
import type { Vec2 } from "../core/types";

export type BattlefieldHpBarKind =
  | "Leader"
  | "Elemental"
  | "SummonedUnit"
  | "Unit";

export interface BattlefieldHpBarLayout {
  x: number;
  y: number;
  width: number;
}

export function battlefieldHpBarLayout(
  kind: BattlefieldHpBarKind,
  screen: Vec2
): BattlefieldHpBarLayout | null {
  switch (kind) {
    case "Leader":
      return null;
    case "Elemental":
      return { x: screen.x - 18, y: screen.y + 18, width: 36 };
    case "SummonedUnit":
      return { x: screen.x - 28, y: screen.y + 34, width: 56 };
    case "Unit":
      return { x: screen.x - 20, y: screen.y + 27, width: 40 };
  }
}
```

- [ ] **Step 7: `BattleScene` をレイアウト計算の利用側へ変更する**

インポートを追加する。

```ts
import {
  battlefieldHpBarLayout,
  type BattlefieldHpBarKind
} from "../render/hpBarPresentation";
```

対象ごとの直書き `drawHpBar` 呼び出しを次のヘルパーへ置き換える。

```ts
private drawBattlefieldHpBar(
  kind: BattlefieldHpBarKind,
  screen: Vec2,
  ratio: number,
  color: number
): void {
  const layout = battlefieldHpBarLayout(kind, screen);
  if (!layout) {
    return;
  }
  this.drawHpBar(layout.x, layout.y, layout.width, ratio, color);
}
```

各描画処理から次のように呼び出す。

```ts
this.drawBattlefieldHpBar("Leader", screen, leader.currentHp / leader.maxHp, color);
this.drawBattlefieldHpBar("Elemental", screen, elemental.currentHp / elemental.maxHp, color);
this.drawBattlefieldHpBar("SummonedUnit", screen, summoned.currentHp / summoned.maxHp, color);
this.drawBattlefieldHpBar("Unit", screen, unit.currentHp / unit.stats.maxHp, color);
```

`Leader` はレイアウトが `null` のため戦場内には描画されない。上部HUDの実装には触れない。

- [ ] **Step 8: HPバー関連テストとクライアント全テストを実行する**

Run:

```powershell
npm.cmd run test -w src/client
```

Expected: 通常ユニットのY座標が `227`、召喚士が `null` となり、全テストがPASSする。

- [ ] **Step 9: 型チェックとビルドを実行する**

Run:

```powershell
npm.cmd run typecheck -w src/client
npm.cmd run build -w src/client
```

Expected: 型エラー0件、Viteビルドがexit code 0で完了する。

- [ ] **Step 10: Task 3をコミットする**

```powershell
git add src/client/src/game/render/hpBarPresentation.ts src/client/src/game/render/hpBarPresentation.test.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: 戦場内HPバーの配置を調整"
```

### Task 4: 最終回帰検証を行う

**Files:**
- Verify: `src/client/src/**/*.ts`
- Verify: `docs/superpowers/specs/2026-08-02-unit-summon-collision-and-hp-layout-design.md`

**Interfaces:**
- Consumes: Task 1〜3の全変更
- Produces: 型チェック、全テスト、ビルドの検証結果

- [ ] **Step 1: 設計要件を差分と照合する**

Run:

```powershell
git diff HEAD~3 -- src/client/src/game/core/battleConfig.ts src/client/src/game/rules src/client/src/game/render src/client/src/game/scenes/BattleScene.ts
```

Expected: 半径 `0.54`、通常ユニット画像のみ4px上、通常ユニットHPバーのみ6px下、召喚士HPバーなしが確認できる。

- [ ] **Step 2: クライアントの完全検証を新しく実行する**

Run:

```powershell
npm.cmd run typecheck -w src/client
npm.cmd run test -w src/client
npm.cmd run build -w src/client
```

Expected: すべてexit code 0で、テスト失敗・型エラー・ビルドエラーがない。

- [ ] **Step 3: 作業ツリーとコミット履歴を確認する**

Run:

```powershell
git status --short
git log -4 --oneline
```

Expected: 意図しない未コミット変更がなく、設計・Task 1・Task 2・Task 3のコミットが確認できる。
