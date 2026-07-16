import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findUnit } from "../core/battleState";
import type { BattleState, ElementalId, TeamId } from "../core/types";
import {
  completedElementalsForTeam,
  countCompletedElementals,
  removeDestroyedElementals,
  tickElementalBuilds,
  tryBeginElementalBuild
} from "./elementalSystem";

test("active units can begin elemental builds", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(tryBeginElementalBuild(state, config, "PlayerMelee"), true);
  const unit = findUnit(state, "PlayerMelee");
  assert.equal(unit.mode, "BuildingElemental");
  assert.equal(unit.pendingElementalId, "Elemental1");
});

test("completed builds create an elemental at the unit position", () => {
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

test("non-active or dead units cannot begin elemental builds", () => {
  const config = createDefaultBattleConfig();
  const defeatedState = createDefaultBattleState(config);
  const defeatedUnit = findUnit(defeatedState, "PlayerMelee");
  defeatedUnit.mode = "Defeated";

  assert.equal(tryBeginElementalBuild(defeatedState, config, "PlayerMelee"), false);
  assert.equal(defeatedUnit.pendingElementalId, null);

  const deadState = createDefaultBattleState(config);
  const deadUnit = findUnit(deadState, "PlayerMelee");
  deadUnit.currentHp = 0;

  assert.equal(tryBeginElementalBuild(deadState, config, "PlayerMelee"), false);
  assert.equal(deadUnit.pendingElementalId, null);
});

test("elemental cap includes pending builds", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addElemental(state, "Elemental1", "Player", 120);
  addElemental(state, "Elemental2", "Player", 120);
  addElemental(state, "Elemental3", "Player", 120);

  assert.equal(tryBeginElementalBuild(state, config, "PlayerMelee"), true);
  assert.equal(findUnit(state, "PlayerMelee").pendingElementalId, "Elemental4");
  assert.equal(tryBeginElementalBuild(state, config, "PlayerSpeed"), false);
  assert.equal(findUnit(state, "PlayerSpeed").pendingElementalId, null);
});

test("multiple pending builds receive sequential elemental ids", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(tryBeginElementalBuild(state, config, "PlayerMelee"), true);
  assert.equal(tryBeginElementalBuild(state, config, "PlayerSpeed"), true);

  assert.equal(findUnit(state, "PlayerMelee").pendingElementalId, "Elemental1");
  assert.equal(findUnit(state, "PlayerSpeed").pendingElementalId, "Elemental2");
});

test("destroyed elementals are excluded from completed queries and removed", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addElemental(state, "Elemental1", "Player", 0);
  addElemental(state, "Elemental2", "Player", 120);

  assert.equal(countCompletedElementals(state, "Player"), 1);
  assert.deepEqual(
    completedElementalsForTeam(state, "Player").map((elemental) => elemental.elementalId),
    ["Elemental2"]
  );

  removeDestroyedElementals(state);

  assert.deepEqual(
    state.elementals.map((elemental) => elemental.elementalId),
    ["Elemental2"]
  );
});

test("destroyed elemental ids can be reused for new builds", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  addElemental(state, "Elemental1", "Player", 0);

  assert.equal(tryBeginElementalBuild(state, config, "PlayerMelee"), true);
  assert.equal(findUnit(state, "PlayerMelee").pendingElementalId, "Elemental1");
});

test("completed elemental positions are copied from units", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");

  tryBeginElementalBuild(state, config, "PlayerMelee");
  tickElementalBuilds(state, config, 5);
  unit.position.x = 99;
  unit.position.y = 99;

  assert.deepEqual(state.elementals[0].position, { x: -5, y: 1.5 });
});

test("partial ticks do not complete builds until enough time accumulates", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");

  tryBeginElementalBuild(state, config, "PlayerMelee");
  tickElementalBuilds(state, config, 2);

  assert.equal(unit.mode, "BuildingElemental");
  assert.equal(unit.buildTimerSeconds, 3);
  assert.equal(state.elementals.length, 0);

  tickElementalBuilds(state, config, 3);

  assert.equal(unit.mode, "Active");
  assert.equal(state.elementals.length, 1);
});

function addElemental(state: BattleState, elementalId: ElementalId, team: TeamId, currentHp: number): void {
  state.elementals.push({
    elementalId,
    team,
    position: { x: 0, y: 0 },
    maxHp: 120,
    currentHp,
    isComplete: true
  });
}
