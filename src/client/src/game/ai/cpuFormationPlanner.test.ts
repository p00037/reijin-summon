import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { findLeader, findUnit } from "../core/battleState";
import { createDeckBattleState } from "../core/deckBattleState";
import type { BattleCommand, ElementalId, UnitId, Vec2 } from "../core/types";
import type { SummonId } from "../core/summonCatalog";
import { GameSession } from "../rules/gameSession";
import { tryExecuteSummon } from "../rules/summonSystem";
import { getSummonBeam, isCircleInBeam } from "@reijin-summon/shared/rules/summonGeometry";
import { avoidFormationBeams } from "./cpuFormationGeometry";
import { createCpuBattleState } from "./cpuDeck";
import { createCpuPlannerMemory, planCpuCommands } from "./cpuPlanner";

function fixture(summon: SummonId = "raphael") {
  const config = createDefaultBattleConfig();
  const state = createDeckBattleState(config, ["SC020", "SC019", "SC014"], ["SC014", "SC013", "SC003", "SC010"]);
  state.cpuSummonId = summon;
  state.phase = "InProgress";
  const positions: Record<string, Vec2> = {
    SC014: { x: -.8, y: 2.4 }, SC013: { x: .8, y: 2.4 },
    SC003: { x: -.9, y: .8 }, SC010: { x: .9, y: .8 }
  };
  const cpu = (id: string) => findUnit(state, `Cpu:${id}`);
  for (const [id, position] of Object.entries(positions)) Object.assign(cpu(id), { position: { ...position }, destination: { ...position } });
  const memory = createCpuPlannerMemory();
  const session = new GameSession(config, state, () => .99);
  const plan = () => planCpuCommands(state, config, memory);
  const apply = (commands: BattleCommand[]) => commands.forEach(command => session.applyCommand(command));
  const territory = (wide = false) => {
    state.elementals = (wide ? [{ x: -1.15, y: 1.6 }, { x: 1.15, y: 1.6 }, { x: -4.6, y: -.4 }, { x: 4.6, y: -.4 }]
      : [{ x: -1.15, y: 1.6 }, { x: 1.15, y: 1.6 }]).map((position, index) => ({
      elementalId: `Elemental${index + 1}` as ElementalId, team: "Cpu", position,
      maxHp: 1000, currentHp: 1000, isComplete: true, nation: "ScaleGuild", enchantments: []
    }));
  };
  return { config, state, cpu, memory, session, plan, apply, territory };
}

function moveFor(commands: BattleCommand[], id: UnitId) {
  return commands.find((command): command is Extract<BattleCommand, { commandType: "MoveUnit" }> =>
    command.commandType === "MoveUnit" && command.unitId === id);
}

test("アウインは複数基へ付与し、周辺の陣形で実際にゲージを回復する", () => {
  const f = fixture();
  f.territory();
  f.cpu("SC014").abilityAp = 4;
  const command = f.plan().find(c => c.commandType === "UseAbility" && c.unitId === "Cpu:SC014");
  assert.ok(command, "アウインが未強化のエレメンタルへ能力を使う");
  f.apply([command]);
  assert.ok(f.state.elementals.every(elemental => elemental.enchantments?.some(effect => effect.kind === "gauge")));
  f.session.tick(20);
  assert.ok(f.state.cpuSummonGauge >= .5, "重なる2基の周辺人数をゲージ回復へ生かす");
});

test("同じエレメンタルへの再付与でアウインとスペサルティンのAPを浪費しない", () => {
  const f = fixture();
  f.territory();
  for (const elemental of f.state.elementals) elemental.enchantments = [
    { kind: "gauge", elapsedSeconds: 5 }, { kind: "speed", elapsedSeconds: 0 }
  ];
  f.cpu("SC014").abilityAp = 4;
  f.cpu("SC003").abilityAp = 2;
  assert.ok(!f.plan().some(c => c.commandType === "UseAbility" && ["Cpu:SC014", "Cpu:SC003"].includes(c.unitId)));
});

test("スペサルティンはエレメンタルへ加速を付与する", () => {
  const f = fixture();
  f.territory();
  f.cpu("SC003").abilityAp = 2;
  f.apply(f.plan());
  assert.ok(f.state.elementals.every(elemental => elemental.enchantments?.some(effect => effect.kind === "speed")));
});

test("チェルミは撤退する前衛の方向を向いて加速する", () => {
  const f = fixture();
  f.territory();
  const singer = f.cpu("SC013"), guard = f.cpu("SC003");
  singer.position = { x: 2, y: 2 };
  singer.abilityAp = 2;
  guard.position = { x: 3, y: 2 };
  guard.currentHp = guard.stats.maxHp * .3;
  f.apply(f.plan());
  assert.equal(singer.abilityAp, 0);
  assert.ok(guard.abilityEffects.some(effect => effect.abilityId === "SC013"));
});

test("後衛2体は敵の射程内で停止して射撃する", () => {
  const f = fixture();
  f.territory(true);
  const enemy = findUnit(f.state, "Player:SC020");
  enemy.position = { x: 0, y: .3 };
  for (const id of ["SC014", "SC013"]) f.cpu(id).destination = { x: 0, y: -3 };
  f.apply(f.plan());
  assert.deepEqual(f.cpu("SC014").destination, f.cpu("SC014").position);
  assert.deepEqual(f.cpu("SC013").destination, f.cpu("SC013").position);
  f.session.tick(.1);
  for (const id of ["Cpu:SC014", "Cpu:SC013"]) assert.ok(f.state.recentAttackEvents.some(event => event.attackerUnitId === id));
});

test("前衛は射撃陣形に近づいた同じ敵を迎撃する", () => {
  const f = fixture();
  f.territory(true);
  const enemy = findUnit(f.state, "Player:SC019");
  enemy.position = { x: 0, y: .2 };
  const commands = f.plan();
  assert.deepEqual(moveFor(commands, "Cpu:SC003")?.targetPosition, enemy.position);
  assert.deepEqual(moveFor(commands, "Cpu:SC010")?.targetPosition, enemy.position);
});

test("前衛も撤退後は70%まで回復を続け、移動指示で回復を中断しない", () => {
  const f = fixture();
  f.territory(true);
  const guard = f.cpu("SC003"), leader = findLeader(f.state, "Cpu");
  guard.currentHp = guard.stats.maxHp * .35;
  f.apply(f.plan());
  assert.deepEqual(guard.destination, leader.position);
  guard.position = { ...leader.position };
  guard.currentHp = guard.stats.maxHp * .5;
  assert.equal(moveFor(f.plan(), guard.unitId), undefined);
  guard.currentHp = guard.stats.maxHp * .7;
  assert.ok(moveFor(f.plan(), guard.unitId));
});

test("活動中のユグドラシルは射撃陣形の近くで守る", () => {
  const f = fixture("yggdrasil");
  f.territory(true);
  f.state.cpuSummonGauge = 1;
  assert.equal(tryExecuteSummon(f.state, f.config, "Cpu"), true);
  const commands = f.plan();
  for (const id of ["SC003", "SC010"]) {
    const goal = moveFor(commands, f.cpu(id).unitId)?.targetPosition ?? f.cpu(id).destination;
    assert.ok(goal.y > -1.5, "停止型の召喚獣を置いて全員で突進しない");
  }
});

test("ジャックポットは味方を経路から退避させてから召喚する", () => {
  const f = fixture("jackpot");
  f.territory(true);
  f.state.cpuSummonGauge = 1;
  for (const unit of f.state.units.filter(unit => unit.team === "Player")) { unit.mode = "Defeated"; unit.currentHp = 0; }
  for (const unit of f.state.units.filter(unit => unit.team === "Cpu")) unit.position = { x: 0, y: 0 };
  const commands = f.plan();
  assert.ok(!commands.some(c => c.commandType === "Summon"), "召喚時のレーザーでも味方を傷つけない");
  assert.ok(commands.some(c => c.commandType === "MoveUnit"));
  f.apply(commands);
  f.session.tick(15);
  const next = f.plan();
  assert.ok(next.some(c => c.commandType === "Summon"), "退避後は召喚できる");
  const hpBefore = f.state.units.filter(unit => unit.team === "Cpu").map(unit => unit.currentHp);
  f.apply(next);
  assert.deepEqual(f.state.units.filter(unit => unit.team === "Cpu").map(unit => unit.currentHp), hpBefore);
  const summon = f.state.summonedUnits.find(summon => summon.team === "Cpu")!;
  assert.ok(f.state.units.filter(unit => unit.team === "Cpu").every(unit => !isCircleInBeam(unit.position, f.config.unitCollisionRadius, getSummonBeam(summon, f.state, f.config))));
});

test("アビリティのないレッドムーンには使用指示を出さない", () => {
  const f = fixture();
  f.cpu("SC010").abilityAp = 3;
  assert.ok(!f.plan().some(c => c.commandType === "UseAbility" && c.unitId === "Cpu:SC010"));
});

test("前衛は外周を生成中も1体を射手の護衛に残す", () => {
  const config = createDefaultBattleConfig();
  const state = createCpuBattleState(config, ["SC020", "SC019", "SC014"], "raphael", "deck3", () => 0);
  const session = new GameSession(config, state, () => .99), memory = createCpuPlannerMemory();
  state.phase = "InProgress";
  let sawBuild = false;
  for (let second = 0; second < 35; second++) {
    planCpuCommands(state, config, memory).forEach(command => session.applyCommand(command));
    const builders = state.units.filter(unit => unit.team === "Cpu" && unit.unitType === "Melee" && unit.mode === "BuildingElemental");
    assert.ok(builders.length <= 1);
    if (builders.length) {
      sawBuild = true;
      const guard = state.units.find(unit => unit.team === "Cpu" && unit.unitType === "Melee" && unit !== builders[0])!;
      assert.ok(Math.abs(guard.destination.x) < 2 && guard.destination.y > 0);
    }
    session.tick(1);
  }
  assert.ok(sawBuild);
});

test("後衛は敵召喚獣にも停止射撃し、接近されたら退避する", () => {
  const f = fixture();
  f.territory(true);
  f.state.playerSummonId = "bahamut";
  f.state.playerSummonGauge = 1;
  assert.equal(tryExecuteSummon(f.state, f.config, "Player"), true);
  const summon = f.state.summonedUnits.find(summon => summon.team === "Player")!;
  summon.position = { x: 0, y: .3 };
  f.cpu("SC014").destination = { x: 0, y: -3 };
  f.apply(f.plan());
  assert.deepEqual(f.cpu("SC014").destination, f.cpu("SC014").position);
  f.session.tick(.1);
  assert.ok(f.state.recentAttackEvents.some(event => event.attackerUnitId === "Cpu:SC014"));
  summon.position = { ...f.cpu("SC014").position };
  assert.deepEqual(moveFor(f.plan(), "Cpu:SC014")?.targetPosition, findLeader(f.state, "Cpu").position);
});

test("進軍型の召喚獣には前衛と後衛が追従する", () => {
  for (const id of ["raphael", "bahamut", "dullahan"] as const) {
    const f = fixture(id);
    f.territory(true);
    f.state.cpuSummonGauge = 1;
    assert.equal(tryExecuteSummon(f.state, f.config, "Cpu"), true);
    const summon = f.state.summonedUnits.find(summon => summon.team === "Cpu")!;
    summon.position = { x: 0, y: -1 };
    const commands = f.plan();
    assert.ok(moveFor(commands, "Cpu:SC003")!.targetPosition.y < -1);
    assert.ok(moveFor(commands, "Cpu:SC014")!.targetPosition.y < 2);
  }
});

test("瀕死時の復活型召喚ではMPを使わず仲間を復活させる", () => {
  for (const id of ["raphael", "dullahan"] as const) {
    const f = fixture(id);
    f.territory(true);
    f.state.cpuMp = 4;
    f.state.cpuSummonGauge = 1;
    findLeader(f.state, "Cpu").currentHp = findLeader(f.state, "Cpu").maxHp * .3;
    const fallen = f.cpu("SC014");
    Object.assign(fallen, { mode: "Defeated", currentHp: 0, defeatedOrder: 1 });
    const commands = f.plan();
    assert.ok(commands.some(command => command.commandType === "Summon"));
    assert.ok(!commands.some(command => command.commandType === "ReviveUnit"));
    f.apply(commands);
    assert.equal(f.state.cpuMp, 4);
    assert.ok(fallen.currentHp > 0 && fallen.mode === "Active");
  }
});

test("ジャックポットの初撃で勝てる場合は狭い陣地でも召喚する", () => {
  const f = fixture("jackpot");
  f.territory();
  f.state.cpuSummonGauge = 1;
  findLeader(f.state, "Player").currentHp = 250;
  for (const unit of f.state.units.filter(unit => unit.team === "Cpu")) unit.position.x = 3;
  const commands = f.plan();
  assert.ok(commands.some(command => command.commandType === "Summon"));
  f.apply(commands);
  assert.equal(findLeader(f.state, "Player").currentHp, 0);
});

test("レーザーを横切る移動を避け、退避先も回復範囲内に収める", () => {
  const config = createDefaultBattleConfig();
  const beam = { start: { x: 0, y: -2 }, end: { x: 0, y: 5 }, width: config.unitCollisionRadius * 2 };
  const start = { x: -2, y: 1 };
  const goal = avoidFormationBeams(start, { x: 2, y: 1 }, [beam], config);
  for (let step = 0; step <= 30; step++) {
    const t = step / 30;
    assert.ok(!isCircleInBeam({ x: start.x + (goal.x - start.x) * t, y: start.y + (goal.y - start.y) * t }, config.unitCollisionRadius, beam));
  }
  const healing = avoidFormationBeams(start, config.cpuLeaderPosition, [beam], config);
  assert.ok(!isCircleInBeam(healing, config.unitCollisionRadius, beam));
  assert.ok(Math.hypot(healing.x - config.cpuLeaderPosition.x, healing.y - config.cpuLeaderPosition.y) <= config.leaderHealingRadius);
});

test("レーザーの中からの撤退では、まず最短距離で横へ抜ける", () => {
  const config = createDefaultBattleConfig();
  const beam = { start: { x: 0, y: -2 }, end: { ...config.cpuLeaderPosition }, width: config.unitCollisionRadius * 2 };
  const start = { x: 0, y: 0 };
  const escape = avoidFormationBeams(start, config.cpuLeaderPosition, [beam], config);
  assert.ok(Math.hypot(escape.x, escape.y) < 2, "召喚士へレーザー内を縦断せず、近い側面から出る");
  assert.ok(!isCircleInBeam(escape, config.unitCollisionRadius, beam));
});

test("安全な立て直しではアウイン、緊急防衛では前衛を優先して復活する", () => {
  const f = fixture();
  for (const id of ["SC014", "SC003"]) Object.assign(f.cpu(id), { mode: "Defeated", currentHp: 0, defeatedOrder: 1 });
  f.state.cpuMp = 4;
  let revive = f.plan().find(c => c.commandType === "ReviveUnit");
  assert.ok(revive?.commandType === "ReviveUnit");
  assert.equal(revive.unitId, "Cpu:SC014");
  findUnit(f.state, "Player:SC020").position = { x: 0, y: 3 };
  revive = f.plan().find(c => c.commandType === "ReviveUnit");
  assert.ok(revive?.commandType === "ReviveUnit");
  assert.equal(revive.unitId, "Cpu:SC003");
});

test("全6種類で通常APから生成・強化・召喚が進み、試合が終了する", () => {
  const config = createDefaultBattleConfig();
  for (let index = 0; index < 6; index++) {
    const state = createCpuBattleState(config, ["SC020", "SC019", "SC014"], "raphael", "deck3", () => (index + .5) / 6);
    const session = new GameSession(config, state, () => .99), memory = createCpuPlannerMemory();
    state.phase = "InProgress";
    let maximumField = 0, enchantments = 0, summons = 0;
    for (let second = 0; second < 300 && state.result === "InProgress"; second++) {
      for (const command of planCpuCommands(state, config, memory)) {
        if (command.commandType === "Summon") summons++;
        if (command.commandType === "UseAbility" && command.unitId === "Cpu:SC014") enchantments++;
        session.applyCommand(command);
      }
      session.tick(1);
      const count = state.elementals.filter(e => e.team === "Cpu" && e.currentHp > 0).length;
      maximumField = Math.max(maximumField, count);
      assert.ok(count <= config.maxElementalsPerTeam);
    }
    assert.ok(maximumField >= 4 && enchantments >= 1 && summons >= 1,
      `${state.cpuSummonId}: 最大${maximumField}基・付与${enchantments}回・召喚${summons}回`);
    assert.notEqual(state.result, "InProgress");
  }
});
