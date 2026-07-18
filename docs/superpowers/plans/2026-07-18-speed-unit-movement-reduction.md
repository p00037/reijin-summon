# Speedユニット移動速度縮小 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Speedユニットの移動速度を0.5へ、召喚獣の移動速度を0.6へ縮小する。

**Architecture:** `battleConfig.ts` のSpeedユニット既定ステータスのみを変更する。既存の召喚獣生成処理はこのステータスに1.2を掛けるため、ロジック変更なしで召喚獣速度も連動する。

**Tech Stack:** TypeScript、Node.js built-in test runner、tsx

## Global Constraints

- `Speed.moveSpeed` は0.5とする。
- `Melee.moveSpeed` は0.5、`Ranged.moveSpeed` は0.375のまま維持する。
- 召喚獣の既定移動速度は0.6となる。
- 既存の画像アセットにある未コミット変更には触れない。

---

## File Structure

- Modify: `src/client/src/game/core/battleConfig.ts` — Speedユニットの既定移動速度を変更する。
- Modify: `src/client/src/game/core/battleState.test.ts` — 既定ステータスの期待値を変更する。
- Modify: `src/client/src/game/rules/summonSystem.test.ts` — 召喚獣の生成速度の期待値を変更する。

### Task 1: Speedユニットと召喚獣の速度を縮小する

**Files:**
- Modify: `src/client/src/game/core/battleConfig.ts`
- Modify: `src/client/src/game/core/battleState.test.ts`
- Modify: `src/client/src/game/rules/summonSystem.test.ts`

**Interfaces:**
- Produces: `createDefaultBattleConfig().statsByType.Speed.moveSpeed === 0.5`
- Produces: `tryExecuteSummon` で生成される召喚獣の `moveSpeed === 0.6`

- [ ] **Step 1: 失敗する速度テストを書く**

`battleState.test.ts` の既定Speed速度を `0.5`、`summonSystem.test.ts` の召喚獣速度を `0.6` へ更新する。

```ts
assert.equal(config.statsByType.Speed.moveSpeed, 0.5);
assert.equal(Number(state.summonedUnits[0].moveSpeed.toFixed(2)), 0.6);
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm.cmd run test -w src/client`

Expected: 既定Speed速度の `0.75` と召喚獣速度の `0.9` が新しい期待値と一致せずFAIL。

- [ ] **Step 3: 最小の設定変更を実装する**

`battleConfig.ts` のSpeedステータスを次の値へ変更する。

```ts
Speed: {
  maxHp: 250,
  moveSpeed: 0.5,
  attackDamage: 30,
  attackRange: 1,
  attackIntervalSeconds: 0.8
}
```

- [ ] **Step 4: 型チェック、全テスト、ビルドを確認する**

Run: `npm.cmd run typecheck -w src/client; npm.cmd run test -w src/client; npm.cmd run build -w src/client`

Expected: 型エラー0件、全テストPASS、Viteビルドがexit code 0で完了。

- [ ] **Step 5: コミットする**

```powershell
git add src/client/src/game/core/battleConfig.ts src/client/src/game/core/battleState.test.ts src/client/src/game/rules/summonSystem.test.ts
git commit -m "feat: Speedユニットの移動速度を縮小"
```
