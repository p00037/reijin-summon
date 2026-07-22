import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findUnit } from "../core/battleState";
import type { BattleState, ElementalId, TeamId } from "../core/types";
import {
  canPlaceElementalAtUnit,
  completedElementalsForTeam,
  countCompletedElementals,
  removeDestroyedElementals,
  tickElementalBuilds,
  tryBeginElementalBuild
} from "./elementalSystem";

test("alive elementals from either team block placement within or on the placement radius", () => {
  const config = createDefaultBattleConfig();

  for (const team of ["Player", "Cpu"] as const) {
    const state = createDefaultBattleState(config);
    const unit = findUnit(state, "PlayerMelee");
    unit.position = { x: 0, y: 0 };
    addElementalAt(state, "Elemental1", team, 120, {
      x: config.elementalPlacementRadius,
      y: 0
    });

    assert.equal(canPlaceElementalAtUnit(state, config, "PlayerMelee"), false);
    assert.equal(tryBeginElementalBuild(state, config, "PlayerMelee"), false);
    assert.equal(unit.pendingElementalId, null);
  }
});

test("alive elementals outside the placement radius allow placement", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.position = { x: 0, y: 0 };
  addElementalAt(state, "Elemental1", "Cpu", 120, {
    x: config.elementalPlacementRadius + 0.001,
    y: 0
  });

  assert.equal(canPlaceElementalAtUnit(state, config, "PlayerMelee"), true);
});

test("destroyed elementals do not block placement", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const unit = findUnit(state, "PlayerMelee");
  unit.position = { x: 0, y: 0 };
  addElementalAt(state, "Elemental1", "Cpu", 0, { x: 0, y: 0 });

  assert.equal(canPlaceElementalAtUnit(state, config, "PlayerMelee"), true);
  assert.equal(tryBeginElementalBuild(state, config, "PlayerMelee"), true);
});

test("another living unit building an elemental reserves its position", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const melee = findUnit(state, "PlayerMelee");
  const speed = findUnit(state, "PlayerSpeed");
  speed.position = { ...melee.position };

  assert.equal(tryBeginElementalBuild(state, config, "PlayerSpeed"), true);
  assert.equal(canPlaceElementalAtUnit(state, config, "PlayerMelee"), false);
  assert.equal(tryBeginElementalBuild(state, config, "PlayerMelee"), false);
  assert.equal(melee.pendingElementalId, null);
});

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
  assert.equal(state.elementals[0].currentHp, 1000);
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
  addElemental(state, "Elemental4", "Player", 120);
  addElemental(state, "Elemental5", "Player", 120);

  assert.equal(tryBeginElementalBuild(state, config, "PlayerMelee"), true);
  assert.equal(findUnit(state, "PlayerMelee").pendingElementalId, "Elemental6");
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

test("both teams can build six elementals without exhausting shared ids", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  for (let index = 1; index <= 6; index += 1) {
    addElemental(state, `Elemental${index}` as ElementalId, "Cpu", 120);
  }

  assert.equal(tryBeginElementalBuild(state, config, "PlayerMelee"), true);
  assert.equal(tryBeginElementalBuild(state, config, "PlayerSpeed"), true);
  assert.equal(tryBeginElementalBuild(state, config, "PlayerRanged"), true);
  tickElementalBuilds(state, config, config.elementalBuildSeconds);
  for (const unit of state.units) {
    if (unit.team === "Player") {
      unit.position.y += 1;
    }
  }
  assert.equal(tryBeginElementalBuild(state, config, "PlayerMelee"), true);
  assert.equal(tryBeginElementalBuild(state, config, "PlayerSpeed"), true);
  assert.equal(tryBeginElementalBuild(state, config, "PlayerRanged"), true);
  tickElementalBuilds(state, config, config.elementalBuildSeconds);

  assert.equal(countCompletedElementals(state, "Cpu"), 6);
  assert.equal(countCompletedElementals(state, "Player"), 6);
  assert.deepEqual(
    completedElementalsForTeam(state, "Player").map((elemental) => elemental.elementalId),
    ["Elemental7", "Elemental8", "Elemental9", "Elemental10", "Elemental11", "Elemental12"]
  );
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

  assert.deepEqual(state.elementals[0].position, { x: -2.4, y: -3 });
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
  addElementalAt(state, elementalId, team, currentHp, { x: 0, y: 0 });
}

function addElementalAt(
  state: BattleState,
  elementalId: ElementalId,
  team: TeamId,
  currentHp: number,
  position: { x: number; y: number }
): void {
  state.elementals.push({
    elementalId,
    team,
    position,
    maxHp: 120,
    currentHp,
    isComplete: true
  });
}
