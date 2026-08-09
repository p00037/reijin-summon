import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findUnit } from "../core/battleState";
import {
  abilityApCost,
  abilityArea,
  abilityTargets,
  canUseAbility,
  effectiveAttackDamage,
  effectiveAttackRange,
  effectiveMoveSpeedMultiplier,
  resetUnitAbilityState,
  tickAbilities,
  tryUseAbility
} from "./abilitySystem";

test("APは戦闘中のプレイヤーユニットに20秒ごとに蓄積され、2で上限になる", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.phase = "InProgress";

  tickAbilities(state, config, 19.9);
  assert.equal(findUnit(state, "PlayerRanged").abilityAp, 0);
  tickAbilities(state, config, 0.1);
  assert.equal(findUnit(state, "PlayerRanged").abilityAp, 1);
  assert.equal(findUnit(state, "PlayerRanged").abilityRecoverySeconds, 0);
  tickAbilities(state, config, 100);
  assert.equal(findUnit(state, "PlayerRanged").abilityAp, 2);
  assert.equal(findUnit(state, "PlayerSpeed").abilityAp, 3);
  assert.equal(findUnit(state, "PlayerRanged").abilityRecoverySeconds, 0);
  assert.equal(findUnit(state, "CpuRanged").abilityAp, 0);
});

test("APは戦闘フェーズ外と負の経過時間では蓄積されない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  tickAbilities(state, config, 20);
  state.phase = "InProgress";
  tickAbilities(state, config, -20);

  assert.equal(findUnit(state, "PlayerMelee").abilityAp, 0);
  assert.equal(findUnit(state, "PlayerMelee").abilityRecoverySeconds, 0);
});

test("戦闘中でも撃破済みまたはHPが0のプレイヤーユニットにはAPを蓄積しない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.phase = "InProgress";
  const defeatedUnit = findUnit(state, "PlayerMelee");
  const zeroHpUnit = findUnit(state, "PlayerSpeed");
  defeatedUnit.mode = "Defeated";
  zeroHpUnit.currentHp = 0;

  tickAbilities(state, config, 20);

  assert.deepEqual(
    { ap: defeatedUnit.abilityAp, progress: defeatedUnit.abilityRecoverySeconds },
    { ap: 0, progress: 0 }
  );
  assert.deepEqual(
    { ap: zeroHpUnit.abilityAp, progress: zeroHpUnit.abilityRecoverySeconds },
    { ap: 0, progress: 0 }
  );
});

test("ユニット種別ごとのAPコストとリセット状態を返す", () => {
  const unit = findUnit(createDefaultBattleState(createDefaultBattleConfig()), "PlayerRanged");
  unit.abilityAp = 2;
  unit.abilityRecoverySeconds = 10;
  unit.masterRangeBoostRemainingSeconds = 4;
  unit.seekerAttackBoostRemainingSeconds = 6;

  assert.equal(abilityApCost("Melee"), 2);
  assert.equal(abilityApCost("Speed"), 3);
  assert.equal(abilityApCost("Ranged"), 2);
  resetUnitAbilityState(unit);
  assert.deepEqual(
    {
      ap: unit.abilityAp,
      progress: unit.abilityRecoverySeconds,
      range: unit.masterRangeBoostRemainingSeconds,
      damage: unit.seekerAttackBoostRemainingSeconds
    },
    { ap: 0, progress: 0, range: 0, damage: 0 }
  );
});

test("マスターのアビリティは必要APでのみ20秒間射程を1.5倍にする", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const master = findUnit(state, "PlayerRanged");
  master.abilityAp = 1;

  assert.equal(abilityArea(state, config, master.unitId), null);
  assert.deepEqual(abilityTargets(state, config, master.unitId), { unitIds: [], elementalIds: [] });
  assert.equal(canUseAbility(state, config, "PlayerRanged"), false);
  assert.equal(tryUseAbility(state, config, "PlayerRanged"), false);
  assert.equal(master.abilityAp, 1);
  assert.equal(effectiveAttackRange(master), master.stats.attackRange);

  master.abilityAp = 2;
  assert.equal(canUseAbility(state, config, "PlayerRanged"), true);
  assert.equal(tryUseAbility(state, config, "PlayerRanged"), true);
  assert.equal(master.abilityAp, 0);
  assert.equal(master.abilityRecoverySeconds, 0);
  assert.equal(effectiveAttackRange(master), master.stats.attackRange * 1.5);
  tickAbilities(state, config, 19.9);
  assert.equal(effectiveAttackRange(master), master.stats.attackRange * 1.5);
  tickAbilities(state, config, 0.1);
  assert.equal(effectiveAttackRange(master), master.stats.attackRange);
});

test("シーカーのアビリティは境界内の生存味方へ15秒間だけ攻撃力を加算する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const seeker = findUnit(state, "PlayerSpeed");
  const keeper = findUnit(state, "PlayerMelee");
  const cpuKeeper = findUnit(state, "CpuMelee");
  const master = findUnit(state, "PlayerRanged");
  seeker.position = { x: 0, y: 0 };
  keeper.position = { x: config.unitCardWorldHeight * 1.5, y: 0 };
  cpuKeeper.position = { x: config.unitCardWorldHeight * 1.5, y: 0 };
  master.position = { x: 99, y: 99 };
  seeker.abilityAp = 3;

  assert.deepEqual(abilityArea(state, config, seeker.unitId), {
    center: { x: 0, y: 0 },
    radius: config.unitCardWorldHeight * 1.5
  });
  assert.deepEqual(abilityTargets(state, config, seeker.unitId), {
    unitIds: ["PlayerMelee", "PlayerSpeed"],
    elementalIds: []
  });
  assert.equal(tryUseAbility(state, config, "PlayerSpeed"), true);
  assert.equal(effectiveAttackDamage(seeker), seeker.stats.attackDamage + 10);
  assert.equal(effectiveAttackDamage(keeper), keeper.stats.attackDamage + 10);
  assert.equal(effectiveAttackDamage(cpuKeeper), cpuKeeper.stats.attackDamage);

  keeper.position = { x: 99, y: 99 };
  seeker.abilityAp = 3;
  assert.equal(tryUseAbility(state, config, "PlayerSpeed"), true);
  assert.equal(effectiveAttackDamage(keeper), keeper.stats.attackDamage + 10);
  tickAbilities(state, config, 15);
  assert.equal(effectiveAttackDamage(seeker), seeker.stats.attackDamage);
  assert.equal(effectiveAttackDamage(keeper), keeper.stats.attackDamage);
});

test("キーパーのアビリティは範囲内の完成済み味方エレメントにだけ速度オーラを付与する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const keeper = findUnit(state, "PlayerMelee");
  const seeker = findUnit(state, "PlayerSpeed");
  keeper.position = { x: 0, y: 0 };
  seeker.position = { x: config.unitCardWorldHeight * 2, y: config.unitCardWorldHeight };
  state.elementals = [
    {
      elementalId: "Elemental1",
      team: "Player",
      position: { x: config.unitCardWorldHeight / 2, y: config.unitCardWorldHeight },
      maxHp: 1000,
      currentHp: 1000,
      isComplete: true
    },
    {
      elementalId: "Elemental2",
      team: "Cpu",
      position: { x: config.unitCardWorldHeight / 2, y: config.unitCardWorldHeight },
      maxHp: 1000,
      currentHp: 1000,
      isComplete: true
    },
    {
      elementalId: "Elemental3",
      team: "Player",
      position: { x: config.unitCardWorldHeight / 2, y: config.unitCardWorldHeight },
      maxHp: 1000,
      currentHp: 1000,
      isComplete: false
    },
    {
      elementalId: "Elemental4",
      team: "Player",
      position: { x: config.unitCardWorldHeight / 2, y: config.unitCardWorldHeight * 2 },
      maxHp: 1000,
      currentHp: 1000,
      isComplete: true
    }
  ];
  keeper.abilityAp = 2;

  assert.deepEqual(abilityArea(state, config, keeper.unitId), {
    center: { x: 0, y: config.unitCardWorldHeight },
    radius: config.unitCardWorldHeight / 2
  });
  assert.deepEqual(abilityTargets(state, config, keeper.unitId), {
    unitIds: [],
    elementalIds: ["Elemental1"]
  });
  assert.equal(tryUseAbility(state, config, "PlayerMelee"), true);
  assert.equal(keeper.abilityAp, 0);
  assert.equal(state.elementals[0].hasKeeperSpeedAura, true);
  assert.equal(state.elementals[1].hasKeeperSpeedAura, undefined);
  assert.equal(state.elementals[2].hasKeeperSpeedAura, undefined);
  assert.equal(state.elementals[3].hasKeeperSpeedAura, undefined);
  assert.equal(effectiveMoveSpeedMultiplier(state, config, seeker), 1.5);

  state.elementals.push({
    elementalId: "Elemental5",
    team: "Player",
    position: { x: seeker.position.x + config.unitCardWorldHeight * 1.5, y: seeker.position.y },
    maxHp: 1000,
    currentHp: 1000,
    isComplete: true,
    hasKeeperSpeedAura: true
  });
  assert.equal(effectiveMoveSpeedMultiplier(state, config, seeker), 1.5);

  state.elementals = [];
  keeper.abilityAp = 2;
  assert.equal(tryUseAbility(state, config, "PlayerMelee"), false);
  assert.equal(keeper.abilityAp, 2);
});
