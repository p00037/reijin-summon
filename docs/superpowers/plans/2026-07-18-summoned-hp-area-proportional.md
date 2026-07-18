# 召喚獣HPの面積比例と召喚士HP倍増 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 召喚獣HPを召喚エリア面積に完全比例させ、両陣営の召喚士HPを2,000にする。

**Architecture:** `BattleConfig` からHP倍率のクランプ設定を削除し、`summonSystem` が面積倍率だけで召喚獣HPを算出する。既存の状態初期化を通じてリーダーHPを更新する。

**Tech Stack:** TypeScript、Node.js test runner、npm workspaces

## Global Constraints

- 召喚獣の最大HPは `近接ユニット最大HP × 召喚エリア面積 × summonedUnitHpPerAreaMultiplier` とする。
- 召喚獣HPの最低・最大倍率クランプは設けない。
- 召喚士HPは両陣営とも2,000とする。
- 既存のユーザー作成アセットは変更しない。

---

### Task 1: HP計算の期待値をテストで固定する

**Files:**
- Modify: `src/client/src/game/core/battleState.test.ts`
- Modify: `src/client/src/game/rules/summonSystem.test.ts`

**Interfaces:**
- Consumes: `createDefaultBattleConfig()`, `createDefaultBattleState()`, `tryExecuteSummon()`
- Produces: 初期リーダーHPと面積比例召喚獣HPを検証するテスト

- [ ] **Step 1: 失敗するテストを書く**

`battleState.test.ts` の初期HP期待値を両チーム `2000` にする。`summonSystem.test.ts` の旧クランプ検証を、面積0でHPが0となるケースと、広い三角形の面積に `350 * area * config.summonedUnitHpPerAreaMultiplier` を掛けた値となるケースへ置き換える。

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm.cmd run test -w src/client -- --test-name-pattern="初期|面積"`

Expected: 旧HPの `1000`、または旧クランプ値 `1050` / `3500` との差分でFAIL。

- [ ] **Step 3: コミットする**

```powershell
git add -- src/client/src/game/core/battleState.test.ts src/client/src/game/rules/summonSystem.test.ts
git commit -m "test: 召喚獣HPの面積比例を検証"
```

### Task 2: 設定と召喚処理を更新する

**Files:**
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/core/battleConfig.ts`
- Modify: `src/client/src/game/rules/summonSystem.ts`

**Interfaces:**
- Consumes: `BattleConfig.summonedUnitHpPerAreaMultiplier`、`calculateSummonArea()`
- Produces: クランプなしで最大HPを返す `tryExecuteSummon()`

- [ ] **Step 1: 最小実装を書く**

`BattleConfig` と初期設定から `summonedUnitMinHpMultiplier`、`summonedUnitMaxHpMultiplier` を削除する。`leaderMaxHp` を `2000` に変更する。召喚処理のHP倍率を次の式に置き換える。

```ts
const maxHp = meleeStats.maxHp * area * config.summonedUnitHpPerAreaMultiplier;
```

自然減衰は近接ユニット最大HPと既存の減衰係数に基づく固定値にする。

- [ ] **Step 2: 対象テストを実行する**

Run: `npm.cmd run test -w src/client -- --test-name-pattern="初期|面積"`

Expected: PASS。

- [ ] **Step 3: 型チェックと全テストを実行する**

Run: `npm.cmd run typecheck -w src/client; npm.cmd run test -w src/client`

Expected: 型エラーなし、全テストPASS。

- [ ] **Step 4: コミットする**

```powershell
git add -- src/client/src/game/core/types.ts src/client/src/game/core/battleConfig.ts src/client/src/game/rules/summonSystem.ts src/client/src/game/core/battleState.test.ts src/client/src/game/rules/summonSystem.test.ts
git commit -m "feat: 召喚獣HPを面積比例へ変更"
```
