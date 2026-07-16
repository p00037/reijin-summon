# エレメント配置間隔制約 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 敵味方および生成中を問わず、既存エレメントの配置半径内へ新しいエレメントの中心を生成できないようにする。

**Architecture:** 配置可否を`rules/elementalSystem.ts`の純粋な問い合わせ関数へ集約し、生成ルール、CPU計画、プレイヤーUIが同じ判定を利用する。距離はワールド座標で計算し、独立した設定値`elementalPlacementRadius`で調整する。

**Tech Stack:** TypeScript 5.8、Phaser 3.90、Node.js test runner、tsx

## Global Constraints

- `elementalPlacementRadius`の初期値は`0.45`ワールド単位とする。
- 距離が配置半径以下の場合は、境界上を含めて配置不可とする。
- 敵味方を問わない生存中の完成済みエレメントを判定対象とする。
- 自分以外の生成中ユニット位置を予約済み中心として判定対象とする。
- 破壊済みエレメントは判定対象外とする。
- エレメント最大数6、生成時間5秒、召喚ゲージ、戦闘ルールは変更しない。
- 新しい依存パッケージは追加しない。
- 既存の未コミット召喚ゲージ変更を保持する。実装タスクでは自動コミットせず、各タスク末尾で対象差分を確認する。コミットは既存差分の扱いをユーザーが指定した後に行う。
- 設計書は`docs/superpowers/specs/2026-07-16-elemental-placement-spacing-design.md`を正とする。

## File Structure

- `src/client/src/game/core/types.ts`: `BattleConfig`へ配置半径の型を追加する。
- `src/client/src/game/core/battleConfig.ts`: 配置半径の既定値を定義する。
- `src/client/src/game/rules/elementalSystem.ts`: 共通の配置可否判定と生成開始時の拒否を実装する。
- `src/client/src/game/rules/elementalSystem.test.ts`: 完成済み、破壊済み、生成中、境界値を検証する。
- `src/client/src/game/ai/cpuPlanner.ts`: 配置可能ユニットの選択と、全候補が配置不可の場合の移動を実装する。
- `src/client/src/game/ai/cpuPlanner.test.ts`: CPUのユニット選択と移動フォールバックを検証する。
- `src/client/src/game/scenes/BattleScene.ts`: プレイヤー操作前に配置可否を確認し、HUDへ拒否理由を表示する。

---

### Task 1: 共通の配置可否ルール

**Files:**
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/core/battleConfig.ts`
- Modify: `src/client/src/game/rules/elementalSystem.ts`
- Test: `src/client/src/game/rules/elementalSystem.test.ts`

**Interfaces:**
- Consumes: `distanceSq(a: Vec2, b: Vec2): number` from `core/vector.ts`
- Produces: `canPlaceElementalAtUnit(state: BattleState, config: BattleConfig, unitId: UnitId): boolean`
- Produces: `BattleConfig.elementalPlacementRadius: number`

- [ ] **Step 1: 完成済みエレメントとの距離に対する失敗テストを書く**

`elementalSystem.test.ts`のimportへ`canPlaceElementalAtUnit`を追加し、次のテストを追加する。

```ts
test("enemy and allied elementals block builds inside the placement radius", () => {
  for (const team of ["Player", "Cpu"] as const) {
    const config = createDefaultBattleConfig();
    const state = createDefaultBattleState(config);
    const unit = findUnit(state, "PlayerMelee");
    unit.position = { x: 0, y: 0 };
    addElementalAt(state, "Elemental1", team, 120, {
      x: unit.position.x + config.elementalPlacementRadius,
      y: unit.position.y
    });

    assert.equal(canPlaceElementalAtUnit(state, config, unit.unitId), false);
    assert.equal(tryBeginElementalBuild(state, config, unit.unitId), false);
    assert.equal(unit.mode, "Active");
    assert.equal(unit.pendingElementalId, null);
  }
});

test("a build can start just outside the elemental placement radius", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.position = { x: 0, y: 0 };
  addElementalAt(state, "Elemental1", "Cpu", 120, {
    x: unit.position.x + config.elementalPlacementRadius + 0.001,
    y: unit.position.y
  });

  assert.equal(canPlaceElementalAtUnit(state, config, unit.unitId), true);
  assert.equal(tryBeginElementalBuild(state, config, unit.unitId), true);
});
```

既存の`addElemental`は`addElementalAt`を呼ぶ形へ変更する。

```ts
function addElemental(
  state: BattleState,
  elementalId: ElementalId,
  team: TeamId,
  currentHp: number
): void {
  addElementalAt(state, elementalId, team, currentHp, { x: 0, y: 0 });
}

function addElementalAt(
  state: BattleState,
  elementalId: ElementalId,
  team: TeamId,
  currentHp: number,
  position: { x: number; y: number }
): void {
  state.elementals.push({
    elementalId,
    team,
    position: { ...position },
    maxHp: 120,
    currentHp,
    isComplete: true
  });
}
```

- [ ] **Step 2: テストを実行し、未実装を理由に失敗することを確認する**

Run:

```powershell
node --import tsx --test src/game/rules/elementalSystem.test.ts
```

Working directory: `src/client`

Expected: FAIL。`canPlaceElementalAtUnit`または`elementalPlacementRadius`が存在しないことが失敗理由であることを確認する。

- [ ] **Step 3: 配置半径と完成済みエレメント判定を最小実装する**

`core/types.ts`の`BattleConfig`へ追加する。

```ts
elementalPlacementRadius: number;
```

`core/battleConfig.ts`の`elementalBuildSeconds`直後へ追加する。

```ts
elementalPlacementRadius: 0.45,
```

`elementalSystem.ts`へ`distanceSq`をimportし、次の関数を追加する。

```ts
import { distanceSq } from "../core/vector";

export function canPlaceElementalAtUnit(
  state: BattleState,
  config: BattleConfig,
  unitId: UnitId
): boolean {
  const unit = findUnit(state, unitId);
  const radiusSq = config.elementalPlacementRadius * config.elementalPlacementRadius;

  return !state.elementals.some(
    (elemental) => elemental.currentHp > 0 && distanceSq(unit.position, elemental.position) <= radiusSq
  );
}
```

`tryBeginElementalBuild`のユニット状態確認後へ追加する。

```ts
if (!canPlaceElementalAtUnit(state, config, unitId)) {
  return false;
}
```

- [ ] **Step 4: 完成済みエレメントのテストが通ることを確認する**

Run:

```powershell
node --import tsx --test src/game/rules/elementalSystem.test.ts
```

Working directory: `src/client`

Expected: PASS。

- [ ] **Step 5: 破壊済みと生成中予定位置の失敗テストを書く**

```ts
test("destroyed elementals do not block builds", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  addElementalAt(state, "Elemental1", "Cpu", 0, unit.position);

  assert.equal(canPlaceElementalAtUnit(state, config, unit.unitId), true);
  assert.equal(tryBeginElementalBuild(state, config, unit.unitId), true);
});

test("a pending elemental position blocks another build", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const melee = findUnit(state, "PlayerMelee");
  const speed = findUnit(state, "PlayerSpeed");
  speed.position = { ...melee.position };

  assert.equal(tryBeginElementalBuild(state, config, speed.unitId), true);
  assert.equal(canPlaceElementalAtUnit(state, config, melee.unitId), false);
  assert.equal(tryBeginElementalBuild(state, config, melee.unitId), false);
  assert.equal(melee.pendingElementalId, null);
});
```

- [ ] **Step 6: テストを実行し、生成中予定位置のテストだけが失敗することを確認する**

Run:

```powershell
node --import tsx --test src/game/rules/elementalSystem.test.ts
```

Working directory: `src/client`

Expected: FAIL。`a pending elemental position blocks another build`が`true !== false`で失敗し、破壊済みエレメントのテストはPASSする。

- [ ] **Step 7: 生成中予定位置の判定を最小実装する**

`canPlaceElementalAtUnit`のreturnを次へ置き換える。

```ts
const overlapsCompletedElemental = state.elementals.some(
  (elemental) => elemental.currentHp > 0 && distanceSq(unit.position, elemental.position) <= radiusSq
);
const overlapsPendingElemental = state.units.some(
  (candidate) =>
    candidate.unitId !== unitId &&
    candidate.mode === "BuildingElemental" &&
    isUnitAlive(candidate) &&
    distanceSq(unit.position, candidate.position) <= radiusSq
);

return !overlapsCompletedElemental && !overlapsPendingElemental;
```

新しい配置ルールに合わせて、既存の`both teams can build six elementals without exhausting shared ids`では1回目の3個が完成した後、2回目の生成開始前にプレイヤーユニットを配置半径より遠くへ移動する。

```ts
for (const unit of state.units.filter((candidate) => candidate.team === "Player")) {
  unit.position.y += 1;
}
```

- [ ] **Step 8: 配置ルールの全テストを実行する**

Run:

```powershell
node --import tsx --test src/game/rules/elementalSystem.test.ts
```

Working directory: `src/client`

Expected: PASS。既存テストを含め失敗0件。

- [ ] **Step 9: タスク差分を確認する**

```powershell
git diff -- src/client/src/game/core/types.ts src/client/src/game/core/battleConfig.ts src/client/src/game/rules/elementalSystem.ts src/client/src/game/rules/elementalSystem.test.ts
git diff --check
```

Expected: 配置半径、配置判定、テスト以外の意図しない変更がなく、`git diff --check`が終了コード0。

---

### Task 2: CPUの配置可能ユニット選択と移動フォールバック

**Files:**
- Modify: `src/client/src/game/ai/cpuPlanner.ts`
- Test: `src/client/src/game/ai/cpuPlanner.test.ts`

**Interfaces:**
- Consumes: `canPlaceElementalAtUnit(state, config, unitId): boolean` from Task 1
- Produces: 上限未満では配置可能なCPUユニットの`BeginElementalBuild`、配置候補なしでは全アクティブCPUユニットの`MoveUnit`

- [ ] **Step 1: 最初のユニットが配置不可でも別ユニットを選ぶ失敗テストを書く**

```ts
test("CPU chooses another active unit when the first unit is too close to an elemental", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const melee = state.units.find((unit) => unit.unitId === "CpuMelee")!;
  state.elementals.push({
    elementalId: "Elemental1",
    team: "Player",
    position: { ...melee.position },
    maxHp: 120,
    currentHp: 120,
    isComplete: true
  });

  assert.deepEqual(planCpuCommands(state, config), [
    { commandType: "BeginElementalBuild", team: "Cpu", unitId: "CpuSpeed" }
  ]);
});
```

- [ ] **Step 2: テストを実行して既存の`CpuMelee`選択で失敗することを確認する**

Run:

```powershell
node --import tsx --test src/game/ai/cpuPlanner.test.ts
```

Working directory: `src/client`

Expected: FAIL。actualの`unitId`が`CpuMelee`、expectedが`CpuSpeed`。

- [ ] **Step 3: 配置可能な最初のCPUユニットを選ぶ最小実装を行う**

importを変更する。

```ts
import { canPlaceElementalAtUnit, countCompletedElementals } from "../rules/elementalSystem";
```

上限未満の分岐を置き換える。

```ts
if (countCpuElementalsIncludingPending(state) < config.maxElementalsPerTeam) {
  const buildUnit = cpuUnits.find((unit) => canPlaceElementalAtUnit(state, config, unit.unitId));
  return [{
    commandType: "BeginElementalBuild",
    team: "Cpu",
    unitId: (buildUnit ?? firstAvailableUnit).unitId
  }];
}
```

- [ ] **Step 4: 別ユニット選択テストが通ることを確認する**

Run:

```powershell
node --import tsx --test src/game/ai/cpuPlanner.test.ts
```

Working directory: `src/client`

Expected: PASS。

- [ ] **Step 5: 全CPUユニットが配置不可なら移動する失敗テストを書く**

```ts
test("CPU moves active units when every build position is blocked", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const cpuUnits = state.units.filter((unit) => unit.team === "Cpu");
  state.elementals.push(
    ...cpuUnits.map((unit, index) => ({
      elementalId: `Elemental${index + 1}` as "Elemental1" | "Elemental2" | "Elemental3",
      team: "Cpu" as const,
      position: { ...unit.position },
      maxHp: 120,
      currentHp: 120,
      isComplete: true
    }))
  );

  const commands = planCpuCommands(state, config);

  assert.equal(commands.length, 3);
  assert(commands.every((command) => command.commandType === "MoveUnit"));
  assert(commands.every((command) => command.team === "Cpu"));
  assert(commands.every(
    (command) => command.commandType !== "MoveUnit" ||
      (command.targetPosition.x === 0 && command.targetPosition.y === -4.1)
  ));
});
```

- [ ] **Step 6: テストを実行して空配列または生成コマンドで失敗することを確認する**

Run:

```powershell
node --import tsx --test src/game/ai/cpuPlanner.test.ts
```

Working directory: `src/client`

Expected: FAIL。3件の`MoveUnit`が得られないことが失敗理由。

- [ ] **Step 7: 配置候補なしの場合に既存の移動処理へフォールスルーさせる**

Task 2 Step 3の上限未満分岐を最終形へ置き換え、配置候補がない場合は既存の移動処理へフォールスルーさせる。

```ts
if (countCpuElementalsIncludingPending(state) < config.maxElementalsPerTeam) {
  const buildUnit = cpuUnits.find((unit) => canPlaceElementalAtUnit(state, config, unit.unitId));
  if (buildUnit) {
    return [{ commandType: "BeginElementalBuild", team: "Cpu", unitId: buildUnit.unitId }];
  }
}

const playerLeader = findLeader(state, "Player");
return cpuUnits.map((unit) => ({
  commandType: "MoveUnit",
  team: "Cpu",
  unitId: unit.unitId,
  targetPosition: { ...playerLeader.position }
}));
```

上限未満でも`buildUnit`が存在しなければ、この処理へ到達することを確認する。

- [ ] **Step 8: CPU計画テストを実行する**

Run:

```powershell
node --import tsx --test src/game/ai/cpuPlanner.test.ts
```

Working directory: `src/client`

Expected: PASS。召喚優先、通常生成、上限時移動の既存テストも成功する。

- [ ] **Step 9: タスク差分を確認する**

```powershell
git diff -- src/client/src/game/ai/cpuPlanner.ts src/client/src/game/ai/cpuPlanner.test.ts
git diff --check
```

Expected: 配置可能ユニット選択、移動フォールバック、対応テスト以外の意図しない変更がない。

---

### Task 3: プレイヤーの配置拒否メッセージと全体検証

**Files:**
- Modify: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**
- Consumes: `canPlaceElementalAtUnit(state, config, unitId): boolean` from Task 1
- Produces: 配置不可時のHUD状態メッセージ`Too close to another elemental.`

- [ ] **Step 1: `BattleScene`へ共通配置判定をimportする**

```ts
import { canPlaceElementalAtUnit } from "../rules/elementalSystem";
```

- [ ] **Step 2: Buildコマンドの直前に配置拒否分岐を追加する**

`handleBuild`のアクティブユニット確認後、`applyCommand`前へ追加する。

```ts
if (!canPlaceElementalAtUnit(this.session.state, this.session.config, unit.unitId)) {
  this.hud.setStatus("Too close to another elemental.");
  return;
}
```

この分岐はTask 1でRED/GREEN確認済みのルール関数だけを利用し、新しい距離計算を`BattleScene`へ重複実装しない。

- [ ] **Step 3: 全クライアントテストを実行する**

Run:

```powershell
npm.cmd test -w src/client
```

Working directory: repository root

Expected: 全テストPASS、失敗0件。

- [ ] **Step 4: 型チェックを実行する**

Run:

```powershell
npm.cmd run typecheck -w src/client
```

Working directory: repository root

Expected: 終了コード0、TypeScriptエラー0件。

- [ ] **Step 5: 本番ビルドを実行する**

Run:

```powershell
npm.cmd run build -w src/client
```

Working directory: repository root

Expected: `tsc`とVite buildが終了コード0。既知のチャンクサイズ警告以外のエラーがない。

- [ ] **Step 6: 手動受け入れ確認を行う**

別ターミナルでローカルクライアントを起動する。

```powershell
npm.cmd run dev -w src/client
```

Viteが出力したローカルURLをブラウザで開き、次を確認する。

1. エレメント上または配置半径内へユニットを置いてBuildを押す。
2. HUDに`Status: Too close to another elemental.`と表示される。
3. ユニットが`BuildingElemental`へ変化せず、エレメントIDも予約されない。
4. 配置半径より外へ移動してBuildを押すと生成が開始する。
5. CPUが既存エレメント上で生成を繰り返さず、移動後に別位置で生成する。

- [ ] **Step 7: 最終差分を確認する**

```powershell
git diff --check
git status --short
git diff -- src/client/src/game/core/types.ts src/client/src/game/core/battleConfig.ts src/client/src/game/rules/elementalSystem.ts src/client/src/game/rules/elementalSystem.test.ts src/client/src/game/ai/cpuPlanner.ts src/client/src/game/ai/cpuPlanner.test.ts src/client/src/game/scenes/BattleScene.ts
```

Expected: 空白エラーなし。既存の未コミット召喚ゲージ変更が保持され、配置制約以外の新しい変更がない。
