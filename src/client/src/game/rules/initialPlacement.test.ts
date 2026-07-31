import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findUnit } from "../core/battleState";
import type { UnitId } from "../core/types";
import { tryPlaceInitialUnit } from "./initialPlacement";

test("プレイヤーユニットを許可範囲へ配置して現在位置と復帰位置と移動先を更新する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(
    tryPlaceInitialUnit(state, config, "PlayerMelee", { x: -4, y: -2 }),
    true
  );
  const unit = findUnit(state, "PlayerMelee");
  assert.deepEqual(unit.position, { x: -4, y: -2 });
  assert.deepEqual(unit.spawnPosition, { x: -4, y: -2 });
  assert.deepEqual(unit.destination, { x: -4, y: -2 });
});

test("戦場外と敵陣側と中央境界線より上への配置を拒否する", () => {
  const config = createDefaultBattleConfig();

  for (const target of [
    { x: -6, y: -2 },
    { x: 0, y: 1 },
    { x: 0, y: -0.5 }
  ]) {
    const state = createDefaultBattleState(config);
    assert.equal(
      tryPlaceInitialUnit(state, config, "PlayerMelee", target),
      false
    );
    assert.deepEqual(findUnit(state, "PlayerMelee").position, { x: -2.4, y: -3 });
  }
});

test("他のプレイヤーユニットと最小中心間隔未満になる配置を拒否する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(
    tryPlaceInitialUnit(state, config, "PlayerMelee", { x: 0.5, y: -3 }),
    false
  );
  assert.deepEqual(findUnit(state, "PlayerMelee").position, { x: -2.4, y: -3 });
});

test("CPUユニットの配置を拒否する", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(
    tryPlaceInitialUnit(state, config, "CpuMelee", { x: -4, y: -2 }),
    false
  );
  assert.deepEqual(findUnit(state, "CpuMelee").position, { x: -2.4, y: 3 });
});

test("存在しないユニットIDを配置して状態を変更しない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  const positionsBefore = state.units.map((unit) => ({ ...unit.position }));

  assert.equal(
    tryPlaceInitialUnit(
      state,
      config,
      "MissingUnit" as UnitId,
      { x: -4, y: -2 }
    ),
    false
  );
  assert.deepEqual(
    state.units.map((unit) => unit.position),
    positionsBefore
  );
});
