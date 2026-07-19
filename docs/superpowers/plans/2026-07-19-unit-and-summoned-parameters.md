# 通常ユニット・召喚獣パラメータ調整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通常ユニットの移動時間と、召喚獣のHP・攻撃間隔・攻撃力・自然減少・移動時間を指定値へ合わせる。

**Architecture:** 数値は `BattleConfig` に集約し、召喚時に `SummonedUnitState` へ確定値をコピーする。召喚獣の攻撃は既存の接触対象列挙を再利用し、`attackTimerSeconds` が0のときだけ離散ダメージを与える。

**Tech Stack:** TypeScript、Node.js test runner、npm workspaces

## Global Constraints

- `1C = 1秒` とする。
- 召喚獣HPは `1750 + 60 × (召喚面積 ÷ 戦場全体面積 × 100)` とする。
- 召喚獣の攻撃間隔は2C、基本攻撃力は99、対召喚士攻撃力は300とする。
- 召喚獣のHP自然減少は毎秒120とする。
- 召喚士間8.2の所要時間は、召喚獣12C、Melee 40C、Speed 22C、Ranged 32Cとする。
- 既存の接触速度低下と、接触全対象への同時攻撃は維持する。
- ユーザー作成の画像アセットは変更しない。

---

### Task 1: 通常ユニットと召喚獣生成パラメータを更新する

**Files:**
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/core/battleConfig.ts`
- Modify: `src/client/src/game/core/battleState.test.ts`
- Modify: `src/client/src/game/rules/summonSystem.ts`
- Modify: `src/client/src/game/rules/summonSystem.test.ts`

**Interfaces:**
- Consumes: `BattleConfig`, `createDefaultBattleConfig()`, `tryExecuteSummon()`
- Produces: HP・速度・攻撃値・タイマーを保持する `SummonedUnitState`

- [ ] **Step 1: 失敗するテストを書く**

`battleState.test.ts` で速度を `8.2 / 40`、`8.2 / 22`、`8.2 / 32` と検証する。`summonSystem.test.ts` で面積0%、5%、100%のHPを `1750`、`2050`、`7750` と検証し、生成された召喚獣の値を次のように検証する。

```ts
assert.equal(summoned.attackDamage, 99);
assert.equal(summoned.leaderAttackDamage, 300);
assert.equal(summoned.attackIntervalSeconds, 2);
assert.equal(summoned.attackTimerSeconds, 0);
assert.equal(summoned.healthDecayPerSecond, 120);
assert.equal(summoned.moveSpeed, 8.2 / 12);
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm.cmd run test -w src/client`

Expected: 現行のHP、速度、召喚獣パラメータとの差分または不足プロパティでFAIL。

- [ ] **Step 3: 型と設定を実装する**

`BattleConfig` に次の設定を定義し、旧 `summonedUnitHpPerAreaMultiplier`、`summonedUnitAttackDamageMultiplier`、`summonedUnitHealthDecayMinimumHpFactorPerSecond` を置き換える。

```ts
summonedUnitBaseHp: number;
summonedUnitHpPerFieldPercent: number;
summonedUnitAttackDamage: number;
summonedUnitLeaderAttackDamage: number;
summonedUnitAttackIntervalSeconds: number;
summonedUnitHealthDecayPerSecond: number;
summonedUnitMoveSpeed: number;
```

`SummonedUnitState` に次を追加する。

```ts
leaderAttackDamage: number;
attackIntervalSeconds: number;
attackTimerSeconds: number;
```

既定値は `1750`、`60`、`99`、`300`、`2`、`120`、`8.2 / 12` とする。通常ユニット速度は `8.2 / 40`、`8.2 / 22`、`8.2 / 32` とする。

- [ ] **Step 4: 召喚時のHPと状態を実装する**

```ts
const fieldPercent = area / battlefieldArea * 100;
const maxHp = config.summonedUnitBaseHp + config.summonedUnitHpPerFieldPercent * fieldPercent;
```

生成状態へ設定値と `attackTimerSeconds: 0` をコピーする。

- [ ] **Step 5: 対象テストを通す**

Run: `npm.cmd run test -w src/client`

Expected: 生成パラメータとHP・速度テストがPASS。

### Task 2: 召喚獣の2C攻撃を実装する

**Files:**
- Modify: `src/client/src/game/rules/summonSystem.ts`
- Modify: `src/client/src/game/rules/summonSystem.test.ts`

**Interfaces:**
- Consumes: `SummonedUnitState.attackTimerSeconds`, `attackIntervalSeconds`, `attackDamage`, `leaderAttackDamage`
- Produces: 2C周期の接触攻撃

- [ ] **Step 1: 失敗する攻撃間隔テストを書く**

接触中の召喚獣へ `attackTimerSeconds: 2` を設定し、`tickSummonedUnits(..., 1.99)` ではダメージなし、続く `0.01` で通常対象へ99、召喚士へ300ダメージとなることを検証する。

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm.cmd run test -w src/client`

Expected: 現行の連続ダメージとの差分でFAIL。

- [ ] **Step 3: 攻撃タイマー処理を実装する**

各tickでタイマーを0まで減らし、接触対象がありタイマーが0なら全対象へ1回分の固定ダメージを与え、タイマーを2へ戻す。召喚士には `leaderAttackDamage`、通常ユニットと召喚獣には `attackDamage` を使用する。攻撃できない場合の移動判定は既存どおり接触の有無で行う。

- [ ] **Step 4: 対象テストを通す**

Run: `npm.cmd run test -w src/client`

Expected: 2C周期・99・300のテストがPASS。

### Task 3: 全体整合性を検証してコミットする

**Files:**
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/core/battleConfig.ts`
- Modify: `src/client/src/game/core/battleState.test.ts`
- Modify: `src/client/src/game/rules/summonSystem.ts`
- Modify: `src/client/src/game/rules/summonSystem.test.ts`

**Interfaces:**
- Consumes: Task 1・2の実装
- Produces: 型チェック済み・回帰テスト済みの変更

- [ ] **Step 1: 旧設定名の残存を確認する**

Run: `rg -n "summonedUnitHpPerAreaMultiplier|summonedUnitAttackDamageMultiplier|summonedUnitHealthDecayMinimumHpFactorPerSecond" src/client/src`

Expected: 出力なし。

- [ ] **Step 2: 型チェックと全テストを実行する**

Run: `npm.cmd run typecheck -w src/client; npm.cmd run test -w src/client; git diff --check`

Expected: 型エラーなし、全テストPASS、空白エラーなし。

- [ ] **Step 3: 対象ファイルだけをコミットする**

```powershell
git add -- src/client/src/game/core/types.ts src/client/src/game/core/battleConfig.ts src/client/src/game/core/battleState.test.ts src/client/src/game/rules/summonSystem.ts src/client/src/game/rules/summonSystem.test.ts
git commit -m "feat: ユニットと召喚獣のパラメータを調整"
```
