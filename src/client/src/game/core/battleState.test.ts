import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "./battleConfig";
import { createDefaultBattleState, findLeader, findUnit, getMpState, setMpState } from "./battleState";
import type { BattleCommand } from "./types";

test("既定状態は上下のリーダーと横一列に並ぶ各3体の通常ユニットを持つ", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(state.remainingSeconds, 300);
  assert.equal(state.phase, "Setup");
  assert.equal(state.countdownRemainingSeconds, 0);
  assert.equal(config.matchDurationSeconds, 300);
  assert.equal(config.countdownSeconds, 5);
  assert.equal(config.initialPlacementMargin, 0.6);
  assert.equal(config.initialPlacementMinDistance, 1.2);
  assert.equal(config.leaderMaxHp, 8000);
  assert.equal(state.leaders.length, 2);
  assert.equal(state.units.length, 6);
  assert.equal(findLeader(state, "Player").maxHp, 8000);
  assert.equal(findLeader(state, "Player").currentHp, 8000);
  assert.equal(findLeader(state, "Cpu").maxHp, 8000);
  assert.equal(findLeader(state, "Cpu").currentHp, 8000);
  assert.deepEqual(findLeader(state, "Player").position, { x: 0, y: -4.1 });
  assert.deepEqual(findLeader(state, "Cpu").position, { x: 0, y: 4.1 });
  assert.equal(findUnit(state, "PlayerMelee").unitType, "Melee");
  assert.deepEqual(findUnit(state, "PlayerMelee").position, { x: -2.4, y: -3 });
  assert.deepEqual(findUnit(state, "CpuRanged").position, { x: 2.4, y: 3 });
  assert.deepEqual(config.battlefieldMin, { x: -6.3, y: -4.5 });
  assert.deepEqual(config.battlefieldMax, { x: 6.3, y: 4.5 });
  assert.equal(config.statsByType.Ranged.moveSpeed, 8.2 / 32);
  assert.equal(config.statsByType.Melee.moveSpeed, 8.2 / 40);
  assert.equal(config.statsByType.Speed.moveSpeed, 8.2 / 22);
  assert.equal(config.elementalPlacementRadius, 0.30375);
  assert.equal(config.elementalContactRadius, 0.30375);
  assert.equal("contactSlowRadius" in config, false);
  assert.equal(config.unitCollisionRadius, 0.756);
  assert.equal(config.summonedUnitCollisionRadius, 0.9828);
  assert.equal(config.unitLeaderAttackIntervalSeconds, 1);
  assert.equal(config.summonedUnitAttackIntervalSeconds, 0.5);
  assert.equal(config.summonedUnitLeaderAttackIntervalSeconds, 2);
  assert.deepEqual(
    {
      Melee: config.statsByType.Melee,
      Speed: config.statsByType.Speed,
      Ranged: config.statsByType.Ranged
    },
    {
      Melee: {
        level: 3,
        revivalCost: 3,
        maxHp: 1100,
        moveSpeed: 8.2 / 40,
        attackDamage: 61,
        attackRange: 1.25,
        attackIntervalSeconds: 0.5,
        elementalBuildSeconds: 5.7,
        elementalAttackMultiplier: 2
      },
      Speed: {
        level: 3,
        revivalCost: 3,
        maxHp: 1060,
        moveSpeed: 8.2 / 22,
        attackDamage: 53,
        attackRange: 1,
        attackIntervalSeconds: 0.5,
        elementalBuildSeconds: 7.2,
        elementalAttackMultiplier: 1
      },
      Ranged: {
        level: 3,
        revivalCost: 3,
        maxHp: 1025,
        moveSpeed: 8.2 / 32,
        attackDamage: 36,
        attackRange: 3.5,
        attackIntervalSeconds: 0.5,
        elementalBuildSeconds: 6.7,
        elementalAttackMultiplier: 1
      }
    }
  );
  assert.equal(config.elementalMaxHp, 1000);
  assert.equal(config.leaderHealingIntervalSeconds, 2);
  assert.equal(config.leaderHealingPercent, 0.1);
  assert.equal(config.keeperRestHealingIntervalSeconds, 1.5);
  assert.equal(config.keeperRestHealingAmount, 60);
  assert.equal(config.unitCardWorldHeight, 2.25);
  assert.equal(findUnit(state, "PlayerMelee").leaderHealingElapsedSeconds, 0);
  assert.equal(findUnit(state, "PlayerMelee").restHealingElapsedSeconds, 0);
  assert.equal(findUnit(state, "PlayerMelee").attackTimerSeconds, 0);
  assert.equal(findUnit(state, "PlayerMelee").leaderAttackTimerSeconds, 0);
  const master = findUnit(state, "PlayerRanged");
  assert.deepEqual(
    {
      ap: master.abilityAp,
      progress: master.abilityRecoverySeconds,
      range: master.masterRangeBoostRemainingSeconds,
      damage: master.seekerAttackBoostRemainingSeconds
    },
    { ap: 0, progress: 0, range: 0, damage: 0 }
  );
});

test("既定設定と既定状態は可変のステータス参照を共有しない", () => {
  const firstConfig = createDefaultBattleConfig();
  const secondConfig = createDefaultBattleConfig();

  firstConfig.statsByType.Melee.maxHp = 1;

  assert.equal(secondConfig.statsByType.Melee.maxHp, 1100);
  assert.equal(createDefaultBattleConfig().statsByType.Melee.maxHp, 1100);

  const firstState = createDefaultBattleState(createDefaultBattleConfig());
  const secondState = createDefaultBattleState(createDefaultBattleConfig());

  findUnit(firstState, "PlayerMelee").stats.maxHp = 1;

  assert.equal(findUnit(secondState, "PlayerMelee").stats.maxHp, 1100);

  const sameState = createDefaultBattleState(createDefaultBattleConfig());

  findUnit(sameState, "PlayerMelee").stats.maxHp = 1;

  assert.equal(findUnit(sameState, "CpuMelee").stats.maxHp, 1100);
});

const validPlayerMoveCommand: BattleCommand = {
  commandType: "MoveUnit",
  team: "Player",
  unitId: "PlayerMelee",
  targetPosition: { x: 0, y: 0 }
};

const validCpuBuildCommand: BattleCommand = {
  commandType: "BeginElementalBuild",
  team: "Cpu",
  unitId: "CpuRanged"
};

const validSummonCommand: BattleCommand = {
  commandType: "Summon",
  team: "Cpu"
};

const validInitialPlacementCommand: BattleCommand = {
  commandType: "PlaceInitialUnit",
  team: "Player",
  unitId: "PlayerMelee",
  targetPosition: { x: -4, y: -2 }
};

const validStartBattleCommand: BattleCommand = {
  commandType: "StartBattle",
  team: "Player"
};

assert.equal(validPlayerMoveCommand.team, "Player");
assert.equal(validCpuBuildCommand.team, "Cpu");
assert.equal(validSummonCommand.commandType, "Summon");
assert.equal(validInitialPlacementCommand.commandType, "PlaceInitialUnit");
assert.equal(validStartBattleCommand.commandType, "StartBattle");

const invalidPlayerMoveCommand: BattleCommand = {
  commandType: "MoveUnit",
  team: "Player",
  // @ts-expect-error Player commands cannot target Cpu units.
  unitId: "CpuMelee",
  targetPosition: { x: 0, y: 0 }
};

const invalidCpuBuildCommand: BattleCommand = {
  commandType: "BeginElementalBuild",
  team: "Cpu",
  // @ts-expect-error Cpu commands cannot build with Player units.
  unitId: "PlayerRanged"
};

assert.equal(invalidPlayerMoveCommand.commandType, "MoveUnit");
assert.equal(invalidCpuBuildCommand.commandType, "BeginElementalBuild");

test("初期状態のMPはすべてゼロで、全ユニットのLVとCOSTは3である", () => {
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

test("チーム別MPアクセサーは対象チームの状態だけを更新する", () => {
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
