# MP消費型ユニット復活 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通常ユニットの時間復活を廃止し、LV依存で回復する共有MPをCOST分消費して、待機場所から自軍回復エリアへドラッグ復活できるようにする。

**Architecture:** MPの蓄積、被ダメージ加算、復活検証と状態遷移は新しい `resurrectionSystem.ts` に集約し、`GameSession` が更新とコマンド適用を仲介する。UIは純粋なレイアウト・入力遷移関数とPhaser描画を分離し、CPUも同じ `ReviveUnit` コマンドを使用する。

**Tech Stack:** TypeScript 5.8、Phaser 3.90、Node.js test runner、tsx、Vite、npm workspaces

## Global Constraints

- 設計の正本は `docs/superpowers/specs/2026-08-08-mp-unit-revival-design.md` とする。
- ゲーム画面全体は既存の `644×468` から変更しない。
- 全通常ユニットは `level: 3`、`revivalCost: 3` とし、別プロパティで保持する。
- MPは召喚士ごとに戦闘開始時0、最大10とする。
- 復活費用はCOST、自然回復速度は撤退中LV合計を使用する。
- 既存の召喚士最大HP `8000` は変更せず、実ダメージ `800` ごとにMP1を回復する。
- 既存の召喚獣、エレメンタル、AP、デッキ編成、画像アセットの仕様は変更しない。
- ユーザー所有の未追跡ファイル `src/client/public/assets/effects/melee_attack_2.png` と `melee_attack_3.png` は変更、追加、コミットしない。
- 各タスクはRED、GREEN、対象テスト再実行、コミットの順で進める。

---

## File Structure

- `src/client/src/game/core/types.ts`: MP、LV、COST、撤退順、`ReviveUnit` コマンドの型を定義する。
- `src/client/src/game/core/battleConfig.ts`: MP上限、被ダメージ回復割合を設定し、旧復活秒数を削除する。
- `src/client/src/game/core/battleState.ts`: 両チームのMP進捗と被ダメージ進捗を初期化し、チーム別アクセサーを提供する。
- `src/client/src/game/core/battleState.test.ts`: 初期MPと全ユニットのLV/COSTを検証する。
- `src/client/src/game/rules/resurrectionSystem.ts`: MP自然回復、被ダメージ回復、復活可否、復活実行を担当する新規ファイル。
- `src/client/src/game/rules/resurrectionSystem.test.ts`: 復活システムの境界値を網羅する新規テスト。
- `src/client/src/game/rules/unitSystem.ts`: 撃破順を記録し、旧タイマー復活を削除する。
- `src/client/src/game/rules/unitSystem.test.ts`: 時間で復活しないことと撃破時初期化を検証する。
- `src/client/src/game/rules/gameSession.ts`: MP更新、被ダメージ差分、`ReviveUnit` をゲームループへ接続する。
- `src/client/src/game/rules/gameSession.test.ts`: 戦闘中だけMPが増え、コマンドが一度だけMPを消費することを検証する。
- `src/client/src/game/ai/cpuPlanner.ts`: CPUの最古撤退ユニット復活を最優先する。
- `src/client/src/game/ai/cpuPlanner.test.ts`: CPU復活順とMP不足時の既存判断を検証する。
- `src/client/src/game/ui/battleLayout.ts`: 左2列上下ゲージ、上詰めフィールド、右時間表示、下待機場所を計算する。
- `src/client/src/game/ui/battleLayout.test.ts`: `644×468` の確定座標とHUD入力範囲を検証する。
- `src/client/src/game/ui/battleHudModel.ts`: 味方MPモデルを生成する。
- `src/client/src/game/ui/battleHudModel.test.ts`: MP文字列、比率、上限を検証する。
- `src/client/src/game/ui/battleHud.ts`: 細い縦ゲージと新しい時間位置を描画する。
- `src/client/src/game/ui/defeatedUnitLayout.ts`: 待機カードの共通縮尺、矩形、復活可能表示を計算する新規ファイル。
- `src/client/src/game/ui/defeatedUnitLayout.test.ts`: 待機場所の高さ・横幅に応じた縮小を検証する新規テスト。
- `src/client/src/game/input/revivalDrag.ts`: 復活ドラッグの純粋な状態遷移を担当する新規ファイル。
- `src/client/src/game/input/revivalDrag.test.ts`: 回復エリア、MP、フェーズ、撤退状態によるコマンド生成を検証する新規テスト。
- `src/client/src/game/scenes/BattleScene.ts`: 待機カード描画、ポインター追従、復活ドロップをPhaserへ接続する。
- `docs/開発メモ.txt`: MP復活を「詳細が必要」から「修正した内容」へ移す。

---

### Task 1: MP・LV・COST・復活コマンドの状態モデル

**Files:**
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/core/battleConfig.ts`
- Modify: `src/client/src/game/core/battleState.ts`
- Modify: `src/client/src/game/core/battleState.test.ts`

**Interfaces:**
- Consumes: 既存の `BattleConfig`、`BattleState`、`UnitStats`、`UnitState`、`BattleCommand`。
- Produces: `UnitStats.level: number`、`UnitStats.revivalCost: number`、`UnitState.defeatedOrder: number | null`、`BattleState` のMP関連フィールド、`ReviveUnit`、`getMpState()`、`setMpState()`。

- [ ] **Step 1: 初期状態の失敗テストを書く**

`battleState.test.ts` に次を追加する。

```ts
test("MPは両召喚士とも0で開始し全ユニットはLV3・COST3である", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());

  assert.equal(state.playerMp, 0);
  assert.equal(state.cpuMp, 0);
  assert.equal(state.playerMpRecoveryProgress, 0);
  assert.equal(state.cpuMpRecoveryProgress, 0);
  assert.equal(state.playerLeaderDamageProgress, 0);
  assert.equal(state.cpuLeaderDamageProgress, 0);
  assert.equal(state.nextDefeatedOrder, 1);
  assert(state.units.every((unit) => unit.stats.level === 3));
  assert(state.units.every((unit) => unit.stats.revivalCost === 3));
  assert(state.units.every((unit) => unit.defeatedOrder === null));
});

test("チーム別MPアクセサーは相手側を変更しない", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  setMpState(state, "Player", 4, 0.25, 120);

  assert.deepEqual(getMpState(state, "Player"), {
    current: 4,
    recoveryProgress: 0.25,
    leaderDamageProgress: 120
  });
  assert.deepEqual(getMpState(state, "Cpu"), {
    current: 0,
    recoveryProgress: 0,
    leaderDamageProgress: 0
  });
});
```

- [ ] **Step 2: テストが型エラーで失敗することを確認する**

Run: `npm test -w src/client -- src/game/core/battleState.test.ts`

Expected: `playerMp`、`level`、`getMpState`、`setMpState` が存在しないためFAIL。

- [ ] **Step 3: 型と初期値を最小実装する**

`types.ts` に次の型を追加する。

```ts
export type MpState = {
  current: number;
  recoveryProgress: number;
  leaderDamageProgress: number;
};

export type UnitStats = {
  level: number;
  revivalCost: number;
  // 既存フィールドをこの後ろへ維持する
};
```

`BattleConfig` に次を追加する。このタスクでは途中状態でも既存コードを型チェックできるよう、`unitRespawnSeconds` はまだ残す。

```ts
maxMp: number;
leaderDamageMpThresholdRatio: number;
```

`UnitState` は次を追加する。このタスクでは `respawnTimerSeconds` をまだ残し、Task 3で時間復活処理と同時に削除する。

```ts
defeatedOrder: number | null;
```

`BattleState` に次を追加する。

```ts
playerMp: number;
cpuMp: number;
playerMpRecoveryProgress: number;
cpuMpRecoveryProgress: number;
playerLeaderDamageProgress: number;
cpuLeaderDamageProgress: number;
nextDefeatedOrder: number;
```

`BattleCommand` に次を追加する。

```ts
| { commandType: "ReviveUnit"; team: TeamId; unitId: UnitId; targetPosition: Vec2 }
```

`battleConfig.ts` の全兵種へ `level: 3`、`revivalCost: 3` を追加し、既定設定へ次を追加する。

```ts
maxMp: 10,
leaderDamageMpThresholdRatio: 0.1,
```

`battleState.ts` でMP関連値を0、`nextDefeatedOrder` を1、`defeatedOrder` を `null` で初期化し、次をexportする。

```ts
export function getMpState(state: BattleState, team: TeamId): MpState;
export function setMpState(
  state: BattleState,
  team: TeamId,
  current: number,
  recoveryProgress: number,
  leaderDamageProgress: number
): void;
```

- [ ] **Step 4: 状態モデルテストを通す**

Run: `npm test -w src/client -- src/game/core/battleState.test.ts`

Expected: PASS。

- [ ] **Step 5: 既存コードを含む型チェックを通す**

Run: `npm run typecheck -w src/client`

Expected: PASS。

- [ ] **Step 6: 状態モデルをコミットする**

```powershell
git add src/client/src/game/core/types.ts src/client/src/game/core/battleConfig.ts src/client/src/game/core/battleState.ts src/client/src/game/core/battleState.test.ts
git commit -m "feat: MP復活用の戦闘状態を追加"
```

---

### Task 2: MP自然回復と被ダメージ回復

**Files:**
- Create: `src/client/src/game/rules/resurrectionSystem.ts`
- Create: `src/client/src/game/rules/resurrectionSystem.test.ts`

**Interfaces:**
- Consumes: `getMpState(state, team)`、`setMpState(state, team, current, recoveryProgress, leaderDamageProgress)`、`UnitStats.level`、`BattleConfig.maxMp`。
- Produces: `mpRecoverySecondsForDefeatedLevel(level: number): number`、`defeatedLevelTotal(state, team): number`、`tickMpRecovery(state, config, deltaSeconds): void`、`recordLeaderDamageForMp(state, config, team, damage): void`。

- [ ] **Step 1: 回復時間表と自然回復の失敗テストを書く**

```ts
const expectedSeconds = [25, 24, 21, 19, 16, 13, 9, 5, 4, 3, 3];
for (const [level, seconds] of expectedSeconds.entries()) {
  test(`撤退LV合計${level}は${seconds}カウントでMP1回復する`, () => {
    assert.equal(mpRecoverySecondsForDefeatedLevel(level), seconds);
  });
}

test("撤退LV合計はチーム別に集計する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  findUnit(state, "PlayerMelee").mode = "Defeated";
  findUnit(state, "PlayerSpeed").mode = "Defeated";
  findUnit(state, "CpuMelee").mode = "Defeated";

  assert.equal(defeatedLevelTotal(state, "Player"), 6);
  assert.equal(defeatedLevelTotal(state, "Cpu"), 3);
});

test("速度変更時も小数の自然回復進捗を維持する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  tickMpRecovery(state, config, 12.5);
  findUnit(state, "PlayerMelee").mode = "Defeated";
  tickMpRecovery(state, config, 9.5);

  assert.equal(state.playerMp, 1);
  assert.equal(state.playerMpRecoveryProgress, 0);
});

test("MP10到達時は自然回復の超過進捗を破棄する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.playerMp = 9;
  state.playerMpRecoveryProgress = 0.9;
  tickMpRecovery(state, config, 100);

  assert.equal(state.playerMp, 10);
  assert.equal(state.playerMpRecoveryProgress, 0);
});
```

- [ ] **Step 2: 自然回復テストが未定義関数で失敗することを確認する**

Run: `npm test -w src/client -- src/game/rules/resurrectionSystem.test.ts`

Expected: `resurrectionSystem.ts` が存在しないためFAIL。

- [ ] **Step 3: 自然回復を実装する**

`resurrectionSystem.ts` に次を実装する。

```ts
const mpRecoverySeconds = [25, 24, 21, 19, 16, 13, 9, 5, 4, 3, 3] as const;

export function mpRecoverySecondsForDefeatedLevel(level: number): number {
  const index = Math.min(10, Math.max(0, Math.floor(level)));
  return mpRecoverySeconds[index];
}

export function defeatedLevelTotal(state: BattleState, team: TeamId): number {
  return state.units
    .filter((unit) => unit.team === team && unit.mode === "Defeated")
    .reduce((total, unit) => total + unit.stats.level, 0);
}

export function tickMpRecovery(
  state: BattleState,
  config: BattleConfig,
  deltaSeconds: number
): void;
```

`tickMpRecovery` は両チームを処理し、負の `deltaSeconds` を0として扱う。MPが `config.maxMp` へ到達したら `recoveryProgress` を0にする。

- [ ] **Step 4: 被ダメージ回復の失敗テストを書く**

```ts
test("召喚士最大HPの10%の実ダメージごとにMP1回復する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  recordLeaderDamageForMp(state, config, "Player", 799);
  assert.equal(state.playerMp, 0);
  recordLeaderDamageForMp(state, config, "Player", 1);
  assert.equal(state.playerMp, 1);
  assert.equal(state.playerLeaderDamageProgress, 0);
});

test("一度に複数境界を超え最大MPを超えない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.cpuMp = 9;
  recordLeaderDamageForMp(state, config, "Cpu", 2400);

  assert.equal(state.cpuMp, 10);
  assert.equal(state.cpuLeaderDamageProgress, 0);
});
```

- [ ] **Step 5: 被ダメージ回復を実装してテストを通す**

```ts
export function recordLeaderDamageForMp(
  state: BattleState,
  config: BattleConfig,
  team: TeamId,
  damage: number
): void;
```

閾値は `findLeader(state, team).maxHp * config.leaderDamageMpThresholdRatio` とする。正の実ダメージだけを加算し、MP最大時は `leaderDamageProgress` を0へ戻す。

Run: `npm test -w src/client -- src/game/rules/resurrectionSystem.test.ts`

Expected: PASS。

- [ ] **Step 6: MP回復ルールをコミットする**

```powershell
git add src/client/src/game/rules/resurrectionSystem.ts src/client/src/game/rules/resurrectionSystem.test.ts
git commit -m "feat: 撤退LVと被ダメージでMPを回復"
```

---

### Task 3: 撃破ライフサイクルとMP消費復活

**Files:**
- Modify: `src/client/src/game/rules/unitSystem.ts`
- Modify: `src/client/src/game/rules/unitSystem.test.ts`
- Modify: `src/client/src/game/rules/resurrectionSystem.ts`
- Modify: `src/client/src/game/rules/resurrectionSystem.test.ts`

**Interfaces:**
- Consumes: `UnitState.defeatedOrder`、`BattleState.nextDefeatedOrder`、`UnitStats.revivalCost`、`BattleConfig.leaderHealingRadius`。
- Produces: `markDefeatedUnits(state): void`、`canReviveUnit(state, config, team, unitId, targetPosition): boolean`、`tryReviveUnit(state, config, team, unitId, targetPosition): boolean`。

- [ ] **Step 1: 時間で復活せず撤退順を記録する失敗テストを書く**

`unitSystem.test.ts` の旧復活タイマーテストを次へ置き換える。

```ts
test("HP0の通常ユニットは撤退順を記録して時間では復活しない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const first = findUnit(state, "PlayerMelee");
  const second = findUnit(state, "PlayerSpeed");
  first.currentHp = 0;
  markDefeatedUnits(state);
  second.currentHp = 0;
  markDefeatedUnits(state);

  assert.equal(first.mode, "Defeated");
  assert.equal(first.defeatedOrder, 1);
  assert.equal(second.defeatedOrder, 2);
  assert.equal(state.nextDefeatedOrder, 3);
  tickCombat(state, config, 30);
  assert.equal(first.mode, "Defeated");
  assert.equal(first.currentHp, 0);
});
```

- [ ] **Step 2: 撃破テストが `markDefeatedUnits` 未定義で失敗することを確認する**

Run: `npm test -w src/client -- src/game/rules/unitSystem.test.ts`

Expected: `markDefeatedUnits` がexportされていないためFAIL。

- [ ] **Step 3: 撃破確定処理を実装する**

```ts
export function markDefeatedUnits(state: BattleState): void {
  for (const unit of state.units) {
    if (unit.mode !== "Defeated" && unit.currentHp <= 0) {
      defeatUnit(state, unit);
    }
  }
}
```

`defeatUnit(state, unit)` は `defeatedOrder = state.nextDefeatedOrder++` を設定し、HP、攻撃、回復、生成タイマー、生成中IDを初期化する。`tickCombat` の攻撃前後で `markDefeatedUnits` を呼ぶ。旧 `tickRespawns` は復元しない。

このステップで `BattleConfig.unitRespawnSeconds`、`UnitState.respawnTimerSeconds`、`tickRespawns` と全参照を削除する。旧復活タイマーテストはStep 1の時間非復活テストへ置き換える。

- [ ] **Step 4: 復活条件と成功状態の失敗テストを書く**

```ts
test("MP3を消費して回復エリア内へ全HP復活する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.mode = "Defeated";
  unit.currentHp = 0;
  unit.defeatedOrder = 1;
  state.playerMp = 3;
  const target = { ...findLeader(state, "Player").position };

  assert.equal(tryReviveUnit(state, config, "Player", unit.unitId, target), true);
  assert.equal(state.playerMp, 0);
  assert.equal(unit.mode, "Active");
  assert.equal(unit.currentHp, unit.stats.maxHp);
  assert.deepEqual(unit.position, target);
  assert.deepEqual(unit.destination, target);
  assert.equal(unit.defeatedOrder, null);
});

test("MP不足と回復エリア外ではMPを消費しない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.mode = "Defeated";
  unit.currentHp = 0;
  state.playerMp = 2;
  const leader = findLeader(state, "Player");

  assert.equal(tryReviveUnit(state, config, "Player", unit.unitId, leader.position), false);
  state.playerMp = 3;
  assert.equal(tryReviveUnit(state, config, "Player", unit.unitId, { x: 0, y: 0 }), false);
  assert.equal(state.playerMp, 3);
  assert.equal(unit.mode, "Defeated");
});
```

同じテストファイルへ、生存中、別チーム、戦場外の各拒否ケースを個別テストとして追加する。

- [ ] **Step 5: 復活検証と状態遷移を実装する**

```ts
export function canReviveUnit(
  state: BattleState,
  config: BattleConfig,
  team: TeamId,
  unitId: UnitId,
  targetPosition: Vec2
): boolean;

export function tryReviveUnit(
  state: BattleState,
  config: BattleConfig,
  team: TeamId,
  unitId: UnitId,
  targetPosition: Vec2
): boolean;
```

戦場内判定は `battlefieldMin` と `battlefieldMax` の包含範囲、回復エリア判定は `distanceSq(targetPosition, leader.position) <= leaderHealingRadius ** 2` とする。成功時はMPをCOST分引き、HP、位置、移動先、攻撃、回復、生成状態を初期化する。

- [ ] **Step 6: 撃破と復活のテストを通す**

Run: `npm test -w src/client -- src/game/rules/unitSystem.test.ts src/game/rules/resurrectionSystem.test.ts`

Expected: PASS。

- [ ] **Step 7: 撃破と復活をコミットする**

```powershell
git add src/client/src/game/rules/unitSystem.ts src/client/src/game/rules/unitSystem.test.ts src/client/src/game/rules/resurrectionSystem.ts src/client/src/game/rules/resurrectionSystem.test.ts
git commit -m "feat: MP消費で撤退ユニットを復活"
```

---

### Task 4: GameSessionへのMPと復活コマンド統合

**Files:**
- Modify: `src/client/src/game/rules/gameSession.ts`
- Modify: `src/client/src/game/rules/gameSession.test.ts`

**Interfaces:**
- Consumes: `tickMpRecovery`、`recordLeaderDamageForMp`、`tryReviveUnit`、`markDefeatedUnits`、`BattleCommand.ReviveUnit`。
- Produces: 戦闘中だけMPを更新し、通常ユニットと召喚獣による召喚士実ダメージをMPへ変換する `GameSession.tick()`。

- [ ] **Step 1: GameSession統合の失敗テストを書く**

```ts
test("戦闘中だけMP自然回復が進む", () => {
  const session = new GameSession();
  session.tick(25);
  assert.equal(session.state.playerMp, 0);
  session.applyCommand({ commandType: "StartBattle", team: "Player" });
  session.tick(session.config.countdownSeconds);
  session.tick(25);
  assert.equal(session.state.playerMp, 1);
});

test("ReviveUnitコマンドは成功時だけMPを一度消費する", () => {
  const session = createStartedSession();
  const unit = findUnit(session.state, "PlayerMelee");
  unit.mode = "Defeated";
  unit.currentHp = 0;
  session.state.playerMp = 6;
  const command = {
    commandType: "ReviveUnit" as const,
    team: "Player" as const,
    unitId: unit.unitId,
    targetPosition: { ...findLeader(session.state, "Player").position }
  };

  session.applyCommand(command);
  session.applyCommand(command);

  assert.equal(session.state.playerMp, 3);
  assert.equal(unit.mode, "Active");
});

test("通常ユニットが召喚士へ与えた実ダメージ800でMP1回復する", () => {
  const session = createStartedSession();
  const attacker = findUnit(session.state, "CpuMelee");
  const leader = findLeader(session.state, "Player");
  attacker.position = { ...leader.position };
  attacker.destination = { ...leader.position };
  attacker.stats.attackDamage = 800;
  session.config.directLeaderDamageMultiplier = 1;
  for (const playerUnit of session.state.units.filter((unit) => unit.team === "Player")) {
    playerUnit.mode = "Defeated";
    playerUnit.currentHp = 0;
  }
  session.tick(0);

  assert.equal(session.state.playerMp, 1);
});

test("召喚獣が召喚士へ与えた実ダメージ800でMP1回復する", () => {
  const session = createStartedSession();
  const leader = findLeader(session.state, "Player");
  session.state.summonedUnits.push({
    summonedUnitId: 99,
    team: "Cpu",
    position: { ...leader.position },
    destination: { ...leader.position },
    maxHp: 1000,
    currentHp: 1000,
    attackDamage: 0,
    leaderAttackDamage: 800,
    attackIntervalSeconds: 0.5,
    attackTimerSeconds: 0,
    leaderAttackIntervalSeconds: 2,
    leaderAttackTimerSeconds: 0,
    moveSpeed: 0,
    healthDecayPerSecond: 0
  });
  session.tick(0);

  assert.equal(session.state.playerMp, 1);
});
```

- [ ] **Step 2: 統合テストがMP未更新で失敗することを確認する**

Run: `npm test -w src/client -- src/game/rules/gameSession.test.ts`

Expected: MPが0のまま、または `ReviveUnit` が処理されずFAIL。

- [ ] **Step 3: コマンドと更新順序を実装する**

`applyCommand` に次を追加する。

```ts
case "ReviveUnit":
  if (this.state.phase === "InProgress") {
    tryReviveUnit(
      this.state,
      this.config,
      command.team,
      command.unitId,
      command.targetPosition
    );
  }
  break;
```

`tick` の戦闘進行分岐で、最初に `tickMpRecovery` を呼ぶ。戦闘処理直前に両リーダーHPを保存し、`tickCombat`、`tickSummonedUnits`、`markDefeatedUnits` の後で減少差分を `recordLeaderDamageForMp` へ渡す。負の `deltaSeconds` は既存テストに合わせて戦闘時間とMP進捗のどちらにも加算しない。

- [ ] **Step 4: GameSessionテストと関連ルールテストを通す**

Run: `npm test -w src/client -- src/game/rules/gameSession.test.ts src/game/rules/resurrectionSystem.test.ts src/game/rules/unitSystem.test.ts src/game/rules/summonSystem.test.ts`

Expected: PASS。

- [ ] **Step 5: GameSession統合をコミットする**

```powershell
git add src/client/src/game/rules/gameSession.ts src/client/src/game/rules/gameSession.test.ts
git commit -m "feat: 戦闘ループにMP復活を統合"
```

---

### Task 5: CPUの撤退順自動復活

**Files:**
- Modify: `src/client/src/game/ai/cpuPlanner.ts`
- Modify: `src/client/src/game/ai/cpuPlanner.test.ts`

**Interfaces:**
- Consumes: `canReviveUnit(state, config, "Cpu", unitId, cpuLeader.position)`、`UnitState.defeatedOrder`、`BattleCommand.ReviveUnit`。
- Produces: 復活可能な最古ユニットを既存行動より優先する `planCpuCommands()`。

- [ ] **Step 1: CPU復活優先順位の失敗テストを書く**

```ts
test("CPUはMPが足りると最古の撤退ユニットを召喚士位置へ復活させる", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const older = findUnit(state, "CpuSpeed");
  const newer = findUnit(state, "CpuMelee");
  older.mode = "Defeated";
  older.currentHp = 0;
  older.defeatedOrder = 1;
  newer.mode = "Defeated";
  newer.currentHp = 0;
  newer.defeatedOrder = 2;
  state.cpuMp = 3;

  assert.deepEqual(planCpuCommands(state, config), [{
    commandType: "ReviveUnit",
    team: "Cpu",
    unitId: "CpuSpeed",
    targetPosition: { ...findLeader(state, "Cpu").position }
  }]);
});

test("CPUはMP不足なら既存の召喚・生成・移動判断を続ける", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "CpuMelee");
  unit.mode = "Defeated";
  unit.currentHp = 0;
  unit.defeatedOrder = 1;
  state.cpuMp = 2;

  assert.notEqual(planCpuCommands(state, config)[0]?.commandType, "ReviveUnit");
});
```

- [ ] **Step 2: CPUテストが既存コマンドを返して失敗することを確認する**

Run: `npm test -w src/client -- src/game/ai/cpuPlanner.test.ts`

Expected: 最初のコマンドが `ReviveUnit` ではないためFAIL。

- [ ] **Step 3: CPU復活を最優先で実装する**

`planCpuCommands` 冒頭で `Defeated` かつ `defeatedOrder !== null` のCPUユニットを昇順に並べる。CPU召喚士位置に対して `canReviveUnit` がtrueとなる最初のユニットがあれば、`ReviveUnit` 1件だけを返す。該当しない場合だけ既存の召喚、生成、移動判断へ進む。

- [ ] **Step 4: CPU全テストを通す**

Run: `npm test -w src/client -- src/game/ai/cpuPlanner.test.ts`

Expected: PASS。

- [ ] **Step 5: CPU復活をコミットする**

```powershell
git add src/client/src/game/ai/cpuPlanner.ts src/client/src/game/ai/cpuPlanner.test.ts
git commit -m "feat: CPUが撤退順にユニットを復活"
```

---

### Task 6: 644×468内の縦HUDと待機場所レイアウト

**Files:**
- Modify: `src/client/src/game/ui/battleLayout.ts`
- Modify: `src/client/src/game/ui/battleLayout.test.ts`
- Modify: `src/client/src/game/ui/battleHudModel.ts`
- Modify: `src/client/src/game/ui/battleHudModel.test.ts`
- Modify: `src/client/src/game/ui/battleHud.ts`

**Interfaces:**
- Consumes: `BattleState.playerMp`、`BattleConfig.maxMp` 相当の固定表示上限10、`gameViewport` の `644×468`。
- Produces: `BattleLayout.leftPanel`、`waitingArea`、`remainingTime`、縦向き `playerHp`、`cpuHp`、`mp`、`summonGauge`、`BattleHudModel.mp`。

- [ ] **Step 1: 新レイアウトの失敗テストを書く**

`battleLayout.test.ts` の旧上部・下部HUD座標テストを次の確定座標へ置き換える。

```ts
test("644x468内に左2列上下HUD・上詰めフィールド・待機場所を配置する", () => {
  const layout = calculateBattleLayout(644, 468);

  assert.deepEqual(layout.leftPanel, { x: 6, y: 8, width: 106, height: 326 });
  assert.deepEqual(layout.cpuHp, { x: 25, y: 28, width: 12, height: 118 });
  assert.deepEqual(layout.playerHp, { x: 25, y: 174, width: 12, height: 118 });
  assert.deepEqual(layout.mp, { x: 75, y: 28, width: 12, height: 118 });
  assert.deepEqual(layout.summonGauge, { x: 75, y: 174, width: 12, height: 118 });
  assert.deepEqual(layout.field, { x: 120, y: 8, width: 456, height: 326 });
  assert.deepEqual(layout.waitingArea, { x: 120, y: 342, width: 456, height: 116 });
  assert.deepEqual(layout.remainingTime, { x: 591.6, y: 8, width: 52, height: 53 });
  assert.deepEqual(layout.buildButton, { x: 591.6, y: 69, width: 52, height: 52 });
  assert.deepEqual(layout.summonButton, { x: 591.6, y: 129, width: 52, height: 52 });
  assert.deepEqual(layout.retryButton, { x: 591.6, y: 189, width: 52, height: 52 });
  assert.equal(layout.waitingArea.y + layout.waitingArea.height, 458);
});

test("待機場所と左HUDと時間表示はHUD入力範囲で戦場は操作可能である", () => {
  const layout = calculateBattleLayout(644, 468);
  assert.equal(isPointInHud(layout, 10, 10), true);
  assert.equal(isPointInHud(layout, 130, 350), true);
  assert.equal(isPointInHud(layout, 600, 20), true);
  assert.equal(isPointInHud(layout, 130, 20), false);
});
```

- [ ] **Step 2: HUDモデルのMP失敗テストを書く**

```ts
test("味方MPを0から10の縦ゲージモデルへ整形する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.playerMp = 6;
  const model = createBattleHudModel(state, null, false);

  assert.deepEqual(model.mp, { text: "MP 6 / 10", ratio: 0.6 });
});
```

- [ ] **Step 3: レイアウトとモデルテストが失敗することを確認する**

Run: `npm test -w src/client -- src/game/ui/battleLayout.test.ts src/game/ui/battleHudModel.test.ts`

Expected: `leftPanel`、`waitingArea`、`remainingTime`、`mp` が存在しないためFAIL。

- [ ] **Step 4: 純粋レイアウトとHUDモデルを実装する**

`BattleLayout` を次の形へ変更する。

```ts
export type BattleLayout = {
  leftPanel: UiRect;
  field: UiRect;
  waitingArea: UiRect;
  playerHp: UiRect;
  cpuHp: UiRect;
  mp: UiRect;
  summonGauge: UiRect;
  remainingTime: UiRect;
  buildButton: UiRect;
  summonButton: UiRect;
  retryButton: UiRect;
};
```

`isPointInHud` は `leftPanel`、`waitingArea`、`remainingTime`、3ボタンを対象とし、`field` を含めない。`BattleHudModel` へ `mp: HudGaugeModel` を追加し、`playerMp` を0～10へ制限してモデル化する。

- [ ] **Step 5: Phaser HUDを細い縦ゲージへ変更する**

`battleHud.ts` の `HudGauge` に `height` と `orientation: "Horizontal" | "Vertical"` を持たせる。縦ゲージ更新は次の配置にする。

```ts
const fillHeight = gauge.height * model.ratio;
gauge.fill.height = fillHeight;
gauge.fill.y = gauge.background.y + gauge.background.height - 2 - fillHeight;
```

HP、MP、召喚ゲージには縦向きゲージを使い、時間テキストは `remainingTime` の中央へ置く。上部・下部背景は削除し、`leftPanel` と `waitingArea` の背景を生成する。`destroy()` も新しいオブジェクト構成へ合わせる。

- [ ] **Step 6: HUDテストと型チェックを通す**

Run: `npm test -w src/client -- src/game/ui/battleLayout.test.ts src/game/ui/battleHudModel.test.ts`

Expected: PASS。

Run: `npm run typecheck -w src/client`

Expected: PASS。

- [ ] **Step 7: HUD再配置をコミットする**

```powershell
git add src/client/src/game/ui/battleLayout.ts src/client/src/game/ui/battleLayout.test.ts src/client/src/game/ui/battleHudModel.ts src/client/src/game/ui/battleHudModel.test.ts src/client/src/game/ui/battleHud.ts
git commit -m "feat: 戦闘HUDを縦2列へ再配置"
```

---

### Task 7: 待機カード縮小・復活ドラッグ・BattleScene統合

**Files:**
- Create: `src/client/src/game/ui/defeatedUnitLayout.ts`
- Create: `src/client/src/game/ui/defeatedUnitLayout.test.ts`
- Create: `src/client/src/game/input/revivalDrag.ts`
- Create: `src/client/src/game/input/revivalDrag.test.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts`
- Modify: `docs/開発メモ.txt`

**Interfaces:**
- Consumes: `BattleLayout.waitingArea`、`UnitState.stats.level`、`revivalCost`、`BattleState.playerMp`、`ReviveUnit`、`canReviveUnit`。
- Produces: `calculateDefeatedUnitLayout(area, unitIds)`、`DefeatedUnitCardLayout`、`transitionRevivalDragRelease()`、待機カード描画とポインター追従。

- [ ] **Step 1: 待機カード縮小の失敗テストを書く**

```ts
test("待機カードは利用可能な縦幅へ等比縮小される", () => {
  const layouts = calculateDefeatedUnitLayout(
    { x: 120, y: 342, width: 456, height: 60 },
    ["PlayerMelee"]
  );

  assert.equal(layouts.length, 1);
  assert.equal(layouts[0].unitId, "PlayerMelee");
  assert(layouts[0].rect.height <= 44);
  assert.equal(layouts[0].rect.width / layouts[0].rect.height, 54 / 76);
});

test("3枚の待機カードは共通縮尺で待機場所の横幅へ収まる", () => {
  const layouts = calculateDefeatedUnitLayout(
    { x: 120, y: 342, width: 180, height: 116 },
    ["PlayerMelee", "PlayerSpeed", "PlayerRanged"]
  );

  assert.equal(layouts.length, 3);
  assert(layouts.every((layout) => layout.scale === layouts[0].scale));
  assert(layouts.at(-1)!.rect.x + layouts.at(-1)!.rect.width <= 294);
});
```

- [ ] **Step 2: 復活ドラッグの失敗テストを書く**

```ts
test("撤退カードをMP充足状態で回復エリアへ置くとReviveUnitを生成する", () => {
  const transition = transitionRevivalDragRelease(
    { draggedUnitId: "PlayerMelee" },
    {
      phase: "InProgress",
      targetDefeated: true,
      enoughMp: true,
      insideBattlefield: true,
      insideHealingArea: true
    },
    { x: 0, y: -4.1 }
  );

  assert.deepEqual(transition.command, {
    commandType: "ReviveUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: 0, y: -4.1 }
  });
  assert.equal(transition.draggedUnitId, null);
});

for (const invalid of [
  { targetDefeated: false },
  { enoughMp: false },
  { insideBattlefield: false },
  { insideHealingArea: false },
  { phase: "Countdown" as const }
]) {
  test(`無効な復活ドロップはコマンドを生成しない: ${JSON.stringify(invalid)}`, () => {
    const transition = transitionRevivalDragRelease(
      { draggedUnitId: "PlayerMelee" },
      {
        phase: "InProgress",
        targetDefeated: true,
        enoughMp: true,
        insideBattlefield: true,
        insideHealingArea: true,
        ...invalid
      },
      { x: 0, y: -4.1 }
    );
    assert.equal(transition.command, null);
  });
}
```

- [ ] **Step 3: 新規UI・入力テストがファイル未作成で失敗することを確認する**

Run: `npm test -w src/client -- src/game/ui/defeatedUnitLayout.test.ts src/game/input/revivalDrag.test.ts`

Expected: 対象モジュールが存在しないためFAIL。

- [ ] **Step 4: 待機カードレイアウトを実装する**

```ts
export type DefeatedUnitCardLayout = {
  unitId: PlayerUnitId;
  rect: UiRect;
  scale: number;
};

export function calculateDefeatedUnitLayout(
  area: UiRect,
  unitIds: readonly PlayerUnitId[]
): DefeatedUnitCardLayout[];
```

基準カードサイズは `54×76`、内側余白は8px、カード間隔は8px、上部ラベル領域は16pxとする。縮尺は `Math.min(1, availableHeight / 76, availableWidthForCards / (54 * count))` から求め、全カードへ同じ値を使う。0枚なら空配列を返す。

- [ ] **Step 5: 復活ドラッグ遷移を実装する**

```ts
export type RevivalDragState = {
  draggedUnitId: PlayerUnitId | null;
};

export type RevivalDropContext = {
  phase: MatchPhase;
  targetDefeated: boolean;
  enoughMp: boolean;
  insideBattlefield: boolean;
  insideHealingArea: boolean;
};

export function transitionRevivalDragRelease(
  state: RevivalDragState,
  context: RevivalDropContext,
  targetPosition: Vec2
): {
  draggedUnitId: null;
  command: Extract<BattleCommand, { commandType: "ReviveUnit" }> | null;
};
```

有効条件をすべて満たした場合だけPlayerの `ReviveUnit` を返し、成功・失敗を問わずドラッグIDを `null` にする。

- [ ] **Step 6: 純粋関数テストを通す**

Run: `npm test -w src/client -- src/game/ui/defeatedUnitLayout.test.ts src/game/input/revivalDrag.test.ts`

Expected: PASS。

- [ ] **Step 7: BattleSceneへ待機表示とドラッグを接続する**

`BattleScene` に次の状態を追加する。

```ts
private revivalDraggedUnitId: PlayerUnitId | null = null;
private revivalPointerPosition: Vec2 | null = null;
private defeatedUnitLayouts: DefeatedUnitCardLayout[] = [];
```

描画時はPlayerの `Defeated` ユニットIDを撤退順で並べ、`calculateDefeatedUnitLayout(layout.waitingArea, ids)` を呼ぶ。撤退ユニットは `worldToScreen(unit.position)` へ描かず、待機矩形中央へ画像と枠を配置する。画像は元の縦横比を維持し、`layout.scale` を適用する。MP不足時は画像と枠を `alpha = 0.35`、復活可能時は `alpha = 0.78` とし、`LV3 / COST3` と状態ラベルを待機場所へ描く。

`pointerdown` は `hud.contains` による早期returnより前に待機カード矩形をヒットテストし、該当すれば `revivalDraggedUnitId` を設定する。その後だけ、生存カード選択用の既存HUD判定へ進む。`pointermove` は復活ドラッグ中だけ `revivalPointerPosition` を更新し、対象カードをポインターへ追従表示する。`pointerup` は画面座標をワールド座標へ変換し、召喚士との距離とMPから `transitionRevivalDragRelease` のcontextを組み立て、返されたコマンドを `session.applyCommand` へ渡す。`pointerupoutside` と試合終了時は復活ドラッグ状態も解除する。

既存 `findPlayerUnitNear` は `isUnitAlive` 条件を維持し、撤退ユニットを通常移動として選ばない。`drawUnits` は撤退ユニットの戦場HPバーと選択円を描かない。

- [ ] **Step 8: 開発メモを更新する**

`docs/開発メモ.txt` の「詳細が必要な内容」から「ユニットの復活は時間ではなく保持コストにする」を削除し、「修正した内容」へ次を追加する。

```text
- ユニットは撤退中LV合計に応じて回復する共有MPをCOST分消費し、回復エリアへドラッグして復活する
```

- [ ] **Step 9: 全テスト・型チェック・ビルドを実行する**

Run: `npm test -w src/client`

Expected: 全テストPASS。

Run: `npm run typecheck`

Expected: client/serverともPASS。

Run: `npm run build`

Expected: server/clientともビルド成功。

- [ ] **Step 10: ブラウザで操作確認する**

Run: `npm run dev:client`

確認項目:

- 画面外形が `644×468` のままである。
- 左列上から敵HP・味方HP、右列上からMP・召喚ゲージが細い縦バーで表示される。
- 残り時間が右ボタン列の上に表示される。
- 戦闘フィールドが上へ詰まり、待機場所が下へ収まる。
- 撃破カードが戦場から待機場所へ移動し、3枚でも等比縮小して収まる。
- MP不足時は暗転し、回復エリア外では復活しない。
- MP3以上で回復エリア内へドラッグするとMP3を消費して全HP復活する。
- 生存カードの通常ドラッグ、生成、召喚、Retryが従来どおり動く。

確認後、開発サーバーを停止する。

- [ ] **Step 11: UIと復活操作をコミットする**

```powershell
git add src/client/src/game/ui/defeatedUnitLayout.ts src/client/src/game/ui/defeatedUnitLayout.test.ts src/client/src/game/input/revivalDrag.ts src/client/src/game/input/revivalDrag.test.ts src/client/src/game/scenes/BattleScene.ts docs/開発メモ.txt
git commit -m "feat: 待機場所からのドラッグ復活を追加"
```

---

## Final Verification

全タスク完了後、作業ツリーにユーザー所有ファイル以外の未コミット差分がないことを確認する。

```powershell
git status --short
npm test -w src/client
npm run typecheck
npm run build
```

Expected:

- `src/client/public/assets/effects/melee_attack_2.png` と `melee_attack_3.png`、ビジュアル確認用 `.superpowers/brainstorm/` 以外に未コミット差分がない。
- クライアント全テストがPASSする。
- client/serverの型チェックがPASSする。
- client/serverのビルドが成功する。
