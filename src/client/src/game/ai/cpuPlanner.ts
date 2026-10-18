import { findLeader, isUnitAlive } from "../core/battleState";
import type { BattleCommand, BattleConfig, BattleState, CpuUnitId, SummonedUnitState, UnitId, UnitState, Vec2 } from "../core/types";
import { distanceSq } from "@reijin-summon/shared/core/vector";
import { abilityTargets, canUseAbility } from "../rules/abilitySystem";
import { canPlaceElementalAtUnit, completedElementalsForTeam } from "../rules/elementalSystem";
import { canReviveUnit } from "../rules/resurrectionSystem";
import { canSummon } from "../rules/summonSystem";
import { calculateSummonArea } from "../rules/areaCalculator";
import { chooseCpuBuildSite, isCpuBuildSafe } from "./cpuElementals";
import { cpuFieldPosition } from "./cpuDeck";
import { cpuClerkPosition, cpuWavePosition, shouldSummonCpuYggdrasil, shouldUseCpuWave } from "./cpuRainTactics";
import { planFormationCpuCommands } from "./cpuFormationPlanner";

export type CpuPlannerMemory = { retreating: Set<UnitId> };
type CpuUnit = UnitState & { unitId: CpuUnitId };

export function createCpuPlannerMemory(): CpuPlannerMemory {
  return { retreating: new Set() };
}

export function planCpuCommands(
  state: BattleState, config: BattleConfig, memory: CpuPlannerMemory = createCpuPlannerMemory()
): BattleCommand[] {
  if (state.phase !== "InProgress" || state.result !== "InProgress") return [];
  if (state.units.some(unit => unit.team === "Cpu" && unit.cardId === "SC013")) {
    return planFormationCpuCommands(state, config, memory);
  }
  const commands: BattleCommand[] = [];
  const cpuUnits = state.units.filter((unit): unit is CpuUnit => unit.team === "Cpu" && isUnitAlive(unit));
  const enemies = state.units.filter(unit => unit.team === "Player" && isUnitAlive(unit));
  const enemySummons = state.summonedUnits.filter(summon => summon.team === "Player" && summon.currentHp > 0);
  const leader = findLeader(state, "Cpu");
  const enemyLeader = findLeader(state, "Player");
  const threatened = [...enemies, ...enemySummons].some(enemy => distanceSq(enemy.position, leader.position) < 3 ** 2);
  const elementals = completedElementalsForTeam(state, "Cpu");
  const activeSummon = state.summonedUnits.find(summon => summon.team === "Cpu" && summon.currentHp > 0);
  const elapsed = config.matchDurationSeconds - state.remainingSeconds;
  const rainDeck = state.units.some(unit => unit.team === "Cpu" && unit.cardId === "SC015");
  const clerk = cpuUnits.find(unit => unit.cardId === "SC004");
  const darius = cpuUnits.find(unit => unit.cardId === "SC015");
  const castRain = !!clerk && state.rainRemainingSeconds <= 10 && canUseAbility(state, config, clerk.unitId, 0);
  const abilityState = castRain ? { ...state, rainRemainingSeconds: 100 } : state;
  const pushing = rainDeck
    ? !!activeSummon || abilityState.rainRemainingSeconds > 0 || (darius?.abilityAp ?? 0) >= 3 || elapsed >= 90
    : !!activeSummon || elementals.length >= 4 || elapsed >= 60;

  for (const id of memory.retreating) {
    if (!cpuUnits.some(unit => unit.unitId === id)) memory.retreating.delete(id);
  }
  for (const unit of cpuUnits) {
    const nearbyEnemies = enemies.filter(enemy => distanceSq(unit.position, enemy.position) < 3 ** 2).length;
    const nearbyAllies = cpuUnits.filter(ally => ally !== unit && distanceSq(unit.position, ally.position) < 3.5 ** 2).length;
    const hpRatio = unit.currentHp / unit.stats.maxHp;
    if (hpRatio <= .35 || (hpRatio < .7 && nearbyEnemies >= 2 && nearbyAllies === 0)) {
      memory.retreating.add(unit.unitId);
    } else if (hpRatio >= .7) {
      memory.retreating.delete(unit.unitId);
    }
  }

  const priority = rainDeck
    ? threatened || state.rainRemainingSeconds > 10 ? ["SC015", "SC009", "SC004", "SC007"] : ["SC004", "SC015", "SC009", "SC007"]
    : threatened ? ["SC009", "SC005", "SC012", "SC007"] : ["SC012", "SC009", "SC005", "SC007"];
  const defeated = state.units.filter(unit => unit.team === "Cpu" && unit.mode === "Defeated")
    .sort((left, right) => priority.indexOf(left.cardId!) - priority.indexOf(right.cardId!));
  const revival = defeated.find(unit => canReviveUnit(state, config, "Cpu", unit.unitId, leader.position));
  if (revival) commands.push({ commandType: "ReviveUnit", team: "Cpu", unitId: revival.unitId, targetPosition: { ...leader.position } });
  if (castRain) commands.push(abilityCommand(clerk!, 0));

  const goo = cpuUnits.find(unit => unit.cardId === "SC012");
  const boostGauge = goo && canUseAbility(state, config, goo.unitId, 0);
  if (boostGauge) commands.push(abilityCommand(goo, 0));
  const projected = boostGauge ? { ...state, cpuSummonGauge: Math.min(1, state.cpuSummonGauge + .3) } : state;
  const fieldArea = (config.battlefieldMax.x - config.battlefieldMin.x) * (config.battlefieldMax.y - config.battlefieldMin.y);
  const areaRatio = calculateSummonArea([leader.position, ...elementals.map(e => e.position)]) / fieldArea;
  const summonNow = canSummon(projected, config, "Cpu")
    && (rainDeck ? shouldSummonCpuYggdrasil(state, config)
      : areaRatio >= .1 || threatened || leader.currentHp <= leader.maxHp * .35 || elapsed >= 90);
  if (summonNow) commands.push({ commandType: "Summon", team: "Cpu" });

  const red = cpuUnits.find(unit => unit.cardId === "SC009" && !memory.retreating.has(unit.unitId));
  const tiger = cpuUnits.find(unit => unit.cardId === "SC005" && !memory.retreating.has(unit.unitId));
  const anchor = red?.position ?? tiger?.position ?? cpuFieldPosition(config, 0, .38);
  const focus = [...enemies, ...enemySummons]
    .filter(enemy => !rainDeck || !activeSummon || threatened || distanceSq(enemy.position, activeSummon.position) < 3.2 ** 2)
    .filter(enemy => pushing || threatened || distanceSq(enemy.position, leader.position) < 4.5 ** 2)
    .sort((left, right) => focusScore(left) - focusScore(right))[0];
  function focusScore(enemy: UnitState | SummonedUnitState): number {
    const defense = threatened ? Math.sqrt(distanceSq(enemy.position, leader.position)) * 3 : 0;
    const maxHp = "stats" in enemy ? enemy.stats.maxHp : enemy.maxHp;
    return defense + Math.sqrt(distanceSq(enemy.position, anchor)) + enemy.currentHp / maxHp * 2;
  }

  const reserved: Vec2[] = [];
  let buildingCount = cpuUnits.filter(unit => unit.mode === "BuildingElemental").length;
  const goals = new Map<UnitId, Vec2>();
  // 建築担当を先に割り当て、同じ生成地点へ複数のカードを向かわせない。
  const builderPriority = rainDeck ? ["SC004", "SC007", "SC009", "SC015"] : ["SC012", "SC007", "SC005", "SC009"];
  const ordered = [...cpuUnits].sort((left, right) => builderPriority.indexOf(left.cardId!) - builderPriority.indexOf(right.cardId!));
  for (const unit of ordered) {
    if (memory.retreating.has(unit.unitId)) {
      setGoal(unit, leader.position);
      continue;
    }
    if (unit.mode === "BuildingElemental"
      && isCpuBuildSafe(state, config, unit.position, unit.buildTimerSeconds) && !threatened) continue;

    const initialBuild = elementals.length + buildingCount < 3;
    const canBuild = !threatened && (rainDeck
      ? unit.cardId === "SC007" || initialBuild && (unit.cardId === "SC009"
        || unit.cardId === "SC004" && !enemies.some(enemy => distanceSq(enemy.position, unit.position) < 3 ** 2)
        || unit.cardId === "SC015" && !clerk)
      : unit.cardId === "SC012" || unit.cardId === "SC007" || unit.cardId === "SC005" && initialBuild);
    if (canBuild && !activeSummon && !summonNow && elementals.length + buildingCount + reserved.length < config.maxElementalsPerTeam) {
      const site = chooseCpuBuildSite(state, config, unit, reserved);
      if (site) {
        if (distanceSq(unit.position, site) <= .15 ** 2 && canPlaceElementalAtUnit(state, config, unit.unitId)) {
          commands.push({ commandType: "BeginElementalBuild", team: "Cpu", unitId: unit.unitId });
          buildingCount++;
        } else {
          reserved.push(site);
          setGoal(unit, site);
        }
        continue;
      }
    }

    let goal: Vec2;
    if (rainDeck && unit.cardId === "SC004") {
      goal = cpuClerkPosition(state, config, unit, darius && !memory.retreating.has(darius.unitId) ? darius : undefined, pushing);
    } else if (rainDeck && unit.cardId === "SC015") {
      goal = threatened && focus ? focus.position : activeSummon
        ? focus?.position ?? { x: activeSummon.position.x, y: activeSummon.position.y - 1 }
        : cpuWavePosition(state, config, unit) ?? focus?.position
          ?? (pushing ? cpuFieldPosition(config, 0, .52) : cpuFieldPosition(config, -.1, .38));
    } else if (rainDeck && activeSummon) {
      goal = focus?.position ?? { x: activeSummon.position.x + (unit.cardId === "SC007" ? 2 : -1.5), y: activeSummon.position.y - .6 };
    } else if (unit.cardId === "SC012") {
      const closeEnemy = [...enemies].sort((left, right) => distanceSq(left.position, unit.position) - distanceSq(right.position, unit.position))[0];
      const enemyElemental = state.elementals.filter(e => e.team === "Player" && e.currentHp > 0)
        .sort((left, right) => distanceSq(left.position, unit.position) - distanceSq(right.position, unit.position))[0];
      goal = threatened && focus ? focus.position : closeEnemy && distanceSq(closeEnemy.position, unit.position) < 3 ** 2
        ? closeEnemy.position : (activeSummon || summonNow)
          ? enemyElemental?.position ?? focus?.position ?? enemyLeader.position : cpuFieldPosition(config, 0, .3);
    } else if (unit.cardId === "SC007" && !threatened) {
      const sideTarget = state.elementals.filter(e => e.team === "Player" && e.currentHp > 0)
        .sort((left, right) => distanceSq(left.position, unit.position) - distanceSq(right.position, unit.position))[0];
      goal = pushing ? sideTarget?.position ?? focus?.position ?? enemyLeader.position : cpuFieldPosition(config, .28, .35);
    } else {
      goal = focus?.position ?? (pushing || summonNow ? enemyLeader.position : cpuFieldPosition(config, 0, .38));
    }
    setGoal(unit, goal);
  }

  for (const unit of cpuUnits) {
    if (unit.cardId === "SC012" || (unit.cardId !== "SC005" && !canUseAbility(abilityState, config, unit.unitId, 0))) continue;
    if (unit.cardId === "SC005") {
      const directions = enemies.map(enemy => Math.atan2(enemy.position.x - unit.position.x, enemy.position.y - unit.position.y));
      const best = directions.map(rotation => ({ rotation, count: abilityTargets(state, config, unit.unitId, rotation).unitIds
        .filter(id => !state.units.find(candidate => candidate.unitId === id)!.abilityEffects
          .some(effect => effect.abilityId === "SC005" && effect.remainingSeconds > 3)).length }))
        .sort((left, right) => right.count - left.count)[0];
      if (best?.count && canUseAbility(state, config, unit.unitId, best.rotation)) commands.push(abilityCommand(unit, best.rotation));
    } else if (unit.cardId === "SC007") {
      const goal = goals.get(unit.unitId);
      if (elementals.length > 0 && (goal && distanceSq(unit.position, goal) > 1
        || enemies.some(enemy => distanceSq(enemy.position, unit.position) < 2.5 ** 2))) commands.push(abilityCommand(unit, 0));
    } else if (unit.cardId === "SC009") {
      const movingAllies = cpuUnits.filter(ally => {
        const goal = goals.get(ally.unitId);
        return goal && distanceSq(ally.position, goal) > 1;
      }).length;
      if (movingAllies >= 2 || memory.retreating.size > 0) commands.push(abilityCommand(unit, 0));
    }
  }
  if (darius && shouldUseCpuWave(state, config, darius, threatened)) commands.push(abilityCommand(darius, 0));
  return commands;

  function setGoal(unit: CpuUnit, target: Vec2): void {
    goals.set(unit.unitId, target);
    // 同じ移動指示でも回復タイマーがリセットされるため、目標が変わる時だけ送る。
    if (unit.mode === "BuildingElemental" || distanceSq(unit.destination, target) > .1 ** 2) {
      commands.push({ commandType: "MoveUnit", team: "Cpu", unitId: unit.unitId, targetPosition: { ...target } });
    }
  }
}

function abilityCommand(unit: CpuUnit, facingRotation: number): BattleCommand {
  return { commandType: "UseAbility", team: "Cpu", unitId: unit.unitId, facingRotation };
}
