# マスター遠距離攻撃の魔法弾演出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** マスターの攻撃時に、白い中心と淡い黄緑色の尾を持つ小さな魔法弾を攻撃元から対象へ飛ばす。

**Architecture:** 攻撃イベントの兵種判定と、画像・角度・寸法・移動時間をPhaser非依存の表示計算モジュールへ分離する。`BattleScene` は表示計算結果を受け取り、`melee_attack1.png` の画像を加算合成し、Phaser Tweenで対象位置まで移動後に破棄する。

**Tech Stack:** TypeScript、Phaser 3.90、Node.js test runner、Vite

## Global Constraints

- ダメージは従来どおり攻撃イベント発生時に即時適用し、着弾時刻とは同期させない。
- `Ranged` の攻撃だけを魔法弾表示へ変更し、他兵種の既存白線表示は維持する。
- `src/client/public/assets/effects/melee_attack1.png` は既存のユーザー提供ファイルをそのまま使用する。
- `melee_attack_2.png` と `melee_attack_3.png` は変更・利用しない。
- 攻撃イベントの型および戦闘ルールは変更しない。
- 新しい外部依存関係は追加しない。

---

## File Structure

- Create: `src/client/src/game/render/rangedAttackPresentation.ts`
  - 攻撃兵種から白線または魔法弾を選び、魔法弾の角度・寸法・時間・描画情報を返す。
- Create: `src/client/src/game/render/rangedAttackPresentation.test.ts`
  - 兵種分岐、方向角、同一点、表示契約をPhaserなしで検証する。
- Modify: `src/client/src/game/scenes/BattleScene.ts`
  - 画像のpreloadと、表示計算結果からの画像・Tween生成を担当する。

### Task 1: 攻撃演出の表示計算

**Files:**
- Create: `src/client/src/game/render/rangedAttackPresentation.test.ts`
- Create: `src/client/src/game/render/rangedAttackPresentation.ts`

**Interfaces:**
- Consumes: `UnitType`、画面座標の `Vec2`
- Produces: `attackEffectPresentation(unitType: UnitType | null, origin: Vec2, target: Vec2): AttackEffectPresentation`
- Produces: `rangedAttackProjectileTextureKey: string`
- Produces: `rangedAttackProjectileAssetPath: string`
- Produces: `AttackEffectPresentation = LineAttackPresentation | RangedProjectilePresentation`

- [ ] **Step 1: 兵種分岐と水平方向の失敗テストを書く**

次のテストを作成する。壊れ方として、`Ranged` が白線へ戻る、他兵種が誤って魔法弾になる、右向きの弾が回転する変更を検出する。

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  attackEffectPresentation,
  rangedAttackProjectileAssetPath,
  rangedAttackProjectileTextureKey
} from "./rangedAttackPresentation";

test("マスター攻撃は右向きの魔法弾表示を返す", () => {
  assert.deepEqual(
    attackEffectPresentation("Ranged", { x: 10, y: 20 }, { x: 90, y: 20 }),
    {
      kind: "RangedProjectile",
      origin: { x: 10, y: 20 },
      target: { x: 90, y: 20 },
      rotation: 0,
      displayWidth: 72,
      displayHeight: 72,
      durationMs: 250,
      depth: 3
    }
  );
});

test("マスター以外の攻撃は既存の白線表示を返す", () => {
  for (const unitType of ["Melee", "Speed", null] as const) {
    assert.deepEqual(
      attackEffectPresentation(unitType, { x: 10, y: 20 }, { x: 90, y: 20 }),
      {
        kind: "Line",
        origin: { x: 10, y: 20 },
        target: { x: 90, y: 20 }
      }
    );
  }
});

test("魔法弾は指定された透過画像を使用する", () => {
  assert.equal(rangedAttackProjectileTextureKey, "ranged-attack-projectile");
  assert.equal(
    rangedAttackProjectileAssetPath,
    "/assets/effects/melee_attack1.png"
  );
});
```

- [ ] **Step 2: テストを実行して期待どおり失敗することを確認する**

Run:

```powershell
Set-Location src/client
npm test -- src/game/render/rangedAttackPresentation.test.ts
```

Expected: `rangedAttackPresentation` が存在しないためFAIL。

- [ ] **Step 3: 最小限の型と兵種分岐を実装する**

`src/client/src/game/render/rangedAttackPresentation.ts` を作成する。

```ts
import type { UnitType, Vec2 } from "../core/types";

export const rangedAttackProjectileTextureKey = "ranged-attack-projectile";
export const rangedAttackProjectileAssetPath =
  "/assets/effects/melee_attack1.png";

type LineAttackPresentation = {
  kind: "Line";
  origin: Vec2;
  target: Vec2;
};

type RangedProjectilePresentation = {
  kind: "RangedProjectile";
  origin: Vec2;
  target: Vec2;
  rotation: number;
  displayWidth: number;
  displayHeight: number;
  durationMs: number;
  depth: number;
};

export type AttackEffectPresentation =
  | LineAttackPresentation
  | RangedProjectilePresentation;

export function attackEffectPresentation(
  unitType: UnitType | null,
  origin: Vec2,
  target: Vec2
): AttackEffectPresentation {
  if (unitType !== "Ranged") {
    return { kind: "Line", origin, target };
  }

  return {
    kind: "RangedProjectile",
    origin,
    target,
    rotation: Math.atan2(target.y - origin.y, target.x - origin.x),
    displayWidth: 72,
    displayHeight: 72,
    durationMs: 250,
    depth: 3
  };
}
```

- [ ] **Step 4: 対象テストがPASSすることを確認する**

Run:

```powershell
Set-Location src/client
npm test -- src/game/render/rangedAttackPresentation.test.ts
```

Expected: 3件PASS。

- [ ] **Step 5: 垂直・斜め・同一点の失敗テストを追加する**

角度計算を `0` 固定にする変更や、同一点で `NaN` を返す変更を検出する。

```ts
test("魔法弾は攻撃対象の方向へ回転する", () => {
  const cases = [
    {
      name: "下",
      target: { x: 10, y: 100 },
      expectedRotation: Math.PI / 2
    },
    {
      name: "上",
      target: { x: 10, y: -60 },
      expectedRotation: -Math.PI / 2
    },
    {
      name: "左下",
      target: { x: -70, y: 100 },
      expectedRotation: Math.PI * 3 / 4
    }
  ];

  for (const { name, target, expectedRotation } of cases) {
    const presentation = attackEffectPresentation(
      "Ranged",
      { x: 10, y: 20 },
      target
    );
    assert.equal(presentation.kind, "RangedProjectile", name);
    if (presentation.kind === "RangedProjectile") {
      assert.ok(
        Math.abs(presentation.rotation - expectedRotation) < 1e-12,
        name
      );
    }
  }
});

test("攻撃元と対象が同一点でも有限の回転角を返す", () => {
  const presentation = attackEffectPresentation(
    "Ranged",
    { x: 10, y: 20 },
    { x: 10, y: 20 }
  );

  assert.equal(presentation.kind, "RangedProjectile");
  if (presentation.kind === "RangedProjectile") {
    assert.equal(presentation.rotation, 0);
    assert.equal(Number.isFinite(presentation.rotation), true);
  }
});
```

- [ ] **Step 6: 角度テストが正しい理由でFAILすることを確認する**

一時的に `rotation: 0` として対象テストを実行する。

Run:

```powershell
Set-Location src/client
npm test -- src/game/render/rangedAttackPresentation.test.ts
```

Expected: 「魔法弾は攻撃対象の方向へ回転する」が角度不一致でFAILし、同一点テストはPASS。

確認後、`rotation` を `Math.atan2(target.y - origin.y, target.x - origin.x)` に戻す。

- [ ] **Step 7: 表示計算テストをすべてPASSさせる**

Run:

```powershell
Set-Location src/client
npm test -- src/game/render/rangedAttackPresentation.test.ts
```

Expected: 5件PASS。

- [ ] **Step 8: 表示計算をコミットする**

```powershell
git add -- src/client/src/game/render/rangedAttackPresentation.ts src/client/src/game/render/rangedAttackPresentation.test.ts
git commit -m "feat: マスター攻撃の表示情報を追加"
```

### Task 2: BattleSceneへの魔法弾組み込み

**Files:**
- Modify: `src/client/src/game/scenes/BattleScene.ts:1-100`
- Modify: `src/client/src/game/scenes/BattleScene.ts:660-667`

**Interfaces:**
- Consumes: `attackEffectPresentation(unitType, origin, target)`
- Consumes: `rangedAttackProjectileTextureKey`
- Consumes: `rangedAttackProjectileAssetPath`
- Produces: `Ranged` 攻撃イベントごとに生成され、250ミリ秒後に破棄されるPhaser Image

- [ ] **Step 1: 表示計算モジュールをimportし、画像をpreloadする**

`BattleScene.ts` に次を追加する。

```ts
import {
  attackEffectPresentation,
  rangedAttackProjectileAssetPath,
  rangedAttackProjectileTextureKey
} from "../render/rangedAttackPresentation";
```

`preload()` の既存画像読み込みに次を追加する。

```ts
this.load.image(
  rangedAttackProjectileTextureKey,
  rangedAttackProjectileAssetPath
);
```

- [ ] **Step 2: 攻撃イベントを白線と魔法弾へ振り分ける**

`drawAttackEvents` を次の形へ変更する。攻撃者が見つからない場合は `unitType` を `null` とし、既存の白線へフォールバックする。

```ts
private drawAttackEvents(state: BattleState): void {
  this.battlefield.lineStyle(2, 0xf8fafc, 0.8);
  for (const event of state.recentAttackEvents) {
    const origin = this.worldToScreen(event.origin);
    const target = this.worldToScreen(event.targetPosition);
    const attacker = state.units.find(
      (unit) => unit.unitId === event.attackerUnitId
    );
    const presentation = attackEffectPresentation(
      attacker?.unitType ?? null,
      origin,
      target
    );

    if (presentation.kind === "Line") {
      this.battlefield.lineBetween(
        presentation.origin.x,
        presentation.origin.y,
        presentation.target.x,
        presentation.target.y
      );
      continue;
    }

    const projectile = this.add.image(
      presentation.origin.x,
      presentation.origin.y,
      rangedAttackProjectileTextureKey
    );
    projectile
      .setDisplaySize(
        presentation.displayWidth,
        presentation.displayHeight
      )
      .setRotation(presentation.rotation)
      .setDepth(presentation.depth)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: projectile,
      x: presentation.target.x,
      y: presentation.target.y,
      duration: presentation.durationMs,
      ease: "Linear",
      onComplete: () => projectile.destroy()
    });
  }
}
```

- [ ] **Step 3: 型チェックと対象テストを実行する**

Run:

```powershell
Set-Location src/client
npm run typecheck
npm test -- src/game/render/rangedAttackPresentation.test.ts
```

Expected: 型エラーなし、表示計算テスト5件PASS。

- [ ] **Step 4: クライアント全テストとビルドを実行する**

Run:

```powershell
Set-Location src/client
npm test
npm run build
```

Expected: 全テストPASS、TypeScriptとViteのビルド成功。新しい警告・エラーなし。

- [ ] **Step 5: ローカル画面で演出を確認する**

開発サーバーを起動し、ブラウザで戦闘を開始する。

```powershell
Set-Location src/client
npm run dev
```

次を確認する。

1. プレイヤー側マスターの攻撃時に、小さな白・黄緑の魔法弾が対象へ飛ぶ。
2. CPU側マスターの攻撃時も、弾の尾が攻撃元側になるよう対象方向へ回転する。
3. 弾は約250ミリ秒で対象へ到達し、残像オブジェクトが残らない。
4. 同時に複数のマスター攻撃が起きても、それぞれ独立して表示される。
5. キーパーとシーカーの攻撃は従来の白線表示のままである。
6. ダメージは着弾待ちにならず、従来どおり攻撃時に即時反映される。

確認後、開発サーバーを停止する。

- [ ] **Step 6: BattleScene組み込みをコミットする**

`effects` ディレクトリにはユーザー提供の未追跡素材が3個あるため、ディレクトリ単位でstageしない。使用する1ファイルだけを明示する。

```powershell
git add -- src/client/src/game/scenes/BattleScene.ts src/client/public/assets/effects/melee_attack1.png
git commit -m "feat: マスターの遠距離攻撃に魔法弾を表示"
```

### Task 3: 最終検証

**Files:**
- Verify only

**Interfaces:**
- Consumes: Task 1とTask 2の完成状態
- Produces: リポジトリへ渡せる検証済み実装

- [ ] **Step 1: 差分と追跡対象を確認する**

Run:

```powershell
git status --short
git diff --check HEAD~2
git diff --stat HEAD~2
```

Expected:

- 実装差分は表示計算、テスト、`BattleScene`、`melee_attack1.png`、本計画書に限定される。
- `melee_attack_2.png` と `melee_attack_3.png` は未追跡のままで、変更されていない。
- 空白エラーなし。

- [ ] **Step 2: クライアントの検証を再実行する**

Run:

```powershell
Set-Location src/client
npm test
npm run typecheck
npm run build
```

Expected: 全コマンドが終了コード0で成功し、新しい警告・エラーなし。

- [ ] **Step 3: 計画書をコミットする**

```powershell
git add -- docs/superpowers/plans/2026-08-06-master-ranged-attack-projectile.md
git commit -m "docs: マスター遠距離攻撃演出の実装計画を追加"
```
