import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { findLeader } from "../core/battleState";
import type { BattleCommand, ElementalId, UnitId, Vec2 } from "../core/types";
import { GameSession } from "../rules/gameSession";
import { tryExecuteSummon, tickSummonedUnits } from "../rules/summonSystem";
import { canReviveUnit } from "../rules/resurrectionSystem";
import { getSummonBeam, isCircleInBeam } from "@reijin-summon/shared/rules/summonGeometry";
import { createCpuBattleState, type CpuOpponentId } from "./cpuDeck";
import { createCpuPlannerMemory, planCpuCommands } from "./cpuPlanner";
import { cpuElementalDefenders } from "./cpuDefense";

function fixture(deck: CpuOpponentId) {
  const config = createDefaultBattleConfig();
  const state = createCpuBattleState(config, ["SC020"], "raphael", deck, () => 0);
  state.phase = "InProgress";
  for (const unit of state.units.filter(unit => unit.team === "Player")) {
    unit.mode = "Defeated"; unit.currentHp = 0;
  }
  const allies = state.units.filter(unit => unit.team === "Cpu");
  const memory = createCpuPlannerMemory();
  const session = new GameSession(config, state, () => .99);
  const plan = () => planCpuCommands(state, config, memory);
  const apply = (commands: BattleCommand[]) => commands.forEach(command => session.applyCommand(command));
  const addElemental = (position: Vec2, team: "Cpu" | "Player" = "Cpu") => {
    state.elementals.push({ elementalId: `Elemental${state.elementals.length + 1}` as ElementalId,
      position, team, isComplete: true, maxHp: 1000, currentHp: 1000 });
  };
  return { config, state, allies, memory, session, plan, apply, addElemental };
}

function moveFor(commands: BattleCommand[], id: UnitId) {
  return commands.find((command): command is Extract<BattleCommand, { commandType: "MoveUnit" }> =>
    command.commandType === "MoveUnit" && command.unitId === id);
}

for (const deck of ["deck1", "deck2", "deck3"] as const) {
  test(`${deck}: 自陣内の敵エレメントへ近い前衛を送り建築を中断する`, () => {
    const f = fixture(deck);
    const guard = f.allies.find(unit => unit.unitType !== "Ranged")!;
    const target = { x: 3, y: 1.5 };
    for (const ally of f.allies) ally.position = { x: -5, y: 3 };
    f.addElemental({ x: -3, y: 1 }); f.addElemental({ x: 3, y: 0 });
    f.addElemental(target, "Player");
    Object.assign(guard, { position: { x: 3, y: 2.5 }, mode: "BuildingElemental",
      pendingElementalId: "Elemental4", buildTimerSeconds: 5 });
    const commands = f.plan();
    assert.deepEqual(moveFor(commands, guard.unitId)?.targetPosition, target);
    f.apply(commands);
    assert.equal(guard.mode, "Active");
    assert.equal(guard.pendingElementalId, null);
  });

  test(`${deck}: 敵召喚獣へ攻撃した後はHP95%で離れ安全な場所で回復する`, () => {
    const f = fixture(deck);
    const guard = f.allies.find(unit => unit.unitType !== "Ranged")!;
    f.state.playerSummonGauge = 1;
    assert.equal(tryExecuteSummon(f.state, f.config, "Player"), true);
    f.state.summonedUnits[0].position = { x: 0, y: 1 };
    Object.assign(guard, { position: { x: 0, y: 1.7 }, destination: { x: 0, y: 1 },
      currentHp: guard.stats.maxHp * .95 });
    const commands = f.plan();
    assert.ok(f.memory.retreating.has(guard.unitId));
    assert.ok(Math.abs(moveFor(commands, guard.unitId)!.targetPosition.x) > .1, "敵の進路から側方へ離脱する");
    f.apply(commands);
    guard.position = { x: 1.8, y: findLeader(f.state, "Cpu").position.y };
    guard.destination = { ...guard.position };
    guard.currentHp = guard.stats.maxHp * .85;
    assert.equal(moveFor(f.plan(), guard.unitId), undefined);
    assert.ok(f.memory.retreating.has(guard.unitId));
    guard.currentHp = guard.stats.maxHp * .95;
    f.state.summonedUnits[0].position = { x: 0, y: -3 };
    f.plan();
    assert.ok(!f.memory.retreating.has(guard.unitId));
  });

  for (const summonId of ["raphael", "jackpot"] as const) {
    test(`${deck}: ${summonId} が召喚士を攻撃中も被弾しない場所へ復活する`, () => {
      const f = fixture(deck);
      const fallen = f.allies[0];
      Object.assign(fallen, { mode: "Defeated", currentHp: 0, defeatedOrder: 1 });
      f.state.cpuMp = 10;
      // レーザー型にも十分な召喚面積を用意する。
      f.addElemental({ x: -3, y: -2 }, "Player");
      f.addElemental({ x: 3, y: -2 }, "Player");
      f.state.playerSummonId = summonId; f.state.playerSummonGauge = 1;
      assert.equal(tryExecuteSummon(f.state, f.config, "Player"), true);
      const summon = f.state.summonedUnits[0];
      summon.position = { x: 0, y: 3.6 };
      const revive = f.plan().find(command => command.commandType === "ReviveUnit");
      assert.ok(revive?.commandType === "ReviveUnit");
      assert.ok(canReviveUnit(f.state, f.config, "Cpu", fallen.unitId, revive.targetPosition));
      if (summonId === "jackpot") {
        assert.ok(!isCircleInBeam(revive.targetPosition, f.config.unitCollisionRadius,
          getSummonBeam(summon, f.state, f.config)));
      } else {
        assert.ok(Math.hypot(revive.targetPosition.x - summon.position.x, revive.targetPosition.y - summon.position.y) > .85);
      }
      f.apply([revive]);
      fallen.potentialProtectionSeconds = 0;
      tickSummonedUnits(f.state, f.config, .5);
      assert.equal(fallen.currentHp, fallen.stats.maxHp);
    });
  }

  test(`${deck}: 低HPの前衛も近接召喚獣へ正面から突入せず生存する`, () => {
    const f = fixture(deck);
    const guard = f.allies.filter(unit => unit.unitType !== "Ranged")
      .sort((left, right) => left.stats.maxHp - right.stats.maxHp)[0];
    for (const ally of f.allies.filter(unit => unit !== guard)) Object.assign(ally, { mode: "Defeated", currentHp: 0 });
    f.state.cpuMp = 0; f.state.playerSummonGauge = 1;
    assert.equal(tryExecuteSummon(f.state, f.config, "Player"), true);
    const summon = f.state.summonedUnits[0];
    summon.position = { x: 0, y: 0 }; summon.healthDecayPerSecond = 0;
    Object.assign(guard, { position: { x: 0, y: 3 }, destination: { x: 0, y: 0 } });
    f.apply(f.plan());
    assert.ok(f.memory.retreating.has(guard.unitId), "離脱できない火力なら接触する前に回避する");
    for (let step = 0; step < 250; step++) {
      if (step % 10 === 0) f.apply(f.plan());
      f.session.tick(.1);
      assert.ok(guard.currentHp > 0);
    }
  });
}

test("回復範囲が敵の攻撃で覆われている場合は復活のMPを温存する", () => {
  const f = fixture("deck1");
  for (const ally of f.allies) Object.assign(ally, { mode: "Defeated", currentHp: 0, defeatedOrder: 1 });
  const enemy = f.state.units.find(unit => unit.team === "Player")!;
  Object.assign(enemy, { mode: "Active", currentHp: enemy.stats.maxHp, position: { ...f.config.cpuLeaderPosition } });
  enemy.stats.attackRange = 10;
  f.state.cpuMp = 10;
  assert.ok(!f.plan().some(command => command.commandType === "ReviveUnit"));
  assert.equal(f.state.cpuMp, 10);
});

test("遠方の召喚獣だけでは通常のユニットを撤退させない", () => {
  const f = fixture("deck1");
  f.state.playerSummonGauge = 1;
  assert.equal(tryExecuteSummon(f.state, f.config, "Player"), true);
  const guard = f.allies[0];
  guard.currentHp = guard.stats.maxHp * .8;
  f.plan();
  assert.ok(!f.memory.retreating.has(guard.unitId));
});

test("召喚獣が召喚士へ進む途中でも撤退した騎兵が生存して回復する", () => {
  const f = fixture("deck1");
  const guard = f.allies.find(unit => unit.cardId === "SC009")!;
  for (const ally of f.allies.filter(unit => unit !== guard)) Object.assign(ally, { mode: "Defeated", currentHp: 0 });
  f.state.cpuMp = 0;
  f.state.playerSummonGauge = 1;
  assert.equal(tryExecuteSummon(f.state, f.config, "Player"), true);
  const summon = f.state.summonedUnits[0];
  summon.position = { x: 0, y: 1 };
  summon.healthDecayPerSecond = 0;
  Object.assign(guard, { position: { x: 0, y: 1.7 }, destination: { x: 0, y: 1 } });
  for (let step = 0; step < 300; step++) {
    if (step % 5 === 0) f.apply(f.plan());
    f.session.tick(.1);
    assert.ok(guard.currentHp > 0, "撤退方向で召喚獣の進路から外れて生存する");
  }
  assert.ok(guard.leaderHealingElapsedSeconds > 0 || guard.currentHp >= guard.stats.maxHp * .95, "安全な回復範囲に到達する");
});

test("敵陣の孤立したエレメントと破壊済みエレメントには防衛役を割り当てない", () => {
  const f = fixture("deck1");
  f.addElemental({ x: 5, y: -3 }, "Player");
  f.addElemental({ x: 3, y: 1 }, "Player");
  f.state.elementals[1].currentHp = 0;
  assert.equal(cpuElementalDefenders(f.state, f.config, f.memory.retreating).size, 0);
});

test("レーザー経路補正で通常攻撃の範囲内へ撤退しない", () => {
  const f = fixture("deck1");
  f.addElemental({ x: -3, y: -2 }, "Player"); f.addElemental({ x: 3, y: -2 }, "Player");
  f.state.playerSummonId = "jackpot"; f.state.playerSummonGauge = 1;
  assert.equal(tryExecuteSummon(f.state, f.config, "Player"), true);
  f.state.summonedUnits[0].position = { x: 0, y: -2 };
  const enemy = f.state.units.find(unit => unit.team === "Player")!;
  Object.assign(enemy, { mode: "Active", currentHp: enemy.stats.maxHp, position: { x: -1.762, y: 4.1 } });
  const guard = f.allies[0];
  Object.assign(guard, { position: { x: -2, y: 0 }, destination: { x: -2, y: 0 }, currentHp: guard.stats.maxHp * .3 });
  const goal = moveFor(f.plan(), guard.unitId)?.targetPosition ?? guard.destination;
  assert.ok(Math.hypot(goal.x - enemy.position.x, goal.y - enemy.position.y) > enemy.stats.attackRange);
});
