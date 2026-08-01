# ユニット初期配置と召喚位置変更 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プレイヤー3ユニットを自陣内へ初期配置し、召喚ボタン押下後の5秒カウントダウンから戦闘を開始するとともに、召喚獣を自軍陣地の面積重心へ出現させる。

**Architecture:** `BattleState` に開始フェーズを保持し、配置・カウントダウン・戦闘進行の可否を `GameSession` で一元管理する。初期配置判定と多角形重心計算は副作用を限定したルール関数へ分離し、`BattleScene` とHUDは状態の入力・表示だけを担当する。

**Tech Stack:** TypeScript 5.8、Phaser 3.90、Node.js test runner、tsx、Vite

## Global Constraints

- 設計仕様は `docs/superpowers/specs/2026-07-31-initial-unit-placement-and-summon-centroid-design.md` を正とする。
- プレイヤー側3ユニットだけを初期配置対象とし、CPU側は既定位置を維持する。
- 初期配置範囲はプレイヤー自陣（ワールド座標 `y < 0`）に限定する。
- カウントダウンは `5`、`4`、`3`、`2`、`1` を1秒ずつ表示する。
- `Setup` と `Countdown` 中は戦闘時間および全戦闘処理を進めない。
- 戦闘開始後の召喚条件、ゲージ消費、召喚獣HP算出、移動先は変更しない。
- 新規の挙動は失敗するテストを先に実行し、期待した理由で失敗することを確認してから実装する。
- リポジトリ内の資料は日本語で記述する。

---

### Task 1: 陣地点群の並べ替えと面積重心

**Files:**
- Modify: `src/client/src/game/rules/areaCalculator.ts`
- Modify: `src/client/src/game/rules/areaCalculator.test.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**
- Consumes: `Vec2[]` と、面を作れない場合に使う `Vec2` のフォールバック位置。
- Produces: `orderPolygonPoints(points: Vec2[]): Vec2[]`、`calculateSummonCentroid(points: Vec2[], fallback: Vec2): Vec2`。

- [ ] **Step 1: 面積重心とフォールバックの失敗テストを書く**

`areaCalculator.test.ts` に、手計算できるリテラルを期待値とするテストを追加する。

```ts
import {
  calculateSummonArea,
  calculateSummonCentroid,
  orderPolygonPoints
} from "./areaCalculator";

test("三角形の面積重心を返す", () => {
  assert.deepEqual(
    calculateSummonCentroid(
      [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 3 }],
      { x: 9, y: 9 }
    ),
    { x: 2, y: 1 }
  );
});

test("角度順に並べた凹多角形の面積重心を返す", () => {
  const centroid = calculateSummonCentroid(
    [
      { x: -2, y: -1 },
      { x: 2, y: -1 },
      { x: 1, y: 0 },
      { x: 2, y: 2 },
      { x: -2, y: 2 }
    ],
    { x: 9, y: 9 }
  );

  assert.equal(Number(centroid.x.toFixed(6)), -0.238095);
  assert.equal(Number(centroid.y.toFixed(6)), 0.52381);
});

test("3点未満または面積0なら指定した位置へフォールバックする", () => {
  const fallback = { x: 0, y: -4.1 };

  assert.deepEqual(
    calculateSummonCentroid([{ x: 0, y: 0 }, { x: 1, y: 0 }], fallback),
    fallback
  );
  assert.deepEqual(
    calculateSummonCentroid(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
      fallback
    ),
    fallback
  );
});

test("重複点を除き点群中心からの角度順に並べる", () => {
  assert.deepEqual(
    orderPolygonPoints([
      { x: 1, y: 1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: 1, y: 1 }
    ]),
    [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 }
    ]
  );
});
```

- [ ] **Step 2: 重心テストが未実装関数によって失敗することを確認する**

Run: `node --import tsx --test src/client/src/game/rules/areaCalculator.test.ts`

Expected: FAIL。`calculateSummonCentroid` または `orderPolygonPoints` がexportされていないことが失敗理由になる。

- [ ] **Step 3: 角度順ソートと符号付き面積による重心計算を実装する**

`areaCalculator.ts` に次の公開関数を追加する。入力配列とフォールバック値は変更しない。

```ts
const polygonAreaEpsilon = 1e-9;

export function orderPolygonPoints(points: Vec2[]): Vec2[] {
  const unique = points.filter(
    (point, index) =>
      points.findIndex(
        (candidate) => candidate.x === point.x && candidate.y === point.y
      ) === index
  );
  if (unique.length < 2) {
    return unique.map((point) => ({ ...point }));
  }

  const center = unique.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 }
  );
  center.x /= unique.length;
  center.y /= unique.length;

  return unique
    .map((point) => ({ ...point }))
    .sort(
      (a, b) =>
        Math.atan2(a.y - center.y, a.x - center.x)
        - Math.atan2(b.y - center.y, b.x - center.x)
    );
}

export function calculateSummonCentroid(
  points: Vec2[],
  fallback: Vec2
): Vec2 {
  const polygon = orderPolygonPoints(points);
  if (polygon.length < 3) {
    return { ...fallback };
  }

  let crossSum = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const cross = current.x * next.y - next.x * current.y;
    crossSum += cross;
    weightedX += (current.x + next.x) * cross;
    weightedY += (current.y + next.y) * cross;
  }
  if (Math.abs(crossSum) <= polygonAreaEpsilon) {
    return { ...fallback };
  }

  return {
    x: weightedX / (3 * crossSum),
    y: weightedY / (3 * crossSum)
  };
}
```

`BattleScene.drawArea` は `orderPolygonPoints(points)` を使用し、ファイル末尾のローカル `orderPoints` を削除する。これにより表示面と召喚位置の頂点順を一致させる。

- [ ] **Step 4: 面積計算テストを通す**

Run: `node --import tsx --test src/client/src/game/rules/areaCalculator.test.ts`

Expected: PASS。既存の面積テストも含めて全件成功する。

- [ ] **Step 5: Task 1をコミットする**

```powershell
git add src/client/src/game/rules/areaCalculator.ts src/client/src/game/rules/areaCalculator.test.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: 召喚面の重心計算を追加"
```

---

### Task 2: 召喚獣を自軍陣地の重心へ出現させる

**Files:**
- Modify: `src/client/src/game/rules/summonSystem.ts`
- Modify: `src/client/src/game/rules/summonSystem.test.ts`

**Interfaces:**
- Consumes: Task 1の `calculateSummonCentroid(points, fallback)`。
- Produces: `tryExecuteSummon` が生成する `SummonedUnitState.position`。公開シグネチャは変更しない。

- [ ] **Step 1: プレイヤー、CPU、フォールバックの失敗テストを書く**

`summonSystem.test.ts` に次のテストを追加する。各テストではゲージを1にし、完成済みで生存中のエレメントだけを配置する。

```ts
test("プレイヤー召喚獣は召喚士と完成済みエレメントの面積重心に出現する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  findLeader(state, "Player").position = { x: 0, y: -3 };
  state.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: -3, y: 0 }, maxHp: 1000, currentHp: 1000, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: 3, y: 0 }, maxHp: 1000, currentHp: 1000, isComplete: true }
  );
  state.playerSummonGauge = 1;

  assert.equal(tryExecuteSummon(state, config, "Player"), true);
  assert.deepEqual(state.summonedUnits[0].position, { x: 0, y: -1 });
});

test("CPU召喚獣にもCPU陣地の面積重心を使用する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  findLeader(state, "Cpu").position = { x: 0, y: 3 };
  state.elementals.push(
    { elementalId: "Elemental1", team: "Cpu", position: { x: -3, y: 0 }, maxHp: 1000, currentHp: 1000, isComplete: true },
    { elementalId: "Elemental2", team: "Cpu", position: { x: 3, y: 0 }, maxHp: 1000, currentHp: 1000, isComplete: true }
  );
  state.cpuSummonGauge = 1;

  assert.equal(tryExecuteSummon(state, config, "Cpu"), true);
  assert.deepEqual(state.summonedUnits[0].position, { x: 0, y: 1 });
});

test("召喚面を作れない場合は召喚士位置に出現する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.playerSummonGauge = 1;

  assert.equal(tryExecuteSummon(state, config, "Player"), true);
  assert.deepEqual(
    state.summonedUnits[0].position,
    findLeader(state, "Player").position
  );
});
```

- [ ] **Step 2: 既存の召喚士位置から出現する実装に対して失敗することを確認する**

Run: `node --import tsx --test src/client/src/game/rules/summonSystem.test.ts`

Expected: FAIL。最初の2テストで `position` が召喚士位置のままであることが失敗理由になる。フォールバックテストは既存挙動の保護として成功してよい。

- [ ] **Step 3: 召喚位置だけを面積重心へ変更する**

`summonSystem.ts` で既存の点群を再利用し、生成前に重心を計算する。

```ts
import {
  calculateSummonArea,
  calculateSummonCentroid
} from "./areaCalculator";

const summonPoints = [
  leader.position,
  ...elementals.map((elemental) => elemental.position)
];
const area = calculateSummonArea(summonPoints);
const summonPosition = calculateSummonCentroid(summonPoints, leader.position);

state.summonedUnits.push({
  summonedUnitId: state.nextSummonedUnitId,
  team,
  position: summonPosition,
  destination: { ...enemyLeader.position },
  maxHp,
  currentHp: maxHp,
  attackDamage: config.summonedUnitAttackDamage,
  leaderAttackDamage: config.summonedUnitLeaderAttackDamage,
  attackIntervalSeconds: config.summonedUnitAttackIntervalSeconds,
  attackTimerSeconds: 0,
  leaderAttackIntervalSeconds: config.summonedUnitLeaderAttackIntervalSeconds,
  leaderAttackTimerSeconds: 0,
  moveSpeed: config.summonedUnitMoveSpeed,
  healthDecayPerSecond: config.summonedUnitHealthDecayPerSecond
});
```

`maxHp`、`destination`、攻撃値、速度、ID採番、ゲージ消費には変更を加えない。

- [ ] **Step 4: 召喚システムの全テストを通す**

Run: `node --import tsx --test src/client/src/game/rules/summonSystem.test.ts`

Expected: PASS。既存テストのうち出現位置を召喚士位置と期待するケースは、新しい面積重心のリテラルへ更新する。

- [ ] **Step 5: Task 2をコミットする**

```powershell
git add src/client/src/game/rules/summonSystem.ts src/client/src/game/rules/summonSystem.test.ts
git commit -m "feat: 召喚獣を陣地の重心に出現させる"
```

---

### Task 3: プレイヤーユニットの初期配置ルール

**Files:**
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/core/battleConfig.ts`
- Modify: `src/client/src/game/core/battleState.test.ts`
- Create: `src/client/src/game/rules/initialPlacement.ts`
- Create: `src/client/src/game/rules/initialPlacement.test.ts`

**Interfaces:**
- Consumes: `BattleState`、`BattleConfig`、`PlayerUnitId`、配置先 `Vec2`。
- Produces: `tryPlaceInitialUnit(state: BattleState, config: BattleConfig, unitId: UnitId, targetPosition: Vec2): boolean`。

- [ ] **Step 1: 配置境界値を型と既定設定へ追加する失敗テストを書く**

`BattleConfig` に次の値を追加する。

```ts
countdownSeconds: number;
initialPlacementMargin: number;
initialPlacementMinDistance: number;
```

`battleState.test.ts` の既定設定テストへ次を追加する。

```ts
assert.equal(config.countdownSeconds, 5);
assert.equal(config.initialPlacementMargin, 0.6);
assert.equal(config.initialPlacementMinDistance, 1.2);
```

- [ ] **Step 2: 初期配置の成功・拒否を表す失敗テストを書く**

`initialPlacement.test.ts` を作成する。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findUnit } from "../core/battleState";
import type { UnitId } from "../core/types";
import { tryPlaceInitialUnit } from "./initialPlacement";

test("プレイヤーユニットを自陣内へ配置して復活位置と移動先も更新する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(
    tryPlaceInitialUnit(state, config, "PlayerMelee", { x: -4, y: -2 }),
    true
  );
  const unit = findUnit(state, "PlayerMelee");
  assert.deepEqual(unit.position, { x: -4, y: -2 });
  assert.deepEqual(unit.spawnPosition, { x: -4, y: -2 });
  assert.deepEqual(unit.destination, { x: -4, y: -2 });
});

test("戦場外、自陣外、中央線余白内への配置を拒否する", () => {
  const config = createDefaultBattleConfig();

  for (const target of [
    { x: -6, y: -2 },
    { x: 0, y: 1 },
    { x: 0, y: -0.5 }
  ]) {
    const state = createDefaultBattleState(config);
    assert.equal(
      tryPlaceInitialUnit(state, config, "PlayerMelee", target),
      false
    );
    assert.deepEqual(findUnit(state, "PlayerMelee").position, { x: -2.4, y: -3 });
  }
});

test("他のプレイヤーユニットと最低間隔未満になる配置を拒否する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(
    tryPlaceInitialUnit(state, config, "PlayerMelee", { x: 0.5, y: -3 }),
    false
  );
  assert.deepEqual(findUnit(state, "PlayerMelee").position, { x: -2.4, y: -3 });
});

test("CPUユニットの配置を拒否する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(
    tryPlaceInitialUnit(state, config, "CpuMelee", { x: -4, y: -2 }),
    false
  );
  assert.deepEqual(findUnit(state, "CpuMelee").position, { x: -2.4, y: 3 });
});

test("存在しないユニットIDを拒否して状態を変更しない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const positionsBefore = state.units.map((unit) => ({ ...unit.position }));

  assert.equal(
    tryPlaceInitialUnit(
      state,
      config,
      "MissingUnit" as UnitId,
      { x: -4, y: -2 }
    ),
    false
  );
  assert.deepEqual(
    state.units.map((unit) => unit.position),
    positionsBefore
  );
});
```

- [ ] **Step 3: 設定と配置テストが未実装によって失敗することを確認する**

Run: `node --import tsx --test src/client/src/game/core/battleState.test.ts src/client/src/game/rules/initialPlacement.test.ts`

Expected: FAIL。設定値と `tryPlaceInitialUnit` が存在しないことが失敗理由になる。

- [ ] **Step 4: 最小の初期配置判定を実装する**

`battleConfig.ts` に `countdownSeconds: 5`、`initialPlacementMargin: 0.6`、`initialPlacementMinDistance: 1.2` を追加する。

`initialPlacement.ts` は次の境界を実装する。

```ts
export function tryPlaceInitialUnit(
  state: BattleState,
  config: BattleConfig,
  unitId: UnitId,
  targetPosition: Vec2
): boolean {
  const unit = state.units.find((candidate) => candidate.unitId === unitId);
  if (!unit || unit.team !== "Player" || !isUnitAlive(unit)) {
    return false;
  }

  const margin = config.initialPlacementMargin;
  const insidePlayerArea =
    targetPosition.x >= config.battlefieldMin.x + margin
    && targetPosition.x <= config.battlefieldMax.x - margin
    && targetPosition.y >= config.battlefieldMin.y + margin
    && targetPosition.y <= -margin;
  if (!insidePlayerArea) {
    return false;
  }

  const minimumDistanceSq =
    config.initialPlacementMinDistance * config.initialPlacementMinDistance;
  const overlapsUnit = state.units.some(
    (candidate) =>
      candidate.unitId !== unitId
      && candidate.team === "Player"
      && isUnitAlive(candidate)
      && distanceSq(candidate.position, targetPosition) < minimumDistanceSq
  );
  if (overlapsUnit) {
    return false;
  }

  unit.position = { ...targetPosition };
  unit.spawnPosition = { ...targetPosition };
  unit.destination = { ...targetPosition };
  return true;
}
```

- [ ] **Step 5: 初期配置と既定状態のテストを通す**

Run: `node --import tsx --test src/client/src/game/core/battleState.test.ts src/client/src/game/rules/initialPlacement.test.ts`

Expected: PASS。

- [ ] **Step 6: Task 3をコミットする**

```powershell
git add src/client/src/game/core/types.ts src/client/src/game/core/battleConfig.ts src/client/src/game/core/battleState.test.ts src/client/src/game/rules/initialPlacement.ts src/client/src/game/rules/initialPlacement.test.ts
git commit -m "feat: プレイヤーユニットの初期配置ルールを追加"
```

---

### Task 4: Setup・Countdown・InProgressのセッション遷移

**Files:**
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/core/battleState.ts`
- Modify: `src/client/src/game/core/battleState.test.ts`
- Modify: `src/client/src/game/rules/gameSession.ts`
- Modify: `src/client/src/game/rules/gameSession.test.ts`

**Interfaces:**
- Consumes: Task 3の `tryPlaceInitialUnit`。
- Produces: `MatchPhase`、`BattleState.phase`、`BattleState.countdownRemainingSeconds`、`PlaceInitialUnit` と `StartBattle` コマンド。

- [ ] **Step 1: 初期フェーズとコマンド型の失敗テストを書く**

`types.ts` に予定する型をテスト側から先に使用する。

```ts
export type MatchPhase = "Setup" | "Countdown" | "InProgress";

| {
    commandType: "PlaceInitialUnit";
    team: "Player";
    unitId: PlayerUnitId;
    targetPosition: Vec2;
  }
| { commandType: "StartBattle"; team: "Player" };
```

`battleState.test.ts` で初期値を検証する。

```ts
assert.equal(state.phase, "Setup");
assert.equal(state.countdownRemainingSeconds, 0);
```

- [ ] **Step 2: セッション遷移と停止条件の失敗テストを書く**

`gameSession.test.ts` に次のテストを追加する。

```ts
test("Setup中は初期配置だけを受け付けて戦闘時間を進めない", () => {
  const session = new GameSession();

  session.applyCommand({
    commandType: "PlaceInitialUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: -4, y: -2 }
  });
  session.applyCommand({
    commandType: "MoveUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: 4, y: 2 }
  });
  session.tick(10);

  assert.deepEqual(
    session.state.units.find((unit) => unit.unitId === "PlayerMelee")!.position,
    { x: -4, y: -2 }
  );
  assert.equal(session.state.remainingSeconds, 300);
});

test("StartBattleで5秒カウントダウンし終了後に戦闘を開始する", () => {
  const session = new GameSession();

  session.applyCommand({ commandType: "StartBattle", team: "Player" });
  assert.equal(session.state.phase, "Countdown");
  assert.equal(session.state.countdownRemainingSeconds, 5);

  session.tick(1.25);
  assert.equal(session.state.phase, "Countdown");
  assert.equal(session.state.countdownRemainingSeconds, 3.75);
  assert.equal(session.state.remainingSeconds, 300);

  session.tick(-1);
  assert.equal(session.state.countdownRemainingSeconds, 3.75);

  session.tick(10);
  assert.equal(session.state.phase, "InProgress");
  assert.equal(session.state.countdownRemainingSeconds, 0);
  assert.equal(session.state.remainingSeconds, 300);

  session.tick(1);
  assert.equal(session.state.remainingSeconds, 299);
});

test("Countdown中の配置と重複した開始操作を無視する", () => {
  const session = new GameSession();
  session.applyCommand({ commandType: "StartBattle", team: "Player" });
  session.tick(1);

  session.applyCommand({ commandType: "StartBattle", team: "Player" });
  session.applyCommand({
    commandType: "PlaceInitialUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: -4, y: -2 }
  });

  assert.equal(session.state.countdownRemainingSeconds, 4);
  assert.deepEqual(
    session.state.units.find((unit) => unit.unitId === "PlayerMelee")!.position,
    { x: -2.4, y: -3 }
  );
});
```

- [ ] **Step 3: フェーズ未実装を理由として失敗することを確認する**

Run: `node --import tsx --test src/client/src/game/core/battleState.test.ts src/client/src/game/rules/gameSession.test.ts`

Expected: FAIL。`phase`、新規コマンド、カウントダウン処理が存在しないことが失敗理由になる。

- [ ] **Step 4: 状態、コマンド、セッションのフェーズ制御を実装する**

`BattleState` に次を追加し、`createDefaultBattleState` で初期化する。

```ts
phase: MatchPhase;
countdownRemainingSeconds: number;
```

`GameSession.applyCommand` はフェーズごとに受理するコマンドを限定する。

```ts
case "PlaceInitialUnit":
  if (this.state.phase === "Setup") {
    tryPlaceInitialUnit(
      this.state,
      this.config,
      command.unitId,
      command.targetPosition
    );
  }
  break;
case "StartBattle":
  if (this.state.phase === "Setup") {
    this.state.phase = "Countdown";
    this.state.countdownRemainingSeconds = this.config.countdownSeconds;
  }
  break;
```

既存の `MoveUnit`、`BeginElementalBuild`、`Summon` は `phase === "InProgress"` の場合だけ実行する。`tick` 冒頭は次の順序にする。

```ts
if (this.state.result !== "InProgress") {
  return;
}
if (this.state.phase === "Setup") {
  return;
}
if (this.state.phase === "Countdown") {
  this.state.countdownRemainingSeconds = Math.max(
    0,
    this.state.countdownRemainingSeconds - Math.max(0, deltaSeconds)
  );
  if (this.state.countdownRemainingSeconds === 0) {
    this.state.phase = "InProgress";
  }
  return;
}
```

既存の戦闘セッションテストは、戦闘挙動を検証するテストだけ次の実コード経由ヘルパーで開始済み状態にする。

```ts
function createStartedSession(
  config = createDefaultBattleConfig()
): GameSession {
  const session = new GameSession(config);
  session.applyCommand({ commandType: "StartBattle", team: "Player" });
  session.tick(config.countdownSeconds);
  return session;
}
```

- [ ] **Step 5: セッションと既定状態の全テストを通す**

Run: `node --import tsx --test src/client/src/game/core/battleState.test.ts src/client/src/game/rules/gameSession.test.ts`

Expected: PASS。既存戦闘テストは `createStartedSession` を用いて従来どおりの戦闘結果を検証する。

- [ ] **Step 6: Task 4をコミットする**

```powershell
git add src/client/src/game/core/types.ts src/client/src/game/core/battleState.ts src/client/src/game/core/battleState.test.ts src/client/src/game/rules/gameSession.ts src/client/src/game/rules/gameSession.test.ts
git commit -m "feat: 戦闘開始前フェーズとカウントダウンを追加"
```

---

### Task 5: HUDへ配置確定状態とカウントダウンを反映する

**Files:**
- Modify: `src/client/src/game/ui/battleHudModel.ts`
- Modify: `src/client/src/game/ui/battleHudModel.test.ts`

**Interfaces:**
- Consumes: Task 4の `BattleState.phase` と `countdownRemainingSeconds`。
- Produces: `BattleHudModel.resultText`、`canBuild`、`canSummon`。`BattleHud` の公開シグネチャは変更しない。

- [ ] **Step 1: フェーズ別HUDモデルの失敗テストを書く**

`battleHudModel.test.ts` に次を追加する。

```ts
test("Setupでは召喚ボタンを配置確定用に有効化する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  const model = createBattleHudModel(state, "PlayerMelee", false);

  assert.equal(model.canBuild, false);
  assert.equal(model.canSummon, true);
  assert.equal(model.resultText, "");
});

test("Countdownでは召喚ボタンを無効化して切り上げ秒数を表示する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.phase = "Countdown";
  state.countdownRemainingSeconds = 4.01;

  const model = createBattleHudModel(state, "PlayerMelee", true);

  assert.equal(model.canBuild, false);
  assert.equal(model.canSummon, false);
  assert.equal(model.resultText, "5");

  state.countdownRemainingSeconds = 0.01;
  assert.equal(createBattleHudModel(state, null, true).resultText, "1");
});

test("InProgressでは従来の建築・召喚条件を使う", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.phase = "InProgress";

  const model = createBattleHudModel(state, "PlayerMelee", true);

  assert.equal(model.canBuild, true);
  assert.equal(model.canSummon, true);
  assert.equal(model.resultText, "");
});
```

- [ ] **Step 2: SetupとCountdownの表示未対応によって失敗することを確認する**

Run: `node --import tsx --test src/client/src/game/ui/battleHudModel.test.ts`

Expected: FAIL。Setupの召喚ボタンが無効、Countdownの数字が空文字であることが失敗理由になる。

- [ ] **Step 3: フェーズに応じたHUDモデルを実装する**

`battleHudModel.ts` で次の規則を使う。

```ts
const battleInProgress =
  state.result === "InProgress" && state.phase === "InProgress";
const resultText =
  state.result !== "InProgress"
    ? formatResult(state.result)
    : state.phase === "Countdown"
      ? `${Math.max(1, Math.ceil(state.countdownRemainingSeconds))}`
      : "";

return {
  resultText,
  canBuild: Boolean(battleInProgress && selectedUnitIsUsable),
  canSummon:
    state.result === "InProgress"
    && (
      state.phase === "Setup"
      || (state.phase === "InProgress" && canSummonPlayer)
    )
};
```

- [ ] **Step 4: HUDモデルの全テストを通す**

Run: `node --import tsx --test src/client/src/game/ui/battleHudModel.test.ts`

Expected: PASS。既存テストは戦闘中のボタン可否を検証する箇所だけ `state.phase = "InProgress"` を設定する。

- [ ] **Step 5: Task 5をコミットする**

```powershell
git add src/client/src/game/ui/battleHudModel.ts src/client/src/game/ui/battleHudModel.test.ts
git commit -m "feat: HUDに配置確定とカウントダウンを表示"
```

---

### Task 6: BattleSceneのドラッグ配置・開始操作・CPU停止を接続する

**Files:**
- Modify: `src/client/src/game/scenes/BattleScene.ts`
- Modify: `src/client/src/game/input/dragMovement.ts`
- Modify: `src/client/src/game/input/dragMovement.test.ts`

**Interfaces:**
- Consumes: Task 4の `PlaceInitialUnit`、`StartBattle`、`BattleState.phase`。
- Produces: `DragReleaseContext.phase: MatchPhase` と、`DragReleaseTransition.command` の `PlaceInitialUnit | MoveUnit | null`。配置中のドラッグ終了を初期配置コマンドへ変換し、戦闘中は既存の移動コマンドを維持する。

- [ ] **Step 1: フェーズ別ドラッグコマンドの失敗テストを書く**

`dragMovement.ts` のコンテキストを `phase: MatchPhase` に変更し、`transitionDragRelease` がSetupとInProgressで異なるコマンドを返す仕様をテストする。

```ts
test("Setupの有効なドロップは初期配置コマンドを作る", () => {
  const transition = transitionDragRelease(
    { draggedUnitId: "PlayerMelee", moveMarkers: new Map() },
    {
      phase: "Setup",
      overHud: false,
      insideBattlefield: true,
      targetUnitAlive: true
    },
    { x: -4, y: -2 }
  );

  assert.deepEqual(transition.command, {
    commandType: "PlaceInitialUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: -4, y: -2 }
  });
  assert.equal(transition.moveMarkers.size, 0);
});

test("Countdownのドロップはコマンドを作らない", () => {
  const transition = transitionDragRelease(
    { draggedUnitId: "PlayerMelee", moveMarkers: new Map() },
    {
      phase: "Countdown",
      overHud: false,
      insideBattlefield: true,
      targetUnitAlive: true
    },
    { x: -4, y: -2 }
  );

  assert.equal(transition.command, null);
});
```

既存の移動テストは `phase: "InProgress"` を使用し、`MoveUnit` と移動マーカーが従来どおり生成されることを維持する。

- [ ] **Step 2: 現在の戦闘中専用ドラッグ実装に対して失敗することを確認する**

Run: `node --import tsx --test src/client/src/game/input/dragMovement.test.ts`

Expected: FAIL。Setupで `PlaceInitialUnit` が生成されないことが失敗理由になる。

- [ ] **Step 3: ドラッグ変換をフェーズ対応にする**

`DragReleaseContext.matchInProgress` を `phase` に置き換える。有効条件は `phase !== "Countdown"` とし、返却コマンドはフェーズで分岐する。

```ts
const command =
  context.phase === "Setup"
    ? {
        commandType: "PlaceInitialUnit" as const,
        team: "Player" as const,
        unitId: state.draggedUnitId,
        targetPosition: { ...targetPosition }
      }
    : {
        commandType: "MoveUnit" as const,
        team: "Player" as const,
        unitId: state.draggedUnitId,
        targetPosition: { ...targetPosition }
      };

if (context.phase === "InProgress") {
  moveMarkers.set(state.draggedUnitId, { ...targetPosition });
}
```

- [ ] **Step 4: ドラッグ変換テストを通す**

Run: `node --import tsx --test src/client/src/game/input/dragMovement.test.ts`

Expected: PASS。

- [ ] **Step 5: BattleSceneをフェーズ対応に接続する**

`BattleScene.ts` を次の規則へ変更する。

```ts
if (
  this.session.state.result === "InProgress"
  && this.session.state.phase === "InProgress"
) {
  this.cpuPlanTimerSeconds += deltaSeconds;
  if (this.cpuPlanTimerSeconds >= 1) {
    this.cpuPlanTimerSeconds = 0;
    for (
      const command of planCpuCommands(
        this.session.state,
        this.session.config
      )
    ) {
      this.session.applyCommand(command);
    }
  }
}
this.session.tick(deltaSeconds);

if (this.session.state.phase === "Setup") {
  this.session.applyCommand({ commandType: "StartBattle", team: "Player" });
  return;
}
if (
  this.session.state.phase === "InProgress"
  && this.session.canSummon("Player")
) {
  this.session.applyCommand({ commandType: "Summon", team: "Player" });
}
```

`handlePointerDown` は `Setup` または `InProgress` のときだけプレイヤーユニットを選択する。`handlePointerUp` は `transitionDragRelease` へ現在フェーズを渡す。`handleBuild` は `phase === "InProgress"` を追加条件とする。配置中は `moveMarkers` を追加しない。

- [ ] **Step 6: クライアント全テストと型チェックを実行する**

Run: `npm.cmd test -w src/client`

Expected: PASS。全テスト成功。

Run: `npm.cmd run typecheck -w src/client`

Expected: PASS。TypeScriptエラーなし。

- [ ] **Step 7: Task 6をコミットする**

```powershell
git add src/client/src/game/scenes/BattleScene.ts src/client/src/game/input/dragMovement.ts src/client/src/game/input/dragMovement.test.ts
git commit -m "feat: 戦闘画面に初期配置フローを接続"
```

---

### Task 7: 全体回帰確認とビルド

**Files:**
- Modify only if a verification failure exposes a regression in files already listed above.

**Interfaces:**
- Consumes: Tasks 1〜6の完成状態。
- Produces: テスト、型チェック、プロダクションビルドを通過した変更一式。

- [ ] **Step 1: クライアント全テストを実行する**

Run: `npm.cmd test -w src/client`

Expected: PASS。失敗0件。

- [ ] **Step 2: ワークスペース全体の型チェックを実行する**

Run: `npm.cmd run typecheck`

Expected: PASS。クライアントとサーバーのTypeScriptエラーなし。

- [ ] **Step 3: ワークスペース全体をビルドする**

Run: `npm.cmd run build`

Expected: PASS。サーバーのTypeScriptビルドとクライアントのViteビルドが成功する。

- [ ] **Step 4: 差分と作業ツリーを確認する**

Run: `git diff --check`

Expected: PASS。空白エラーなし。

Run: `git status --short`

Expected: 今回の実装対象外である既存の未追跡ファイルだけが表示され、Tasks 1〜6の対象ファイルに未コミット差分がない。
