# ユニット・エレメント・回復バランス調整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 兵種別HP・攻撃力・エレメント生成時間、エレメントHP、キーパー固有能力、召喚士回復エリアの周期回復と表示を承認済み仕様へ合わせる。

**Architecture:** 静的な兵種差は `UnitStats`、共通の回復周期・回復量は `BattleConfig`、ユニットごとの経過時間は `UnitState` に置く。ゲームルールは既存のtick関数内で離散周期を計算し、描画値はPhaser非依存の小さなpresentation関数へ分離して単体テストする。

**Tech Stack:** TypeScript、Node.js test runner、tsx、Phaser 3、Vite

## Global Constraints

- `1C = 1秒` とする。
- キーパーはHP 1,100、ATK 61、生成時間5.7C、対エレメント攻撃倍率2とする。
- シーカーはHP 1,060、ATK 53、生成時間7.2Cとする。
- マスターはHP 1,025、ATK 36、生成時間6.7Cとする。
- エレメントの最大HPと生成時HPは1,000とする。
- 回復エリアは既存半径のまま薄い緑色で表示し、連続滞在2Cごとに最大HPの10%を回復する。
- キーパーは停止中1.5Cごとに60HP回復し、回復エリア効果と重複する。
- ユーザーが作業中の画像ファイルおよび無関係な未追跡ファイルは変更・ステージしない。

---

## ファイル構成

- `src/client/src/game/core/types.ts`: 兵種別生成値、攻撃倍率、回復設定、ユニット別タイマーの型を定義する。
- `src/client/src/game/core/battleConfig.ts`: 今回の全固定値を設定する。
- `src/client/src/game/core/battleState.ts`: 新しいユニット状態タイマーを初期化する。
- `src/client/src/game/core/battleState.test.ts`: 設定値と状態初期値を検証する。
- `src/client/src/game/rules/elementalSystem.ts`: 兵種別生成時間を使用する。
- `src/client/src/game/rules/elementalSystem.test.ts`: 兵種別生成時間とHP 1,000を検証する。
- `src/client/src/game/rules/unitSystem.ts`: 対エレメント倍率、回復エリア周期回復、キーパー停止回復を実装する。
- `src/client/src/game/rules/unitSystem.test.ts`: 攻撃と両回復挙動を検証する。
- `src/client/src/game/ai/cpuPlanner.test.ts`: 廃止する共通生成時間参照を兵種別値へ追従させる。
- `src/client/src/game/render/healingAreaPresentation.ts`: Phaser非依存の回復エリア表示値を返す。
- `src/client/src/game/render/healingAreaPresentation.test.ts`: 色・透明度・半径を検証する。
- `src/client/src/game/scenes/BattleScene.ts`: presentation値を使って回復エリアを描画する。

---

### Task 1: 兵種設定とユニット状態を更新する

**Files:**
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/core/battleConfig.ts`
- Modify: `src/client/src/game/core/battleState.ts`
- Test: `src/client/src/game/core/battleState.test.ts`

**Interfaces:**
- Produces: `UnitStats.elementalBuildSeconds: number`
- Produces: `UnitStats.elementalAttackMultiplier: number`
- Produces: `BattleConfig.leaderHealingIntervalSeconds: number`
- Produces: `BattleConfig.leaderHealingPercent: number`
- Produces: `BattleConfig.keeperRestHealingIntervalSeconds: number`
- Produces: `BattleConfig.keeperRestHealingAmount: number`
- Produces: `UnitState.leaderHealingElapsedSeconds: number`
- Produces: `UnitState.restHealingElapsedSeconds: number`

- [ ] **Step 1: 設定値と初期タイマーの失敗テストを書く**

`battleState.test.ts` の既存設定テストへ次の検証を追加し、独立性テストの旧HP期待値も新しい値へ変更する。

```ts
assert.deepEqual(
  {
    Melee: config.statsByType.Melee,
    Speed: config.statsByType.Speed,
    Ranged: config.statsByType.Ranged
  },
  {
    Melee: {
      maxHp: 1100,
      moveSpeed: 8.2 / 40,
      attackDamage: 61,
      attackRange: 1.25,
      attackIntervalSeconds: 1.2,
      elementalBuildSeconds: 5.7,
      elementalAttackMultiplier: 2
    },
    Speed: {
      maxHp: 1060,
      moveSpeed: 8.2 / 22,
      attackDamage: 53,
      attackRange: 1,
      attackIntervalSeconds: 0.8,
      elementalBuildSeconds: 7.2,
      elementalAttackMultiplier: 1
    },
    Ranged: {
      maxHp: 1025,
      moveSpeed: 8.2 / 32,
      attackDamage: 36,
      attackRange: 3.5,
      attackIntervalSeconds: 1.4,
      elementalBuildSeconds: 6.7,
      elementalAttackMultiplier: 1
    }
  }
);
assert.equal(config.elementalMaxHp, 1000);
assert.equal(config.leaderHealingIntervalSeconds, 2);
assert.equal(config.leaderHealingPercent, 0.1);
assert.equal(config.keeperRestHealingIntervalSeconds, 1.5);
assert.equal(config.keeperRestHealingAmount, 60);
assert.equal(findUnit(state, "PlayerMelee").leaderHealingElapsedSeconds, 0);
assert.equal(findUnit(state, "PlayerMelee").restHealingElapsedSeconds, 0);
```

- [ ] **Step 2: REDを確認する**

Run: `npm test -- src/game/core/battleState.test.ts`

Expected: 新規プロパティが存在しない、または旧HP・ATK・エレメントHPとの差でFAIL。

- [ ] **Step 3: 型と設定を最小実装する**

`UnitStats` に `elementalBuildSeconds` と `elementalAttackMultiplier`、`BattleConfig` に4つの回復設定を追加し、共通の `elementalBuildSeconds` は削除する。`UnitState` に2つの経過タイマーを追加する。`battleConfig.ts` の `statsByType` と設定をGlobal Constraintsの値へ更新し、`battleState.ts` の `createUnit` で両タイマーを0にする。

```ts
leaderHealingIntervalSeconds: 2,
leaderHealingPercent: 0.1,
keeperRestHealingIntervalSeconds: 1.5,
keeperRestHealingAmount: 60,
elementalMaxHp: 1000,
```

- [ ] **Step 4: GREENを確認する**

Run: `npm test -- src/game/core/battleState.test.ts`

Expected: PASS。

- [ ] **Step 5: コミットする**

```powershell
git add -- src/client/src/game/core/types.ts src/client/src/game/core/battleConfig.ts src/client/src/game/core/battleState.ts src/client/src/game/core/battleState.test.ts
git commit -m "feat: 兵種と回復の設定値を更新"
```

---

### Task 2: 兵種別エレメント生成時間とHPを適用する

**Files:**
- Modify: `src/client/src/game/rules/elementalSystem.ts`
- Test: `src/client/src/game/rules/elementalSystem.test.ts`
- Modify: `src/client/src/game/ai/cpuPlanner.test.ts`

**Interfaces:**
- Consumes: `UnitStats.elementalBuildSeconds`
- Consumes: `BattleConfig.elementalMaxHp`
- Produces: `tryBeginElementalBuild` が兵種別の `buildTimerSeconds` を設定する挙動

- [ ] **Step 1: 兵種別時間とHPの失敗テストを書く**

`elementalSystem.test.ts` に次を追加する。

```ts
test("兵種ごとの時間でエレメント生成を開始する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(tryBeginElementalBuild(state, config, "PlayerMelee"), true);
  assert.equal(tryBeginElementalBuild(state, config, "PlayerSpeed"), true);
  assert.equal(tryBeginElementalBuild(state, config, "PlayerRanged"), true);

  assert.equal(findUnit(state, "PlayerMelee").buildTimerSeconds, 5.7);
  assert.equal(findUnit(state, "PlayerSpeed").buildTimerSeconds, 7.2);
  assert.equal(findUnit(state, "PlayerRanged").buildTimerSeconds, 6.7);
});
```

既存の完成テストは `tickElementalBuilds(state, config, 5.7)` を使用し、次を検証する。

```ts
assert.equal(state.elementals[0].maxHp, 1000);
assert.equal(state.elementals[0].currentHp, 1000);
```

- [ ] **Step 2: REDを確認する**

Run: `npm test -- src/game/rules/elementalSystem.test.ts`

Expected: 全兵種が旧共通値を使うためFAIL。

- [ ] **Step 3: 兵種別生成時間を最小実装する**

`tryBeginElementalBuild` の代入を次へ変更する。

```ts
unit.buildTimerSeconds = unit.stats.elementalBuildSeconds;
```

テスト中の `config.elementalBuildSeconds` 参照を対象ユニットの `stats.elementalBuildSeconds` へ置換する。補助データのエレメントHP `120` は、HP自体を検証する箇所のみ `1000` へ更新し、単なる生存値として使う箇所は任意の正数のままでよい。`cpuPlanner.test.ts` の共通設定参照も、生成中ユニットの `stats.elementalBuildSeconds` へ変更する。

- [ ] **Step 4: GREENを確認する**

Run: `npm test -- src/game/rules/elementalSystem.test.ts src/game/ai/cpuPlanner.test.ts`

Expected: PASS。

- [ ] **Step 5: コミットする**

```powershell
git add -- src/client/src/game/rules/elementalSystem.ts src/client/src/game/rules/elementalSystem.test.ts src/client/src/game/ai/cpuPlanner.test.ts
git commit -m "feat: エレメント生成を兵種別に調整"
```

---

### Task 3: キーパーの攻撃倍率と周期回復を実装する

**Files:**
- Modify: `src/client/src/game/rules/unitSystem.ts`
- Test: `src/client/src/game/rules/unitSystem.test.ts`
- Modify: `src/client/src/game/core/battleState.ts`

**Interfaces:**
- Consumes: Task 1で追加した設定、兵種値、2つの経過タイマー
- Produces: `tickUnitHealing(state, config, deltaSeconds): void`
- Replaces: `tickLeaderHealing(state, config, deltaSeconds)`

- [ ] **Step 1: 対エレメント攻撃倍率の失敗テストを書く**

`unitSystem.test.ts` に、キーパーと敵エレメントを同位置に置き、攻撃後HPが `1000 - 122` になるテストを追加する。続けて別状態の敵ユニットへ攻撃し、HP減少が61であることを検証する。

```ts
assert.equal(elemental.currentHp, 878);
assert.equal(enemyUnit.currentHp, enemyUnit.stats.maxHp - 61);
```

- [ ] **Step 2: REDを確認する**

Run: `npm test -- src/game/rules/unitSystem.test.ts`

Expected: エレメントにも61しか与えずFAIL。

- [ ] **Step 3: 対エレメント倍率を最小実装する**

攻撃対象確定後に対象種別からダメージを求める。

```ts
const damage = target.kind === "Elemental"
  ? unit.stats.attackDamage * unit.stats.elementalAttackMultiplier
  : unit.stats.attackDamage;
applyDamage(target, damage, config);
```

- [ ] **Step 4: 攻撃テストのGREENを確認する**

Run: `npm test -- src/game/rules/unitSystem.test.ts`

Expected: 新しい攻撃テストがPASS。

- [ ] **Step 5: 回復周期・退出リセット・重複回復の失敗テストを書く**

`tickLeaderHealing` のimportを `tickUnitHealing` へ変更し、以下を個別テストとして追加する。

```ts
test("回復エリアに2C連続滞在すると最大HPの10%回復する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerSpeed");
  unit.position = { ...findLeader(state, "Player").position };
  unit.destination = { x: unit.position.x + 1, y: unit.position.y };
  unit.currentHp = 500;

  tickUnitHealing(state, config, 1.99);
  assert.equal(unit.currentHp, 500);
  tickUnitHealing(state, config, 0.01);
  assert.equal(unit.currentHp, 606);
});

test("回復エリアを出ると滞在時間をリセットする", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerSpeed");
  unit.position = { ...findLeader(state, "Player").position };
  unit.destination = { x: unit.position.x + 1, y: unit.position.y };
  unit.currentHp = 500;

  tickUnitHealing(state, config, 1.5);
  unit.position = { x: 6, y: 0 };
  tickUnitHealing(state, config, 1);
  unit.position = { ...findLeader(state, "Player").position };
  tickUnitHealing(state, config, 0.5);

  assert.equal(unit.currentHp, 500);
  assert.equal(unit.leaderHealingElapsedSeconds, 0.5);
});

test("停止中のキーパーは1.5Cごとに60回復する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const keeper = findUnit(state, "PlayerMelee");
  keeper.currentHp = 500;

  tickUnitHealing(state, config, 1.49);
  assert.equal(keeper.currentHp, 500);
  tickUnitHealing(state, config, 0.01);
  assert.equal(keeper.currentHp, 560);
});

test("停止回復と回復エリアは独立して重複する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const keeper = findUnit(state, "PlayerMelee");
  keeper.position = { ...findLeader(state, "Player").position };
  keeper.destination = { ...keeper.position };
  keeper.currentHp = 500;

  tickUnitHealing(state, config, 6);

  assert.equal(keeper.currentHp, 500 + 3 * 110 + 4 * 60);
});
```

さらに、移動開始、生成中、撃破中で停止タイマーが0になることと、両回復が最大HPを超えないことを個別に検証する。

- [ ] **Step 6: 回復テストのREDを確認する**

Run: `npm test -- src/game/rules/unitSystem.test.ts`

Expected: `tickUnitHealing` が未定義、または旧連続回復との差でFAIL。

- [ ] **Step 7: 周期回復を最小実装する**

周期処理は端数を保持し、複数周期をまたぐtickにも対応する。

```ts
function elapsedIntervals(elapsed: number, interval: number): { count: number; remainder: number } {
  const count = Math.floor((elapsed + Number.EPSILON) / interval);
  return { count, remainder: elapsed - count * interval };
}
```

`tickUnitHealing` では各生存ユニットについて、回復エリア内なら `leaderHealingElapsedSeconds` を加算して周期数×`stats.maxHp * leaderHealingPercent` を回復し、エリア外なら0へ戻す。キーパーが `Active` かつ停止中なら `restHealingElapsedSeconds` を加算して周期数×60を回復し、それ以外は0へ戻す。最後に `Math.min(unit.stats.maxHp, healedHp)` でクランプする。

`applyMoveCommand`、`defeatUnit`、`tickRespawns` でも両タイマーを0へ戻す。これによりコマンド直後と復活時の古い経過時間を持ち越さない。

- [ ] **Step 8: 全ルールテストのGREENを確認する**

Run: `npm test -- src/game/rules/unitSystem.test.ts src/game/rules/gameSession.test.ts`

Expected: PASS。

- [ ] **Step 9: コミットする**

```powershell
git add -- src/client/src/game/rules/unitSystem.ts src/client/src/game/rules/unitSystem.test.ts src/client/src/game/core/battleState.ts
git commit -m "feat: キーパー攻撃と周期回復を実装"
```

---

### Task 4: 回復エリアを薄い緑色で描画する

**Files:**
- Create: `src/client/src/game/render/healingAreaPresentation.ts`
- Create: `src/client/src/game/render/healingAreaPresentation.test.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**
- Consumes: `BattleConfig.leaderHealingRadius`
- Produces: `healingAreaPresentation(radius): { radius: number; fillColor: number; fillAlpha: number; strokeColor: number; strokeAlpha: number; strokeWidth: number }`

- [ ] **Step 1: 表示値の失敗テストを書く**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { healingAreaPresentation } from "./healingAreaPresentation";

test("回復エリアは指定半径の薄い緑色半透明円として表示する", () => {
  assert.deepEqual(healingAreaPresentation(2), {
    radius: 2,
    fillColor: 0x86efac,
    fillAlpha: 0.12,
    strokeColor: 0x86efac,
    strokeAlpha: 0.45,
    strokeWidth: 2
  });
});
```

- [ ] **Step 2: REDを確認する**

Run: `npm test -- src/game/render/healingAreaPresentation.test.ts`

Expected: モジュールが存在せずFAIL。

- [ ] **Step 3: presentation関数を最小実装する**

```ts
export function healingAreaPresentation(radius: number) {
  return {
    radius,
    fillColor: 0x86efac,
    fillAlpha: 0.12,
    strokeColor: 0x86efac,
    strokeAlpha: 0.45,
    strokeWidth: 2
  } as const;
}
```

- [ ] **Step 4: presentationテストのGREENを確認する**

Run: `npm test -- src/game/render/healingAreaPresentation.test.ts`

Expected: PASS。

- [ ] **Step 5: BattleSceneへ描画を接続する**

`draw()` でフィールド描画後、ユニット等より前に `drawHealingAreas(state.leaders)` を呼ぶ。`drawHealingAreas` は各召喚士のworld座標をscreen座標へ変換し、world半径を既存の座標変換比率でscreen半径へ変換して、次の順で描画する。

```ts
this.battlefieldOverlay.fillStyle(presentation.fillColor, presentation.fillAlpha);
this.battlefieldOverlay.fillCircle(screen.x, screen.y, screenRadius);
this.battlefieldOverlay.lineStyle(
  presentation.strokeWidth,
  presentation.strokeColor,
  presentation.strokeAlpha
);
this.battlefieldOverlay.strokeCircle(screen.x, screen.y, screenRadius);
```

既存の召喚士本体とHPバーは円より後に描画し、視認性を維持する。

- [ ] **Step 6: 型検査と描画関連テストを実行する**

Run: `npm run typecheck && npm test -- src/game/render/healingAreaPresentation.test.ts`

Expected: PASS、TypeScriptエラーなし。

- [ ] **Step 7: コミットする**

```powershell
git add -- src/client/src/game/render/healingAreaPresentation.ts src/client/src/game/render/healingAreaPresentation.test.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: 召喚士の回復エリアを表示"
```

---

### Task 5: GameSession接続と全体回帰を完了する

**Files:**
- Modify: `src/client/src/game/rules/gameSession.ts`
- Test: `src/client/src/game/rules/gameSession.test.ts`

**Interfaces:**
- Consumes: `tickUnitHealing(state, config, deltaSeconds)`
- Produces: 移動後・戦闘前に両回復を処理するゲームtick

- [ ] **Step 1: GameSession経由の失敗テストを書く**

```ts
test("GameSessionは移動後に周期回復を処理する", () => {
  const session = new GameSession();
  const keeper = findUnit(session.state, "PlayerMelee");
  keeper.position = { ...findLeader(session.state, "Player").position };
  keeper.destination = { ...keeper.position };
  keeper.currentHp = 500;

  session.tick(2);

  assert.equal(keeper.currentHp, 500 + 110 + 60);
});
```

- [ ] **Step 2: REDを確認する**

Run: `npm test -- src/game/rules/gameSession.test.ts`

Expected: 旧 `tickLeaderHealing` 接続または期待回復量との差でFAIL。

- [ ] **Step 3: GameSessionを新しい回復処理へ接続する**

importとtick呼び出しを `tickLeaderHealing` から `tickUnitHealing` へ変更する。呼び出し順は `tickMovement` の直後、`tickRespawns` と `tickCombat` の前を維持する。

- [ ] **Step 4: 対象テストと型検査を通す**

Run: `npm test -- src/game/rules/gameSession.test.ts && npm run typecheck`

Expected: PASS、TypeScriptエラーなし。

- [ ] **Step 5: クライアント全テストとビルドを実行する**

Run: `npm test && npm run build`

Expected: 全テストPASS、Vite build成功、warning以外のエラーなし。Task 1〜4で更新した期待値以外に旧設定値の参照が残っていないこと。

- [ ] **Step 6: 差分と作業ツリーを確認する**

Run: `git diff --check && git status --short`

Expected: whitespace errorなし。今回の変更対象と、開始前から存在したユーザーの画像・未追跡ファイルだけが表示される。

- [ ] **Step 7: 最終接続をコミットする**

```powershell
git add -- src/client/src/game/rules/gameSession.ts src/client/src/game/rules/gameSession.test.ts
git commit -m "test: バランス調整の全体動作を検証"
```

コミット前に `git diff --cached --name-only` を確認し、ユーザー作業中の `src/client/public/assets/**` や本計画外のファイルがステージされていないことを確認する。

---

## 計画セルフレビュー結果

- 設計書の全要件をTask 1〜5へ対応付け済み。
- 未確定値や後続作業へ先送りする記述なし。
- `elementalBuildSeconds` は共通設定から削除し、全参照を `UnitStats.elementalBuildSeconds` に統一。
- 回復タイマー名、設定名、公開関数名は全Taskで一致。
- 既存のユーザー画像変更をステージしない制約を全体制約と最終確認へ明記。
