# ローカルCOM戦MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unity版MVPのローカルCOM戦ルールをTypeScriptへ移植し、Phaserクライアントで遊べるブラウザ版MVPを作る。

**Architecture:** 重要なゲームルールは `src/client/src/game` 配下の純TypeScriptに分離し、Phaser Sceneは入力、描画、HUD更新だけを担当する。サーバ/Colyseusは今回のプレイ経路から外し、既存スターターとしてビルド可能な状態を保つ。

**Tech Stack:** TypeScript, Phaser 3, Vite, Node.js built-in test runner, tsx

---

## ファイル構成

- Modify: `src/client/package.json`
  - クライアント単体のテストコマンドを追加する。
- Modify: `src/client/tsconfig.json`
  - `node:test` と `node:assert` を使うテストファイルを型チェック対象にするため、Node型を含める。
- Create: `src/client/src/game/core/types.ts`
  - ID、コマンド、状態、イベントの型定義を集約する。
- Create: `src/client/src/game/core/battleConfig.ts`
  - 既定パラメータとユニット性能を定義する。
- Create: `src/client/src/game/core/battleState.ts`
  - 初期状態生成と状態参照ヘルパーを定義する。
- Create: `src/client/src/game/core/vector.ts`
  - 2Dベクトル計算と戦場クランプを定義する。
- Create: `src/client/src/game/rules/areaCalculator.ts`
  - 凸包と多角形面積を計算する。
- Create: `src/client/src/game/rules/elementalSystem.ts`
  - エレメンタル生成開始、進行、完了、除去を扱う。
- Create: `src/client/src/game/rules/unitSystem.ts`
  - 通常ユニットの移動、攻撃、撃破、復活、リーダー回復を扱う。
- Create: `src/client/src/game/rules/summonSystem.ts`
  - 召喚可否、召喚ユニット生成、移動、接触ダメージ、HP自然減少を扱う。
- Create: `src/client/src/game/rules/gameSession.ts`
  - コマンド適用、Tick順序、勝敗判定をまとめる。
- Create: `src/client/src/game/ai/cpuPlanner.ts`
  - CPUの1秒ごとのコマンド生成を扱う。
- Create: `src/client/src/game/ui/battleHud.ts`
  - PhaserボタンとHUDテキストを生成し、状態に合わせて更新する。
- Create: `src/client/src/game/scenes/TitleScene.ts`
  - タイトルと開始ボタンを表示する。
- Create: `src/client/src/game/scenes/BattleScene.ts`
  - `GameSession` を駆動し、入力、CPU計画、描画、HUD更新を行う。
- Modify: `src/client/src/main.ts`
  - 既存の接続確認用BootSceneから、タイトル/バトルシーン起動へ差し替える。
- Modify: `src/client/src/style.css`
  - ゲームキャンバスとHUDの基本表示を整える。
- Test: `src/client/src/game/**/*.test.ts`
  - 純ルール層をNode.js built-in test runnerで検証する。

## 実装タスク

### Task 1: クライアントテスト基盤

**Files:**
- Modify: `src/client/package.json`
- Modify: `src/client/tsconfig.json`
- Create: `src/client/src/game/core/testSmoke.test.ts`

- [ ] **Step 1: 失敗するテストを追加する**

`src/client/src/game/core/testSmoke.test.ts` を作成する。まだ `sumForSmokeTest` は存在しないので、コンパイル時に失敗する。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { sumForSmokeTest } from "./testSmokeTarget";

test("クライアントのTypeScriptテストを実行できる", () => {
  assert.equal(sumForSmokeTest(2, 3), 5);
});
```

- [ ] **Step 2: テストコマンドを追加する**

`src/client/package.json` の `scripts` を次の形にする。

```json
"scripts": {
  "dev": "vite --host 0.0.0.0",
  "build": "tsc -p tsconfig.json && vite build",
  "preview": "vite preview",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "test": "node --import tsx --test \"src/**/*.test.ts\""
}
```

`src/client/tsconfig.json` の `types` を次の形にする。

```json
"types": [
  "vite/client",
  "node"
]
```

- [ ] **Step 3: 失敗を確認する**

Run: `npm run test -w src/client`

Expected: FAIL。`Cannot find module './testSmokeTarget'` または同等の未定義モジュールエラーで失敗する。

- [ ] **Step 4: 最小実装を書く**

`src/client/src/game/core/testSmokeTarget.ts` を作成する。

```ts
export function sumForSmokeTest(left: number, right: number): number {
  return left + right;
}
```

- [ ] **Step 5: 成功を確認する**

Run: `npm run test -w src/client`

Expected: PASS。`1 test` が成功する。

- [ ] **Step 6: スモークテストを削除する**

`src/client/src/game/core/testSmoke.test.ts` と `src/client/src/game/core/testSmokeTarget.ts` を削除する。これはテスト基盤確認専用で、MVPの仕様を表さないため残さない。

- [ ] **Step 7: 削除後もテストコマンドが正常終了することを確認する**

Run: `npm run test -w src/client`

Expected: PASS。テストファイルがない場合でもコマンドが正常終了しない環境なら、次の空ではない実テストをTask 2で追加してから再実行する。

- [ ] **Step 8: コミットする**

```bash
git add src/client/package.json src/client/tsconfig.json
git commit -m "test: add client test runner"
```

### Task 2: コア型、設定、初期状態

**Files:**
- Create: `src/client/src/game/core/types.ts`
- Create: `src/client/src/game/core/battleConfig.ts`
- Create: `src/client/src/game/core/battleState.ts`
- Test: `src/client/src/game/core/battleState.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/client/src/game/core/battleState.test.ts` を作成する。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "./battleConfig";
import { createDefaultBattleState, findLeader, findUnit } from "./battleState";

test("既定状態は左右のリーダーと各3体の通常ユニットを持つ", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(state.remainingSeconds, 180);
  assert.equal(state.leaders.length, 2);
  assert.equal(state.units.length, 6);
  assert.equal(findLeader(state, "Player").currentHp, 1000);
  assert.equal(findLeader(state, "Cpu").position.x, 7);
  assert.equal(findUnit(state, "PlayerMelee").unitType, "Melee");
  assert.equal(findUnit(state, "CpuRanged").position.y, -1.5);
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -w src/client -- src/game/core/battleState.test.ts`

Expected: FAIL。`Cannot find module './battleConfig'` または同等の未定義モジュールエラー。

- [ ] **Step 3: 型定義を作成する**

`src/client/src/game/core/types.ts` を作成する。

```ts
export type TeamId = "Player" | "Cpu";
export type UnitType = "Melee" | "Speed" | "Ranged";
export type UnitId =
  | "PlayerMelee"
  | "PlayerSpeed"
  | "PlayerRanged"
  | "CpuMelee"
  | "CpuSpeed"
  | "CpuRanged";
export type LeaderId = "Player" | "Cpu";
export type ElementalId =
  | "Elemental1"
  | "Elemental2"
  | "Elemental3"
  | "Elemental4"
  | "Elemental5"
  | "Elemental6"
  | "Elemental7"
  | "Elemental8";
export type CommandType = "MoveUnit" | "BeginElementalBuild" | "Summon";
export type MatchResult = "InProgress" | "PlayerWin" | "CpuWin" | "Draw";
export type UnitMode = "Active" | "BuildingElemental" | "Defeated";

export type Vec2 = {
  x: number;
  y: number;
};

export type UnitStats = {
  maxHp: number;
  moveSpeed: number;
  attackDamage: number;
  attackRange: number;
  attackIntervalSeconds: number;
};

export type BattleConfig = {
  matchDurationSeconds: number;
  leaderMaxHp: number;
  elementalBuildSeconds: number;
  maxElementalsPerTeam: number;
  requiredElementalsToSummon: number;
  summonCooldownSeconds: number;
  summonedUnitMinHpMultiplier: number;
  summonedUnitMaxHpMultiplier: number;
  summonedUnitHpPerAreaMultiplier: number;
  summonedUnitAttackDamageMultiplier: number;
  summonedUnitHealthDecayMinimumHpFactorPerSecond: number;
  unitRespawnSeconds: number;
  elementalMaxHp: number;
  directLeaderDamageMultiplier: number;
  playerLeaderPosition: Vec2;
  cpuLeaderPosition: Vec2;
  battlefieldMin: Vec2;
  battlefieldMax: Vec2;
  contactSlowRadius: number;
  contactSlowMultiplier: number;
  leaderVisualSize: number;
  leaderHealingRadius: number;
  statsByType: Record<UnitType, UnitStats>;
};

export type BattleCommand =
  | { commandType: "MoveUnit"; team: TeamId; unitId: UnitId; targetPosition: Vec2 }
  | { commandType: "BeginElementalBuild"; team: TeamId; unitId: UnitId }
  | { commandType: "Summon"; team: TeamId };

export type LeaderState = {
  leaderId: LeaderId;
  team: TeamId;
  position: Vec2;
  maxHp: number;
  currentHp: number;
};

export type UnitState = {
  unitId: UnitId;
  team: TeamId;
  unitType: UnitType;
  position: Vec2;
  spawnPosition: Vec2;
  destination: Vec2;
  stats: UnitStats;
  currentHp: number;
  mode: UnitMode;
  buildTimerSeconds: number;
  respawnTimerSeconds: number;
  attackTimerSeconds: number;
  pendingElementalId: ElementalId | null;
};

export type ElementalState = {
  elementalId: ElementalId;
  team: TeamId;
  position: Vec2;
  maxHp: number;
  currentHp: number;
  isComplete: boolean;
};

export type SummonedUnitState = {
  summonedUnitId: number;
  team: TeamId;
  position: Vec2;
  destination: Vec2;
  maxHp: number;
  currentHp: number;
  attackDamage: number;
  moveSpeed: number;
  healthDecayPerSecond: number;
};

export type AttackEvent = {
  attackerUnitId: UnitId;
  origin: Vec2;
  targetPosition: Vec2;
};

export type BattleState = {
  remainingSeconds: number;
  playerSummonCooldownSeconds: number;
  cpuSummonCooldownSeconds: number;
  result: MatchResult;
  leaders: LeaderState[];
  units: UnitState[];
  elementals: ElementalState[];
  summonedUnits: SummonedUnitState[];
  recentAttackEvents: AttackEvent[];
  nextSummonedUnitId: number;
};
```

- [ ] **Step 4: 設定を作成する**

`src/client/src/game/core/battleConfig.ts` を作成する。

```ts
import type { BattleConfig, UnitStats, UnitType } from "./types";

const statsByType: Record<UnitType, UnitStats> = {
  Melee: {
    maxHp: 350,
    moveSpeed: 3.5 / 3,
    attackDamage: 45,
    attackRange: 1.25,
    attackIntervalSeconds: 1.2
  },
  Speed: {
    maxHp: 250,
    moveSpeed: 5.5 / 3,
    attackDamage: 30,
    attackRange: 1,
    attackIntervalSeconds: 0.8
  },
  Ranged: {
    maxHp: 220,
    moveSpeed: 1,
    attackDamage: 35,
    attackRange: 3.5,
    attackIntervalSeconds: 1.4
  }
};

export function createDefaultBattleConfig(): BattleConfig {
  return {
    matchDurationSeconds: 180,
    leaderMaxHp: 1000,
    elementalBuildSeconds: 5,
    maxElementalsPerTeam: 4,
    requiredElementalsToSummon: 2,
    summonCooldownSeconds: 30,
    summonedUnitMinHpMultiplier: 3,
    summonedUnitMaxHpMultiplier: 10,
    summonedUnitHpPerAreaMultiplier: 1,
    summonedUnitAttackDamageMultiplier: 3,
    summonedUnitHealthDecayMinimumHpFactorPerSecond: 0.1,
    unitRespawnSeconds: 10,
    elementalMaxHp: 120,
    directLeaderDamageMultiplier: 0.25,
    playerLeaderPosition: { x: -7, y: 0 },
    cpuLeaderPosition: { x: 7, y: 0 },
    battlefieldMin: { x: -7.5, y: -4.5 },
    battlefieldMax: { x: 7.5, y: 4.5 },
    contactSlowRadius: 0.45,
    contactSlowMultiplier: 1 / 3,
    leaderVisualSize: 0.8,
    leaderHealingRadius: 0.8 * 2.5,
    statsByType
  };
}
```

- [ ] **Step 5: 初期状態を作成する**

`src/client/src/game/core/battleState.ts` を作成する。

```ts
import type { BattleConfig, BattleState, LeaderState, TeamId, UnitId, UnitState, UnitType } from "./types";

export function createDefaultBattleState(config: BattleConfig): BattleState {
  return {
    remainingSeconds: config.matchDurationSeconds,
    playerSummonCooldownSeconds: 0,
    cpuSummonCooldownSeconds: 0,
    result: "InProgress",
    leaders: [
      createLeader("Player", config.playerLeaderPosition, config.leaderMaxHp),
      createLeader("Cpu", config.cpuLeaderPosition, config.leaderMaxHp)
    ],
    units: [
      createUnit("PlayerMelee", "Player", "Melee", { x: -5, y: 1.5 }, config),
      createUnit("PlayerSpeed", "Player", "Speed", { x: -5, y: 0 }, config),
      createUnit("PlayerRanged", "Player", "Ranged", { x: -5, y: -1.5 }, config),
      createUnit("CpuMelee", "Cpu", "Melee", { x: 5, y: 1.5 }, config),
      createUnit("CpuSpeed", "Cpu", "Speed", { x: 5, y: 0 }, config),
      createUnit("CpuRanged", "Cpu", "Ranged", { x: 5, y: -1.5 }, config)
    ],
    elementals: [],
    summonedUnits: [],
    recentAttackEvents: [],
    nextSummonedUnitId: 1
  };
}

export function findLeader(state: BattleState, team: TeamId): LeaderState {
  const leader = state.leaders.find((candidate) => candidate.team === team);
  if (!leader) {
    throw new Error(`Leader not found: ${team}`);
  }
  return leader;
}

export function findUnit(state: BattleState, unitId: UnitId): UnitState {
  const unit = state.units.find((candidate) => candidate.unitId === unitId);
  if (!unit) {
    throw new Error(`Unit not found: ${unitId}`);
  }
  return unit;
}

export function isUnitAlive(unit: UnitState): boolean {
  return unit.mode !== "Defeated" && unit.currentHp > 0;
}

export function teamForUnit(unitId: UnitId): TeamId {
  return unitId.startsWith("Player") ? "Player" : "Cpu";
}

export function oppositeTeam(team: TeamId): TeamId {
  return team === "Player" ? "Cpu" : "Player";
}

export function getSummonCooldown(state: BattleState, team: TeamId): number {
  return team === "Player" ? state.playerSummonCooldownSeconds : state.cpuSummonCooldownSeconds;
}

export function setSummonCooldown(state: BattleState, team: TeamId, seconds: number): void {
  if (team === "Player") {
    state.playerSummonCooldownSeconds = seconds;
  } else {
    state.cpuSummonCooldownSeconds = seconds;
  }
}

function createLeader(team: TeamId, position: { x: number; y: number }, maxHp: number): LeaderState {
  return {
    leaderId: team,
    team,
    position: { ...position },
    maxHp,
    currentHp: maxHp
  };
}

function createUnit(
  unitId: UnitId,
  team: TeamId,
  unitType: UnitType,
  spawnPosition: { x: number; y: number },
  config: BattleConfig
): UnitState {
  const stats = config.statsByType[unitType];
  return {
    unitId,
    team,
    unitType,
    position: { ...spawnPosition },
    spawnPosition: { ...spawnPosition },
    destination: { ...spawnPosition },
    stats,
    currentHp: stats.maxHp,
    mode: "Active",
    buildTimerSeconds: 0,
    respawnTimerSeconds: 0,
    attackTimerSeconds: 0,
    pendingElementalId: null
  };
}
```

- [ ] **Step 6: 成功を確認する**

Run: `npm run test -w src/client -- src/game/core/battleState.test.ts`

Expected: PASS。

- [ ] **Step 7: コミットする**

```bash
git add src/client/src/game/core src/client/package.json src/client/tsconfig.json
git commit -m "feat: add battle core state"
```

### Task 3: ベクトル計算と召喚領域計算

**Files:**
- Create: `src/client/src/game/core/vector.ts`
- Create: `src/client/src/game/rules/areaCalculator.ts`
- Test: `src/client/src/game/rules/areaCalculator.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/client/src/game/rules/areaCalculator.test.ts` を作成する。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { calculateSummonArea } from "./areaCalculator";

test("三角形の召喚領域を計算する", () => {
  const area = calculateSummonArea([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 3 }
  ]);

  assert.equal(area, 6);
});

test("内側の点は凸包面積に影響しない", () => {
  const area = calculateSummonArea([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 0, y: 2 },
    { x: 1, y: 1 }
  ]);

  assert.equal(area, 4);
});

test("3点未満なら面積は0", () => {
  assert.equal(calculateSummonArea([{ x: 0, y: 0 }, { x: 1, y: 0 }]), 0);
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -w src/client -- src/game/rules/areaCalculator.test.ts`

Expected: FAIL。`Cannot find module './areaCalculator'`。

- [ ] **Step 3: ベクトルヘルパーを作成する**

`src/client/src/game/core/vector.ts` を作成する。

```ts
import type { Vec2 } from "./types";

export function distanceSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.sqrt(distanceSq(a, b));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampVec2(position: Vec2, min: Vec2, max: Vec2): Vec2 {
  return {
    x: clamp(position.x, min.x, max.x),
    y: clamp(position.y, min.y, max.y)
  };
}

export function moveTowards(current: Vec2, target: Vec2, maxDelta: number): Vec2 {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length <= maxDelta || length === 0) {
    return { ...target };
  }
  const scale = maxDelta / length;
  return {
    x: current.x + dx * scale,
    y: current.y + dy * scale
  };
}
```

- [ ] **Step 4: 面積計算を実装する**

`src/client/src/game/rules/areaCalculator.ts` を作成する。

```ts
import type { Vec2 } from "../core/types";

export function calculateSummonArea(points: Vec2[]): number {
  const hull = convexHull(points);
  if (hull.length < 3) {
    return 0;
  }
  return Math.abs(shoelaceArea(hull));
}

function convexHull(points: Vec2[]): Vec2[] {
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const unique = sorted.filter((point, index) => index === 0 || point.x !== sorted[index - 1].x || point.y !== sorted[index - 1].y);
  if (unique.length <= 1) {
    return unique;
  }

  const lower: Vec2[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: Vec2[] = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function cross(origin: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function shoelaceArea(points: Vec2[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}
```

- [ ] **Step 5: 成功を確認する**

Run: `npm run test -w src/client -- src/game/rules/areaCalculator.test.ts`

Expected: PASS。

- [ ] **Step 6: コミットする**

```bash
git add src/client/src/game/core/vector.ts src/client/src/game/rules/areaCalculator.ts src/client/src/game/rules/areaCalculator.test.ts
git commit -m "feat: add summon area calculation"
```

### Task 4: エレメンタル生成システム

**Files:**
- Create: `src/client/src/game/rules/elementalSystem.ts`
- Test: `src/client/src/game/rules/elementalSystem.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/client/src/game/rules/elementalSystem.test.ts` を作成する。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findUnit } from "../core/battleState";
import { tryBeginElementalBuild, tickElementalBuilds } from "./elementalSystem";

test("アクティブなユニットはエレメンタル生成を開始できる", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(tryBeginElementalBuild(state, config, "PlayerMelee"), true);
  const unit = findUnit(state, "PlayerMelee");
  assert.equal(unit.mode, "BuildingElemental");
  assert.equal(unit.pendingElementalId, "Elemental1");
});

test("生成時間が満了するとユニット位置にエレメンタルが完成する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  tryBeginElementalBuild(state, config, "PlayerMelee");
  tickElementalBuilds(state, config, 5);

  const unit = findUnit(state, "PlayerMelee");
  assert.equal(unit.mode, "Active");
  assert.equal(state.elementals.length, 1);
  assert.equal(state.elementals[0].elementalId, "Elemental1");
  assert.equal(state.elementals[0].team, "Player");
  assert.equal(state.elementals[0].currentHp, 120);
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -w src/client -- src/game/rules/elementalSystem.test.ts`

Expected: FAIL。`Cannot find module './elementalSystem'`。

- [ ] **Step 3: 実装する**

`src/client/src/game/rules/elementalSystem.ts` を作成する。

```ts
import { findUnit, isUnitAlive } from "../core/battleState";
import type { BattleConfig, BattleState, ElementalId, TeamId } from "../core/types";

const elementalIds: ElementalId[] = [
  "Elemental1",
  "Elemental2",
  "Elemental3",
  "Elemental4",
  "Elemental5",
  "Elemental6",
  "Elemental7",
  "Elemental8"
];

export function tryBeginElementalBuild(state: BattleState, config: BattleConfig, unitId: Parameters<typeof findUnit>[1]): boolean {
  const unit = findUnit(state, unitId);
  if (!isUnitAlive(unit) || unit.mode !== "Active") {
    return false;
  }
  const completedCount = countCompletedElementals(state, unit.team);
  const pendingCount = state.units.filter((candidate) => candidate.team === unit.team && candidate.mode === "BuildingElemental").length;
  if (completedCount + pendingCount >= config.maxElementalsPerTeam) {
    return false;
  }
  const nextId = nextAvailableElementalId(state);
  if (!nextId) {
    return false;
  }
  unit.mode = "BuildingElemental";
  unit.buildTimerSeconds = config.elementalBuildSeconds;
  unit.pendingElementalId = nextId;
  return true;
}

export function tickElementalBuilds(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  for (const unit of state.units) {
    if (unit.mode !== "BuildingElemental" || !unit.pendingElementalId || !isUnitAlive(unit)) {
      continue;
    }
    unit.buildTimerSeconds = Math.max(0, unit.buildTimerSeconds - deltaSeconds);
    if (unit.buildTimerSeconds > 0) {
      continue;
    }
    state.elementals.push({
      elementalId: unit.pendingElementalId,
      team: unit.team,
      position: { ...unit.position },
      maxHp: config.elementalMaxHp,
      currentHp: config.elementalMaxHp,
      isComplete: true
    });
    unit.mode = "Active";
    unit.pendingElementalId = null;
    unit.buildTimerSeconds = 0;
  }
}

export function removeDestroyedElementals(state: BattleState): void {
  state.elementals = state.elementals.filter((elemental) => elemental.currentHp > 0);
}

export function countCompletedElementals(state: BattleState, team: TeamId): number {
  return state.elementals.filter((elemental) => elemental.team === team && elemental.isComplete && elemental.currentHp > 0).length;
}

export function completedElementalsForTeam(state: BattleState, team: TeamId) {
  return state.elementals.filter((elemental) => elemental.team === team && elemental.isComplete && elemental.currentHp > 0);
}

function nextAvailableElementalId(state: BattleState): ElementalId | null {
  const used = new Set<ElementalId>();
  for (const elemental of state.elementals) {
    used.add(elemental.elementalId);
  }
  for (const unit of state.units) {
    if (unit.pendingElementalId) {
      used.add(unit.pendingElementalId);
    }
  }
  return elementalIds.find((id) => !used.has(id)) ?? null;
}
```

- [ ] **Step 4: 成功を確認する**

Run: `npm run test -w src/client -- src/game/rules/elementalSystem.test.ts`

Expected: PASS。

- [ ] **Step 5: コミットする**

```bash
git add src/client/src/game/rules/elementalSystem.ts src/client/src/game/rules/elementalSystem.test.ts
git commit -m "feat: add elemental build rules"
```

### Task 5: 通常ユニットの移動、戦闘、復活

**Files:**
- Create: `src/client/src/game/rules/unitSystem.ts`
- Test: `src/client/src/game/rules/unitSystem.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/client/src/game/rules/unitSystem.test.ts` を作成する。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader, findUnit } from "../core/battleState";
import { applyMoveCommand, tickCombat, tickMovement, tickRespawns } from "./unitSystem";

test("移動コマンドは生成中を解除し、目標を戦場内にクランプする", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.mode = "BuildingElemental";
  unit.pendingElementalId = "Elemental1";

  applyMoveCommand(state, config, {
    commandType: "MoveUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: 100, y: -100 }
  });

  assert.equal(unit.mode, "Active");
  assert.equal(unit.pendingElementalId, null);
  assert.deepEqual(unit.destination, { x: 7.5, y: -4.5 });
});

test("ユニットは目標へ移動する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");

  applyMoveCommand(state, config, {
    commandType: "MoveUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: -4, y: 1.5 }
  });
  tickMovement(state, config, 3);

  assert.equal(Number(unit.position.x.toFixed(2)), -4);
});

test("攻撃範囲内の敵リーダーへ直接ダメージを与える", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.position = { x: 6.4, y: 0 };
  unit.destination = { x: 6.4, y: 0 };
  unit.attackTimerSeconds = 0;

  tickCombat(state, config, 1.2);

  assert.equal(findLeader(state, "Cpu").currentHp, 1000 - 45 * 0.25);
});

test("撃破された通常ユニットは復活タイマー後にスポーン位置へ戻る", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerSpeed");
  unit.currentHp = 0;
  unit.mode = "Defeated";
  unit.respawnTimerSeconds = 10;
  unit.position = { x: 0, y: 0 };

  tickRespawns(state, 10);

  assert.equal(unit.mode, "Active");
  assert.equal(unit.currentHp, unit.stats.maxHp);
  assert.deepEqual(unit.position, unit.spawnPosition);
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -w src/client -- src/game/rules/unitSystem.test.ts`

Expected: FAIL。`Cannot find module './unitSystem'`。

- [ ] **Step 3: 実装する**

`src/client/src/game/rules/unitSystem.ts` を作成する。

```ts
import { findLeader, findUnit, isUnitAlive, oppositeTeam } from "../core/battleState";
import type { BattleCommand, BattleConfig, BattleState, ElementalState, LeaderState, SummonedUnitState, UnitState } from "../core/types";
import { clampVec2, distance, distanceSq, moveTowards } from "../core/vector";

export function applyMoveCommand(state: BattleState, config: BattleConfig, command: Extract<BattleCommand, { commandType: "MoveUnit" }>): boolean {
  const unit = findUnit(state, command.unitId);
  if (!isUnitAlive(unit)) {
    return false;
  }
  unit.mode = "Active";
  unit.buildTimerSeconds = 0;
  unit.pendingElementalId = null;
  unit.destination = clampVec2(command.targetPosition, config.battlefieldMin, config.battlefieldMax);
  return true;
}

export function tickMovement(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  for (const unit of state.units) {
    if (!isUnitAlive(unit) || unit.mode !== "Active") {
      continue;
    }
    const speed = isContactSlowed(state, config, unit) ? unit.stats.moveSpeed * config.contactSlowMultiplier : unit.stats.moveSpeed;
    unit.position = moveTowards(unit.position, unit.destination, speed * deltaSeconds);
  }
}

export function tickCombat(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  state.recentAttackEvents = [];
  for (const unit of state.units) {
    if (!isUnitAlive(unit) || unit.mode !== "Active") {
      continue;
    }
    unit.attackTimerSeconds = Math.max(0, unit.attackTimerSeconds - deltaSeconds);
    if (unit.attackTimerSeconds > 0) {
      continue;
    }
    const target = findNearestTarget(state, unit);
    if (!target || distance(unit.position, target.position) > unit.stats.attackRange) {
      continue;
    }
    applyDamage(target, target.kind === "leader" ? unit.stats.attackDamage * config.directLeaderDamageMultiplier : unit.stats.attackDamage);
    state.recentAttackEvents.push({ attackerUnitId: unit.unitId, origin: { ...unit.position }, targetPosition: { ...target.position } });
    unit.attackTimerSeconds = unit.stats.attackIntervalSeconds;
    markDefeatedUnits(state, config);
  }
}

export function tickLeaderHealing(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  for (const unit of state.units) {
    if (!isUnitAlive(unit)) {
      continue;
    }
    const leader = findLeader(state, unit.team);
    if (distance(unit.position, leader.position) <= config.leaderHealingRadius) {
      unit.currentHp = Math.min(unit.stats.maxHp, unit.currentHp + unit.stats.attackDamage * deltaSeconds);
    }
  }
}

export function tickRespawns(state: BattleState, deltaSeconds: number): void {
  for (const unit of state.units) {
    if (unit.mode !== "Defeated") {
      continue;
    }
    unit.respawnTimerSeconds = Math.max(0, unit.respawnTimerSeconds - deltaSeconds);
    if (unit.respawnTimerSeconds === 0) {
      unit.mode = "Active";
      unit.currentHp = unit.stats.maxHp;
      unit.position = { ...unit.spawnPosition };
      unit.destination = { ...unit.spawnPosition };
      unit.attackTimerSeconds = 0;
    }
  }
}

function isContactSlowed(state: BattleState, config: BattleConfig, unit: UnitState): boolean {
  const radiusSq = config.contactSlowRadius * config.contactSlowRadius;
  return [...state.units, ...state.summonedUnits]
    .filter((candidate) => candidate.team !== unit.team)
    .some((candidate) => distanceSq(unit.position, candidate.position) <= radiusSq);
}

function findNearestTarget(state: BattleState, unit: UnitState): AttackTarget | null {
  const enemyTeam = oppositeTeam(unit.team);
  const candidates: AttackTarget[] = [
    ...state.units.filter((candidate) => candidate.team === enemyTeam && isUnitAlive(candidate)).map((candidate) => ({ kind: "unit" as const, value: candidate, position: candidate.position })),
    ...state.elementals.filter((candidate) => candidate.team === enemyTeam && candidate.currentHp > 0).map((candidate) => ({ kind: "elemental" as const, value: candidate, position: candidate.position })),
    ...state.summonedUnits.filter((candidate) => candidate.team === enemyTeam && candidate.currentHp > 0).map((candidate) => ({ kind: "summoned" as const, value: candidate, position: candidate.position })),
    { kind: "leader" as const, value: findLeader(state, enemyTeam), position: findLeader(state, enemyTeam).position }
  ];
  return candidates.sort((a, b) => distanceSq(unit.position, a.position) - distanceSq(unit.position, b.position))[0] ?? null;
}

function applyDamage(target: AttackTarget, damage: number): void {
  target.value.currentHp = Math.max(0, target.value.currentHp - damage);
}

function markDefeatedUnits(state: BattleState, config: BattleConfig): void {
  for (const unit of state.units) {
    if (unit.mode !== "Defeated" && unit.currentHp <= 0) {
      unit.mode = "Defeated";
      unit.pendingElementalId = null;
      unit.buildTimerSeconds = 0;
      unit.respawnTimerSeconds = config.unitRespawnSeconds;
    }
  }
}

type AttackTarget =
  | { kind: "unit"; value: UnitState; position: UnitState["position"] }
  | { kind: "elemental"; value: ElementalState; position: ElementalState["position"] }
  | { kind: "summoned"; value: SummonedUnitState; position: SummonedUnitState["position"] }
  | { kind: "leader"; value: LeaderState; position: LeaderState["position"] };
```

- [ ] **Step 4: 成功を確認する**

Run: `npm run test -w src/client -- src/game/rules/unitSystem.test.ts`

Expected: PASS。

- [ ] **Step 5: 全ルールテストを確認する**

Run: `npm run test -w src/client`

Expected: PASS。

- [ ] **Step 6: コミットする**

```bash
git add src/client/src/game/rules/unitSystem.ts src/client/src/game/rules/unitSystem.test.ts
git commit -m "feat: add unit movement and combat rules"
```

### Task 6: 召喚システム

**Files:**
- Create: `src/client/src/game/rules/summonSystem.ts`
- Test: `src/client/src/game/rules/summonSystem.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/client/src/game/rules/summonSystem.test.ts` を作成する。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader } from "../core/battleState";
import { tryExecuteSummon, tickSummonCooldowns, tickSummonedUnits } from "./summonSystem";

test("完成済みエレメンタルが2つあれば召喚できる", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: -5, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: -4, y: 1 }, maxHp: 120, currentHp: 120, isComplete: true }
  );

  assert.equal(tryExecuteSummon(state, config, "Player"), true);
  assert.equal(state.summonedUnits.length, 1);
  assert.equal(state.playerSummonCooldownSeconds, 30);
  assert.deepEqual(state.summonedUnits[0].destination, { x: 7, y: 0 });
});

test("召喚ユニットは接触した敵リーダーへ継続ダメージを与える", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.summonedUnits.push({
    summonedUnitId: 1,
    team: "Player",
    position: { x: 7, y: 0 },
    destination: { x: 7, y: 0 },
    maxHp: 100,
    currentHp: 100,
    attackDamage: 135,
    moveSpeed: 1,
    healthDecayPerSecond: 10
  });

  tickSummonedUnits(state, config, 1);

  assert.equal(findLeader(state, "Cpu").currentHp, 865);
  assert.equal(state.summonedUnits[0].currentHp, 90);
});

test("クールダウンは0未満にならない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.playerSummonCooldownSeconds = 1;
  tickSummonCooldowns(state, 2);
  assert.equal(state.playerSummonCooldownSeconds, 0);
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -w src/client -- src/game/rules/summonSystem.test.ts`

Expected: FAIL。`Cannot find module './summonSystem'`。

- [ ] **Step 3: 実装する**

`src/client/src/game/rules/summonSystem.ts` を作成する。

```ts
import { findLeader, getSummonCooldown, setSummonCooldown, oppositeTeam } from "../core/battleState";
import type { BattleConfig, BattleState, TeamId } from "../core/types";
import { distance, moveTowards } from "../core/vector";
import { calculateSummonArea } from "./areaCalculator";
import { completedElementalsForTeam } from "./elementalSystem";

export function canSummon(state: BattleState, config: BattleConfig, team: TeamId): boolean {
  return getSummonCooldown(state, team) === 0 && completedElementalsForTeam(state, team).length >= config.requiredElementalsToSummon;
}

export function tryExecuteSummon(state: BattleState, config: BattleConfig, team: TeamId): boolean {
  if (!canSummon(state, config, team)) {
    return false;
  }
  const leader = findLeader(state, team);
  const enemyLeader = findLeader(state, oppositeTeam(team));
  const elementals = completedElementalsForTeam(state, team);
  const area = calculateSummonArea([leader.position, ...elementals.map((elemental) => elemental.position)]);
  const meleeStats = config.statsByType.Melee;
  const hpMultiplier = Math.min(
    config.summonedUnitMaxHpMultiplier,
    Math.max(config.summonedUnitMinHpMultiplier, config.summonedUnitMinHpMultiplier + area * config.summonedUnitHpPerAreaMultiplier)
  );
  const maxHp = meleeStats.maxHp * hpMultiplier;
  state.summonedUnits.push({
    summonedUnitId: state.nextSummonedUnitId,
    team,
    position: { ...leader.position },
    destination: { ...enemyLeader.position },
    maxHp,
    currentHp: maxHp,
    attackDamage: meleeStats.attackDamage * config.summonedUnitAttackDamageMultiplier,
    moveSpeed: meleeStats.moveSpeed,
    healthDecayPerSecond: meleeStats.maxHp * config.summonedUnitMinHpMultiplier * config.summonedUnitHealthDecayMinimumHpFactorPerSecond
  });
  state.nextSummonedUnitId += 1;
  setSummonCooldown(state, team, config.summonCooldownSeconds);
  return true;
}

export function tickSummonCooldowns(state: BattleState, deltaSeconds: number): void {
  state.playerSummonCooldownSeconds = Math.max(0, state.playerSummonCooldownSeconds - deltaSeconds);
  state.cpuSummonCooldownSeconds = Math.max(0, state.cpuSummonCooldownSeconds - deltaSeconds);
}

export function tickSummonedUnits(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  for (const summoned of state.summonedUnits) {
    const enemyLeader = findLeader(state, oppositeTeam(summoned.team));
    summoned.destination = { ...enemyLeader.position };
    const touchingLeader = distance(summoned.position, enemyLeader.position) <= config.contactSlowRadius;
    if (touchingLeader) {
      enemyLeader.currentHp = Math.max(0, enemyLeader.currentHp - summoned.attackDamage * deltaSeconds);
    } else {
      summoned.position = moveTowards(summoned.position, summoned.destination, summoned.moveSpeed * deltaSeconds);
    }
    summoned.currentHp = Math.max(0, summoned.currentHp - summoned.healthDecayPerSecond * deltaSeconds);
  }
  state.summonedUnits = state.summonedUnits.filter((summoned) => summoned.currentHp > 0);
}
```

- [ ] **Step 4: 成功を確認する**

Run: `npm run test -w src/client -- src/game/rules/summonSystem.test.ts`

Expected: PASS。

- [ ] **Step 5: コミットする**

```bash
git add src/client/src/game/rules/summonSystem.ts src/client/src/game/rules/summonSystem.test.ts
git commit -m "feat: add summon rules"
```

### Task 7: GameSessionとCPU計画

**Files:**
- Create: `src/client/src/game/rules/gameSession.ts`
- Create: `src/client/src/game/ai/cpuPlanner.ts`
- Test: `src/client/src/game/rules/gameSession.test.ts`
- Test: `src/client/src/game/ai/cpuPlanner.test.ts`

- [ ] **Step 1: 失敗するGameSessionテストを書く**

`src/client/src/game/rules/gameSession.test.ts` を作成する。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { GameSession } from "./gameSession";

test("CPUリーダーHPが0になるとPlayerWinになる", () => {
  const session = new GameSession();
  session.state.leaders.find((leader) => leader.team === "Cpu")!.currentHp = 0;
  session.tick(0);
  assert.equal(session.state.result, "PlayerWin");
});

test("時間切れ時はリーダーHPの高い側が勝つ", () => {
  const session = new GameSession();
  session.state.remainingSeconds = 0.1;
  session.state.leaders.find((leader) => leader.team === "Player")!.currentHp = 900;
  session.state.leaders.find((leader) => leader.team === "Cpu")!.currentHp = 800;
  session.tick(0.2);
  assert.equal(session.state.result, "PlayerWin");
});
```

- [ ] **Step 2: 失敗するCPUテストを書く**

`src/client/src/game/ai/cpuPlanner.test.ts` を作成する。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState } from "../core/battleState";
import { planCpuCommands } from "./cpuPlanner";

test("CPUは召喚可能なら召喚を最優先する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.elementals.push(
    { elementalId: "Elemental1", team: "Cpu", position: { x: 5, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Cpu", position: { x: 4, y: 1 }, maxHp: 120, currentHp: 120, isComplete: true }
  );

  assert.deepEqual(planCpuCommands(state, config), [{ commandType: "Summon", team: "Cpu" }]);
});

test("CPUは召喚できないときエレメンタル生成を開始する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const commands = planCpuCommands(state, config);
  assert.equal(commands[0].commandType, "BeginElementalBuild");
  assert.equal(commands[0].team, "Cpu");
});
```

- [ ] **Step 3: 失敗を確認する**

Run: `npm run test -w src/client -- src/game/rules/gameSession.test.ts src/game/ai/cpuPlanner.test.ts`

Expected: FAIL。`Cannot find module './gameSession'` と `Cannot find module './cpuPlanner'`。

- [ ] **Step 4: GameSessionを実装する**

`src/client/src/game/rules/gameSession.ts` を作成する。

```ts
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader } from "../core/battleState";
import type { BattleCommand, BattleConfig, BattleState } from "../core/types";
import { tryBeginElementalBuild, removeDestroyedElementals, tickElementalBuilds } from "./elementalSystem";
import { tryExecuteSummon, tickSummonCooldowns, tickSummonedUnits } from "./summonSystem";
import { applyMoveCommand, tickCombat, tickLeaderHealing, tickMovement, tickRespawns } from "./unitSystem";

export class GameSession {
  readonly config: BattleConfig;
  readonly state: BattleState;

  constructor(config: BattleConfig = createDefaultBattleConfig()) {
    this.config = config;
    this.state = createDefaultBattleState(config);
  }

  applyCommand(command: BattleCommand): void {
    if (this.state.result !== "InProgress") {
      return;
    }
    if (command.commandType === "MoveUnit") {
      applyMoveCommand(this.state, this.config, command);
    } else if (command.commandType === "BeginElementalBuild") {
      tryBeginElementalBuild(this.state, this.config, command.unitId);
    } else {
      tryExecuteSummon(this.state, this.config, command.team);
      this.updateResult();
    }
  }

  tick(deltaSeconds: number): void {
    if (this.state.result !== "InProgress") {
      return;
    }
    this.state.remainingSeconds = Math.max(0, this.state.remainingSeconds - deltaSeconds);
    tickSummonCooldowns(this.state, deltaSeconds);
    tickElementalBuilds(this.state, this.config, deltaSeconds);
    tickMovement(this.state, this.config, deltaSeconds);
    tickLeaderHealing(this.state, this.config, deltaSeconds);
    tickCombat(this.state, this.config, deltaSeconds);
    tickSummonedUnits(this.state, this.config, deltaSeconds);
    tickRespawns(this.state, deltaSeconds);
    removeDestroyedElementals(this.state);
    this.updateResult();
  }

  private updateResult(): void {
    const player = findLeader(this.state, "Player");
    const cpu = findLeader(this.state, "Cpu");
    if (player.currentHp <= 0 && cpu.currentHp <= 0) {
      this.state.result = "Draw";
    } else if (cpu.currentHp <= 0) {
      this.state.result = "PlayerWin";
    } else if (player.currentHp <= 0) {
      this.state.result = "CpuWin";
    } else if (this.state.remainingSeconds > 0) {
      this.state.result = "InProgress";
    } else if (player.currentHp > cpu.currentHp) {
      this.state.result = "PlayerWin";
    } else if (cpu.currentHp > player.currentHp) {
      this.state.result = "CpuWin";
    } else {
      this.state.result = "Draw";
    }
  }
}
```

- [ ] **Step 5: CPU計画を実装する**

`src/client/src/game/ai/cpuPlanner.ts` を作成する。

```ts
import { findLeader, isUnitAlive } from "../core/battleState";
import type { BattleCommand, BattleConfig, BattleState } from "../core/types";
import { canSummon } from "../rules/summonSystem";
import { countCompletedElementals } from "../rules/elementalSystem";

export function planCpuCommands(state: BattleState, config: BattleConfig): BattleCommand[] {
  if (canSummon(state, config, "Cpu")) {
    return [{ commandType: "Summon", team: "Cpu" }];
  }

  const availableUnit = state.units.find((unit) => unit.team === "Cpu" && isUnitAlive(unit) && unit.mode === "Active");
  if (!availableUnit) {
    return [];
  }

  if (countCompletedElementals(state, "Cpu") < config.maxElementalsPerTeam) {
    return [{ commandType: "BeginElementalBuild", team: "Cpu", unitId: availableUnit.unitId }];
  }

  const playerLeader = findLeader(state, "Player");
  return state.units
    .filter((unit) => unit.team === "Cpu" && isUnitAlive(unit) && unit.mode === "Active")
    .map((unit) => ({
      commandType: "MoveUnit",
      team: "Cpu",
      unitId: unit.unitId,
      targetPosition: { ...playerLeader.position }
    }));
}
```

- [ ] **Step 6: 成功を確認する**

Run: `npm run test -w src/client -- src/game/rules/gameSession.test.ts src/game/ai/cpuPlanner.test.ts`

Expected: PASS。

- [ ] **Step 7: 全テストを確認する**

Run: `npm run test -w src/client`

Expected: PASS。

- [ ] **Step 8: コミットする**

```bash
git add src/client/src/game/rules/gameSession.ts src/client/src/game/rules/gameSession.test.ts src/client/src/game/ai/cpuPlanner.ts src/client/src/game/ai/cpuPlanner.test.ts
git commit -m "feat: add game session and cpu planner"
```

### Task 8: Phaserタイトル/バトルシーンとHUD

**Files:**
- Create: `src/client/src/game/ui/battleHud.ts`
- Create: `src/client/src/game/scenes/TitleScene.ts`
- Create: `src/client/src/game/scenes/BattleScene.ts`
- Modify: `src/client/src/main.ts`
- Modify: `src/client/src/style.css`

- [ ] **Step 1: 型チェックで失敗する最小Scene参照を追加する**

`src/client/src/main.ts` を次の内容に置き換える。まだ `TitleScene` が存在しないので型チェックが失敗する。

```ts
import Phaser from "phaser";
import "./style.css";
import { TitleScene } from "./game/scenes/TitleScene";
import { BattleScene } from "./game/scenes/BattleScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  backgroundColor: "#101827",
  scene: [TitleScene, BattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run typecheck -w src/client`

Expected: FAIL。`Cannot find module './game/scenes/TitleScene'` と `Cannot find module './game/scenes/BattleScene'`。

- [ ] **Step 3: HUDを実装する**

`src/client/src/game/ui/battleHud.ts` を作成する。

```ts
import Phaser from "phaser";
import type { BattleState, UnitId } from "../core/types";

export type BattleHudCallbacks = {
  onBuild: () => void;
  onSummon: () => void;
  onRetry: () => void;
};

export class BattleHud {
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly buildText: Phaser.GameObjects.Text;
  private readonly summonText: Phaser.GameObjects.Text;
  private readonly retryText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, callbacks: BattleHudCallbacks) {
    this.statusText = scene.add.text(16, 12, "", {
      color: "#f8fafc",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px"
    });
    this.buildText = this.createButton(scene, 16, 500, "Build Elemental", callbacks.onBuild);
    this.summonText = this.createButton(scene, 168, 500, "Summon", callbacks.onSummon);
    this.retryText = this.createButton(scene, 280, 500, "Retry", callbacks.onRetry);
  }

  update(state: BattleState, selectedUnitId: UnitId | null, blocker: string): void {
    const player = state.leaders.find((leader) => leader.team === "Player")!;
    const cpu = state.leaders.find((leader) => leader.team === "Cpu")!;
    this.statusText.setText([
      `Player HP: ${Math.ceil(player.currentHp)} / ${player.maxHp}`,
      `CPU HP: ${Math.ceil(cpu.currentHp)} / ${cpu.maxHp}`,
      `Time: ${Math.ceil(state.remainingSeconds)}`,
      `Selected: ${selectedUnitId ?? "-"}`,
      `Summon CD: ${Math.ceil(state.playerSummonCooldownSeconds)}`,
      `Status: ${state.result === "InProgress" ? blocker : state.result}`
    ]);
  }

  private createButton(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    return scene.add
      .text(x, y, label, {
        backgroundColor: "#1f2937",
        color: "#f8fafc",
        fixedWidth: 132,
        fixedHeight: 28,
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        align: "center",
        padding: { top: 6 }
      })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", onClick);
  }
}
```

- [ ] **Step 4: タイトルシーンを実装する**

`src/client/src/game/scenes/TitleScene.ts` を作成する。

```ts
import Phaser from "phaser";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#0f172a");
    this.add
      .text(width / 2, height / 2 - 56, "The Eternal Wheel MVP", {
        color: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        fontSize: "36px"
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 16, "Start Battle", {
        backgroundColor: "#2563eb",
        color: "#ffffff",
        fixedWidth: 180,
        fixedHeight: 42,
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        align: "center",
        padding: { top: 10 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("BattleScene"));
  }
}
```

- [ ] **Step 5: バトルシーンを実装する**

`src/client/src/game/scenes/BattleScene.ts` を作成する。描画は抽象図形で、1フレームごとに描き直す。

```ts
import Phaser from "phaser";
import { planCpuCommands } from "../ai/cpuPlanner";
import { findUnit } from "../core/battleState";
import type { TeamId, UnitId, Vec2 } from "../core/types";
import { distance } from "../core/vector";
import { GameSession } from "../rules/gameSession";
import { canSummon } from "../rules/summonSystem";
import { BattleHud } from "../ui/battleHud";

const unitIds: UnitId[] = ["PlayerMelee", "PlayerSpeed", "PlayerRanged", "CpuMelee", "CpuSpeed", "CpuRanged"];

export class BattleScene extends Phaser.Scene {
  private session = new GameSession();
  private graphics?: Phaser.GameObjects.Graphics;
  private hud?: BattleHud;
  private selectedUnitId: UnitId | null = "PlayerMelee";
  private cpuAccumulator = 0;
  private blocker = "Ready";

  constructor() {
    super("BattleScene");
  }

  create(): void {
    this.session = new GameSession();
    this.selectedUnitId = "PlayerMelee";
    this.cpuAccumulator = 0;
    this.graphics = this.add.graphics();
    this.hud = new BattleHud(this, {
      onBuild: () => this.buildSelected(),
      onSummon: () => this.summonPlayer(),
      onRetry: () => this.scene.restart()
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handlePointer(pointer));
  }

  update(_time: number, delta: number): void {
    const deltaSeconds = Math.min(delta / 1000, 0.05);
    this.cpuAccumulator += deltaSeconds;
    while (this.cpuAccumulator >= 1) {
      for (const command of planCpuCommands(this.session.state, this.session.config)) {
        this.session.applyCommand(command);
      }
      this.cpuAccumulator -= 1;
    }
    this.session.tick(deltaSeconds);
    this.draw();
    this.hud?.update(this.session.state, this.selectedUnitId, this.blocker);
  }

  private handlePointer(pointer: Phaser.Input.Pointer): void {
    if (pointer.y > 480 || this.session.state.result !== "InProgress") {
      return;
    }
    const world = this.screenToWorld(pointer.x, pointer.y);
    const clickedUnit = this.findClickedPlayerUnit(world);
    if (clickedUnit) {
      this.selectedUnitId = clickedUnit;
      this.blocker = `Selected ${clickedUnit}`;
      return;
    }
    if (this.selectedUnitId) {
      this.session.applyCommand({
        commandType: "MoveUnit",
        team: "Player",
        unitId: this.selectedUnitId,
        targetPosition: world
      });
      this.blocker = "Move command issued";
    }
  }

  private buildSelected(): void {
    if (!this.selectedUnitId) {
      this.blocker = "Select a unit first";
      return;
    }
    this.session.applyCommand({ commandType: "BeginElementalBuild", team: "Player", unitId: this.selectedUnitId });
    this.blocker = "Build command issued";
  }

  private summonPlayer(): void {
    if (!canSummon(this.session.state, this.session.config, "Player")) {
      this.blocker = "Need 2 elementals and cooldown ready";
      return;
    }
    this.session.applyCommand({ commandType: "Summon", team: "Player" });
    this.blocker = "Summoned";
  }

  private draw(): void {
    const graphics = this.graphics!;
    graphics.clear();
    graphics.fillStyle(0x101827, 1).fillRect(0, 0, 960, 540);
    graphics.fillStyle(0x182235, 1).fillRect(60, 66, 840, 390);
    graphics.lineStyle(1, 0x334155, 1).strokeRect(60, 66, 840, 390);
    graphics.lineStyle(1, 0x475569, 0.5).lineBetween(480, 66, 480, 456);

    for (const leader of this.session.state.leaders) {
      this.drawPiece(leader.position, leader.team, 18, leader.team === "Player" ? 0x38bdf8 : 0xf87171);
      this.drawHp(leader.position, leader.currentHp / leader.maxHp, 64);
    }
    this.drawAreaLines("Player");
    this.drawAreaLines("Cpu");
    for (const elemental of this.session.state.elementals) {
      this.drawPiece(elemental.position, elemental.team, 8, 0xfbbf24);
      this.drawHp(elemental.position, elemental.currentHp / elemental.maxHp, 30);
    }
    for (const unit of this.session.state.units) {
      const selected = unit.unitId === this.selectedUnitId;
      const color = unit.team === "Player" ? 0x22c55e : 0xef4444;
      this.drawPiece(unit.position, unit.team, selected ? 13 : 10, unit.mode === "Defeated" ? 0x64748b : color);
      this.drawHp(unit.position, unit.currentHp / unit.stats.maxHp, 34);
    }
    for (const summoned of this.session.state.summonedUnits) {
      this.drawPiece(summoned.position, summoned.team, 16, 0xd946ef);
      this.drawHp(summoned.position, summoned.currentHp / summoned.maxHp, 48);
    }
    graphics.lineStyle(2, 0x93c5fd, 0.7);
    for (const event of this.session.state.recentAttackEvents) {
      const origin = this.worldToScreen(event.origin);
      const target = this.worldToScreen(event.targetPosition);
      graphics.lineBetween(origin.x, origin.y, target.x, target.y);
    }
  }

  private drawAreaLines(team: TeamId): void {
    const graphics = this.graphics!;
    const leader = this.session.state.leaders.find((candidate) => candidate.team === team)!;
    const points = [leader.position, ...this.session.state.elementals.filter((elemental) => elemental.team === team).map((elemental) => elemental.position)];
    if (points.length < 2) {
      return;
    }
    graphics.lineStyle(1, team === "Player" ? 0x38bdf8 : 0xf87171, 0.55);
    for (let index = 0; index < points.length; index += 1) {
      const current = this.worldToScreen(points[index]);
      const next = this.worldToScreen(points[(index + 1) % points.length]);
      graphics.lineBetween(current.x, current.y, next.x, next.y);
    }
  }

  private drawPiece(position: Vec2, _team: TeamId, radius: number, color: number): void {
    const screen = this.worldToScreen(position);
    this.graphics!.fillStyle(color, 1).fillCircle(screen.x, screen.y, radius);
  }

  private drawHp(position: Vec2, ratio: number, width: number): void {
    const screen = this.worldToScreen(position);
    const clamped = Math.max(0, Math.min(1, ratio));
    this.graphics!.fillStyle(0x0f172a, 1).fillRect(screen.x - width / 2, screen.y - 24, width, 5);
    this.graphics!.fillStyle(0x84cc16, 1).fillRect(screen.x - width / 2, screen.y - 24, width * clamped, 5);
  }

  private findClickedPlayerUnit(world: Vec2): UnitId | null {
    for (const unitId of unitIds.filter((id) => id.startsWith("Player"))) {
      const unit = findUnit(this.session.state, unitId);
      if (distance(world, unit.position) <= 0.45) {
        return unitId;
      }
    }
    return null;
  }

  private worldToScreen(position: Vec2): Vec2 {
    return {
      x: 60 + ((position.x + 7.5) / 15) * 840,
      y: 66 + ((4.5 - position.y) / 9) * 390
    };
  }

  private screenToWorld(x: number, y: number): Vec2 {
    return {
      x: ((x - 60) / 840) * 15 - 7.5,
      y: 4.5 - ((y - 66) / 390) * 9
    };
  }
}
```

- [ ] **Step 6: CSSを更新する**

`src/client/src/style.css` を次の内容にする。

```css
html,
body,
#game {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  overflow: hidden;
  background: #020617;
}

canvas {
  display: block;
}
```

- [ ] **Step 7: 型チェックを確認する**

Run: `npm run typecheck -w src/client`

Expected: PASS。

- [ ] **Step 8: ビルドを確認する**

Run: `npm run build -w src/client`

Expected: PASS。`dist` が更新される。

- [ ] **Step 9: コミットする**

```bash
git add src/client/src/main.ts src/client/src/style.css src/client/src/game/scenes src/client/src/game/ui
git commit -m "feat: add playable phaser battle scene"
```

### Task 9: 全体検証と軽微な調整

**Files:**
- Modify: `README.md`
- Modify only when a verification step fails: `src/client/src/game/**/*.ts`
- Modify only when the manual play pass shows text overlap or unreadable controls: `src/client/src/style.css`

- [ ] **Step 1: 全テストを実行する**

Run: `npm run test -w src/client`

Expected: PASS。全ルールテストが成功する。

- [ ] **Step 2: 全体型チェックを実行する**

Run: `npm run typecheck`

Expected: PASS。サーバとクライアントの型チェックが成功する。

- [ ] **Step 3: 全体ビルドを実行する**

Run: `npm run build`

Expected: PASS。サーバとクライアントのビルドが成功する。

- [ ] **Step 4: ローカル起動で手動確認する**

Run: `npm run dev:client`

Expected: Viteが `http://localhost:5173` を表示する。ブラウザで以下を確認する。

- タイトル画面から `Start Battle` でバトルに入れる。
- `PlayerMelee`、`PlayerSpeed`、`PlayerRanged` をクリック選択できる。
- 戦場クリックで選択中ユニットが移動する。
- `Build Elemental` で選択中ユニットが生成状態になり、約5秒後にエレメンタルが出る。
- エレメンタル2つ以上かつクールダウン0で `Summon` が召喚ユニットを出す。
- CPUが手動操作なしでエレメンタル生成、召喚、攻撃を行う。
- リーダーHP、残り時間、選択中ユニット、クールダウン、結果がHUDに表示される。
- 勝敗後に `Retry` で再開できる。

- [ ] **Step 5: READMEにMVP起動メモを追記する**

`README.md` の Development セクションに次の文を追記する。

````md
ローカルCOM戦MVPだけを確認する場合は、クライアントを単体起動できます。

```powershell
npm.cmd run dev:client
```
````

- [ ] **Step 6: 最終状態を確認する**

Run: `git status --short`

Expected: 実装対象ファイルだけが変更されている。`docs/phaser-migration-spec.md` が未追跡のまま残っている場合は、ユーザー提供資料として扱い、このMVP実装コミットには含めない。

- [ ] **Step 7: コミットする**

```bash
git add README.md src/client/package.json src/client/tsconfig.json src/client/src
git commit -m "docs: add local mvp run instructions"
```

## セルフレビュー

- 設計書の範囲であるローカルCOM戦、タイトル/開始フロー、通常ユニット、エレメンタル、召喚、CPU計画、HUD、勝敗判定、ビルド確認はTask 1からTask 9でカバーしている。
- オンライン対戦、永続進行、製品アート、サーバ権威シミュレーションは実装対象から外している。
- テストは純ルール層を対象にし、Phaser側は型チェック、ビルド、手動プレイ確認で検証する。
- 主要な型名、関数名、ファイルパスはタスク間で統一している。
