# 対象別攻撃間隔 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** キーパー・シーカー・マスターは通常対象へ0.5C、召喚士へ1Cで攻撃し、召喚獣は通常対象へ0.5C、召喚士へ2Cで攻撃する独立タイマー方式を実装する。

**Architecture:** 通常対象用の既存 `attackTimerSeconds` を維持し、召喚士専用の `leaderAttackTimerSeconds` を攻撃者ごとに追加する。通常ユニットは最寄りの1対象を従来どおり選んだ後、対象種別に対応するタイマーだけを判定・再設定し、召喚獣は接触中の通常対象群と召喚士を別々のタイマーで攻撃する。

**Tech Stack:** TypeScript 5.8、Node.js test runner、tsx、npm workspaces

## Global Constraints

- `1C = 1秒` とする。
- キーパー、シーカー、マスターから敵通常ユニット・敵召喚獣・敵エレメントへの攻撃間隔はすべて0.5Cとする。
- キーパー、シーカー、マスターから敵召喚士への攻撃間隔は1Cとする。
- 召喚獣から敵通常ユニット・敵召喚獣・敵エレメントへの攻撃間隔は0.5Cとする。
- 召喚獣から敵召喚士への攻撃間隔は現在と同じ2Cを維持する。
- 通常対象用と召喚士用のタイマーは、対象の有無にかかわらず各tickで独立して0まで減少させ、一方の攻撃で他方のタイマーを変更しない。
- 攻撃者の生成時、および通常ユニットの復活時は両タイマーを0にし、最初の接触時には即時攻撃可能とする。
- 通常ユニットの対象選択、攻撃力、射程、各種倍率、召喚獣の自然HP減少・移動・接触減速・対象除外条件は変更しない。
- ユーザーが作業中の画像ファイルと、無関係な未追跡ファイルは変更・ステージングしない。

---

## ファイル構成

- `src/client/src/game/core/types.ts`: 設定型と戦闘状態型へ召喚士用の間隔・タイマーを追加する。
- `src/client/src/game/core/battleConfig.ts`: 通常対象0.5C、通常ユニット対召喚士1C、召喚獣対召喚士2Cの既定値を定義する。
- `src/client/src/game/core/battleState.ts`: 通常ユニット生成時に召喚士用タイマーを0で初期化する。
- `src/client/src/game/core/battleState.test.ts`: 既定設定と通常ユニット初期状態を固定する。
- `src/client/src/game/rules/unitSystem.ts`: 通常ユニットの2タイマーを減算し、選択対象に応じて使用するタイマーを切り替える。
- `src/client/src/game/rules/unitSystem.test.ts`: 通常対象0.5C、召喚士1C、対象切替、復活初期化を検証する。
- `src/client/src/game/rules/summonSystem.ts`: 召喚獣生成時の2タイマー初期化と、通常対象・召喚士の独立攻撃判定を実装する。
- `src/client/src/game/rules/summonSystem.test.ts`: 召喚獣の0.5C/2C、同時接触、独立減算、0下限を検証し、直接生成するテスト状態を新しい型へ追従させる。

### Task 1: 設定値と戦闘状態へ2系統の攻撃間隔を追加

**Files:**
- Modify: `src/client/src/game/core/types.ts:47-65,92-132`
- Modify: `src/client/src/game/core/battleConfig.ts:3-51`
- Modify: `src/client/src/game/core/battleState.ts:84-104`
- Modify: `src/client/src/game/rules/summonSystem.ts:27-43`
- Test: `src/client/src/game/core/battleState.test.ts:7-73`
- Test: `src/client/src/game/rules/summonSystem.test.ts:8-28,30-52,103-174,253-349,557-572`

**Interfaces:**
- Consumes: 既存の `BattleConfig`、`UnitState`、`SummonedUnitState`、`createDefaultBattleConfig()`、`createDefaultBattleState()`、`tryExecuteSummon()`
- Produces: `BattleConfig.unitLeaderAttackIntervalSeconds: number`、`BattleConfig.summonedUnitLeaderAttackIntervalSeconds: number`、`UnitState.leaderAttackTimerSeconds: number`、`SummonedUnitState.leaderAttackIntervalSeconds: number`、`SummonedUnitState.leaderAttackTimerSeconds: number`

- [ ] **Step 1: 既定値と初期状態を表す失敗テストを書く**

`battleState.test.ts` の既定設定テストで、3兵種の `attackIntervalSeconds` を0.5へ変更し、新しい設定値と初期タイマーを検証する。

```ts
assert.equal(config.unitLeaderAttackIntervalSeconds, 1);
assert.equal(config.summonedUnitAttackIntervalSeconds, 0.5);
assert.equal(config.summonedUnitLeaderAttackIntervalSeconds, 2);
assert.equal(config.statsByType.Melee.attackIntervalSeconds, 0.5);
assert.equal(config.statsByType.Speed.attackIntervalSeconds, 0.5);
assert.equal(config.statsByType.Ranged.attackIntervalSeconds, 0.5);
assert.equal(findUnit(state, "PlayerMelee").attackTimerSeconds, 0);
assert.equal(findUnit(state, "PlayerMelee").leaderAttackTimerSeconds, 0);
```

`summonSystem.test.ts` の「完成済みエレメンタルが2つあれば召喚できる」へ、召喚された状態の間隔と初期タイマーを追加する。

```ts
assert.equal(summoned.attackIntervalSeconds, 0.5);
assert.equal(summoned.attackTimerSeconds, 0);
assert.equal(summoned.leaderAttackIntervalSeconds, 2);
assert.equal(summoned.leaderAttackTimerSeconds, 0);
```

- [ ] **Step 2: 対象テストを実行して失敗を確認する**

Run（workdir: `src/client`）:

```powershell
node --import tsx --test src/game/core/battleState.test.ts src/game/rules/summonSystem.test.ts
```

Expected: 新しい `BattleConfig` / 状態プロパティが未定義であること、および既存の攻撃間隔が0.5ではないことによりFAIL。

- [ ] **Step 3: 型、既定設定、生成時の初期値を最小実装する**

`types.ts` へ次のプロパティを追加する。

```ts
export type BattleConfig = {
  summonedUnitAttackIntervalSeconds: number;
  summonedUnitLeaderAttackIntervalSeconds: number;
  unitLeaderAttackIntervalSeconds: number;
};

export type UnitState = {
  attackTimerSeconds: number;
  leaderAttackTimerSeconds: number;
};

export type SummonedUnitState = {
  attackIntervalSeconds: number;
  attackTimerSeconds: number;
  leaderAttackIntervalSeconds: number;
  leaderAttackTimerSeconds: number;
};
```

`battleConfig.ts` の3兵種をすべて0.5へ変更し、既定設定に召喚士用間隔を追加する。

```ts
attackIntervalSeconds: 0.5
```

```ts
summonedUnitAttackIntervalSeconds: 0.5,
summonedUnitLeaderAttackIntervalSeconds: 2,
// ...
unitLeaderAttackIntervalSeconds: 1,
```

`battleState.ts` の `createUnit()` 戻り値へ召喚士用タイマーを追加する。

```ts
attackTimerSeconds: 0,
leaderAttackTimerSeconds: 0,
```

`summonSystem.ts` の `tryExecuteSummon()` で召喚獣の間隔とタイマーを初期化する。

```ts
attackIntervalSeconds: config.summonedUnitAttackIntervalSeconds,
attackTimerSeconds: 0,
leaderAttackIntervalSeconds: config.summonedUnitLeaderAttackIntervalSeconds,
leaderAttackTimerSeconds: 0,
```

- [ ] **Step 4: テスト内で直接組み立てる全召喚獣状態を新しい型へ追従させる**

`summonSystem.test.ts` の `summonedUnitId` を持つ8個のオブジェクト（現在の34、107、150、258、287、314、328、559行付近）すべてで、既存の `attackTimerSeconds` の直後へ次を追加する。2C開始を意図する既存周期テストでも、召喚士用タイマーの初期値はそのテスト目的に合わせて明示する。

```ts
leaderAttackIntervalSeconds: 2,
leaderAttackTimerSeconds: 0,
```

既存の「召喚獣は2Cごとに通常対象へ99、召喚士へ300ダメージを与える」は後続Task 3で独立周期テストへ置き換える。この時点では既存テストの共有2Cという前提を維持し、召喚士用プロパティだけを加える。

```ts
attackIntervalSeconds: 2,
attackTimerSeconds: 2,
leaderAttackIntervalSeconds: 2,
leaderAttackTimerSeconds: 2,
```

`addSummonedUnit()` ヘルパーも、このタスクでは既存テストの期待値を維持して召喚士用プロパティだけを加える。

```ts
attackIntervalSeconds: 2,
attackTimerSeconds: 0,
leaderAttackIntervalSeconds: 2,
leaderAttackTimerSeconds: 0,
```

- [ ] **Step 5: 設定・状態テストと型検査を通す**

Run（workdir: `src/client`）:

```powershell
node --import tsx --test src/game/core/battleState.test.ts src/game/rules/summonSystem.test.ts
npm run typecheck
```

Expected: 両コマンドがexit code 0。既存の2C共有周期テストはTask 3で意味を更新するが、状態オブジェクトにはすべて新しい必須プロパティが存在する。

- [ ] **Step 6: Task 1をコミットする**

```powershell
git add -- src/client/src/game/core/types.ts src/client/src/game/core/battleConfig.ts src/client/src/game/core/battleState.ts src/client/src/game/core/battleState.test.ts src/client/src/game/rules/summonSystem.ts src/client/src/game/rules/summonSystem.test.ts
git commit -m "feat: 対象別攻撃間隔の状態を追加"
```

### Task 2: 通常ユニットの通常対象0.5C・召喚士1Cを独立させる

**Files:**
- Modify: `src/client/src/game/rules/unitSystem.ts:83-121,221-238`
- Test: `src/client/src/game/rules/unitSystem.test.ts:44-75,259-281,412-431`

**Interfaces:**
- Consumes: Task 1の `BattleConfig.unitLeaderAttackIntervalSeconds` と `UnitState.leaderAttackTimerSeconds`
- Produces: `tickCombat()` が対象種別に対応するタイマーだけで攻撃を制御する挙動、`tickRespawns()` が両攻撃タイマーを0へ戻す挙動

- [ ] **Step 1: 通常対象0.5Cと召喚士1Cの失敗テストを書く**

`unitSystem.test.ts` へ、他の敵通常ユニットを撃破済みにし、攻撃者と対象を射程内へ固定するテストを追加する。

```ts
test("通常ユニットは通常対象へ0.5Cごとに攻撃する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerMelee");
  const enemy = findUnit(state, "CpuMelee");
  attacker.position = { x: 0, y: 0 };
  attacker.destination = { ...attacker.position };
  enemy.position = { x: 1, y: 0 };
  enemy.destination = { ...enemy.position };
  for (const candidate of state.units.filter(
    (unit) => unit.team === "Cpu" && unit.unitId !== enemy.unitId
  )) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }

  tickCombat(state, config, 0);
  const afterFirstAttack = enemy.currentHp;
  tickCombat(state, config, 0.49);
  assert.equal(enemy.currentHp, afterFirstAttack);
  tickCombat(state, config, 0.01);

  assert.equal(enemy.currentHp, afterFirstAttack - attacker.stats.attackDamage);
  assert.equal(attacker.attackTimerSeconds, 0.5);
});

test("通常ユニットは召喚士へ1Cごとに攻撃する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerMelee");
  attacker.position = { x: 0, y: 4.1 };
  attacker.destination = { ...attacker.position };
  for (const enemy of state.units.filter((unit) => unit.team === "Cpu")) {
    enemy.currentHp = 0;
    enemy.mode = "Defeated";
  }

  tickCombat(state, config, 0);
  const afterFirstAttack = findLeader(state, "Cpu").currentHp;
  tickCombat(state, config, 0.99);
  assert.equal(findLeader(state, "Cpu").currentHp, afterFirstAttack);
  tickCombat(state, config, 0.01);

  assert.equal(
    findLeader(state, "Cpu").currentHp,
    afterFirstAttack - attacker.stats.attackDamage * config.directLeaderDamageMultiplier
  );
  assert.equal(attacker.leaderAttackTimerSeconds, 1);
});
```

通常ユニットから召喚獣への攻撃も通常対象用タイマーを使うことを、全敵通常ユニットを撃破し、敵召喚獣だけを射程内へ置いて検証する。

```ts
test("通常ユニットは敵召喚獣への攻撃後に通常対象用0.5Cを設定する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerRanged");
  attacker.position = { x: 0, y: 0 };
  attacker.destination = { ...attacker.position };
  findLeader(state, "Cpu").position = { x: 10, y: 0 };
  for (const enemy of state.units.filter((unit) => unit.team === "Cpu")) {
    enemy.currentHp = 0;
    enemy.mode = "Defeated";
  }
  state.summonedUnits.push({
    summonedUnitId: 1,
    team: "Cpu",
    position: { x: 1, y: 0 },
    destination: { x: 0, y: 0 },
    maxHp: 1000,
    currentHp: 1000,
    attackDamage: 99,
    leaderAttackDamage: 300,
    attackIntervalSeconds: 0.5,
    attackTimerSeconds: 0,
    leaderAttackIntervalSeconds: 2,
    leaderAttackTimerSeconds: 0,
    moveSpeed: 0,
    healthDecayPerSecond: 0
  });

  tickCombat(state, config, 0);

  assert.equal(state.summonedUnits[0].currentHp, 1000 - attacker.stats.attackDamage);
  assert.equal(attacker.attackTimerSeconds, 0.5);
  assert.equal(attacker.leaderAttackTimerSeconds, 0);
});
```

既存のエレメント攻撃テストにも、攻撃後の通常対象用タイマーと未使用の召喚士用タイマーを追加で検証する。

```ts
assert.equal(keeper.attackTimerSeconds, 0.5);
assert.equal(keeper.leaderAttackTimerSeconds, 0);
```

- [ ] **Step 2: 通常ユニット周期テストの失敗を確認する**

Run（workdir: `src/client`）:

```powershell
node --import tsx --test src/game/rules/unitSystem.test.ts
```

Expected: `tickCombat()` が `leaderAttackTimerSeconds` を使用せず、共有タイマーのままであるためFAIL。

- [ ] **Step 3: `tickCombat()` を対象別タイマーへ変更する**

各Activeユニットについて、対象選択より前に両タイマーを独立して減算する。既存の `attackTimerSeconds > 0` による早期 `continue` は削除する。

```ts
unit.attackTimerSeconds = Math.max(0, unit.attackTimerSeconds - deltaSeconds);
unit.leaderAttackTimerSeconds = Math.max(0, unit.leaderAttackTimerSeconds - deltaSeconds);

if (!canAttack(state, config, unit)) {
  continue;
}

const target = findAttackTarget(state, unit);
if (!target) {
  continue;
}

const attackTimerSeconds =
  target.kind === "Leader"
    ? unit.leaderAttackTimerSeconds
    : unit.attackTimerSeconds;
if (attackTimerSeconds > Number.EPSILON) {
  continue;
}
```

ダメージと `recentAttackEvents` の既存処理後、選択対象のタイマーだけを再設定する。

```ts
if (target.kind === "Leader") {
  unit.leaderAttackTimerSeconds = config.unitLeaderAttackIntervalSeconds;
} else {
  unit.attackTimerSeconds = unit.stats.attackIntervalSeconds;
}
```

- [ ] **Step 4: 対象切替時の独立性と0下限の失敗テストを書く**

`unitSystem.test.ts` へマスターで通常対象→召喚士→通常対象と切り替えるテストを追加し、一方の攻撃が他方のタイマーを再設定しないことを確認する。

```ts
test("通常ユニットは通常対象用と召喚士用のタイマーを独立して維持する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerRanged");
  const enemy = findUnit(state, "CpuMelee");
  attacker.position = { x: 0, y: 0 };
  attacker.destination = { ...attacker.position };
  enemy.position = { x: 0.5, y: 0 };
  enemy.destination = { ...enemy.position };
  findLeader(state, "Cpu").position = { x: 2, y: 0 };
  for (const candidate of state.units.filter(
    (unit) => unit.team === "Cpu" && unit.unitId !== enemy.unitId
  )) {
    candidate.currentHp = 0;
    candidate.mode = "Defeated";
  }

  tickCombat(state, config, 0);
  assert.equal(attacker.attackTimerSeconds, 0.5);
  assert.equal(attacker.leaderAttackTimerSeconds, 0);

  enemy.position = { x: 10, y: 0 };
  tickCombat(state, config, 0);
  assert.equal(attacker.attackTimerSeconds, 0.5);
  assert.equal(attacker.leaderAttackTimerSeconds, 1);

  enemy.position = { x: 0.5, y: 0 };
  tickCombat(state, config, 0.5);
  assert.equal(attacker.attackTimerSeconds, 0.5);
  assert.equal(attacker.leaderAttackTimerSeconds, 0.5);

  enemy.position = { x: 10, y: 0 };
  tickCombat(state, config, 10);
  assert.equal(attacker.attackTimerSeconds, 0);
  assert.equal(attacker.leaderAttackTimerSeconds, 1);
});
```

対象をすべて射程外へ置き、両タイマーが負数にならないことも独立して検証する。

```ts
test("通常ユニットの両攻撃タイマーは対象がなくても0まで減少する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const attacker = findUnit(state, "PlayerMelee");
  attacker.position = { x: -6, y: 0 };
  attacker.destination = { ...attacker.position };
  attacker.attackTimerSeconds = 0.25;
  attacker.leaderAttackTimerSeconds = 0.75;
  findLeader(state, "Cpu").position = { x: 6, y: 0 };
  for (const enemy of state.units.filter((unit) => unit.team === "Cpu")) {
    enemy.currentHp = 0;
    enemy.mode = "Defeated";
  }

  tickCombat(state, config, 0.5);
  assert.equal(attacker.attackTimerSeconds, 0);
  assert.equal(attacker.leaderAttackTimerSeconds, 0.25);

  tickCombat(state, config, 1);
  assert.equal(attacker.attackTimerSeconds, 0);
  assert.equal(attacker.leaderAttackTimerSeconds, 0);
});
```

- [ ] **Step 5: 復活時に両タイマーを0へ戻す**

既存の復活テストで、復活前に両タイマーへ非0値を設定し、復活後の0を検証する。

```ts
unit.attackTimerSeconds = 0.25;
unit.leaderAttackTimerSeconds = 0.75;
// tickRespawns(state, 10);
assert.equal(unit.attackTimerSeconds, 0);
assert.equal(unit.leaderAttackTimerSeconds, 0);
```

`tickRespawns()` の復活処理へ次を追加する。

```ts
unit.attackTimerSeconds = 0;
unit.leaderAttackTimerSeconds = 0;
```

- [ ] **Step 6: 通常ユニットのテストと型検査を通す**

Run（workdir: `src/client`）:

```powershell
node --import tsx --test src/game/rules/unitSystem.test.ts src/game/core/battleState.test.ts
npm run typecheck
```

Expected: 両コマンドがexit code 0。既存の最寄り対象選択、エレメント倍率、マスターの移動中攻撃条件、攻撃イベントのテストもPASS。

- [ ] **Step 7: Task 2をコミットする**

```powershell
git add -- src/client/src/game/rules/unitSystem.ts src/client/src/game/rules/unitSystem.test.ts
git commit -m "feat: 通常ユニットの攻撃間隔を対象別に分離"
```

### Task 3: 召喚獣の通常対象0.5C・召喚士2Cを独立させる

**Files:**
- Modify: `src/client/src/game/rules/summonSystem.ts:65-112`
- Test: `src/client/src/game/rules/summonSystem.test.ts:30-62,143-174,417-547`

**Interfaces:**
- Consumes: Task 1の `SummonedUnitState.leaderAttackIntervalSeconds` と `SummonedUnitState.leaderAttackTimerSeconds`
- Produces: `tickSummonedUnits()` が接触中の通常対象群と召喚士を独立周期で攻撃する挙動

- [ ] **Step 1: 共有2Cテストを0.5C/2Cの独立周期テストへ置き換える**

既存の「召喚獣は2Cごとに通常対象へ99、召喚士へ300ダメージを与える」を次の意図へ変更する。

```ts
test("召喚獣は通常対象へ0.5C、召喚士へ2Cごとに独立して攻撃する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const enemyUnit = state.units.find((unit) => unit.unitId === "CpuMelee")!;
  enemyUnit.position = { x: 0, y: 4.1 };
  enemyUnit.destination = { ...enemyUnit.position };
  addSummonedUnit(state, "Player", 2000);
  const summoned = state.summonedUnits[0];
  summoned.position = { x: 0, y: 4.1 };
  summoned.destination = { ...summoned.position };
  summoned.healthDecayPerSecond = 0;
  summoned.attackTimerSeconds = 0.5;
  summoned.leaderAttackTimerSeconds = 2;

  tickSummonedUnits(state, config, 0.49);
  assert.equal(enemyUnit.currentHp, enemyUnit.stats.maxHp);
  assert.equal(findLeader(state, "Cpu").currentHp, 2000);

  tickSummonedUnits(state, config, 0.01);
  assert.equal(enemyUnit.currentHp, enemyUnit.stats.maxHp - 99);
  assert.equal(findLeader(state, "Cpu").currentHp, 2000);
  assert.equal(summoned.attackTimerSeconds, 0.5);
  assert.equal(summoned.leaderAttackTimerSeconds, 1.5);

  tickSummonedUnits(state, config, 1.5);
  assert.equal(enemyUnit.currentHp, enemyUnit.stats.maxHp - 99 * 2);
  assert.equal(findLeader(state, "Cpu").currentHp, 1700);
  assert.equal(summoned.attackTimerSeconds, 0.5);
  assert.equal(summoned.leaderAttackTimerSeconds, 2);
});
```

このテストでは1.5秒の大きなtickでも攻撃は従来どおり1回だけであり、経過中の複数周期分を遡及適用しない既存仕様を維持する。

- [ ] **Step 2: 独立周期テストを実行して失敗を確認する**

Run（workdir: `src/client`）:

```powershell
node --import tsx --test src/game/rules/summonSystem.test.ts
```

Expected: 現在の `tickSummonedUnits()` が `attackTimerSeconds` だけで通常対象と召喚士を同時攻撃するためFAIL。

- [ ] **Step 3: 召喚獣のタイマー減算と攻撃判定を分離する**

生存・自然HP減少の既存判定後に、両タイマーを0下限付きで減算する。

```ts
summoned.attackTimerSeconds = Math.max(0, summoned.attackTimerSeconds - deltaSeconds);
summoned.leaderAttackTimerSeconds = Math.max(
  0,
  summoned.leaderAttackTimerSeconds - deltaSeconds
);
```

接触対象の取得後、通常対象群と召喚士を別々に判定する。既存の `hasAttackTarget` と共有タイマーのブロックは削除する。

```ts
const touchingNormalTargets =
  touchingUnits.length > 0 ||
  touchingSummonedUnits.length > 0 ||
  touchingElementals.length > 0;

if (touchingNormalTargets && summoned.attackTimerSeconds <= Number.EPSILON) {
  for (const target of touchingUnits) {
    target.currentHp = Math.max(0, target.currentHp - summoned.attackDamage);
  }
  for (const target of touchingSummonedUnits) {
    target.currentHp = Math.max(0, target.currentHp - summoned.attackDamage);
  }
  for (const target of touchingElementals) {
    target.currentHp = Math.max(0, target.currentHp - summoned.attackDamage);
  }
  summoned.attackTimerSeconds = summoned.attackIntervalSeconds;
}

if (touchingLeader && summoned.leaderAttackTimerSeconds <= Number.EPSILON) {
  enemyLeader.currentHp = Math.max(
    0,
    enemyLeader.currentHp - summoned.leaderAttackDamage
  );
  summoned.leaderAttackTimerSeconds = summoned.leaderAttackIntervalSeconds;
}
```

移動速度判定は既存どおり `touchingLeader` なら移動せず、それ以外で通常対象に接触中なら `config.contactSlowMultiplier` を使う。

- [ ] **Step 4: 非接触中の独立減算と0下限を検証する**

`summonSystem.test.ts` へ、対象を接触範囲外へ置いた状態で両タイマーを減算するテストを追加する。

```ts
test("召喚獣の両攻撃タイマーは対象がなくても独立して0まで減少する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  findLeader(state, "Cpu").position = { x: 7, y: 0 };
  addSummonedUnit(state, "Player", 1000);
  const summoned = state.summonedUnits[0];
  summoned.position = { x: -7, y: 0 };
  summoned.attackTimerSeconds = 0.25;
  summoned.leaderAttackTimerSeconds = 0.75;
  summoned.healthDecayPerSecond = 0;

  tickSummonedUnits(state, config, 0.5);
  assert.equal(summoned.attackTimerSeconds, 0);
  assert.equal(summoned.leaderAttackTimerSeconds, 0.25);

  tickSummonedUnits(state, config, 1);
  assert.equal(summoned.attackTimerSeconds, 0);
  assert.equal(summoned.leaderAttackTimerSeconds, 0);
});
```

- [ ] **Step 5: 通常対象の各種別と同時攻撃の既存テストを0.5Cへ合わせる**

`addSummonedUnit()` と、通常ユニット、敵召喚獣、敵エレメントへの既存テストは、`attackIntervalSeconds`、準備時の通常対象用タイマー、期待される再設定値を0.5に統一する。`leaderAttackIntervalSeconds` は2のままにする。特にエレメント周期テストを次の値へ変更する。

```ts
summoned.attackIntervalSeconds = 0.5;
summoned.attackTimerSeconds = 0.5;

tickSummonedUnits(state, config, 0.49);
assert.equal(state.elementals[0].currentHp, 1000);

tickSummonedUnits(state, config, 0.01);
assert.equal(state.elementals[0].currentHp, 901);
assert.equal(summoned.attackTimerSeconds, 0.5);
```

通常ユニットとエレメントを同時に攻撃するテストでは、両対象が同じ通常対象用タイマーで同一tickに99ダメージを受ける期待値を維持する。敵召喚獣同士のテストでも、それぞれの `attackTimerSeconds` が0.5へ再設定されることを追加で検証する。

```ts
assert.equal(state.summonedUnits[0].attackTimerSeconds, 0.5);
assert.equal(state.summonedUnits[1].attackTimerSeconds, 0.5);
```

- [ ] **Step 6: 召喚獣テスト、全クライアントテスト、型検査、ビルドを実行する**

Run（workdir: `src/client`）:

```powershell
node --import tsx --test src/game/rules/summonSystem.test.ts
npm test
npm run typecheck
npm run build
```

Run（workdir: repository root）:

```powershell
npm run typecheck
npm run build
git diff --check
```

Expected: すべてexit code 0。Viteの既存chunk-size警告は許容するが、新しいTypeScriptエラー、テスト失敗、ビルド失敗、空白エラーはない。

- [ ] **Step 7: 仕様との差分と変更対象を最終確認する**

```powershell
git diff -- src/client/src/game/core/types.ts src/client/src/game/core/battleConfig.ts src/client/src/game/core/battleState.ts src/client/src/game/core/battleState.test.ts src/client/src/game/rules/unitSystem.ts src/client/src/game/rules/unitSystem.test.ts src/client/src/game/rules/summonSystem.ts src/client/src/game/rules/summonSystem.test.ts
git status --short
```

確認事項:

- 0.5C / 1C / 2Cが対象表どおりである。
- 通常ユニットは最寄り1対象だけを攻撃する。
- 召喚獣は接触中の全通常対象を同じ通常対象用タイマーで攻撃する。
- 通常対象用と召喚士用のタイマーは相互に再設定されない。
- 画像ファイルと無関係な未追跡ファイルはステージング対象に含まれない。

- [ ] **Step 8: Task 3をコミットする**

```powershell
git add -- src/client/src/game/rules/summonSystem.ts src/client/src/game/rules/summonSystem.test.ts
git commit -m "feat: 召喚獣の攻撃間隔を対象別に分離"
```
