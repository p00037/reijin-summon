# マスター攻撃・召喚ゲージ・ゲーム時間調整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** マスターの移動中攻撃を接敵時だけ許可し、召喚獣存在中のゲージ増加を停止し、ゲーム時間を300Cへ変更する。

**Architecture:** `unitSystem` の既存接触判定を攻撃可否にも再利用する。`summonSystem` は陣営ごとに生存中召喚獣を確認してゲージ更新をスキップし、ゲーム時間は既存設定値だけを変更する。

**Tech Stack:** TypeScript、Node.js test runner、npm workspaces

## Global Constraints

- `1C = 1秒` とする。
- マスターは停止中、または移動中でも接敵中の場合だけ攻撃可能とする。
- 接敵判定は既存の移動速度低下判定を利用する。
- 自陣営の生存中召喚獣が存在する間だけ、その陣営の召喚ゲージ増加を停止する。
- ゲーム時間は300Cとする。
- ユーザー作成の画像アセットは変更しない。

---

### Task 1: マスターの移動中攻撃条件を実装する

**Files:**
- Modify: `src/client/src/game/rules/unitSystem.ts`
- Modify: `src/client/src/game/rules/unitSystem.test.ts`

**Interfaces:**
- Consumes: `hasEnemyContact(state, config, unit)`, `distanceSq()`
- Produces: `canAttack(state, config, unit): boolean`

- [ ] **Step 1: 失敗する3条件テストを書く**

`PlayerRanged` と射程内の敵を配置し、次を個別に検証する。

```ts
// 停止中: 攻撃する
attacker.destination = { ...attacker.position };

// 移動中・非接敵: 攻撃しない
attacker.destination = { x: attacker.position.x + 1, y: attacker.position.y };

// 移動中・接敵: 接触半径内の敵がいるため攻撃する
enemy.position = { x: attacker.position.x + config.contactSlowRadius, y: attacker.position.y };
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm.cmd run test -w src/client`

Expected: 移動中・非接敵のマスターが現行処理では攻撃するためFAIL。

- [ ] **Step 3: 攻撃条件を実装する**

`tickCombat` で攻撃タイマーを減らした後、対象検索より前に次の判定を追加する。

```ts
function canAttack(state: BattleState, config: BattleConfig, unit: UnitState): boolean {
  if (unit.unitType !== "Ranged") {
    return true;
  }
  const isStopped = distanceSq(unit.position, unit.destination) <= Number.EPSILON;
  return isStopped || hasEnemyContact(state, config, unit);
}
```

攻撃不可の場合は対象検索とダメージ処理をスキップする。タイマー減算はスキップしない。

- [ ] **Step 4: 対象テストを通す**

Run: `npm.cmd run test -w src/client`

Expected: 停止・非接敵移動・接敵移動の全条件がPASS。

### Task 2: 召喚獣存在中のゲージ増加を停止する

**Files:**
- Modify: `src/client/src/game/rules/summonSystem.ts`
- Modify: `src/client/src/game/rules/summonSystem.test.ts`

**Interfaces:**
- Consumes: `BattleState.summonedUnits`, `TeamId`
- Produces: 陣営別に停止・再開する `tickSummonGauges()`

- [ ] **Step 1: 失敗する陣営別テストを書く**

完成済みエレメントを持つPlayerについて、次を検証する。

```ts
// 生存中のPlayer召喚獣あり: ゲージは増えない
assert.equal(state.playerSummonGauge, 0);

// Cpu召喚獣だけが生存: Playerゲージは増える
assert.ok(state.playerSummonGauge > 0);

// Player召喚獣のHPが0: Playerゲージは増える
assert.ok(state.playerSummonGauge > 0);
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm.cmd run test -w src/client`

Expected: 生存中の自陣営召喚獣がいても現行処理ではゲージが増えるためFAIL。

- [ ] **Step 3: 陣営別停止条件を実装する**

`tickSummonGauges` の陣営ループ冒頭へ次を追加する。

```ts
const hasLivingSummonedUnit = state.summonedUnits.some(
  (summoned) => summoned.team === team && summoned.currentHp > 0
);
if (hasLivingSummonedUnit) {
  continue;
}
```

- [ ] **Step 4: 対象テストを通す**

Run: `npm.cmd run test -w src/client`

Expected: 自陣営のみ停止、相手陣営とHP0では増加するテストがPASS。

### Task 3: ゲーム時間を300Cへ変更して全体検証する

**Files:**
- Modify: `src/client/src/game/core/battleConfig.ts`
- Modify: `src/client/src/game/core/battleState.test.ts`

**Interfaces:**
- Consumes: `BattleConfig.matchDurationSeconds`
- Produces: 初期残り時間300Cのゲーム状態

- [ ] **Step 1: 失敗する初期時間テストを書く**

```ts
assert.equal(state.remainingSeconds, 300);
assert.equal(config.matchDurationSeconds, 300);
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm.cmd run test -w src/client`

Expected: 現行値180との差分でFAIL。

- [ ] **Step 3: 初期設定を変更する**

`createDefaultBattleConfig()` の `matchDurationSeconds` を `300` に変更する。

- [ ] **Step 4: 型チェックと全テストを実行する**

Run: `npm.cmd run typecheck -w src/client; npm.cmd run test -w src/client; git diff --check`

Expected: 型エラーなし、全テストPASS、空白エラーなし。

- [ ] **Step 5: 対象ファイルだけをコミットする**

```powershell
git add -- src/client/src/game/core/battleConfig.ts src/client/src/game/core/battleState.test.ts src/client/src/game/rules/unitSystem.ts src/client/src/game/rules/unitSystem.test.ts src/client/src/game/rules/summonSystem.ts src/client/src/game/rules/summonSystem.test.ts
git commit -m "feat: 攻撃条件と召喚ゲージを調整"
```
