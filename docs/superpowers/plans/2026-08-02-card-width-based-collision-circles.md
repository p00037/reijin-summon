# カード横幅基準の当たり判定円 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通常ユニットと召喚獣の当たり判定円の直径を各カード横幅の1.2倍にし、双方の半径を加算した対称な接触判定へ変更する。

**Architecture:** `BattleConfig` に通常ユニット用と召喚獣用のワールド座標半径を明示し、共通の純粋関数で種別ごとの半径取得・半径加算・円重なり判定を行う。通常ユニットと召喚獣のルールはこの共通関数を使用し、選択円は通常ユニット用半径を既存の画面座標変換へ渡す。

**Tech Stack:** TypeScript、Node.js Test Runner、tsx、Phaser 3、Vite

## Global Constraints

- 通常ユニットのカード横幅は51.52px、当たり判定直径は61.824px、半径は30.912pxおよび0.756ワールド単位とする。
- 召喚獣のカード横幅は66.976px、当たり判定直径は80.3712px、半径は40.1856pxおよび0.9828ワールド単位とする。
- 接触境界は通常ユニット同士1.512、通常ユニットと召喚獣1.7388、召喚獣同士1.9656とし、境界上を接触に含める。
- エレメンタルと召喚士は中心点として扱い、新しい半径を持たせない。
- 通常ユニットの選択円は `unitCollisionRadius` と一致させる。
- クリック取得半径 `selectionRadiusPx = 28` は変更しない。
- カード枠、カード画像、HPバー、攻撃射程、エレメンタル配置間隔、召喚士回復範囲は変更しない。
- 設計書 `docs/superpowers/specs/2026-08-02-card-width-based-collision-circles-design.md` を正とする。

---

## ファイル構成

- `src/client/src/game/core/types.ts`: 2種類の当たり判定半径を `BattleConfig` に定義する。
- `src/client/src/game/core/battleConfig.ts`: 既定半径0.756と0.9828を提供する。
- `src/client/src/game/core/battleState.test.ts`: 既定設定値を固定する。
- `src/client/src/game/rules/collisionGeometry.ts`: 対象種別の半径、半径加算、円重なり判定を提供する。
- `src/client/src/game/rules/collisionGeometry.test.ts`: カード幅との対応、組み合わせ境界、点対象を検証する。
- `src/client/src/game/rules/unitSystem.ts`: 通常ユニット側の接触減速判定を共通関数へ移行する。
- `src/client/src/game/rules/unitSystem.test.ts`: 通常ユニットから各対象への接触境界を検証する。
- `src/client/src/game/rules/summonSystem.ts`: 召喚獣側の攻撃・減速・召喚士接触判定を共通関数へ移行する。
- `src/client/src/game/rules/summonSystem.test.ts`: 召喚獣から各対象への接触境界と対称性を検証する。
- `src/client/src/game/render/unitSelectionPresentation.test.ts`: 新しい通常ユニット半径の画面座標変換を検証する。
- `src/client/src/game/scenes/BattleScene.ts`: 選択円へ `unitCollisionRadius` を渡す。

---

### Task 1: 種別別半径と共通円重なり判定

**Files:**
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/core/battleConfig.ts`
- Modify: `src/client/src/game/core/battleState.test.ts`
- Create: `src/client/src/game/rules/collisionGeometry.ts`
- Create: `src/client/src/game/rules/collisionGeometry.test.ts`

**Interfaces:**
- Consumes: `BattleConfig`、`Vec2`、`distanceSq(a: Vec2, b: Vec2): number`
- Produces: `CollisionBodyKind = "Unit" | "SummonedUnit" | "Point"`
- Produces: `collisionRadiusForKind(config: BattleConfig, kind: CollisionBodyKind): number`
- Produces: `combinedCollisionRadius(config: BattleConfig, firstKind: CollisionBodyKind, secondKind: CollisionBodyKind): number`
- Produces: `areCollisionCirclesTouching(config: BattleConfig, firstPosition: Vec2, firstKind: CollisionBodyKind, secondPosition: Vec2, secondKind: CollisionBodyKind): boolean`

- [ ] **Step 1: 既定設定と共通判定の失敗テストを書く**

`battleState.test.ts` の既定設定テストへ次を追加する。旧 `contactSlowRadius` は後続タスクが移行を終えるまで残す。

```ts
assert.equal(config.unitCollisionRadius, 0.756);
assert.equal(config.summonedUnitCollisionRadius, 0.9828);
```

`collisionGeometry.test.ts` を作成する。

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBattleConfig } from "../core/battleConfig";
import {
  summonedCardPresentation,
  unitCardPresentation
} from "../render/cardPresentation";
import {
  areCollisionCirclesTouching,
  collisionRadiusForKind,
  combinedCollisionRadius
} from "./collisionGeometry";

const screenUnitsPerWorldUnit = 515.2 / 12.6;

test("種別別半径は各カード横幅の1.2倍を直径にする", () => {
  const config = createDefaultBattleConfig();

  assert.equal(collisionRadiusForKind(config, "Unit"), 0.756);
  assert.equal(collisionRadiusForKind(config, "SummonedUnit"), 0.9828);
  assert.equal(collisionRadiusForKind(config, "Point"), 0);
  assert.equal(
    Number((config.unitCollisionRadius * 2 * screenUnitsPerWorldUnit).toFixed(4)),
    unitCardPresentation.Melee.displayWidth * 1.2
  );
  assert.equal(
    config.summonedUnitCollisionRadius * 2 * screenUnitsPerWorldUnit,
    summonedCardPresentation.displayWidth * 1.2
  );
});

test("接触距離は双方の半径を加算する", () => {
  const config = createDefaultBattleConfig();

  assert.equal(combinedCollisionRadius(config, "Unit", "Unit"), 1.512);
  assert.equal(
    combinedCollisionRadius(config, "Unit", "SummonedUnit"),
    1.7388
  );
  assert.equal(
    combinedCollisionRadius(config, "SummonedUnit", "SummonedUnit"),
    1.9656
  );
  assert.equal(combinedCollisionRadius(config, "Unit", "Point"), 0.756);
  assert.equal(
    combinedCollisionRadius(config, "SummonedUnit", "Point"),
    0.9828
  );
});

test("境界上は接触し境界を超えると接触しない", () => {
  const config = createDefaultBattleConfig();
  const origin = { x: 0, y: 0 };

  assert.equal(
    areCollisionCirclesTouching(
      config,
      origin,
      "Unit",
      { x: 1.7388, y: 0 },
      "SummonedUnit"
    ),
    true
  );
  assert.equal(
    areCollisionCirclesTouching(
      config,
      origin,
      "SummonedUnit",
      { x: 1.7388 + 0.0001, y: 0 },
      "Unit"
    ),
    false
  );
});
```

- [ ] **Step 2: 対象テストを実行してREDを確認する**

Run:

```powershell
cd src/client
node --import tsx --test src/game/core/battleState.test.ts src/game/rules/collisionGeometry.test.ts
```

Expected: `unitCollisionRadius`、`summonedUnitCollisionRadius`、`collisionGeometry` の未実装によりFAIL。

- [ ] **Step 3: 設定型・既定値・共通判定を最小実装する**

`BattleConfig` の `contactSlowRadius` の直後へ次を追加する。Task 1では既存利用箇所を壊さないため、旧プロパティをまだ削除しない。

```ts
unitCollisionRadius: number;
summonedUnitCollisionRadius: number;
```

`createDefaultBattleConfig()` へ次を設定する。

```ts
unitCollisionRadius: 0.756,
summonedUnitCollisionRadius: 0.9828,
```

`collisionGeometry.ts` を作成する。

```ts
import type { BattleConfig, Vec2 } from "../core/types";
import { distanceSq } from "../core/vector";

export type CollisionBodyKind = "Unit" | "SummonedUnit" | "Point";

export function collisionRadiusForKind(
  config: BattleConfig,
  kind: CollisionBodyKind
): number {
  switch (kind) {
    case "Unit":
      return config.unitCollisionRadius;
    case "SummonedUnit":
      return config.summonedUnitCollisionRadius;
    case "Point":
      return 0;
  }
}

export function combinedCollisionRadius(
  config: BattleConfig,
  firstKind: CollisionBodyKind,
  secondKind: CollisionBodyKind
): number {
  return (
    collisionRadiusForKind(config, firstKind) +
    collisionRadiusForKind(config, secondKind)
  );
}

export function areCollisionCirclesTouching(
  config: BattleConfig,
  firstPosition: Vec2,
  firstKind: CollisionBodyKind,
  secondPosition: Vec2,
  secondKind: CollisionBodyKind
): boolean {
  const radius = combinedCollisionRadius(config, firstKind, secondKind);
  return distanceSq(firstPosition, secondPosition) <= radius * radius;
}
```

- [ ] **Step 4: 対象テストと型チェックを実行してGREENを確認する**

Run:

```powershell
cd src/client
node --import tsx --test src/game/core/battleState.test.ts src/game/rules/collisionGeometry.test.ts
npm.cmd run typecheck
```

Expected: 対象テストと型チェックがPASS。

- [ ] **Step 5: Task 1をコミットする**

```powershell
git add src/client/src/game/core/types.ts src/client/src/game/core/battleConfig.ts src/client/src/game/core/battleState.test.ts src/client/src/game/rules/collisionGeometry.ts src/client/src/game/rules/collisionGeometry.test.ts
git commit -m "feat: 種別別の当たり判定半径を定義"
```

---

### Task 2: 通常ユニット側の対称接触判定

**Files:**
- Modify: `src/client/src/game/rules/unitSystem.ts`
- Modify: `src/client/src/game/rules/unitSystem.test.ts`

**Interfaces:**
- Consumes: `areCollisionCirclesTouching(...)` from Task 1
- Produces: 通常ユニット対通常ユニット・召喚獣・点対象の接触減速判定

- [ ] **Step 1: 通常ユニット側の境界テストを書く**

`unitSystem.test.ts` に、他の敵を撃破状態へして判定対象を1体だけ残す補助処理を置き、次を追加する。

```ts
test("通常ユニット同士は半径の合計1.512で接触する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  const enemy = findUnit(state, "CpuMelee");
  unit.position = { x: 0, y: 0 };
  unit.destination = { x: 3, y: 0 };
  enemy.position = { x: 1.512, y: 0 };
  for (const candidate of state.units.filter(
    (value) => value.team === "Cpu" && value.unitId !== enemy.unitId
  )) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }

  tickMovement(state, config, 1);

  assert.equal(
    Number(unit.position.x.toFixed(6)),
    Number((unit.stats.moveSpeed * config.contactSlowMultiplier).toFixed(6))
  );
});

test("通常ユニットと召喚獣は半径の合計1.7388で接触する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  for (const candidate of state.units.filter((value) => value.team === "Cpu")) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }
  unit.position = { x: 0, y: 0 };
  unit.destination = { x: 3, y: 0 };
  state.summonedUnits.push({
    summonedUnitId: 1,
    team: "Cpu",
    position: { x: 1.7388, y: 0 },
    destination: { x: 1.7388, y: 0 },
    maxHp: 100,
    currentHp: 100,
    attackDamage: 0,
    leaderAttackDamage: 0,
    attackIntervalSeconds: 0.5,
    attackTimerSeconds: 0,
    leaderAttackIntervalSeconds: 2,
    leaderAttackTimerSeconds: 0,
    moveSpeed: 0,
    healthDecayPerSecond: 0
  });

  tickMovement(state, config, 1);

  assert.equal(
    Number(unit.position.x.toFixed(6)),
    Number((unit.stats.moveSpeed * config.contactSlowMultiplier).toFixed(6))
  );
});

test("通常ユニットと点対象は0.756を超えると接触しない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  for (const candidate of state.units.filter((value) => value.team === "Cpu")) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }
  unit.position = { x: 0, y: 0 };
  unit.destination = { x: 3, y: 0 };
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Cpu",
    position: { x: 0.756 + 0.0001, y: 0 },
    maxHp: 100,
    currentHp: 100,
    isComplete: true
  });

  tickMovement(state, config, 1);

  assert.equal(
    Number(unit.position.x.toFixed(6)),
    Number(unit.stats.moveSpeed.toFixed(6))
  );
});
```

- [ ] **Step 2: 対象テストを実行してREDを確認する**

Run:

```powershell
cd src/client
node --import tsx --test src/game/rules/unitSystem.test.ts
```

Expected: 旧共通半径参照、または新しい境界で期待と異なる移動量によりFAIL。

- [ ] **Step 3: `hasEnemyContact` を共通判定へ移行する**

`unitSystem.ts` へ次をimportする。

```ts
import { areCollisionCirclesTouching } from "./collisionGeometry";
```

`hasEnemyContact` の3経路を次の組み合わせへ置き換える。

```ts
return (
  state.units.some(
    (candidate) =>
      candidate.team === enemyTeam &&
      candidate.unitId !== unit.unitId &&
      isUnitAlive(candidate) &&
      areCollisionCirclesTouching(
        config,
        unit.position,
        "Unit",
        candidate.position,
        "Unit"
      )
  ) ||
  state.summonedUnits.some(
    (candidate) =>
      candidate.team === enemyTeam &&
      candidate.currentHp > 0 &&
      areCollisionCirclesTouching(
        config,
        unit.position,
        "Unit",
        candidate.position,
        "SummonedUnit"
      )
  ) ||
  state.elementals.some(
    (candidate) =>
      candidate.team === enemyTeam &&
      candidate.currentHp > 0 &&
      areCollisionCirclesTouching(
        config,
        unit.position,
        "Unit",
        candidate.position,
        "Point"
      )
  )
);
```

- [ ] **Step 4: 対象テストを実行してGREENを確認する**

Run:

```powershell
cd src/client
node --import tsx --test src/game/rules/collisionGeometry.test.ts src/game/rules/unitSystem.test.ts
```

Expected: PASS。

- [ ] **Step 5: Task 2をコミットする**

```powershell
git add src/client/src/game/rules/unitSystem.ts src/client/src/game/rules/unitSystem.test.ts
git commit -m "feat: 通常ユニットの接触円を半径加算へ変更"
```

---

### Task 3: 召喚獣側の対称接触判定

**Files:**
- Modify: `src/client/src/game/rules/summonSystem.ts`
- Modify: `src/client/src/game/rules/summonSystem.test.ts`

**Interfaces:**
- Consumes: `areCollisionCirclesTouching(...)` from Task 1
- Produces: 召喚獣対通常ユニット・召喚獣・エレメンタル・召喚士の接触攻撃と接触減速

- [ ] **Step 1: 召喚獣側の境界テストを書く**

`battleState` のimportへ `findUnit` を追加する。既存の `addSummonedUnit` 補助関数を使用し、各テストでは `healthDecayPerSecond = 0` と `moveSpeed = 0` にする。次の境界を追加する。

```ts
test("召喚獣は通常ユニットと中心間距離1.7388で接触する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const enemy = findUnit(state, "CpuMelee");
  for (const candidate of state.units.filter(
    (value) => value.team === "Cpu" && value.unitId !== enemy.unitId
  )) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }
  addSummonedUnit(state, "Player", 100);
  const summoned = state.summonedUnits[0];
  summoned.position = { x: 0, y: 0 };
  summoned.moveSpeed = 0;
  summoned.healthDecayPerSecond = 0;
  enemy.position = { x: 1.7388, y: 0 };
  enemy.destination = { ...enemy.position };

  tickSummonedUnits(state, config, 0);

  assert.equal(enemy.currentHp, enemy.stats.maxHp - summoned.attackDamage);
});

test("召喚獣同士は中心間距離1.9656で接触する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addSummonedUnit(state, "Player", 100);
  addSummonedUnit(state, "Cpu", 100);
  const playerSummoned = state.summonedUnits[0];
  const cpuSummoned = state.summonedUnits[1];
  playerSummoned.position = { x: 0, y: 0 };
  cpuSummoned.position = { x: 1.9656, y: 0 };
  for (const summoned of state.summonedUnits) {
    summoned.moveSpeed = 0;
    summoned.healthDecayPerSecond = 0;
  }

  tickSummonedUnits(state, config, 0);

  assert.ok(cpuSummoned.currentHp < cpuSummoned.maxHp);
  assert.ok(playerSummoned.currentHp < playerSummoned.maxHp);
});

test("召喚獣は点対象と0.9828で接触し超過時は接触しない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addSummonedUnit(state, "Player", 100);
  const summoned = state.summonedUnits[0];
  summoned.position = { x: 0, y: 0 };
  summoned.moveSpeed = 0;
  summoned.healthDecayPerSecond = 0;
  const leader = findLeader(state, "Cpu");
  leader.position = { x: 0.9828, y: 0 };

  tickSummonedUnits(state, config, 0);
  const hpAtBoundary = leader.currentHp;

  summoned.leaderAttackTimerSeconds = 0;
  leader.position = { x: 0.9828 + 0.0001, y: 0 };
  tickSummonedUnits(state, config, 0);

  assert.equal(hpAtBoundary, leader.maxHp - summoned.leaderAttackDamage);
  assert.equal(leader.currentHp, hpAtBoundary);
});

test("召喚獣とエレメンタルは0.9828で接触し超過時は接触しない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addSummonedUnit(state, "Player", 100);
  const summoned = state.summonedUnits[0];
  summoned.position = { x: 0, y: 0 };
  summoned.moveSpeed = 0;
  summoned.healthDecayPerSecond = 0;
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Cpu",
    position: { x: 0.9828, y: 0 },
    maxHp: 100,
    currentHp: 100,
    isComplete: true
  });
  const elemental = state.elementals[0];

  tickSummonedUnits(state, config, 0);
  const hpAtBoundary = elemental.currentHp;

  summoned.attackTimerSeconds = 0;
  elemental.position = { x: 0.9828 + 0.0001, y: 0 };
  tickSummonedUnits(state, config, 0);

  assert.equal(hpAtBoundary, 100 - summoned.attackDamage);
  assert.equal(elemental.currentHp, hpAtBoundary);
});
```

- [ ] **Step 2: 対象テストを実行してREDを確認する**

Run:

```powershell
cd src/client
node --import tsx --test src/game/rules/summonSystem.test.ts
```

Expected: 旧共通半径参照、または新しい境界で攻撃が発生しないためFAIL。

- [ ] **Step 3: 召喚獣の4つの接触経路を共通判定へ移行する**

`summonSystem.ts` の `distance` importを削除し、次をimportする。

```ts
import { areCollisionCirclesTouching } from "./collisionGeometry";
```

接触判定を次の種別組み合わせへ置き換える。

```ts
const touchingLeader = areCollisionCirclesTouching(
  config,
  summoned.position,
  "SummonedUnit",
  enemyLeader.position,
  "Point"
);
```

```ts
areCollisionCirclesTouching(
  config,
  summoned.position,
  "SummonedUnit",
  unit.position,
  "Unit"
)
```

```ts
areCollisionCirclesTouching(
  config,
  summoned.position,
  "SummonedUnit",
  elemental.position,
  "Point"
)
```

```ts
areCollisionCirclesTouching(
  config,
  summoned.position,
  "SummonedUnit",
  candidate.position,
  "SummonedUnit"
)
```

既存の陣営、生存、完成状態、自身除外条件はそのまま維持する。

- [ ] **Step 4: 対象テストとルール全体テストを実行してGREENを確認する**

Run:

```powershell
cd src/client
node --import tsx --test src/game/rules/collisionGeometry.test.ts src/game/rules/unitSystem.test.ts src/game/rules/summonSystem.test.ts
```

Expected: PASS。

- [ ] **Step 5: Task 3をコミットする**

```powershell
git add src/client/src/game/rules/summonSystem.ts src/client/src/game/rules/summonSystem.test.ts
git commit -m "feat: 召喚獣の接触円を半径加算へ変更"
```

---

### Task 4: 選択円を通常ユニットの新半径へ同期

**Files:**
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/core/battleConfig.ts`
- Modify: `src/client/src/game/core/battleState.test.ts`
- Modify: `src/client/src/game/render/unitSelectionPresentation.test.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**
- Consumes: `BattleConfig.unitCollisionRadius`
- Produces: 標準戦場で半径30.912px、直径61.824pxの通常ユニット選択円

- [ ] **Step 1: 新しい選択円半径の失敗テストを書く**

`unitSelectionPresentation.test.ts` の入力と期待値を次へ更新する。

```ts
test("unit selection circle converts the unit collision radius to screen pixels", async () => {
  const module = await loadSelectionPresentation();
  assert.equal(typeof module.unitSelectionCirclePresentation, "function");
  const presentation = module.unitSelectionCirclePresentation!(
    0.756,
    515.2,
    12.6
  );

  assert.equal(Number(presentation.radius.toFixed(3)), 30.912);
  assert.equal(Number((presentation.radius * 2).toFixed(3)), 61.824);
  assert.equal(presentation.strokeWidth, 3);
  assert.equal(presentation.strokeColor, 0xfacc15);
  assert.equal(presentation.strokeAlpha, 1);
});
```

拡大時テストは入力0.756、戦場幅1030.4pxで半径61.824pxを期待する。

`battleState.test.ts` の既定設定テストへ、移行完了後に旧設定が残らないことを追加する。

```ts
assert.equal("contactSlowRadius" in config, false);
```

- [ ] **Step 2: 対象テストを実行してREDを確認する**

Run:

```powershell
cd src/client
node --import tsx --test src/game/core/battleState.test.ts src/game/render/unitSelectionPresentation.test.ts
```

Expected: `contactSlowRadius` がまだ既定設定に存在するため、旧設定の不存在テストがFAIL。

- [ ] **Step 3: 旧設定を削除し、選択円の設定参照を変更する**

`BattleConfig` と `createDefaultBattleConfig()` から `contactSlowRadius` を削除する。

`BattleScene.drawUnits()` の選択円描画で、設定取得と関数引数を次へ変更する。

```ts
const { battlefieldMin, battlefieldMax, unitCollisionRadius } =
  this.session.config;
const presentation = unitSelectionCirclePresentation(
  unitCollisionRadius,
  bounds.width,
  battlefieldMax.x - battlefieldMin.x
);
```

`selectionRadiusPx = 28` と `findPlayerUnitAt` は変更しない。

- [ ] **Step 4: 対象テスト、全テスト、型チェック、production buildを実行する**

Run:

```powershell
cd src/client
node --import tsx --test src/game/render/unitSelectionPresentation.test.ts
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

Expected:

- 選択円テストがPASS。
- 全テストがPASS。
- 型チェックがPASSし、`contactSlowRadius` 参照が残らない。
- production buildが成功する。既存のVite chunk size警告は許容する。

- [ ] **Step 5: 対象外の回帰と差分品質を確認する**

Run:

```powershell
rg -n "selectionRadiusPx = 28" src/client/src/game/scenes/BattleScene.ts
rg -n "unitCardDisplayWidth = 51.52|summonedCardScale = 1.3|unitCardImageTopOffset = 5" src/client/src/game/render/cardPresentation.ts
git diff --check
git status --short
```

Expected:

- クリック取得半径28pxが残る。
- カード幅、召喚獣倍率、画像オフセットが変化していない。
- `git diff --check` に出力がない。
- 意図した5ファイルだけが未コミットである。

- [ ] **Step 6: Task 4をコミットする**

```powershell
git add src/client/src/game/core/types.ts src/client/src/game/core/battleConfig.ts src/client/src/game/core/battleState.test.ts src/client/src/game/render/unitSelectionPresentation.test.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: 選択円を通常ユニットの接触半径へ同期"
```

---

## 最終検証

実装コミット後のクリーンな作業ツリーで次を順番に実行する。

```powershell
npm.cmd run test -w src/client
npm.cmd run typecheck -w src/client
npm.cmd run build -w src/client
git diff --check
git status --short
```

期待結果:

- クライアント全テスト成功。
- 型チェック成功。
- production build成功。既存のVite chunk size警告のみ許容。
- `git diff --check` に出力なし。
- 作業ツリーがクリーン。
