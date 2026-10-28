import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { findLeader, findUnit } from "../core/battleState";
import { createDeckBattleState } from "../core/deckBattleState";
import type { BattleCommand, BattleState, ElementalId, UnitId, Vec2 } from "../core/types";
import { GameSession } from "../rules/gameSession";
import { calculateSummonArea } from "../rules/areaCalculator";
import { tryExecuteSummon } from "../rules/summonSystem";
import { planCpuCommands } from "./cpuPlanner";

function fixture() {
  const config = createDefaultBattleConfig();
  const state = createDeckBattleState(config, ["SC020", "SC019", "SC014"], ["SC012", "SC009", "SC005", "SC007"]);
  state.cpuSummonId = "leviathan";
  state.phase = "InProgress";
  const cpu = (cardId: string) => findUnit(state, `Cpu:${cardId}`);
  const positions: Record<string, Vec2> = {
    SC012: { x: 0, y: 2.6 }, SC009: { x: 0, y: 1 },
    SC005: { x: -3.5, y: 1.8 }, SC007: { x: 3.5, y: 1.8 }
  };
  for (const [id, position] of Object.entries(positions)) {
    Object.assign(cpu(id), { position: { ...position }, destination: { ...position } });
  }
  const memory = { retreating: new Set<UnitId>() };
  const session = new GameSession(config, state, () => .99);
  const plan = () => planCpuCommands(state, config, memory);
  const apply = (commands: BattleCommand[]) => commands.forEach(command => session.applyCommand(command));
  return { config, state, cpu, memory, session, plan, apply };
}

function addTerritory(state: BattleState, count = 6): void {
  const positions = [{ x: 0, y: 2.6 }, { x: -3.5, y: 1.8 }, { x: 3.5, y: 1.8 },
    { x: -4, y: -.5 }, { x: 4, y: -.5 }, { x: 0, y: -1 }];
  state.elementals = positions.slice(0, count).map((position, index) => ({
    elementalId: `Elemental${index + 1}` as ElementalId, team: "Cpu", position,
    maxHp: 1000, currentHp: 1000, isComplete: true, nation: "ScaleGuild", enchantments: []
  }));
}

function moveFor(commands: BattleCommand[], id: UnitId) {
  return commands.find((command): command is Extract<BattleCommand, { commandType: "MoveUnit" }> =>
    command.commandType === "MoveUnit" && command.unitId === id);
}

test("配置中と試合終了後にはCPUを操作しない", () => {
  const f = fixture();
  f.state.phase = "Setup";
  assert.deepEqual(f.plan(), []);
  f.state.phase = "InProgress";
  f.state.result = "PlayerWin";
  assert.deepEqual(f.plan(), []);
});

test("グーのゲージ回復から同じ判断内でリヴァイアサンを召喚する", () => {
  const f = fixture();
  addTerritory(f.state);
  f.cpu("SC012").abilityAp = 2;
  f.state.cpuSummonGauge = .72;
  const commands = f.plan();
  const abilityIndex = commands.findIndex(c => c.commandType === "UseAbility" && c.unitId === "Cpu:SC012");
  const summonIndex = commands.findIndex(c => c.commandType === "Summon");
  assert.ok(abilityIndex >= 0 && summonIndex > abilityIndex);
  f.apply(commands);
  assert.equal(f.cpu("SC012").abilityAp, 0);
  assert.equal(f.state.cpuSummonGauge, 0);
  assert.equal(f.state.summonedUnits[0]?.summonId, "leviathan");
});

test("召喚中と満タン時にグーのAPを無駄にしない", () => {
  const f = fixture();
  addTerritory(f.state);
  f.cpu("SC012").abilityAp = 2;
  f.state.cpuSummonGauge = 1;
  assert.ok(!f.plan().some(c => c.commandType === "UseAbility" && c.unitId === "Cpu:SC012"));
  assert.equal(tryExecuteSummon(f.state, f.config, "Cpu"), true);
  assert.ok(!f.plan().some(c => c.commandType === "UseAbility" && c.unitId === "Cpu:SC012"));
});

test("陣地が小さい序盤は召喚を待ち、召喚士が危険なら切り返す", () => {
  const f = fixture();
  addTerritory(f.state, 1);
  f.state.cpuSummonGauge = 1;
  assert.ok(!f.plan().some(c => c.commandType === "Summon"));
  findLeader(f.state, "Cpu").currentHp = 2000;
  assert.ok(f.plan().some(c => c.commandType === "Summon"));
});

test("HP35%で撤退し、50%では継続、70%まで回復すると戦線へ戻る", () => {
  const f = fixture();
  addTerritory(f.state);
  const red = f.cpu("SC009"), leader = findLeader(f.state, "Cpu");
  red.position = { x: 1, y: 0 };
  red.currentHp = red.stats.maxHp * .35;
  const first = f.plan();
  assert.deepEqual(moveFor(first, red.unitId)?.targetPosition, leader.position);
  f.apply(first);
  red.position = { ...leader.position };
  red.currentHp = red.stats.maxHp * .5;
  assert.equal(moveFor(f.plan(), red.unitId), undefined);
  assert.ok(f.memory.retreating.has(red.unitId));
  red.currentHp = red.stats.maxHp * .7;
  assert.ok(moveFor(f.plan(), red.unitId));
  assert.ok(!f.memory.retreating.has(red.unitId));
});

test("回復中の移動指示を繰り返さず実際にHPを回復できる", () => {
  const f = fixture();
  addTerritory(f.state);
  const red = f.cpu("SC009"), leader = findLeader(f.state, "Cpu");
  red.position = { ...leader.position };
  red.destination = { ...leader.position };
  red.currentHp = red.stats.maxHp * .4;
  f.memory.retreating.add(red.unitId);
  for (let second = 0; second < 5; second++) {
    f.apply(f.plan());
    f.session.tick(1);
  }
  assert.ok(red.currentHp >= red.stats.maxHp * .59);
});

test("生成中に敵が迫ったら建築を中断して戦闘へ切り替える", () => {
  const f = fixture();
  const goo = f.cpu("SC012");
  goo.mode = "BuildingElemental";
  goo.buildTimerSeconds = 5;
  goo.pendingElementalId = "Elemental1";
  findUnit(f.state, "Player:SC020").position = { x: 0, y: 2 };
  const commands = f.plan();
  assert.ok(moveFor(commands, goo.unitId));
  f.apply(commands);
  assert.equal(goo.mode, "Active");
  assert.equal(goo.pendingElementalId, null);
});

test("ジャックポットのレーザー上では建築を中断して線の外へ移動する", () => {
  const f = fixture();
  f.state.playerSummonId = "jackpot";
  f.state.playerSummonGauge = 1;
  f.state.elementals = [{ x: -2, y: -1 }, { x: 2, y: -1 }].map((position, index) => ({
    elementalId: `Elemental${index + 1}` as ElementalId, team: "Player", position,
    isComplete: true, maxHp: 1000, currentHp: 1000
  }));
  assert.equal(tryExecuteSummon(f.state, f.config, "Player"), true);
  const goo = f.cpu("SC012");
  Object.assign(goo, { mode: "BuildingElemental", buildTimerSeconds: 5, pendingElementalId: "Elemental3" });
  const commands = f.plan();
  const move = moveFor(commands, goo.unitId);
  assert.ok(move && Math.abs(move.targetPosition.x) > 1.6, "レーザー上の建築を中断して線の外へ移動する");
  f.apply(commands);
  assert.equal(goo.mode, "Active");
});

test("レッドアイとタイガーアイが近くの同じ敵へ向かう", () => {
  const f = fixture();
  addTerritory(f.state);
  const enemy = findUnit(f.state, "Player:SC019");
  enemy.position = { x: 1, y: .2 };
  enemy.currentHp = 150;
  const commands = f.plan();
  assert.deepEqual(moveFor(commands, "Cpu:SC009")?.targetPosition, enemy.position);
  assert.deepEqual(moveFor(commands, "Cpu:SC005")?.targetPosition, enemy.position);
});

test("敵召喚獣が召喚士へ迫ったら騎兵は無理な接触を避け、陣地が小さくても召喚する", () => {
  const f = fixture();
  addTerritory(f.state, 1);
  f.state.playerSummonGauge = 1;
  assert.equal(tryExecuteSummon(f.state, f.config, "Player"), true);
  const enemy = f.state.summonedUnits[0];
  enemy.position = { x: 0, y: 3 };
  for (const unit of f.state.units.filter(unit => unit.team === "Player")) {
    unit.mode = "Defeated";
    unit.currentHp = 0;
  }
  f.state.cpuSummonGauge = 1;
  const commands = f.plan();
  for (const id of ["Cpu:SC009", "Cpu:SC005"] as const) {
    const goal = moveFor(commands, id)?.targetPosition;
    assert.ok(goal && Math.abs(goal.x) > .1, "生存できない正面接触を避けて側方へ移動する");
  }
  assert.ok(commands.some(command => command.commandType === "Summon"));
});

test("ローズクォーツは初期3基の後に側面の前方へ陣地を広げる", () => {
  const f = fixture();
  addTerritory(f.state, 3);
  const goal = moveFor(f.plan(), "Cpu:SC007")?.targetPosition;
  assert.ok(goal && goal.x > 2 && goal.y < 1);
});

test("タイガーアイは敵の方向へ向けて減速を使用する", () => {
  const f = fixture();
  addTerritory(f.state);
  const tiger = f.cpu("SC005");
  tiger.position = { x: 0, y: 1 };
  tiger.abilityAp = 2;
  const enemy = findUnit(f.state, "Player:SC020");
  enemy.position = { x: -2, y: 1 };
  f.apply(f.plan());
  assert.equal(tiger.abilityAp, 0);
  assert.ok(enemy.abilityEffects.some(effect => effect.abilityId === "SC005" && effect.kind === "speed"));
});

test("レッドアイは晴天ではAPを保持し、雨なら移動する味方を加速する", () => {
  const f = fixture();
  addTerritory(f.state);
  const red = f.cpu("SC009");
  red.abilityAp = 3;
  assert.ok(!f.plan().some(c => c.commandType === "UseAbility" && c.unitId === red.unitId));
  f.state.rainRemainingSeconds = 100;
  f.apply(f.plan());
  assert.equal(red.abilityAp, 0);
  assert.ok(f.cpu("SC005").abilityEffects.some(effect => effect.abilityId === "SC009"));
});

test("ローズクォーツはエレメンタルがある移動時に自己強化する", () => {
  const f = fixture();
  f.cpu("SC007").abilityAp = 1;
  assert.ok(!f.plan().some(c => c.commandType === "UseAbility" && c.unitId === "Cpu:SC007"));
  addTerritory(f.state, 3);
  f.apply(f.plan());
  assert.equal(f.cpu("SC007").abilityAp, 0);
  assert.ok(f.cpu("SC007").abilityEffects.some(effect => effect.kind === "speed"));
});

test("召喚準備では死亡順よりグーの復活を優先する", () => {
  const f = fixture();
  for (const [id, order] of [["SC007", 1], ["SC012", 2]] as const) {
    Object.assign(f.cpu(id), { mode: "Defeated", currentHp: 0, defeatedOrder: order });
  }
  f.state.cpuMp = 4;
  const revive = f.plan().find(c => c.commandType === "ReviveUnit");
  assert.ok(revive?.commandType === "ReviveUnit");
  assert.equal(revive.unitId, "Cpu:SC012");
  f.apply([revive]);
  assert.equal(f.cpu("SC012").currentHp, 1311);
  assert.equal(f.state.cpuMp, 0);
});

test("完成済みと生成中を含めて上限を超える生成指示を出さない", () => {
  const f = fixture();
  addTerritory(f.state, 5);
  const rose = f.cpu("SC007");
  Object.assign(rose, { mode: "BuildingElemental", pendingElementalId: "Elemental6", buildTimerSeconds: 4 });
  assert.ok(!f.plan().some(c => c.commandType === "BeginElementalBuild"));
});

test("時間を進めると広い陣地を作り、生成だけで停滞しない", () => {
  const f = fixture();
  for (let second = 0; second < 38; second++) {
    f.apply(f.plan());
    f.session.tick(1);
  }
  const elementals = f.state.elementals.filter(e => e.team === "Cpu" && e.currentHp > 0);
  assert.ok(elementals.length >= 4, `生成数: ${elementals.length}`);
  const area = calculateSummonArea([findLeader(f.state, "Cpu").position, ...elementals.map(e => e.position)]);
  assert.ok(area >= 12, `陣地面積: ${area}`);
});
