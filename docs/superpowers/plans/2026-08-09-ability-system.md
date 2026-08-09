# アビリティシステム実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プレイヤー側3ユニットへAP蓄積、固有アビリティ、HUD操作、発動前の黄色い範囲・対象マークを追加する。

**Architecture:** 新設する `abilitySystem.ts` がAP、発動判定、対象選択、時間制効果、実効戦闘値を管理する。既存の `GameSession`、`unitSystem`、`resurrectionSystem` はこの境界を介してアビリティ状態を更新し、HUDと描画はルール層の判定結果を表示モデルへ変換する。

**Tech Stack:** TypeScript 5.8、Phaser 3.90、Node.js test runner、tsx、Vite

## Global Constraints

- 設計仕様は `docs/superpowers/specs/2026-08-09-ability-system-design.md` を正とする。
- 1カウントはゲーム内1秒、APは生存中のプレイヤーユニットだけが20秒ごとに1増える。
- `Melee` はキーパー、`Speed` はシーカー、`Ranged` はマスターとして扱う。
- CPU側のAP蓄積とアビリティ使用は実装しない。
- カード縦サイズ `H` の初期値はワールド座標 `2.25` とする。
- 基礎 `UnitStats` は変更せず、効果は実効値として計算する。
- 新しいランタイム依存パッケージは追加しない。
- 作成・更新する資料とテスト名は、コード識別子を除いて日本語を基本とする。

---

## ファイル構成

- `src/client/src/game/rules/abilitySystem.ts`: AP、発動、対象、時間制効果、実効値の唯一のルール境界。
- `src/client/src/game/rules/abilitySystem.test.ts`: アビリティ単体ルールの境界値テスト。
- `src/client/src/game/render/abilityPresentation.ts`: 範囲円と対象マークの表示モデル。
- `src/client/src/game/render/abilityPresentation.test.ts`: 色、形、対象位置の表示モデルテスト。
- `src/client/src/game/core/types.ts`: コマンド、ユニット、エレメント、設定の状態型。
- `src/client/src/game/core/battleConfig.ts`: `unitCardWorldHeight` の初期値。
- `src/client/src/game/core/battleState.ts`: 新規ユニットのアビリティ初期状態。
- `src/client/src/game/rules/gameSession.ts`: `UseAbility` とアビリティ時間更新の統合。
- `src/client/src/game/rules/unitSystem.ts`: 実効攻撃力、射程、速度倍率の利用と戦闘不能時のリセット。
- `src/client/src/game/rules/elementalSystem.ts`: 新規エレメントのキーパー付与状態初期化。
- `src/client/src/game/rules/resurrectionSystem.ts`: 復活時のアビリティ状態リセット。
- `src/client/src/game/ui/battleLayout.ts`: アビリティボタン配置とHUD領域。
- `src/client/src/game/ui/battleHudModel.ts`: AP表示、進捗、ボタン活性条件。
- `src/client/src/game/ui/battleHud.ts`: アビリティ画像ボタン、AP進捗表示、クリック通知。
- `src/client/src/game/scenes/BattleScene.ts`: 画像プリロード、コマンド送信、範囲・マーク描画。
- 対応する既存 `*.test.ts`: 型追加と統合挙動に必要な期待値を更新する。

### Task 1: アビリティ状態とAP蓄積

**Files:**
- Create: `src/client/src/game/rules/abilitySystem.ts`
- Create: `src/client/src/game/rules/abilitySystem.test.ts`
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/core/battleConfig.ts`
- Modify: `src/client/src/game/core/battleState.ts`
- Test: `src/client/src/game/core/battleState.test.ts`

**Interfaces:**
- Consumes: `BattleState`、`BattleConfig`、`UnitState`、`UnitType`。
- Produces: `abilityApCost(unitType: UnitType): number`、`tickAbilities(state: BattleState, config: BattleConfig, deltaSeconds: number): void`、`resetUnitAbilityState(unit: UnitState): void`。

- [ ] **Step 1: AP初期状態と設定値の失敗テストを書く**

`battleState.test.ts` へ、初期ユニットの4項目が0であり `unitCardWorldHeight` が2.25である検証を追加する。

```ts
const state = createDefaultBattleState(config);
const master = findUnit(state, "PlayerRanged");
assert.equal(config.unitCardWorldHeight, 2.25);
assert.deepEqual(
  {
    ap: master.abilityAp,
    progress: master.abilityRecoverySeconds,
    range: master.masterRangeBoostRemainingSeconds,
    damage: master.seekerAttackBoostRemainingSeconds
  },
  { ap: 0, progress: 0, range: 0, damage: 0 }
);
```

- [ ] **Step 2: AP蓄積の失敗テストを書く**

`abilitySystem.test.ts` に、19.9秒では増えず、合計20秒で1増え、マスターは2、シーカーは3で停止するテストを書く。CPU、戦闘不能、負のdeltaでは増えないことも同じファイルで個別テストにする。

```ts
tickAbilities(state, config, 19.9);
assert.equal(findUnit(state, "PlayerRanged").abilityAp, 0);
tickAbilities(state, config, 0.1);
assert.equal(findUnit(state, "PlayerRanged").abilityAp, 1);
assert.equal(findUnit(state, "PlayerRanged").abilityRecoverySeconds, 0);
tickAbilities(state, config, 100);
assert.equal(findUnit(state, "PlayerRanged").abilityAp, 2);
assert.equal(findUnit(state, "PlayerRanged").abilityRecoverySeconds, 0);
assert.equal(findUnit(state, "CpuRanged").abilityAp, 0);
```

- [ ] **Step 3: 失敗を確認する**

Run: `npm.cmd test -w src/client -- --test-name-pattern="AP|アビリティ初期状態"`

Expected: `abilitySystem.ts` と新しい状態プロパティが存在しないためFAIL。

- [ ] **Step 4: 状態型、設定、初期化を実装する**

`BattleConfig` に `unitCardWorldHeight: number`、`UnitState` に4状態、`ElementalState` に後方互換を保つ `hasKeeperSpeedAura?: boolean` を追加する。`createUnit` では4状態を0に初期化し、設定へ `unitCardWorldHeight: 2.25` を追加する。

```ts
export type UnitState = {
  // existing fields
  abilityAp: number;
  abilityRecoverySeconds: number;
  masterRangeBoostRemainingSeconds: number;
  seekerAttackBoostRemainingSeconds: number;
};

export type ElementalState = {
  // existing fields
  hasKeeperSpeedAura?: boolean;
};
```

- [ ] **Step 5: AP蓄積の最小実装を書く**

`abilitySystem.ts` にコスト対応と20秒単位の蓄積を実装する。満タン時は進捗を0にし、CPUと戦闘不能は蓄積対象外にする。

```ts
const apCostByType: Record<UnitType, number> = { Melee: 2, Speed: 3, Ranged: 2 };
const secondsPerAp = 20;

export function abilityApCost(unitType: UnitType): number {
  return apCostByType[unitType];
}

export function resetUnitAbilityState(unit: UnitState): void {
  unit.abilityAp = 0;
  unit.abilityRecoverySeconds = 0;
  unit.masterRangeBoostRemainingSeconds = 0;
  unit.seekerAttackBoostRemainingSeconds = 0;
}
```

`tickAbilities` は `Math.max(0, deltaSeconds)` を加え、`Math.floor(total / 20)` をAPへ移し、満タンなら余りを破棄する。

- [ ] **Step 6: 対象テストとクライアント型チェックを通す**

Run: `npm.cmd test -w src/client -- --test-name-pattern="AP|アビリティ初期状態"`

Expected: PASS。

Run: `npm.cmd run typecheck -w src/client`

Expected: PASS。

- [ ] **Step 7: コミットする**

```powershell
git add src/client/src/game/core/types.ts src/client/src/game/core/battleConfig.ts src/client/src/game/core/battleState.ts src/client/src/game/core/battleState.test.ts src/client/src/game/rules/abilitySystem.ts src/client/src/game/rules/abilitySystem.test.ts
git commit -m "feat: AP状態と蓄積ルールを追加"
```

### Task 2: 3種類の発動ルールと実効値

**Files:**
- Modify: `src/client/src/game/rules/abilitySystem.ts`
- Modify: `src/client/src/game/rules/abilitySystem.test.ts`
- Modify: `src/client/src/game/rules/elementalSystem.ts`
- Test: `src/client/src/game/rules/elementalSystem.test.ts`

**Interfaces:**
- Consumes: Task 1の `abilityApCost` と追加状態。
- Produces: `abilityArea(state: BattleState, config: BattleConfig, unitId: UnitId): AbilityArea | null`、`abilityTargets(state: BattleState, config: BattleConfig, unitId: UnitId): AbilityTargets`、`canUseAbility(state: BattleState, config: BattleConfig, unitId: PlayerUnitId): boolean`、`tryUseAbility(state: BattleState, config: BattleConfig, unitId: PlayerUnitId): boolean`、`effectiveAttackRange(unit: UnitState): number`、`effectiveAttackDamage(unit: UnitState): number`、`effectiveMoveSpeedMultiplier(state: BattleState, config: BattleConfig, unit: UnitState): number`。

- [ ] **Step 1: マスターの失敗テストを書く**

マスターへAP2を与えて発動し、APが0、射程が1.5倍、19.9秒後も有効、20秒で基礎値へ戻ることを検証する。不足APでは状態が変わらないことも検証する。

```ts
master.abilityAp = 2;
assert.equal(tryUseAbility(state, config, "PlayerRanged"), true);
assert.equal(master.abilityAp, 0);
assert.equal(effectiveAttackRange(master), master.stats.attackRange * 1.5);
tickAbilities(state, config, 20);
assert.equal(effectiveAttackRange(master), master.stats.attackRange);
```

- [ ] **Step 2: シーカーの失敗テストを書く**

シーカー中心から `H × 1.5` の境界へ味方を置き、敵を同位置へ置く。発動後は自身と味方だけが15秒間 `+10`、移動しても継続、再発動しても `+10` のまま、15秒で終了することを検証する。

```ts
seeker.position = { x: 0, y: 0 };
keeper.position = { x: config.unitCardWorldHeight * 1.5, y: 0 };
seeker.abilityAp = 3;
assert.equal(tryUseAbility(state, config, "PlayerSpeed"), true);
assert.equal(effectiveAttackDamage(seeker), seeker.stats.attackDamage + 10);
assert.equal(effectiveAttackDamage(keeper), keeper.stats.attackDamage + 10);
assert.equal(effectiveAttackDamage(cpuKeeper), cpuKeeper.stats.attackDamage);
```

- [ ] **Step 3: キーパーの失敗テストを書く**

キーパー中心を `(0, 0)` とし、円中心 `(0, H)`、半径 `H / 2` の境界へ完成済み味方エレメントを置く。敵、未完成、範囲外を除外し、対象0ではAPを消費しないことを検証する。付与済みエレメントから `H × 1.5` 境界内の味方通常ユニットだけが1.5倍になり、複数範囲でも1.5倍であることを検証する。

```ts
keeper.position = { x: 0, y: 0 };
state.elementals = [{
  elementalId: "Elemental1",
  team: "Player",
  position: { x: config.unitCardWorldHeight / 2, y: config.unitCardWorldHeight },
  maxHp: 1000,
  currentHp: 1000,
  isComplete: true
}];
keeper.abilityAp = 2;
assert.equal(tryUseAbility(state, config, "PlayerMelee"), true);
assert.equal(state.elementals[0].hasKeeperSpeedAura, true);
assert.equal(effectiveMoveSpeedMultiplier(state, config, seeker), 1.5);
```

- [ ] **Step 4: 失敗を確認する**

Run: `npm.cmd test -w src/client -- --test-name-pattern="マスターのアビリティ|シーカーのアビリティ|キーパーのアビリティ"`

Expected: 発動・対象・実効値関数が未実装のためFAIL。

- [ ] **Step 5: 範囲、対象、発動、実効値を実装する**

次の公開型と関数を `abilitySystem.ts` に追加する。

```ts
export type AbilityArea = { center: Vec2; radius: number };
export type AbilityTargets = { unitIds: UnitId[]; elementalIds: ElementalId[] };

export function effectiveAttackRange(unit: UnitState): number {
  return unit.stats.attackRange * (unit.masterRangeBoostRemainingSeconds > 0 ? 1.5 : 1);
}

export function effectiveAttackDamage(unit: UnitState): number {
  return unit.stats.attackDamage + (unit.seekerAttackBoostRemainingSeconds > 0 ? 10 : 0);
}
```

`abilityArea` はSpeedでユニット中心・半径 `H * 1.5`、Meleeで中心 `{ x: unit.x, y: unit.y + H }`・半径 `H / 2`、Rangedで `null` を返す。対象判定は平方距離 `<= radius ** 2` を使う。`tryUseAbility` は成功時だけ効果を付与し、APと進捗を0にする。

- [ ] **Step 6: 新規エレメントの付与状態を初期化する**

`elementalSystem.ts` が完成エレメントを追加する箇所へ `hasKeeperSpeedAura: false` を追加する。既存テストで新規エレメントがfalseであることを1件確認する。

- [ ] **Step 7: 対象テストを通す**

Run: `npm.cmd test -w src/client -- --test-name-pattern="アビリティ|付与状態"`

Expected: PASS。

- [ ] **Step 8: コミットする**

```powershell
git add src/client/src/game/rules/abilitySystem.ts src/client/src/game/rules/abilitySystem.test.ts src/client/src/game/rules/elementalSystem.ts src/client/src/game/rules/elementalSystem.test.ts
git commit -m "feat: ユニット固有アビリティを追加"
```

### Task 3: 戦闘、戦闘不能、復活への統合

**Files:**
- Modify: `src/client/src/game/core/types.ts`
- Modify: `src/client/src/game/rules/gameSession.ts`
- Modify: `src/client/src/game/rules/gameSession.test.ts`
- Modify: `src/client/src/game/rules/unitSystem.ts`
- Modify: `src/client/src/game/rules/unitSystem.test.ts`
- Modify: `src/client/src/game/rules/resurrectionSystem.ts`
- Modify: `src/client/src/game/rules/resurrectionSystem.test.ts`

**Interfaces:**
- Consumes: Task 1と2の `tickAbilities`、`tryUseAbility`、`resetUnitAbilityState`、3つの実効値関数。
- Produces: `BattleCommand` の `{ commandType: "UseAbility"; team: "Player"; unitId: PlayerUnitId }` と、実際の戦闘ループへ統合された挙動。

- [ ] **Step 1: `UseAbility` とセッション更新の失敗テストを書く**

`gameSession.test.ts` で、SetupとCountdownでは無視、InProgressでは発動、tick 20秒でAPが増えることを検証する。

```ts
session.state.phase = "InProgress";
findUnit(session.state, "PlayerRanged").abilityAp = 2;
session.applyCommand({ commandType: "UseAbility", team: "Player", unitId: "PlayerRanged" });
assert.equal(findUnit(session.state, "PlayerRanged").masterRangeBoostRemainingSeconds, 20);
```

- [ ] **Step 2: 戦闘実効値の失敗テストを書く**

`unitSystem.test.ts` へ次の独立テストを追加する。

- 基礎射程外かつ1.5倍射程内のマスターが攻撃する。
- シーカー強化中のユニットが基礎攻撃力 `+10` のダメージを与える。
- キーパー付与範囲内の移動距離が基礎の1.5倍になる。
- 接敵中は `1.5 * contactSlowMultiplier` が適用される。
- 戦闘不能になったユニットのAPと時間制効果が0になる。

- [ ] **Step 3: 復活リセットの失敗テストを書く**

`resurrectionSystem.test.ts` の復活成功ケースで、復活前に全アビリティ状態へ非0値を設定し、復活後にすべて0であることを検証する。

```ts
unit.abilityAp = 2;
unit.abilityRecoverySeconds = 12;
unit.masterRangeBoostRemainingSeconds = 8;
unit.seekerAttackBoostRemainingSeconds = 7;
assert.equal(tryReviveUnit(state, config, "Player", unit.unitId, target), true);
assert.equal(unit.abilityAp, 0);
assert.equal(unit.masterRangeBoostRemainingSeconds, 0);
```

- [ ] **Step 4: 失敗を確認する**

Run: `npm.cmd test -w src/client -- --test-name-pattern="UseAbility|実効射程|実効攻撃力|速度強化|アビリティ状態"`

Expected: コマンド分岐と戦闘統合がないためFAIL。

- [ ] **Step 5: セッションへ統合する**

`BattleCommand` へ `UseAbility` を追加する。`GameSession.applyCommand` は `team === "Player"` かつ `phase === "InProgress"` のときだけ `tryUseAbility` を呼ぶ。`GameSession.tick` はInProgress分岐内で `tickAbilities` を呼び、APと残り時間を更新する。

```ts
case "UseAbility":
  if (command.team === "Player" && this.state.phase === "InProgress") {
    tryUseAbility(this.state, this.config, command.unitId);
  }
  break;
```

- [ ] **Step 6: 移動と戦闘へ実効値を統合する**

`tickMovement` の速度は次の積に置き換える。

```ts
const contactMultiplier = hasEnemyContact(state, config, unit)
  ? config.contactSlowMultiplier
  : 1;
const moveSpeed = unit.stats.moveSpeed
  * effectiveMoveSpeedMultiplier(state, config, unit)
  * contactMultiplier;
```

攻撃対象の射程判定は `effectiveAttackRange(unit)`、ダメージ計算は `effectiveAttackDamage(unit)` を基礎にし、エレメント倍率だけ既存どおり後から乗算する。

- [ ] **Step 7: 戦闘不能と復活へリセットを統合する**

`defeatUnit` と `tryReviveUnit` から `resetUnitAbilityState(unit)` を呼ぶ。戦闘不能時点と復活成功時点の両方で明示的に初期化する。

- [ ] **Step 8: 対象テストと全クライアントテストを通す**

Run: `npm.cmd test -w src/client -- --test-name-pattern="UseAbility|実効射程|実効攻撃力|速度強化|アビリティ状態"`

Expected: PASS。

Run: `npm.cmd test -w src/client`

Expected: PASS。

- [ ] **Step 9: コミットする**

```powershell
git add src/client/src/game/core/types.ts src/client/src/game/rules/gameSession.ts src/client/src/game/rules/gameSession.test.ts src/client/src/game/rules/unitSystem.ts src/client/src/game/rules/unitSystem.test.ts src/client/src/game/rules/resurrectionSystem.ts src/client/src/game/rules/resurrectionSystem.test.ts
git commit -m "feat: アビリティを戦闘ループへ統合"
```

### Task 4: HUDのアビリティボタンとAP表示

**Files:**
- Modify: `src/client/src/game/ui/battleLayout.ts`
- Modify: `src/client/src/game/ui/battleLayout.test.ts`
- Modify: `src/client/src/game/ui/battleHudModel.ts`
- Modify: `src/client/src/game/ui/battleHudModel.test.ts`
- Modify: `src/client/src/game/ui/battleHud.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**
- Consumes: `abilityApCost` と `canUseAbility`。
- Produces: `abilityButtonTextureKey`、`BattleLayout.abilityButton`、`BattleHudCallbacks.onAbility`、`BattleHudModel.abilityGauge`、`BattleHudModel.canUseAbility`。

- [ ] **Step 1: レイアウトの失敗テストを書く**

`battleLayout.test.ts` の既存期待値を、build `y:69`、ability `y:129`、summon `y:189`、retry `y:249` へ更新する。`isPointInHud` がability領域を含むことも検証する。

```ts
assert.deepEqual(layout.abilityButton, { x: 591.6, y: 129, width: 52, height: 52 });
assert.deepEqual(layout.summonButton, { x: 591.6, y: 189, width: 52, height: 52 });
assert.equal(isPointInHud(layout, 600, 140), true);
```

- [ ] **Step 2: HUDモデルの失敗テストを書く**

未選択、AP途中、満タン、戦闘不能、建築中、キーパー対象0、キーパー対象ありを検証する。建築中でも有効であることを明示する。

```ts
selected.abilityAp = 1;
selected.abilityRecoverySeconds = 10;
const charging = createBattleHudModel(state, selected.unitId, true, false);
assert.deepEqual(charging.abilityGauge, { text: "AP 1 / 2", ratio: 0.75 });
assert.equal(charging.canUseAbility, false);
```

満タン時のratioは1、未選択時のtextは `"AP - / -"`、ratioは0とする。第4引数 `canUseSelectedAbility` はSceneがルール層から渡す。

- [ ] **Step 3: 失敗を確認する**

Run: `npm.cmd test -w src/client -- --test-name-pattern="abilityButton|AP表示|アビリティボタン"`

Expected: レイアウトとHUDモデルに項目がないためFAIL。

- [ ] **Step 4: レイアウトとHUDモデルを実装する**

`BattleLayout` とHUD領域へ `abilityButton` を追加する。`battleHudModel.ts` に次を追加する。

```ts
export const abilityButtonTextureKey = "hud-ability-button";

export type BattleHudModel = {
  // existing fields
  abilityGauge: HudGaugeModel;
  canUseAbility: boolean;
};
```

進捗ratioは `(currentAp + recoverySeconds / 20) / requiredAp` を0〜1へclampする。満タン時は1とする。
選択ユニットの利用可否は `mode === "Active"` に限定せず、`mode !== "Defeated" && currentHp > 0` として建築中も許可する。

- [ ] **Step 5: Phaser HUDへボタンと進捗を実装する**

`BattleHudCallbacks` に `onAbility` を追加する。`BattleHud` はability画像ボタンを生成し、ボタン下辺に高さ5pxの横ゲージと中央のAPテキストを重ねる。`applyModel` でゲージ、テキスト、活性状態を更新し、`destroy` ですべて破棄する。

```ts
this.abilityButton = this.createImageButton(
  layout.abilityButton,
  abilityButtonTextureKey,
  callbacks.onAbility
);
```

- [ ] **Step 6: 対象テストと型チェックを通す**

`BattleScene` で `/assets/buttons/ability_button.png` をプリロードし、HUD callbackへ `onAbility: () => this.handleAbility()` を渡す。`handleAbility` は `canUseAbility` を再確認して `UseAbility` コマンドを送り、HUD更新の第4引数へ同じ発動可否を渡す。

```ts
this.session.applyCommand({
  commandType: "UseAbility",
  team: "Player",
  unitId: this.selectedUnitId
});
```

Run: `npm.cmd test -w src/client -- --test-name-pattern="abilityButton|AP表示|アビリティボタン"`

Expected: PASS。

Run: `npm.cmd run typecheck -w src/client`

Expected: PASS。

- [ ] **Step 7: コミットする**

```powershell
git add src/client/src/game/ui/battleLayout.ts src/client/src/game/ui/battleLayout.test.ts src/client/src/game/ui/battleHudModel.ts src/client/src/game/ui/battleHudModel.test.ts src/client/src/game/ui/battleHud.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: HUDにアビリティ操作とAP表示を追加"
```

### Task 5: 発動前範囲・対象マークとScene配線

**Files:**
- Create: `src/client/src/game/render/abilityPresentation.ts`
- Create: `src/client/src/game/render/abilityPresentation.test.ts`
- Modify: `src/client/src/game/scenes/BattleScene.ts`

**Interfaces:**
- Consumes: `abilityArea`、`abilityTargets`、`abilityApCost` とTask 4で配線済みのScene・HUD。
- Produces: `abilityTargetingPresentation(state: BattleState, config: BattleConfig, selectedUnitId: PlayerUnitId | null): AbilityTargetingPresentation | null` と、実画面の黄色い範囲・円形／ロックオンマーク。

- [ ] **Step 1: 表示モデルの失敗テストを書く**

`abilityPresentation.test.ts` でAP不足と未選択はnull、満タンマスターは自身のCircleマークだけ、シーカーは範囲円とUnitのLockOn、キーパーは前方円とElementalのLockOnを返すことを検証する。

```ts
master.abilityAp = 2;
assert.deepEqual(
  abilityTargetingPresentation(state, config, "PlayerRanged"),
  {
    area: null,
    markers: [{ kind: "Circle", position: { ...master.position } }],
    color: 0xfacc15
  }
);
```

シーカーとキーパーでは `area.fillAlpha` を0.16、`area.strokeAlpha` を0.9とし、マーク色はすべて `0xfacc15` とする。

- [ ] **Step 2: 失敗を確認する**

Run: `npm.cmd test -w src/client -- --test-name-pattern="アビリティ対象表示"`

Expected: `abilityPresentation.ts` がないためFAIL。

- [ ] **Step 3: 表示モデルを実装する**

ルール層の範囲と対象IDを位置へ解決し、次の型で返す。AP満タンでない場合はnullとする。キーパー対象0でも範囲円は表示し、ボタンだけ無効にする。

```ts
export type AbilityTargetingPresentation = {
  area: { center: Vec2; radius: number; fillAlpha: number; strokeAlpha: number } | null;
  markers: Array<{ kind: "Circle" | "LockOn"; position: Vec2 }>;
  color: number;
};
```

- [ ] **Step 4: 範囲円と2種類のマークを描画する**

`draw()` でユニット・エレメント描画後、HPバーより前面の `battlefieldOverlay` へ表示する。areaはworld中心・半径をscreenへ変換してfill/strokeする。Circleは既存選択円と区別できる二重円、LockOnは四隅の短いL字線で描画する。表示モデルがnullなら何も描かない。

- [ ] **Step 5: 表示テスト、全テスト、型チェックを通す**

Run: `npm.cmd test -w src/client -- --test-name-pattern="アビリティ対象表示"`

Expected: PASS。

Run: `npm.cmd test -w src/client`

Expected: PASS。

Run: `npm.cmd run typecheck`

Expected: client、serverともPASS。

- [ ] **Step 6: コミットする**

```powershell
git add src/client/src/game/render/abilityPresentation.ts src/client/src/game/render/abilityPresentation.test.ts src/client/src/game/scenes/BattleScene.ts
git commit -m "feat: アビリティ範囲と対象マークを表示"
```

### Task 6: 最終回帰検証と実画面確認

**Files:**
- Modify only if verification exposes an ability-related defect: files already listed in Tasks 1-5 and their tests.

**Interfaces:**
- Consumes: Tasks 1-5の完成機能。
- Produces: 全自動検証と実画面確認を通過したアビリティ実装。

- [ ] **Step 1: クライアント全テストを新しく実行する**

Run: `npm.cmd test -w src/client`

Expected: 全テストPASS、失敗0。

- [ ] **Step 2: リポジトリ全体の型チェックを新しく実行する**

Run: `npm.cmd run typecheck`

Expected: client、serverともエラー0。

- [ ] **Step 3: リポジトリ全体をビルドする**

Run: `npm.cmd run build`

Expected: serverのTypeScriptビルドとclientのViteビルドが成功する。

- [ ] **Step 4: 実画面を確認する**

Run: `npm.cmd run dev:client -- --host 127.0.0.1`

ブラウザで次を確認する。

- エレメント作成、アビリティ、召喚、リトライの順にボタンが並ぶ。
- 選択ユニットごとに必要APが2、3、2と表示され、20秒ごとに増える。
- 満タンのシーカーとキーパーで半透明黄色範囲が表示される。
- マスターは自身へ円形、シーカーの味方とキーパー対象エレメントへロックオンマークが表示される。
- 発動後にAPが0となり、マスター20秒、シーカー15秒、キーパー永続付与が動作する。
- 戦闘不能と復活後にAPが0である。

- [ ] **Step 5: 検証で見つかった問題をテスト先行で修正する**

問題が見つかった場合は、再現する最小の `*.test.ts` を追加してFAILを確認し、Tasks 1-5で定義した責務のファイルだけを修正する。修正後はStep 1から再実行する。

- [ ] **Step 6: 最終差分を確認する**

Run: `git diff --check`

Expected: 空出力。

Run: `git status --short`

Expected: 意図したアビリティ関連ファイルだけが変更または追加されている。

- [ ] **Step 7: 検証修正がある場合だけコミットする**

```powershell
git add src/client/src/game
git commit -m "fix: アビリティ実画面検証の不具合を修正"
```

検証修正がない場合は追加コミットを作成しない。
