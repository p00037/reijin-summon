# 召喚獣HPの戦場面積比調整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 召喚獣HPを戦場面積比で算出し、面積5%で1倍、100%で20倍にする。

**Architecture:** `summonSystem` が設定済み戦場境界から全体面積を求め、召喚エリアとの比率をHP倍率に変換する。テストは面積5%と100%の境界値を固定する。

**Tech Stack:** TypeScript、Node.js test runner、npm workspaces

## Global Constraints

- 召喚獣HPは `近接ユニットHP × 20 × (召喚エリア面積 ÷ 戦場全体面積)` とする。
- 面積5%は近接ユニットと同じHP、面積100%は20倍HPとする。
- HP自然減衰、攻撃力、移動速度、召喚条件は変更しない。

---

### Task 1: 面積比HPのテストを追加する

**Files:**
- Modify: `src/client/src/game/rules/summonSystem.test.ts`

**Interfaces:**
- Consumes: `tryExecuteSummon()`, `createDefaultBattleConfig()`
- Produces: 5%・100%の面積比HPを確認する回帰テスト

- [ ] **Step 1: 失敗するテストを書く**

召喚エリア面積を戦場面積の5%と100%に設定し、それぞれ `350` と `7000` が最大HPになることを検証する。

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm.cmd run test -w src/client`

Expected: 旧計算式のHPと期待値の差分でFAIL。

### Task 2: 戦場面積比でHPを算出する

**Files:**
- Modify: `src/client/src/game/rules/summonSystem.ts`
- Modify: `src/client/src/game/rules/summonSystem.test.ts`

**Interfaces:**
- Consumes: `config.battlefieldMin`, `config.battlefieldMax`, `calculateSummonArea()`
- Produces: 戦場面積比に基づく召喚獣最大HP

- [ ] **Step 1: 最小実装を書く**

```ts
const battlefieldArea = (config.battlefieldMax.x - config.battlefieldMin.x) * (config.battlefieldMax.y - config.battlefieldMin.y);
const maxHp = meleeStats.maxHp * 20 * (area / battlefieldArea);
```

- [ ] **Step 2: テストを実行する**

Run: `npm.cmd run typecheck -w src/client; npm.cmd run test -w src/client`

Expected: 型エラーなし、全テストPASS。

- [ ] **Step 3: コミットする**

```powershell
git add -- src/client/src/game/rules/summonSystem.ts src/client/src/game/rules/summonSystem.test.ts
git commit -m "feat: 召喚獣HPを戦場面積比で調整"
```
