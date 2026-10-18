import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { findLeader, findUnit } from "../core/battleState";
import { createDeckBattleState } from "../core/deckBattleState";
import type { BattleCommand, ElementalId, UnitId } from "../core/types";
import { GameSession } from "../rules/gameSession";
import { tryExecuteSummon } from "../rules/summonSystem";
import { createCpuPlannerMemory, planCpuCommands } from "./cpuPlanner";
import { createCpuBattleState } from "./cpuDeck";

function fixture() {
  const config = createDefaultBattleConfig();
  const state = createDeckBattleState(config, ["SC020", "SC019", "SC014"], ["SC015", "SC009", "SC004", "SC007"]);
  state.cpuSummonId = "yggdrasil";
  state.phase = "InProgress";
  const cpu = (id: string) => findUnit(state, `Cpu:${id}`);
  const session = new GameSession(config, state, () => .99);
  const memory = createCpuPlannerMemory();
  const plan = () => planCpuCommands(state, config, memory);
  const apply = (commands: BattleCommand[]) => commands.forEach(command => session.applyCommand(command));
  const territory = (wide = true) => {
    state.elementals = (wide ? [{ x: -4.5, y: -.5 }, { x: 4.5, y: -.5 }, { x: 0, y: -1 }]
      : [{ x: 0, y: 3 }, { x: .2, y: 3 }, { x: .4, y: 3 }]).map((position, index) => ({
      elementalId: `Elemental${index + 1}` as ElementalId, team: "Cpu", position,
      maxHp: 1000, currentHp: 1000, isComplete: true, nation: "ScaleGuild"
    }));
  };
  return { config, state, cpu, session, memory, plan, apply, territory };
}

function moveFor(commands: BattleCommand[], id: UnitId) {
  return commands.find((command): command is Extract<BattleCommand, { commandType: "MoveUnit" }> =>
    command.commandType === "MoveUnit" && command.unitId === id);
}

test("クリンの雨からレッドアイの加速、大津波まで同じ判断内で連携する", () => {
  const f = fixture();
  f.territory();
  for (const id of ["SC004", "SC009", "SC015"]) f.cpu(id).abilityAp = 3;
  f.cpu("SC015").position = { x: 0, y: 1 };
  const left = findUnit(f.state, "Player:SC020"), right = findUnit(f.state, "Player:SC019");
  left.position = { x: -1, y: 1 };
  right.position = { x: 1, y: 1 };
  const commands = f.plan();
  f.apply(commands);
  assert.equal(f.state.rainRemainingSeconds, 100);
  assert.ok(f.cpu("SC015").abilityEffects.some(effect => effect.abilityId === "SC009"));
  assert.ok(left.currentHp < left.stats.maxHp && right.currentHp < right.stats.maxHp);
  const abilities = commands.filter(c => c.commandType === "UseAbility").map(c => c.unitId);
  assert.ok(abilities.indexOf("Cpu:SC004") < abilities.indexOf("Cpu:SC009"));
  assert.ok(abilities.indexOf("Cpu:SC009") < abilities.indexOf("Cpu:SC015"));
});

test("雨が十分残る間はクリンのAPを保持し、終了直前に更新する", () => {
  const f = fixture();
  f.cpu("SC004").abilityAp = 3;
  f.state.rainRemainingSeconds = 60;
  assert.ok(!f.plan().some(c => c.commandType === "UseAbility" && c.unitId === "Cpu:SC004"));
  f.state.rainRemainingSeconds = 5;
  f.apply(f.plan());
  assert.equal(f.state.rainRemainingSeconds, 100);
  assert.equal(f.cpu("SC004").abilityAp, 0);
});

test("雨のAP不足時にはレッドアイのAPを保持する", () => {
  const f = fixture();
  f.cpu("SC004").abilityAp = 2;
  f.cpu("SC009").abilityAp = 3;
  f.apply(f.plan());
  assert.equal(f.state.rainRemainingSeconds, 0);
  assert.equal(f.cpu("SC009").abilityAp, 3);
});

test("大津波は健康な敵1体に温存し、撃破できる1体には使う", () => {
  const f = fixture();
  f.territory();
  const darius = f.cpu("SC015"), target = findUnit(f.state, "Player:SC020");
  darius.position = { x: 0, y: -.5 };
  darius.abilityAp = 3;
  target.position = { x: 0, y: -1 };
  for (const unit of f.state.units.filter(u => u.team === "Player" && u !== target)) {
    unit.mode = "Defeated"; unit.currentHp = 0;
  }
  assert.ok(!f.plan().some(c => c.commandType === "UseAbility" && c.unitId === darius.unitId));
  target.currentHp = 300;
  f.apply(f.plan());
  assert.equal(target.currentHp, 0);
  assert.equal(darius.abilityAp, 0);
});

test("大津波が届く敵の多い半面へダライアスを移動させる", () => {
  const f = fixture();
  f.territory();
  const darius = f.cpu("SC015");
  darius.position = { x: 0, y: 1 };
  darius.abilityAp = 3;
  const commands = f.plan();
  assert.ok(!commands.some(c => c.commandType === "UseAbility" && c.unitId === darius.unitId));
  const goal = moveFor(commands, darius.unitId)?.targetPosition;
  assert.ok(goal && goal.y < 0, "敵の集まる半面へ移動する");
});

test("現在の半面に2体いても、狙う半面の3体へ移動するまでは大津波を温存する", () => {
  const f = fixture();
  const other = createDeckBattleState(f.config, ["SC001", "SC002", "SC003", "SC004", "SC007"], ["SC015", "SC009", "SC004", "SC007"]);
  const targets = other.units.filter(unit => unit.team === "Player");
  targets.forEach((unit, index) => {
    unit.position = { x: index < 3 ? (index - 1) * 4 : (index === 3 ? -4 : 4), y: index < 3 ? -1 : .7 };
  });
  f.state.units = [...targets, ...f.state.units.filter(unit => unit.team === "Cpu")];
  f.territory();
  const darius = f.cpu("SC015");
  darius.position = { x: 0, y: .2 };
  darius.abilityAp = 3;
  const commands = f.plan();
  const goal = moveFor(commands, darius.unitId)?.targetPosition;
  assert.ok(goal && goal.y < 0);
  assert.ok(!commands.some(c => c.commandType === "UseAbility" && c.unitId === darius.unitId), "移動指示だけでは発動する半面は変わらない");
  darius.position = { x: 0, y: -.3 };
  f.apply(f.plan());
  assert.equal(darius.abilityAp, 0);
  assert.ok(targets.slice(0, 3).every(unit => unit.currentHp < unit.stats.maxHp));
  assert.ok(targets.slice(3).every(unit => unit.currentHp === unit.stats.maxHp));
});

test("クリンは射程内で停止して実際に射撃する", () => {
  const f = fixture();
  f.territory();
  const clerk = f.cpu("SC004"), target = findUnit(f.state, "Player:SC020");
  clerk.position = { x: 0, y: 2.5 };
  clerk.destination = { x: 0, y: -3 };
  target.position = { x: 0, y: .5 };
  f.apply(f.plan());
  assert.deepEqual(clerk.destination, clerk.position);
  f.session.tick(.1);
  assert.ok(target.currentHp < target.stats.maxHp);
});

test("クリンは敵に接近されたら後方へ離れる", () => {
  const f = fixture();
  f.territory();
  const clerk = f.cpu("SC004");
  clerk.position = { x: 0, y: 2 };
  findUnit(f.state, "Player:SC020").position = { x: 0, y: 1 };
  const goal = moveFor(f.plan(), clerk.unitId)?.targetPosition;
  assert.ok(goal && goal.y > clerk.position.y, "クリンを敵から離す");
});

test("クリンは敵召喚獣にも停止射撃し、接近されたら退避する", () => {
  const f = fixture();
  f.territory();
  const clerk = f.cpu("SC004");
  clerk.position = { x: 0, y: 2.5 };
  clerk.destination = { x: 3, y: 2.8 };
  f.cpu("SC015").position = { x: 3, y: 1 };
  f.state.rainRemainingSeconds = 60;
  f.state.playerSummonGauge = 1;
  assert.equal(tryExecuteSummon(f.state, f.config, "Player"), true);
  const enemy = f.state.summonedUnits.find(summon => summon.team === "Player")!;
  enemy.position = { x: 0, y: .5 };
  f.apply(f.plan());
  assert.deepEqual(clerk.destination, clerk.position);
  f.session.tick(.1);
  assert.ok(f.state.recentAttackEvents.some(event => event.attackerUnitId === clerk.unitId));
  enemy.position = { x: 0, y: 1.5 };
  const goal = moveFor(f.plan(), clerk.unitId)?.targetPosition;
  assert.ok(goal && goal.y > clerk.position.y, "接近した召喚獣から距離を取る");
});

test("ユグドラシルは密集した陣地では待機し、広い陣地なら召喚する", () => {
  const f = fixture();
  f.state.remainingSeconds = 100;
  f.state.cpuSummonGauge = 1;
  f.territory(false);
  assert.ok(!f.plan().some(c => c.commandType === "Summon"), "活動時間が短い召喚を避ける");
  f.territory();
  assert.ok(f.plan().some(c => c.commandType === "Summon"));
});

test("潜在能力を使う危機では小さい陣地でもユグドラシルを召喚する", () => {
  const f = fixture();
  f.territory(false);
  f.state.cpuSummonGauge = 1;
  findLeader(f.state, "Cpu").currentHp = 2400;
  assert.ok(f.plan().some(c => c.commandType === "Summon"));
});

test("敵バハムートが召喚位置にいる間はユグドラシルの活動時間を過大評価しない", () => {
  const f = fixture();
  f.territory();
  f.state.cpuSummonGauge = 1;
  f.state.playerSummonId = "bahamut";
  f.state.playerSummonGauge = 1;
  assert.equal(tryExecuteSummon(f.state, f.config, "Player"), true);
  const enemy = f.state.summonedUnits.find(summon => summon.team === "Player")!;
  enemy.position = { x: 0, y: 1 };
  assert.ok(!f.plan().some(c => c.commandType === "Summon"), "召喚位置に接触する敵召喚獣の火力も見積もる");
  enemy.currentHp = 0;
  assert.ok(f.plan().some(c => c.commandType === "Summon"));
});

test("敵ジャックポットのレーザーは経路に応じてユグドラシルの活動時間へ反映する", () => {
  const f = fixture();
  f.territory();
  f.state.elementals.push(...[{ x: -2, y: -1 }, { x: 2, y: -1 }].map((position, index) => ({
    elementalId: `Elemental${index + 10}` as ElementalId, team: "Player" as const, position,
    maxHp: 1000, currentHp: 1000, isComplete: true
  })));
  f.state.cpuSummonGauge = 1;
  f.state.playerSummonId = "jackpot";
  f.state.playerSummonGauge = 1;
  assert.equal(tryExecuteSummon(f.state, f.config, "Player"), true);
  const enemy = f.state.summonedUnits.find(summon => summon.team === "Player")!;
  assert.ok(!f.plan().some(c => c.commandType === "Summon"), "召喚地点がレーザーに入る間は待機する");
  enemy.position.x = 6;
  assert.ok(f.plan().some(c => c.commandType === "Summon"), "レーザー経路から離れた地点では召喚できる");
});

test("ユグドラシル活動中は前衛を本体の近くに残す", () => {
  const f = fixture();
  f.territory();
  f.state.cpuSummonGauge = 1;
  assert.equal(tryExecuteSummon(f.state, f.config, "Cpu"), true);
  const commands = f.plan();
  for (const id of ["SC015", "SC009"]) {
    const unit = f.cpu(id);
    const goal = moveFor(commands, unit.unitId)?.targetPosition ?? unit.destination;
    assert.ok(goal.y > -1.5, "敵召喚士へ突進せず本体と陣地を守る");
  }
});

test("雨のない立て直しではクリンを先に復活させる", () => {
  const f = fixture();
  for (const id of ["SC015", "SC004"]) Object.assign(f.cpu(id), { mode: "Defeated", currentHp: 0, defeatedOrder: id === "SC015" ? 1 : 2 });
  f.state.cpuMp = 5;
  const revive = f.plan().find(c => c.commandType === "ReviveUnit");
  assert.ok(revive?.commandType === "ReviveUnit");
  assert.equal(revive.unitId, "Cpu:SC004");
});

test("通常のAP回復と初期配置から雨・大津波・ユグドラシルまで進行する", () => {
  const config = createDefaultBattleConfig();
  const state = createCpuBattleState(config, ["SC020", "SC019", "SC014"], "raphael", "deck2");
  const session = new GameSession(config, state, () => .99);
  const memory = createCpuPlannerMemory();
  state.phase = "InProgress";
  let rainCount = 0, waveCount = 0, summonCount = 0, maximumElementals = 0;
  for (let second = 0; second < 180 && state.result === "InProgress"; second++) {
    for (const command of planCpuCommands(state, config, memory)) {
      if (command.commandType === "UseAbility" && command.unitId === "Cpu:SC004") rainCount++;
      if (command.commandType === "UseAbility" && command.unitId === "Cpu:SC015") waveCount++;
      if (command.commandType === "Summon") summonCount++;
      session.applyCommand(command);
    }
    session.tick(1);
    const count = state.elementals.filter(e => e.team === "Cpu" && e.currentHp > 0).length;
    maximumElementals = Math.max(maximumElementals, count);
    assert.ok(count <= config.maxElementalsPerTeam);
  }
  assert.ok(rainCount >= 1 && waveCount >= 1 && summonCount >= 1,
    `雨${rainCount}回・大津波${waveCount}回・召喚${summonCount}回`);
  assert.ok(maximumElementals >= 4);
  assert.ok(findLeader(state, "Player").currentHp < config.leaderMaxHp);
});
