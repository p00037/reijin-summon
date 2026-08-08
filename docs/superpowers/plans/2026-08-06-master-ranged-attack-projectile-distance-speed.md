# マスター遠距離攻撃の距離判定・弾速調整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** マスターの攻撃距離が1.0以下なら攻撃エフェクトを表示せず、1.0超の魔法弾は現在の半分程度の速度で飛ばす。

**Architecture:** Phaser非依存の表示計算へワールド距離を渡し、`None`、`Line`、`RangedProjectile` の判別可能な3種類を返す。`BattleScene` は既存のワールド座標と `distanceSq` から距離を求め、表示計算結果に従って非表示・白線・500ms Tweenを選ぶ。

**Tech Stack:** TypeScript、Phaser 3.90、Node.js test runner、Vite

## Global Constraints

- `Ranged` の攻撃距離が `1.0` 以下の場合、魔法弾と白線のどちらも表示しない。
- `Ranged` の攻撃距離が `1.0` を超える場合だけ魔法弾を表示する。
- 魔法弾の移動時間は `250ms` から `500ms` へ変更する。
- `Melee`、`Speed`、攻撃者不明の場合は距離にかかわらず既存の白線を表示する。
- 距離は画面ピクセルではなく、攻撃イベントのワールド座標で判定する。
- 攻撃対象選択、攻撃射程、ダメージ、攻撃間隔、ダメージ適用タイミングは変更しない。
- 攻撃イベント型と外部依存関係は変更しない。
- 魔法弾の画像、色、寸法、回転、加算合成、描画深度、Tween完了時の破棄は変更しない。

---

## File Structure

- Modify: `src/client/src/game/render/rangedAttackPresentation.ts`
  - 攻撃距離を受け取り、近距離のマスター攻撃を `None` として返し、遠距離弾の移動時間を500msにする。
- Modify: `src/client/src/game/render/rangedAttackPresentation.test.ts`
  - 距離境界、非Rangedの白線維持、500msの表示契約を検証する。
- Modify: `src/client/src/game/scenes/BattleScene.ts`
  - ワールド距離を計算して表示計算へ渡し、`None` の場合は描画しない。

### Task 1: 距離別の攻撃表示と500ms魔法弾

**Files:**
- Modify: `src/client/src/game/render/rangedAttackPresentation.ts`
- Modify: `src/client/src/game/render/rangedAttackPresentation.test.ts`

**Interfaces:**
- Consumes: `attackEffectPresentation(unitType: UnitType | null, attackDistance: number, origin: Vec2, target: Vec2)`
- Produces: `AttackEffectPresentation = NoAttackEffectPresentation | LineAttackPresentation | RangedProjectilePresentation`
- Produces: `NoAttackEffectPresentation = { kind: "None" }`

- [ ] **Step 1: 近距離境界と弾速の失敗テストを書く**

既存テストの `attackEffectPresentation` 呼び出しへ攻撃距離を追加する。遠距離の既存ケースには `2` を渡し、右向きの魔法弾期待値の `durationMs` を `500` に変更する。

次のテストを追加する。これにより、近距離のマスター攻撃で弾または白線が表示される変更、境界 `1.0` を遠距離扱いする変更を検出する。

```ts
test("マスターの攻撃距離が1.0以下ならエフェクトを表示しない", () => {
  for (const attackDistance of [0, 0.999, 1]) {
    assert.deepEqual(
      attackEffectPresentation(
        "Ranged",
        attackDistance,
        { x: 10, y: 20 },
        { x: 90, y: 20 }
      ),
      { kind: "None" }
    );
  }
});

test("マスターの攻撃距離が1.0を超えれば500msの魔法弾を返す", () => {
  const presentation = attackEffectPresentation(
    "Ranged",
    1.001,
    { x: 10, y: 20 },
    { x: 90, y: 20 }
  );

  assert.equal(presentation.kind, "RangedProjectile");
  if (presentation.kind === "RangedProjectile") {
    assert.equal(presentation.durationMs, 500);
  }
});
```

既存の非マスターテストは、距離 `0` と `2` の双方について `Line` を返すよう変更する。

```ts
test("マスター以外の攻撃は距離にかかわらず既存の直線表示を返す", () => {
  for (const unitType of ["Melee", "Speed", null] as const) {
    for (const attackDistance of [0, 2]) {
      assert.deepEqual(
        attackEffectPresentation(
          unitType,
          attackDistance,
          { x: 10, y: 20 },
          { x: 90, y: 20 }
        ),
        {
          kind: "Line",
          origin: { x: 10, y: 20 },
          target: { x: 90, y: 20 }
        }
      );
    }
  }
});
```

- [ ] **Step 2: 対象テストを実行して正しい理由でFAILすることを確認する**

Run:

```powershell
Set-Location src/client
node --import tsx --test src/game/render/rangedAttackPresentation.test.ts
```

Expected: `attackEffectPresentation` が4引数を受け取らず、近距離で `RangedProjectile` を返し、`durationMs` が250のためFAIL。

- [ ] **Step 3: `None` 分岐と500msを最小実装する**

`rangedAttackPresentation.ts` を次の形へ変更する。

```ts
type NoAttackEffectPresentation = {
  kind: "None";
};

export type AttackEffectPresentation =
  | NoAttackEffectPresentation
  | LineAttackPresentation
  | RangedProjectilePresentation;

export function attackEffectPresentation(
  unitType: UnitType | null,
  attackDistance: number,
  origin: Vec2,
  target: Vec2
): AttackEffectPresentation {
  if (unitType !== "Ranged") {
    return { kind: "Line", origin, target };
  }
  if (attackDistance <= 1) {
    return { kind: "None" };
  }

  return {
    kind: "RangedProjectile",
    origin,
    target,
    rotation: Math.atan2(target.y - origin.y, target.x - origin.x),
    displayWidth: 72,
    displayHeight: 72,
    durationMs: 500,
    depth: 3
  };
}
```

- [ ] **Step 4: 表示計算テストをPASSさせる**

Run:

```powershell
Set-Location src/client
node --import tsx --test src/game/render/rangedAttackPresentation.test.ts
```

Expected: 既存の方向・同一点・アセットテストを含め、7件PASS。

- [ ] **Step 5: クライアント全テストを実行する**

Run:

```powershell
npm.cmd test -w src/client
```

Expected: 全テストPASS、失敗0件。

- [ ] **Step 6: 表示計算変更をコミットする**

```powershell
git add -- src/client/src/game/render/rangedAttackPresentation.ts src/client/src/game/render/rangedAttackPresentation.test.ts
git commit -m "fix: マスター攻撃エフェクトを距離で切り替え"
```

### Task 2: BattleSceneのワールド距離連携

**Files:**
- Modify: `src/client/src/game/scenes/BattleScene.ts:1-50`
- Modify: `src/client/src/game/scenes/BattleScene.ts:669-716`

**Interfaces:**
- Consumes: `distanceSq(first: Vec2, second: Vec2): number`
- Consumes: `attackEffectPresentation(unitType, attackDistance, origin, target)`
- Produces: 近距離の `Ranged` 攻撃では何も描画せず、遠距離では500msの既存魔法弾を描画する `drawAttackEvents`

- [ ] **Step 1: ワールド距離計算を追加する**

`BattleScene.ts` へ既存の純粋関数をimportする。

```ts
import { distanceSq } from "../core/vector";
```

`drawAttackEvents` では画面座標へ変換する前のイベント座標から距離を求める。

```ts
const attackDistance = Math.sqrt(
  distanceSq(event.origin, event.targetPosition)
);
```

表示計算呼び出しへ `attackDistance` を追加する。

```ts
const presentation = attackEffectPresentation(
  attacker?.unitType ?? null,
  attackDistance,
  origin,
  target
);
```

- [ ] **Step 2: `None` の場合は描画をスキップする**

`Line` 分岐より前に次を追加する。

```ts
if (presentation.kind === "None") {
  continue;
}
```

これにより、近距離の `Ranged` 攻撃では白線、画像、Tweenのいずれも生成しない。既存の `Line` と `RangedProjectile` の処理は変更しない。

- [ ] **Step 3: 型チェックと全テストを実行する**

Run:

```powershell
npm.cmd run typecheck
npm.cmd test -w src/client
```

Expected: 型エラーなし、全テストPASS。

- [ ] **Step 4: 全体ビルドを実行する**

Run:

```powershell
npm.cmd run build
```

Expected: server/clientのビルド成功。既存のViteチャンクサイズ警告以外に新しい警告・エラーなし。

- [ ] **Step 5: ローカル画面で距離別表示と弾速を確認する**

開発サーバーを起動する。

```powershell
npm.cmd run dev:client -- --host 127.0.0.1
```

ブラウザで次を確認する。

1. マスターと対象の距離が近い場合、魔法弾と白線のどちらも表示されない。
2. 距離が離れている場合、魔法弾が表示される。
3. 遠距離魔法弾は従来より遅く、約500msで対象へ到達する。
4. キーパーとシーカーは従来どおり白線を表示する。
5. 魔法弾の画像、色、寸法、回転、加算合成、消滅に回帰がない。
6. ダメージは着弾を待たず、従来どおり攻撃時に反映される。
7. ブラウザコンソールに新しいエラー・警告がない。

確認後、ブラウザタブと開発サーバーを停止する。

- [ ] **Step 6: BattleScene連携をコミットする**

```powershell
git add -- src/client/src/game/scenes/BattleScene.ts
git commit -m "fix: マスター攻撃演出へ距離判定を連携"
```

### Task 3: 最終検証

**Files:**
- Verify only

**Interfaces:**
- Consumes: Task 1とTask 2の完成状態
- Produces: 統合可能な検証済み変更

- [ ] **Step 1: 差分範囲と未追跡素材を確認する**

Run:

```powershell
git status --short
git diff --check HEAD~2
git diff --stat HEAD~2
git diff --name-status HEAD~2
```

Expected:

- 実装差分は `rangedAttackPresentation.ts`、同テスト、`BattleScene.ts` に限定される。
- `melee_attack_2.png` と `melee_attack_3.png` は未追跡のままで変更されていない。
- 空白エラーなし。

- [ ] **Step 2: 最新HEADで全検証を実行する**

Run:

```powershell
npm.cmd test -w src/client
npm.cmd run typecheck
npm.cmd run build
```

Expected: 全テストPASS、型エラーなし、ビルド成功。既存のViteチャンクサイズ警告以外に新しい警告・エラーなし。

- [ ] **Step 3: 実装計画をコミットする**

```powershell
git add -- docs/superpowers/plans/2026-08-06-master-ranged-attack-projectile-distance-speed.md
git commit -m "docs: マスター攻撃演出の距離と弾速調整計画を追加"
```
