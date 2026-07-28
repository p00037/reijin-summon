# エレメント縮小 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** エレメント画像・外周リング・専用当たり判定を半分にし、HPバーと通常ユニット接触半径を維持する。

**Architecture:** `BattleConfig` にエレメント専用接触半径を追加し、配置・減速判定だけで使用する。描画定数を半分にする。

**Tech Stack:** TypeScript、Phaser 3、Node.js built-in test runner、tsx、Vite

## Global Constraints

- エレメント画像22px、リング半径9px、配置・接触半径0.225。
- HPバー幅36px、通常接触半径0.45を維持する。

### Task 1: エレメント専用のサイズ・接触半径を導入する

**Files:**
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/core/battleConfig.ts`
- Modify: `src/client/src/game/rules/elementalSystem.ts`
- Modify: `src/client/src/game/rules/unitSystem.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts`
- Modify: `src/client/src/game/core/battleState.test.ts`

- [ ] **Step 1: 失敗する既定設定テストを書く**

```ts
assert.equal(config.elementalPlacementRadius, 0.225);
assert.equal(config.elementalContactRadius, 0.225);
assert.equal(config.contactSlowRadius, 0.45);
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm.cmd run test -w src/client`

Expected: 既定の配置半径が0.45であり、`elementalContactRadius` が未定義のためFAIL。

- [ ] **Step 3: 最小の実装を追加する**

`BattleConfig` に `elementalContactRadius: number` を追加し、既定値を0.225とする。`elementalPlacementRadius` を0.225へ変更する。`unitSystem.ts` の敵エレメント接近判定だけを `elementalContactRadius` へ切り替える。`BattleScene.ts` の `elementalSpriteDisplaySize` を22、リング半径を9へ変更し、HPバーは変更しない。

- [ ] **Step 4: 型チェック、全テスト、ビルドを確認する**

Run: `npm.cmd run typecheck -w src/client; npm.cmd run test -w src/client; npm.cmd run build -w src/client`

Expected: 型エラー0件、全テストPASS、Viteビルドがexit code 0で完了。

- [ ] **Step 5: コミットする**

```powershell
git add src/client/src/game/core src/client/src/game/rules src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: エレメントのサイズと当たり判定を縮小"
```
