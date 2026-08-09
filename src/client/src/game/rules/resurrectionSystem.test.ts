import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader, findUnit } from "../core/battleState";
import {
  canReviveUnit,
  defeatedLevelTotal,
  mpRecoverySecondsForDefeatedLevel,
  recordLeaderDamageForMp,
  tickMpRecovery,
  tryReviveUnit
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

test("natural recovery keeps normalized progress when the defeated level changes", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  tickMpRecovery(state, config, 12.5);
  assert.equal(state.playerMp, 0);
  assert.equal(state.playerMpRecoveryProgress, 0.5);

  findUnit(state, "PlayerMelee").mode = "Defeated";
  tickMpRecovery(state, config, 6.5);

  assert.equal(state.playerMp, 0);
  assert(Math.abs(state.playerMpRecoveryProgress - 0.8421052631578947) < 1e-12);

  tickMpRecovery(state, config, 3);

  assert.equal(state.playerMp, 1);
  assert(Math.abs(state.playerMpRecoveryProgress) < 1e-12);
});

test("natural recovery restores multiple MP and keeps fractional progress for a large tick", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  tickMpRecovery(state, config, 62.5);

  assert.equal(state.playerMp, 2);
  assert.equal(state.playerMpRecoveryProgress, 0.5);
});

test("natural recovery ignores a negative delta without discarding existing progress", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.playerMpRecoveryProgress = 0.4;

  tickMpRecovery(state, config, -10);

  assert.equal(state.playerMp, 0);
  assert.equal(state.playerMpRecoveryProgress, 0.4);
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

test("leader damage reaching maximum MP discards natural recovery progress after revival", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  state.phase = "InProgress";
  state.playerMp = 9;
  state.playerMpRecoveryProgress = 0.9;
  unit.mode = "Defeated";
  unit.currentHp = 0;

  recordLeaderDamageForMp(state, config, "Player", 800);

  assert.equal(state.playerMp, 10);
  assert.equal(state.playerMpRecoveryProgress, 0);
  assert.equal(
    tryReviveUnit(state, config, "Player", unit.unitId, findLeader(state, "Player").position),
    true
  );
  assert.equal(state.playerMp, 7);
  assert.equal(state.playerMpRecoveryProgress, 0);
});

test("leader damage crossing multiple thresholds restores the matching amount of MP", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  recordLeaderDamageForMp(state, config, "Player", 2400);

  assert.equal(state.playerMp, 3);
  assert.equal(state.playerLeaderDamageProgress, 0);
});

test("MP3を消費して回復エリア内へ全HP復活しアビリティ状態をリセットする", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.mode = "Defeated";
  unit.currentHp = 0;
  unit.defeatedOrder = 1;
  unit.attackTimerSeconds = 0.25;
  unit.leaderAttackTimerSeconds = 0.75;
  unit.leaderHealingElapsedSeconds = 1;
  unit.restHealingElapsedSeconds = 1;
  unit.buildTimerSeconds = 3;
  unit.pendingElementalId = "Elemental1";
  unit.abilityAp = 2;
  unit.abilityRecoverySeconds = 12;
  unit.masterRangeBoostRemainingSeconds = 8;
  unit.seekerAttackBoostRemainingSeconds = 7;
  state.phase = "InProgress";
  state.playerMp = 3;
  const target = { ...findLeader(state, "Player").position };

  assert.equal(canReviveUnit(state, config, "Player", unit.unitId, target), true);
  assert.equal(tryReviveUnit(state, config, "Player", unit.unitId, target), true);
  assert.equal(state.playerMp, 0);
  assert.equal(unit.mode, "Active");
  assert.equal(unit.currentHp, unit.stats.maxHp);
  assert.deepEqual(unit.position, target);
  assert.deepEqual(unit.destination, target);
  assert.equal(unit.defeatedOrder, null);
  assert.equal(unit.attackTimerSeconds, 0);
  assert.equal(unit.leaderAttackTimerSeconds, 0);
  assert.equal(unit.leaderHealingElapsedSeconds, 0);
  assert.equal(unit.restHealingElapsedSeconds, 0);
  assert.equal(unit.buildTimerSeconds, 0);
  assert.equal(unit.pendingElementalId, null);
  assert.equal(unit.abilityAp, 0);
  assert.equal(unit.abilityRecoverySeconds, 0);
  assert.equal(unit.masterRangeBoostRemainingSeconds, 0);
  assert.equal(unit.seekerAttackBoostRemainingSeconds, 0);
});

test("MP不足ではMPを消費しない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.mode = "Defeated";
  unit.currentHp = 0;
  state.phase = "InProgress";
  state.playerMp = 2;

  assert.equal(tryReviveUnit(state, config, "Player", unit.unitId, findLeader(state, "Player").position), false);
  assert.equal(state.playerMp, 2);
  assert.equal(unit.mode, "Defeated");
});

test("回復エリア外ではMPを消費しない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.mode = "Defeated";
  unit.currentHp = 0;
  state.phase = "InProgress";
  state.playerMp = 3;

  assert.equal(tryReviveUnit(state, config, "Player", unit.unitId, { x: 0, y: 0 }), false);
  assert.equal(state.playerMp, 3);
  assert.equal(unit.mode, "Defeated");
});

test("生存中のユニットは復活できない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  state.phase = "InProgress";
  state.playerMp = 3;

  assert.equal(tryReviveUnit(state, config, "Player", unit.unitId, findLeader(state, "Player").position), false);
  assert.equal(state.playerMp, 3);
  assert.equal(unit.mode, "Active");
});

test("別チームのユニットは復活できない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.mode = "Defeated";
  unit.currentHp = 0;
  state.phase = "InProgress";
  state.cpuMp = 3;

  assert.equal(tryReviveUnit(state, config, "Cpu", unit.unitId, findLeader(state, "Cpu").position), false);
  assert.equal(state.cpuMp, 3);
  assert.equal(unit.mode, "Defeated");
});

test("戦場外では復活できない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.mode = "Defeated";
  unit.currentHp = 0;
  state.phase = "InProgress";
  state.playerMp = 3;
  const target = { x: findLeader(state, "Player").position.x, y: config.battlefieldMin.y - 0.1 };

  assert.equal(canReviveUnit(state, config, "Player", unit.unitId, target), false);
  assert.equal(tryReviveUnit(state, config, "Player", unit.unitId, target), false);
  assert.equal(state.playerMp, 3);
  assert.equal(unit.mode, "Defeated");
});

for (const [label, target] of [
  ["戦場境界", { x: 0, y: -4.5 }],
  ["回復半径ちょうど", { x: 2, y: -4.1 }]
] as const) {
  test(`${label}では復活できる`, () => {
    const config = createDefaultBattleConfig();
    const state = createDefaultBattleState(config);
    const unit = findUnit(state, "PlayerMelee");
    unit.mode = "Defeated";
    unit.currentHp = 0;
    state.phase = "InProgress";
    state.playerMp = 3;

    assert.equal(canReviveUnit(state, config, "Player", unit.unitId, target), true);
  });
}

test("Setup中と試合終了後は復活できない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  const target = { ...findLeader(state, "Player").position };
  unit.mode = "Defeated";
  unit.currentHp = 0;
  state.playerMp = 3;

  assert.equal(canReviveUnit(state, config, "Player", unit.unitId, target), false);
  assert.equal(tryReviveUnit(state, config, "Player", unit.unitId, target), false);

  state.phase = "InProgress";
  state.result = "CpuWin";

  assert.equal(canReviveUnit(state, config, "Player", unit.unitId, target), false);
  assert.equal(tryReviveUnit(state, config, "Player", unit.unitId, target), false);
  assert.equal(state.playerMp, 3);
  assert.equal(unit.mode, "Defeated");
});
