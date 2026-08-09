# キーパーの向き連動アビリティ範囲 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** キーパーのアビリティ範囲表示と実際の対象選択を、カードが現在向いている方向へ一致させる。

**Architecture:** `BattleScene` が保持するカード回転角を表示照会と `UseAbility` コマンドへ渡す。`abilitySystem` は回転角0の `+Y` ベクトルを回転し、キーパーの範囲円中心を計算する。カード向きを `BattleState` へ重複保存せず、表示・使用可否・発動で同じ回転角を使う。

**Tech Stack:** TypeScript、Node.js test runner、Phaser 3、npm workspaces

## Global Constraints

- 正式仕様は `docs/superpowers/specs/2026-08-09-keeper-facing-ability-area-design.md` とする。
- 対象はプレイヤー側キーパー（`PlayerMelee`）だけとし、マスター、シーカー、CPU側の挙動を変更しない。
- 範囲円の中心距離はカード縦サイズ `H`、半径は `H / 2` のまま維持する。
- 停止中は最後のカード回転角、復活直後と回転角未登録時はプレイヤー初期角度0を使う。
- 不正な回転角では発動せず、APを消費しない。
- production codeを変更する前に対応する失敗テストを実行する。

---

### Task 1: ルール層とコマンドへ回転角を追加する

**Files:**
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/rules/abilitySystem.ts`
- Modify: `src/client/src/game/rules/gameSession.ts`
- Test: `src/client/src/game/rules/abilitySystem.test.ts`
- Test: `src/client/src/game/rules/gameSession.test.ts`

**Interfaces:**
- Consumes: カード回転角 `facingRotation: number`。回転角0は既存の `+Y` 方向。
- Produces: `abilityArea(state, config, unitId, facingRotation)`、`abilityTargets(state, config, unitId, facingRotation)`、`canUseAbility(state, config, unitId, facingRotation)`、`tryUseAbility(state, config, unitId, facingRotation)`。
- Produces: `UseAbility` command `{ commandType: "UseAbility"; team: "Player"; unitId: PlayerUnitId; facingRotation: number }`。

- [ ] **Step 1: キーパーの上下左右の範囲中心と対象選択を示す失敗テストを書く**

`abilitySystem.test.ts` でキーパーを固定位置へ置き、各回転角について次を検証する。浮動小数点は許容誤差 `1e-12` で比較する。

```ts
const cases = [
  { rotation: 0, offset: { x: 0, y: config.unitCardWorldHeight } },
  { rotation: Math.PI / 2, offset: { x: config.unitCardWorldHeight, y: 0 } },
  { rotation: Math.PI, offset: { x: 0, y: -config.unitCardWorldHeight } },
  { rotation: -Math.PI / 2, offset: { x: -config.unitCardWorldHeight, y: 0 } }
];

for (const { rotation, offset } of cases) {
  const area = abilityArea(state, config, keeper.unitId, rotation)!;
  assert.ok(Math.abs(area.center.x - (keeper.position.x + offset.x)) < 1e-12);
  assert.ok(Math.abs(area.center.y - (keeper.position.y + offset.y)) < 1e-12);
  assert.equal(area.radius, config.unitCardWorldHeight / 2);
}
```

対象エレメントを回転後の円中心へ置き、別方向のエレメントが `abilityTargets` に含まれないことも同じテストで確認する。

- [ ] **Step 2: ルールテストを実行して期待どおり失敗することを確認する**

Run: `npm.cmd test -w src/client -- --test-name-pattern="キーパーの範囲はカードの回転角に追従する"`

Expected: `abilityArea` が回転角引数を反映せず、左右または上方向の中心座標アサーションでFAIL。

- [ ] **Step 3: 最小限の範囲回転計算を実装する**

`abilitySystem.ts` でキーパーだけ次の計算を使う。マスターとシーカーの計算は維持する。

```ts
const height = config.unitCardWorldHeight;
return {
  center: {
    x: unit.position.x + Math.sin(facingRotation) * height,
    y: unit.position.y + Math.cos(facingRotation) * height
  },
  radius: height / 2
};
```

`abilityTargets`、`canUseAbility`、`tryUseAbility`、内部の `resolveAbilityUse` が同じ `facingRotation` を引き回す。

- [ ] **Step 4: キーパーの回転後対象選択を含むルールテストを通す**

Run: `npm.cmd test -w src/client -- --test-name-pattern="キーパー"`

Expected: キーパー関連テストがPASS。

- [ ] **Step 5: 不正回転角とコマンド伝播の失敗テストを書く**

`abilitySystem.test.ts` では `Number.NaN` と `Number.POSITIVE_INFINITY` を渡した `canUseAbility` と `tryUseAbility` が `false`、APが2のままであることを検証する。`gameSession.test.ts` では横向き回転角を持つ `UseAbility` が横方向の対象だけへ付与することを検証する。

```ts
session.applyCommand({
  commandType: "UseAbility",
  team: "Player",
  unitId: "PlayerMelee",
  facingRotation: Math.PI / 2
});
```

- [ ] **Step 6: 対象テストを実行して期待どおり失敗することを確認する**

Run: `npm.cmd test -w src/client -- --test-name-pattern="UseAbility|不正な回転角"`

Expected: `UseAbility` 型または伝播不足、および不正回転角の未検証によってFAIL。

- [ ] **Step 7: コマンド型、検証、GameSession伝播を実装する**

`BattleCommand` の `UseAbility` へ `facingRotation: number` を追加する。`resolveAbilityUse` はキーパーで `Number.isFinite(facingRotation)` が偽なら `null` を返す。`GameSession.applyCommand` は `command.facingRotation` を `tryUseAbility` へ渡す。

- [ ] **Step 8: ルール層の全テストを通す**

Run: `npm.cmd test -w src/client -- src/game/rules/abilitySystem.test.ts src/game/rules/gameSession.test.ts`

Expected: 対象ファイルの全テストPASS。

- [ ] **Step 9: ルール変更をコミットする**

```bash
git add src/client/src/game/core/types.ts src/client/src/game/rules/abilitySystem.ts src/client/src/game/rules/gameSession.ts src/client/src/game/rules/abilitySystem.test.ts src/client/src/game/rules/gameSession.test.ts
git commit -m "fix: キーパーのアビリティ範囲を向きに追従"
```

### Task 2: 表示と操作で現在のカード回転角を共有する

**Files:**
- Modify: `src/client/src/game/render/abilityPresentation.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts`
- Test: `src/client/src/game/render/abilityPresentation.test.ts`
- Test: `src/client/src/game/render/unitCardRenderState.test.ts`

**Interfaces:**
- Consumes: Task 1の回転角付き `abilityArea`、`abilityTargets`、`canUseAbility`、`UseAbility`。
- Produces: `abilityTargetingPresentation(state, config, selectedUnitId, facingRotation)`。
- Produces: 表示、HUD使用可否、発動コマンドのすべてに同じ `unitCardRotations` の値を渡す `BattleScene`。

- [ ] **Step 1: 回転した範囲表示の失敗テストを書く**

`abilityPresentation.test.ts` のキーパーケースに `Math.PI / 2` を渡し、範囲円中心がキーパーのworld `+X` 側へ `H` 移動し、その円内のエレメントだけに `LockOn` が付くことを検証する。

```ts
const presentation = abilityTargetingPresentation(
  state,
  config,
  "PlayerMelee",
  Math.PI / 2
)!;
assert.ok(Math.abs(presentation.area!.center.x - (keeper.position.x + config.unitCardWorldHeight)) < 1e-12);
assert.ok(Math.abs(presentation.area!.center.y - keeper.position.y) < 1e-12);
```

さらに literal 角度だけでなく、画面右移動から `cardRotationForMovement` で `π / 2` を生成し、その角度を `abilityTargetingPresentation` へ渡してworld `+X` 側の中心を得る合成境界テストを追加する。

- [ ] **Step 2: 表示テストを実行して期待どおり失敗することを確認する**

Run: `npm.cmd test -w src/client -- src/game/render/abilityPresentation.test.ts`

Expected: `abilityTargetingPresentation` が回転角をルール層へ渡さず、中心座標アサーションでFAIL。

- [ ] **Step 3: 表示モデルへ回転角を渡す**

`abilityTargetingPresentation` に `facingRotation` を追加し、`abilityArea` と `abilityTargets` の両方へ同じ値を渡す。マスターとシーカーも呼び出しシグネチャを統一するが、表示結果は変更しない。

- [ ] **Step 4: 表示テストを通す**

Run: `npm.cmd test -w src/client -- src/game/render/abilityPresentation.test.ts`

Expected: 全テストPASS。

- [ ] **Step 5: BattleSceneで同じ回転角を3経路へ渡す**

選択中ユニットの角度は次の式で取得する。

```ts
const facingRotation = this.unitCardRotations.get(this.selectedUnitId)
  ?? initialCardRotation("Player");
```

この値を `drawAbilityTargeting` の `abilityTargetingPresentation`、HUD更新時の `canUseAbility`、`handleAbility` 内の `canUseAbility` と `UseAbility.facingRotation` へ渡す。これにより停止中はMapの最終角度、復活直後は既存の `applyPlayerRevivalCardState` が設定した0を使う。

- [ ] **Step 6: 型チェックと関連テストで呼び出し漏れがないことを確認する**

Run: `npm.cmd run typecheck`

Expected: exit 0。

Run: `npm.cmd test -w src/client -- src/game/render/abilityPresentation.test.ts src/game/render/unitCardRenderState.test.ts src/game/rules/gameSession.test.ts`

Expected: 対象ファイルの全テストPASS。

- [ ] **Step 7: 表示・操作変更をコミットする**

```bash
git add src/client/src/game/render/abilityPresentation.ts src/client/src/game/scenes/BattleScene.ts src/client/src/game/render/abilityPresentation.test.ts src/client/src/game/render/unitCardRenderState.test.ts
git commit -m "fix: キーパーの範囲表示をカード向きに同期"
```

### Task 3: 全体回帰検証

**Files:**
- Verify only: repository working tree

**Interfaces:**
- Consumes: Task 1とTask 2の完成状態。
- Produces: テスト、型チェック、production buildの検証証跡。

- [ ] **Step 1: クライアント全テストを実行する**

Run: `npm.cmd test -w src/client`

Expected: 失敗0件。

- [ ] **Step 2: 全workspaceの型チェックを実行する**

Run: `npm.cmd run typecheck`

Expected: exit 0。

- [ ] **Step 3: production buildを実行する**

Run: `npm.cmd run build`

Expected: exit 0。既知のVite chunk size警告以外のエラーなし。

- [ ] **Step 4: 差分の健全性を確認する**

Run: `git diff --check`

Expected: 出力なし、exit 0。

- [ ] **Step 5: 検証で修正が発生した場合だけコミットする**

```bash
git add <検証で修正した対象ファイル>
git commit -m "test: キーパー向き連動範囲の回帰を補強"
```
