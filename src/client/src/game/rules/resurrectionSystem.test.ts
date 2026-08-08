import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findUnit } from "../core/battleState";
import {
  defeatedLevelTotal,
  mpRecoverySecondsForDefeatedLevel,
  recordLeaderDamageForMp,
  tickMpRecovery
} from "./resurrectionSystem";

const expectedSeconds = [25, 24, 21, 19, 16, 13, 9, 5, 4, 3, 3];

for (const [level, seconds] of expectedSeconds.entries()) {
  test(`defeated level ${level} restores 1 MP in ${seconds} seconds`, () => {
    assert.equal(mpRecoverySecondsForDefeatedLevel(level), seconds);
  });
}

test("defeated level total includes only defeated units on the requested team", () => {
  const state = createDefaultBattleState(createDefaultBattleConfig());
  findUnit(state, "PlayerMelee").mode = "Defeated";
  findUnit(state, "PlayerSpeed").mode = "Defeated";
  findUnit(state, "CpuMelee").mode = "Defeated";

  assert.equal(defeatedLevelTotal(state, "Player"), 6);
  assert.equal(defeatedLevelTotal(state, "Cpu"), 3);
});

test("natural recovery keeps accrued progress when the defeated level changes", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  tickMpRecovery(state, config, 12.5);
  findUnit(state, "PlayerMelee").mode = "Defeated";
  tickMpRecovery(state, config, 9.5);

  assert.equal(state.playerMp, 1);
  assert.equal(state.playerMpRecoveryProgress, 0);
});

test("natural recovery resets progress after reaching maximum MP", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.playerMp = 9;
  state.playerMpRecoveryProgress = 0.9;

  tickMpRecovery(state, config, 100);

  assert.equal(state.playerMp, 10);
  assert.equal(state.playerMpRecoveryProgress, 0);
});

test("natural recovery reaching maximum MP resets existing leader damage progress", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.playerMp = 9;
  state.playerLeaderDamageProgress = 799;

  tickMpRecovery(state, config, 25);

  assert.equal(state.playerMp, 10);
  assert.equal(state.playerLeaderDamageProgress, 0);
});

test("leader damage equal to 10 percent of maximum HP restores 1 MP", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  recordLeaderDamageForMp(state, config, "Player", 799);
  assert.equal(state.playerMp, 0);
  recordLeaderDamageForMp(state, config, "Player", 1);

  assert.equal(state.playerMp, 1);
  assert.equal(state.playerLeaderDamageProgress, 0);
});

test("leader damage recovery does not exceed maximum MP", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.cpuMp = 9;

  recordLeaderDamageForMp(state, config, "Cpu", 2400);

  assert.equal(state.cpuMp, 10);
  assert.equal(state.cpuLeaderDamageProgress, 0);
});

test("leader damage crossing multiple thresholds restores the matching amount of MP", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  recordLeaderDamageForMp(state, config, "Player", 2400);

  assert.equal(state.playerMp, 3);
  assert.equal(state.playerLeaderDamageProgress, 0);
});
