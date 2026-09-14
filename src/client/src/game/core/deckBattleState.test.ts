import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBattleConfig } from "./battleConfig";
import { createDeckBattleState } from "./deckBattleState";
import { GameSession } from "../rules/gameSession";
import { tryReviveUnit } from "../rules/resurrectionSystem";

test("同兵種の別カードと敵味方の同じカードを独立して生成する", () => {
  const config = createDefaultBattleConfig();
  const state = createDeckBattleState(config, ["SC001", "SC002"], ["SC002"]);
  assert.deepEqual(state.units.map(u => [u.unitId, u.cardId, u.stats.maxHp, u.stats.attackDamage]), [
    ["Player:SC001", "SC001", 800, 31], ["Player:SC002", "SC002", 500, 18], ["Cpu:SC002", "SC002", 500, 18]
  ]);
  state.units[0].currentHp = 1;
  state.units[0].abilityAp = 2;
  assert.equal(state.units[1].currentHp, 500);
  assert.equal(state.units[1].abilityAp, 0);
  assert.equal(state.units[2].currentHp, 500);
});

test("1体から5体まで配置領域と間隔を満たし戦闘を開始できる", () => {
  const ids = ["SC002", "SC004", "SC007", "SC008", "SC010"];
  for (const count of [1, 3, 5]) {
    const config = createDefaultBattleConfig();
    const state = createDeckBattleState(config, ids.slice(0, count), ["SC020", "SC019", "SC014"]);
    const units = state.units.filter(u => u.team === "Player");
    assert.equal(units.length, count);
    for (const unit of units) {
      assert.ok(unit.position.y <= -config.initialPlacementMargin);
      assert.ok(unit.position.x >= config.battlefieldMin.x + config.initialPlacementMargin);
      assert.ok(unit.position.x <= config.battlefieldMax.x - config.initialPlacementMargin);
      for (const other of units.filter(u => u !== unit)) {
        assert.ok(Math.hypot(unit.position.x - other.position.x, unit.position.y - other.position.y) >= config.initialPlacementMinDistance);
      }
    }
    const session = new GameSession(config, state);
    session.applyCommand({ commandType: "StartBattle", team: "Player" });
    session.tick(5);
    assert.equal(state.phase, "InProgress");
    session.tick(300);
    assert.notEqual(state.result, "InProgress");
  }
});

test("カードのコストに応じたMPで復活し再戦用の状態へダメージが漏れない", () => {
  const config = createDefaultBattleConfig();
  const ids = ["SC002", "SC017"];
  const state = createDeckBattleState(config, ids, ["SC010"]);
  state.phase = "InProgress";
  state.playerMp = 5;
  for (const unit of state.units.filter(u => u.team === "Player")) { unit.mode = "Defeated"; unit.currentHp = 0; }
  assert.equal(tryReviveUnit(state, config, "Player", "Player:SC017", config.playerLeaderPosition), true);
  assert.equal(state.playerMp, 0);
  assert.equal(tryReviveUnit(state, config, "Player", "Player:SC002", config.playerLeaderPosition), false);
  const replay = createDeckBattleState(config, ids, ["SC010"]);
  assert.equal(replay.units[1].currentHp, 1400);
  assert.equal(replay.phase, "Setup");
  assert.equal(replay.playerMp, 0);
});

test("不正な編成を戦闘の入口で拒否する", () => {
  const config = createDefaultBattleConfig();
  for (const ids of [[], ["SC001", "SC001"], ["SC015", "SC016", "SC017"], ["SC999"]]) {
    assert.throws(() => createDeckBattleState(config, ids, ["SC010"]));
    assert.throws(() => createDeckBattleState(config, ["SC010"], ids));
  }
});
