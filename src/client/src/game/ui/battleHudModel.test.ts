import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState } from "../core/battleState";
import {
  createBattleHudModel,
  elementButtonTextureKey,
  summonButtonTextureKey
} from "./battleHudModel";

test("HP・残り時間・召喚ゲージを日本語へ整形する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.leaders[0].currentHp = 1799.2;
  state.leaders[1].currentHp = 1650;
  state.remainingSeconds = 237.01;
  state.playerSummonGauge = 0.639;

  const model = createBattleHudModel(state, "PlayerMelee", false, false);

  assert.deepEqual(model.playerHp, {
    text: "自分 1800 / 8000",
    ratio: 1799.2 / 8000
  });
  assert.deepEqual(model.cpuHp, {
    text: "敵 1650 / 8000",
    ratio: 1650 / 8000
  });
  assert.equal(model.remainingTimeText, "238");
  assert.deepEqual(model.summonGauge, { text: "召喚ゲージ 63%", ratio: 0.639 });
});

test("HP・時間・召喚ゲージを表示範囲へ制限する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.leaders[0].currentHp = -10;
  state.leaders[1].currentHp = 9000;
  state.remainingSeconds = -0.2;
  state.playerSummonGauge = 1.4;

  const model = createBattleHudModel(state, null, false, false);

  assert.equal(model.playerHp.ratio, 0);
  assert.equal(model.cpuHp.ratio, 1);
  assert.equal(model.remainingTimeText, "0");
  assert.deepEqual(model.summonGauge, { text: "召喚ゲージ 100%", ratio: 1 });
});

test("味方MPを0から10の縦ゲージモデルへ整形する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.playerMp = 6;

  const model = createBattleHudModel(state, null, false, false);

  assert.deepEqual(model.mp, { text: "MP 6 / 10", ratio: 0.6 });
});

test("味方MPを0から10の表示範囲へ制限する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.playerMp = -2;
  assert.deepEqual(createBattleHudModel(state, null, false, false).mp, {
    text: "MP 0 / 10",
    ratio: 0
  });

  state.playerMp = 14;
  assert.deepEqual(createBattleHudModel(state, null, false, false).mp, {
    text: "MP 10 / 10",
    ratio: 1
  });
});

test("勝敗を日本語へ変換して戦闘中は空文字にする", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());

  assert.equal(createBattleHudModel(state, null, false, false).resultText, "");
  state.result = "PlayerWin";
  assert.equal(createBattleHudModel(state, null, false, false).resultText, "勝利");
  state.result = "CpuWin";
  assert.equal(createBattleHudModel(state, null, false, false).resultText, "敗北");
  state.result = "Draw";
  assert.equal(createBattleHudModel(state, null, false, false).resultText, "引き分け");
});

test("有効な選択ユニットと既存召喚判定をボタン状態へ反映する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());

  state.phase = "InProgress";
  assert.equal(createBattleHudModel(state, "PlayerMelee", true, false).canBuild, true);
  assert.equal(createBattleHudModel(state, "PlayerMelee", true, false).canSummon, true);

  state.units.find((unit) => unit.unitId === "PlayerMelee")!.mode = "Defeated";
  assert.equal(createBattleHudModel(state, "PlayerMelee", true, false).canBuild, false);

  state.result = "CpuWin";
  const finished = createBattleHudModel(state, "PlayerSpeed", true, false);
  assert.equal(finished.canBuild, false);
  assert.equal(finished.canSummon, false);
});

test("Setup enables summon confirmation without allowing builds", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());

  const model = createBattleHudModel(state, "PlayerMelee", false, false);

  assert.equal(model.canBuild, false);
  assert.equal(model.canSummon, true);
  assert.equal(model.resultText, "");
});

test("Countdown disables controls and displays remaining seconds rounded up", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.phase = "Countdown";
  state.countdownRemainingSeconds = 4.01;

  const model = createBattleHudModel(state, "PlayerMelee", true, false);

  assert.equal(model.canBuild, false);
  assert.equal(model.canSummon, false);
  assert.equal(model.resultText, "5");

  state.countdownRemainingSeconds = 0.01;
  assert.equal(createBattleHudModel(state, null, true, false).resultText, "1");
});

test("Countdown prioritizes a completed result and disables both controls", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.phase = "Countdown";
  state.countdownRemainingSeconds = 4.01;
  state.result = "PlayerWin";

  const model = createBattleHudModel(state, "PlayerMelee", true, false);

  assert.equal(model.resultText, "勝利");
  assert.equal(model.canBuild, false);
  assert.equal(model.canSummon, false);
});

test("InProgress restores build and summon availability", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.phase = "InProgress";

  const model = createBattleHudModel(state, "PlayerMelee", true, false);

  assert.equal(model.canBuild, true);
  assert.equal(model.canSummon, true);
  assert.equal(model.resultText, "");
});

test("既存ボタンの画像キーにskillという曖昧な名前を使わない", () => {
  assert.equal(elementButtonTextureKey, "hud-element-button");
  assert.equal(summonButtonTextureKey, "hud-summon-button");
  assert.equal(
    [elementButtonTextureKey, summonButtonTextureKey].some((key) => key.includes("skill")),
    false
  );
});

test("未選択時のAP表示は空状態でアビリティボタンを無効にする", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());

  const model = createBattleHudModel(state, null, false, true);

  assert.deepEqual(model.abilityGauge, { text: "AP - / -", ratio: 0 });
  assert.equal(model.canUseAbility, false);
});

test("AP表示は20秒単位の回復途中を加味する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  const selected = state.units.find((unit) => unit.unitId === "PlayerMelee")!;
  selected.abilityAp = 1;
  selected.abilityRecoverySeconds = 10;

  const charging = createBattleHudModel(state, "PlayerMelee", true, false);

  assert.deepEqual(charging.abilityGauge, { text: "AP 1 / 2", ratio: 0.75 });
  assert.equal(charging.canUseAbility, false);
});

test("満タン時のAP表示を上限1にしてSceneの発動可否を反映する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.phase = "InProgress";
  const selected = state.units.find((unit) => unit.unitId === "PlayerMelee")!;
  selected.abilityAp = 2;
  selected.abilityRecoverySeconds = 10;

  const ready = createBattleHudModel(state, "PlayerMelee", true, true);

  assert.deepEqual(ready.abilityGauge, { text: "AP 2 / 2", ratio: 1 });
  assert.equal(ready.canUseAbility, true);
});

test("戦闘不能ユニットはSceneが許可してもアビリティボタンを無効にする", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  const selected = state.units.find((unit) => unit.unitId === "PlayerMelee")!;
  selected.abilityAp = 2;
  selected.mode = "Defeated";

  const defeated = createBattleHudModel(state, "PlayerMelee", true, true);

  assert.equal(defeated.canUseAbility, false);
});

test("HPが0のユニットはSceneが許可してもアビリティボタンを無効にする", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  const selected = state.units.find((unit) => unit.unitId === "PlayerMelee")!;
  selected.abilityAp = 2;
  selected.currentHp = 0;

  const defeated = createBattleHudModel(state, "PlayerMelee", true, true);

  assert.equal(defeated.canUseAbility, false);
});

test("建築中もアビリティボタンを有効にするがエレメント作成は無効のままにする", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.phase = "InProgress";
  const selected = state.units.find((unit) => unit.unitId === "PlayerMelee")!;
  selected.abilityAp = 2;
  selected.mode = "BuildingElemental";

  const building = createBattleHudModel(state, "PlayerMelee", true, true);

  assert.equal(building.canUseAbility, true);
  assert.equal(building.canBuild, false);
});

test("キーパー対象の有無をScene判定からアビリティボタンへ反映する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.phase = "InProgress";
  const selected = state.units.find((unit) => unit.unitId === "PlayerMelee")!;
  selected.abilityAp = 2;

  assert.equal(
    createBattleHudModel(state, "PlayerMelee", true, false).canUseAbility,
    false
  );
  assert.equal(
    createBattleHudModel(state, "PlayerMelee", true, true).canUseAbility,
    true
  );
});

test("Countdown中は発動条件を満たしてもアビリティボタンを無効にする", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.phase = "Countdown";
  state.units.find((unit) => unit.unitId === "PlayerRanged")!.abilityAp = 2;

  const countdown = createBattleHudModel(state, "PlayerRanged", true, true);

  assert.equal(countdown.canUseAbility, false);
});

test("戦闘終了後は発動条件を満たしてもアビリティボタンを無効にする", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.phase = "InProgress";
  state.result = "PlayerWin";
  state.units.find((unit) => unit.unitId === "PlayerRanged")!.abilityAp = 2;

  const finished = createBattleHudModel(state, "PlayerRanged", true, true);

  assert.equal(finished.canUseAbility, false);
});
