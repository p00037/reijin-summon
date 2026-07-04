import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findUnit } from "../core/battleState";
import { tryBeginElementalBuild, tickElementalBuilds } from "./elementalSystem";

test("アクティブなユニットはエレメンタル生成を開始できる", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(tryBeginElementalBuild(state, config, "PlayerMelee"), true);
  const unit = findUnit(state, "PlayerMelee");
  assert.equal(unit.mode, "BuildingElemental");
  assert.equal(unit.pendingElementalId, "Elemental1");
});

test("生成時間が満了するとユニット位置にエレメンタルが完成する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  tryBeginElementalBuild(state, config, "PlayerMelee");
  tickElementalBuilds(state, config, 5);

  const unit = findUnit(state, "PlayerMelee");
  assert.equal(unit.mode, "Active");
  assert.equal(state.elementals.length, 1);
  assert.equal(state.elementals[0].elementalId, "Elemental1");
  assert.equal(state.elementals[0].team, "Player");
  assert.equal(state.elementals[0].currentHp, 120);
});
