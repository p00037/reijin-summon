import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findUnit } from "../core/battleState";
import { abilityApCost, resetUnitAbilityState, tickAbilities } from "./abilitySystem";

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
