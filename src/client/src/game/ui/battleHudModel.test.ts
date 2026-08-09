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

  const model = createBattleHudModel(state, "PlayerMelee", false);

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

  const model = createBattleHudModel(state, null, false);

  assert.equal(model.playerHp.ratio, 0);
  assert.equal(model.cpuHp.ratio, 1);
  assert.equal(model.remainingTimeText, "0");
  assert.deepEqual(model.summonGauge, { text: "召喚ゲージ 100%", ratio: 1 });
});

test("味方MPを0から10の縦ゲージモデルへ整形する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.playerMp = 6;

  const model = createBattleHudModel(state, null, false);

  assert.deepEqual(model.mp, { text: "MP 6 / 10", ratio: 0.6 });
});

test("味方MPを0から10の表示範囲へ制限する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.playerMp = -2;
  assert.deepEqual(createBattleHudModel(state, null, false).mp, {
    text: "MP 0 / 10",
    ratio: 0
  });

  state.playerMp = 14;
  assert.deepEqual(createBattleHudModel(state, null, false).mp, {
    text: "MP 10 / 10",
    ratio: 1
  });
});

test("勝敗を日本語へ変換して戦闘中は空文字にする", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());

  assert.equal(createBattleHudModel(state, null, false).resultText, "");
  state.result = "PlayerWin";
  assert.equal(createBattleHudModel(state, null, false).resultText, "勝利");
  state.result = "CpuWin";
  assert.equal(createBattleHudModel(state, null, false).resultText, "敗北");
  state.result = "Draw";
  assert.equal(createBattleHudModel(state, null, false).resultText, "引き分け");
});

test("有効な選択ユニットと既存召喚判定をボタン状態へ反映する", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());

  state.phase = "InProgress";
  assert.equal(createBattleHudModel(state, "PlayerMelee", true).canBuild, true);
  assert.equal(createBattleHudModel(state, "PlayerMelee", true).canSummon, true);

  state.units.find((unit) => unit.unitId === "PlayerMelee")!.mode = "Defeated";
  assert.equal(createBattleHudModel(state, "PlayerMelee", true).canBuild, false);

  state.result = "CpuWin";
  const finished = createBattleHudModel(state, "PlayerSpeed", true);
  assert.equal(finished.canBuild, false);
  assert.equal(finished.canSummon, false);
});

test("Setup enables summon confirmation without allowing builds", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());

  const model = createBattleHudModel(state, "PlayerMelee", false);

  assert.equal(model.canBuild, false);
  assert.equal(model.canSummon, true);
  assert.equal(model.resultText, "");
});

test("Countdown disables controls and displays remaining seconds rounded up", () => {
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

test("Countdown prioritizes a completed result and disables both controls", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.phase = "Countdown";
  state.countdownRemainingSeconds = 4.01;
  state.result = "PlayerWin";

  const model = createBattleHudModel(state, "PlayerMelee", true);

  assert.equal(model.resultText, "勝利");
  assert.equal(model.canBuild, false);
  assert.equal(model.canSummon, false);
});

test("InProgress restores build and summon availability", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  state.phase = "InProgress";

  const model = createBattleHudModel(state, "PlayerMelee", true);

  assert.equal(model.canBuild, true);
  assert.equal(model.canSummon, true);
  assert.equal(model.resultText, "");
});

test("使用する画像キーはエレメント生成と召喚だけである", () => {
  assert.equal(elementButtonTextureKey, "hud-element-button");
  assert.equal(summonButtonTextureKey, "hud-summon-button");
  assert.equal(
    [elementButtonTextureKey, summonButtonTextureKey].some((key) => key.includes("skill")),
    false
  );
});
