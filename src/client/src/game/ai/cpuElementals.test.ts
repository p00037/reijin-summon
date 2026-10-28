import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { findLeader } from "../core/battleState";
import type { ElementalId, Vec2 } from "../core/types";
import { calculateSummonArea } from "../rules/areaCalculator";
import { GameSession } from "../rules/gameSession";
import { tryExecuteSummon } from "../rules/summonSystem";
import { createCpuBattleState, type CpuOpponentId } from "./cpuDeck";
import { chooseCpuBuildSite, cpuBuildSites } from "./cpuElementals";
import { createCpuPlannerMemory, planCpuCommands } from "./cpuPlanner";

function fixture(deck: CpuOpponentId = "deck1") {
  const config = createDefaultBattleConfig();
  const state = createCpuBattleState(config, ["SC020"], "raphael", deck, () => 0);
  state.phase = "InProgress";
  const unit = state.units.find(unit => unit.team === "Cpu")!;
  const add = (position: Vec2, team: "Cpu" | "Player" = "Cpu") => {
    state.elementals.push({ elementalId: `Elemental${state.elementals.length + 1}` as ElementalId,
      team, position, maxHp: 1000, currentHp: 1000, isComplete: true });
  };
  return { config, state, unit, add };
}

test("既定の6地点が占有されていても別の安全な地点で不足分を生成する", () => {
  const f = fixture();
  cpuBuildSites(f.config).forEach((position, index) => f.add(position, index === 5 ? "Player" : "Cpu"));
  const site = chooseCpuBuildSite(f.state, f.config, f.unit, []);
  assert.ok(site, "固定地点以外も補充候補にする");
  assert.ok(f.state.elementals.every(elemental => Math.hypot(elemental.position.x - site.x, elemental.position.y - site.y) > .8));
});

test("5基が密集した陣地の最後の1基は面積を広げる場所に作る", () => {
  const f = fixture();
  for (const x of [-1.6, -.8, 0, .8, 1.6]) f.add({ x, y: 2.6 });
  f.unit.position = { x: 0, y: 2.6 };
  const site = chooseCpuBuildSite(f.state, f.config, f.unit, []);
  assert.ok(site);
  const area = calculateSummonArea([findLeader(f.state, "Cpu").position,
    ...f.state.elementals.map(elemental => elemental.position), site]);
  assert.ok(area >= 10, `狭い後方ではなく外周へ広げる: ${area}`);
});

for (const deck of ["deck1", "deck2", "deck3"] as const) {
  test(`${deck}: 味方召喚獣の活動中も安全なら不足するエレメントを補充する`, () => {
    const f = fixture(deck);
    for (const position of cpuBuildSites(f.config).slice(0, 3)) f.add(position);
    f.state.cpuSummonGauge = 1;
    assert.equal(tryExecuteSummon(f.state, f.config, "Cpu"), true);
    const memory = createCpuPlannerMemory(), session = new GameSession(f.config, f.state, () => .99);
    let started = false;
    for (let second = 0; second < 35; second++) {
      for (const command of planCpuCommands(f.state, f.config, memory)) {
        if (command.commandType === "BeginElementalBuild" && f.state.summonedUnits.some(summon => summon.team === "Cpu" && summon.currentHp > 0)) {
          started = true;
        }
        session.applyCommand(command);
      }
      // 自然消耗で先に消滅しないようにして、召喚中の補充を検証する。
      for (const summon of f.state.summonedUnits) { summon.healthDecayPerSecond = 0; summon.moveSpeed = 0; }
      session.tick(1);
    }
    assert.ok(started, "召喚獣の消滅を待たず安全な建築を始める");
  });

  test(`${deck}: 通常の進行で上限6基と広い陣地を確保する`, () => {
    const f = fixture(deck);
    const memory = createCpuPlannerMemory(), session = new GameSession(f.config, f.state, () => .99);
    let maximum = 0, area = 0;
    for (let second = 0; second < 180 && f.state.result === "InProgress"; second++) {
      const commands = planCpuCommands(f.state, f.config, memory);
      commands.forEach(command => session.applyCommand(command));
      session.tick(1);
      const nodes = f.state.elementals.filter(elemental => elemental.team === "Cpu" && elemental.currentHp > 0);
      assert.ok(nodes.length <= 6);
      maximum = Math.max(maximum, nodes.length);
      if (nodes.length === 6) area = Math.max(area, calculateSummonArea([findLeader(f.state, "Cpu").position, ...nodes.map(node => node.position)]));
    }
    assert.equal(maximum, 6);
    assert.ok(area >= 12, `6基での面積: ${area}`);
  });
}
