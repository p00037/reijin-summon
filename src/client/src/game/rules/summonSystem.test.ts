import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findLeader } from "../core/battleState";
import { tryExecuteSummon, tickSummonCooldowns, tickSummonedUnits } from "./summonSystem";

test("完成済みエレメンタルが2つあれば召喚できる", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.elementals.push(
    { elementalId: "Elemental1", team: "Player", position: { x: -5, y: 0 }, maxHp: 120, currentHp: 120, isComplete: true },
    { elementalId: "Elemental2", team: "Player", position: { x: -4, y: 1 }, maxHp: 120, currentHp: 120, isComplete: true }
  );

  assert.equal(tryExecuteSummon(state, config, "Player"), true);
  assert.equal(state.summonedUnits.length, 1);
  assert.equal(state.playerSummonCooldownSeconds, 30);
  assert.deepEqual(state.summonedUnits[0].destination, { x: 7, y: 0 });
});

test("召喚ユニットは接触した敵リーダーへ継続ダメージを与える", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.summonedUnits.push({
    summonedUnitId: 1,
    team: "Player",
    position: { x: 7, y: 0 },
    destination: { x: 7, y: 0 },
    maxHp: 100,
    currentHp: 100,
    attackDamage: 135,
    moveSpeed: 1,
    healthDecayPerSecond: 10
  });

  tickSummonedUnits(state, config, 1);

  assert.equal(findLeader(state, "Cpu").currentHp, 865);
  assert.equal(state.summonedUnits[0].currentHp, 90);
});

test("クールダウンは0未満にならない", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.playerSummonCooldownSeconds = 1;
  tickSummonCooldowns(state, 2);
  assert.equal(state.playerSummonCooldownSeconds, 0);
});
