import { findLeader, isUnitAlive } from "../core/battleState";
import type { BattleCommand, BattleConfig, BattleState, CpuUnitId, UnitId, UnitState, Vec2 } from "../core/types";
import { distanceSq } from "@reijin-summon/shared/core/vector";
import { abilityTargets, canUseAbility, effectiveAttackRange } from "../rules/abilitySystem";
import { canPlaceElementalAtUnit, completedElementalsForTeam } from "../rules/elementalSystem";
import { canReviveUnit } from "../rules/resurrectionSystem";
import { canSummon } from "../rules/summonSystem";
import { calculateSummonArea } from "../rules/areaCalculator";
import { isCircleInBeam } from "@reijin-summon/shared/rules/summonGeometry";
import { chooseCpuBuildSite, isCpuBuildSafe } from "./cpuElementals";
import { activeFormationBeams, avoidFormationBeams, formationBuildSites, formationCenter,
  inFormationBeam, plannedFormationBeam } from "./cpuFormationGeometry";
import { shouldSummonCpuStationary } from "./cpuSummonTactics";
import type { CpuPlannerMemory } from "./cpuPlanner";
import { chooseCpuHealingPosition, cpuElementalAttackPosition, cpuElementalDefenders, cpuRetreatPosition, shouldRetreatFromSummon } from "./cpuDefense";

type CpuUnit = UnitState & { unitId: CpuUnitId };

export function planFormationCpuCommands(state: BattleState, config: BattleConfig, memory: CpuPlannerMemory): BattleCommand[] {
  const commands: BattleCommand[] = [];
  const allies = state.units.filter((unit): unit is CpuUnit => unit.team === "Cpu" && isUnitAlive(unit));
  const enemies = [...state.units.filter(unit => unit.team === "Player" && isUnitAlive(unit)),
    ...state.summonedUnits.filter(summon => summon.team === "Player" && summon.currentHp > 0)];
  const leader = findLeader(state, "Cpu"), enemyLeader = findLeader(state, "Player");
  const center = formationCenter(state, config);
  const elementals = completedElementalsForTeam(state, "Cpu");
  const activeSummon = state.summonedUnits.find(summon => summon.team === "Cpu" && summon.currentHp > 0);
  const threatened = enemies.some(enemy => distanceSq(enemy.position, leader.position) < 3 ** 2);
  const campThreat = enemies.some(enemy => distanceSq(enemy.position, center) < 4 ** 2);
  const advancing = activeSummon && ["raphael", "bahamut", "dullahan"].includes(activeSummon.summonId);
  const focus = enemies.filter(enemy => threatened || distanceSq(enemy.position, center) < 4 ** 2
    || advancing && distanceSq(enemy.position, activeSummon.position) < 5 ** 2)
    .sort((left, right) => focusScore(left) - focusScore(right))[0];
  function focusScore(enemy: typeof enemies[number]): number {
    const anchor = threatened ? leader.position : advancing ? activeSummon!.position : center;
    return distanceSq(enemy.position, anchor);
  }

  for (const id of memory.retreating) {
    if (!allies.some(unit => unit.unitId === id)) memory.retreating.delete(id);
  }
  for (const unit of allies) {
    const ratio = unit.currentHp / unit.stats.maxHp;
    if (ratio <= .35 || shouldRetreatFromSummon(state, config, unit)) memory.retreating.add(unit.unitId);
    else if (ratio >= (state.summonedUnits.some(summon => summon.team === "Player" && summon.currentHp > 0) ? .95 : .7)) {
      memory.retreating.delete(unit.unitId);
    }
  }

  const fieldArea = (config.battlefieldMax.x - config.battlefieldMin.x) * (config.battlefieldMax.y - config.battlefieldMin.y);
  const areaRatio = calculateSummonArea([leader.position, ...elementals.map(node => node.position)]) / fieldArea;
  const stationary = state.cpuSummonId === "jackpot" || state.cpuSummonId === "yggdrasil";
  const wantSummon = canSummon(state, config, "Cpu") && (stationary
    ? shouldSummonCpuStationary(state, config)
    : areaRatio >= .1 || threatened || leader.currentHp <= leader.maxHp * .3
      || config.matchDurationSeconds - state.remainingSeconds >= 120);
  const plannedBeam = wantSummon && state.cpuSummonId === "jackpot" ? plannedFormationBeam(state, config) : undefined;
  const beams = activeFormationBeams(state, config);
  if (plannedBeam) beams.push(plannedBeam);
  const summonNow = wantSummon && (!plannedBeam || !allies.some(unit => inFormationBeam(unit.position, [plannedBeam], config))
    && !isCircleInBeam(leader.position, 0, plannedBeam));
  if (summonNow) commands.push({ commandType: "Summon", team: "Cpu" });

  // 瀕死時のラファエル／デュラハンは召喚効果で復活できるのでMPを残す。
  const freeRevival = summonNow && leader.currentHp <= leader.maxHp * .3
    && (state.cpuSummonId === "raphael" || state.cpuSummonId === "dullahan");
  const priority = threatened ? ["SC003", "SC010", "SC014", "SC013"] : ["SC014", "SC003", "SC013", "SC010"];
  const revivalPosition = chooseCpuHealingPosition(state, config, undefined, beams);
  const revival = revivalPosition && state.units.filter(unit => unit.team === "Cpu" && unit.mode === "Defeated")
    .sort((left, right) => priority.indexOf(left.cardId!) - priority.indexOf(right.cardId!))
    .find(unit => canReviveUnit(state, config, "Cpu", unit.unitId, revivalPosition));
  if (revival && !freeRevival) commands.push({ commandType: "ReviveUnit", team: "Cpu", unitId: revival.unitId,
    targetPosition: { ...revivalPosition } });

  const sites = formationBuildSites(config), reserved: Vec2[] = [];
  const goals = new Map<UnitId, Vec2>();
  let buildingCount = allies.filter(unit => unit.mode === "BuildingElemental").length;
  const canDevelop = !campThreat && !wantSummon;
  const escort = advancing ? allies.filter(unit => unit.unitType === "Melee" && !memory.retreating.has(unit.unitId))
    .sort((left, right) => distanceSq(left.position, activeSummon.position) - distanceSq(right.position, activeSummon.position))[0]
    : undefined;
  // 前衛は一度に1体だけを外周の生成へ回し、もう1体を射手の護衛に残す。
  const frontBuilder = canDevelop && !allies.some(unit => unit.unitType === "Melee" && unit.mode === "BuildingElemental")
    ? allies.filter(unit => unit.unitType === "Melee" && unit !== escort && !memory.retreating.has(unit.unitId))
      .map(unit => ({ unit, site: chooseCpuBuildSite(state, config, unit, [], sites.slice(2)) }))
      .filter((entry): entry is { unit: CpuUnit; site: Vec2 } => !!entry.site)
      .sort((left, right) => distanceSq(left.unit.position, left.site) - distanceSq(right.unit.position, right.site))[0]?.unit
    : undefined;

  const defenders = threatened ? new Map<UnitId, Vec2>() : cpuElementalDefenders(state, config, memory.retreating);
  for (const unit of allies) {
    if (memory.retreating.has(unit.unitId)) {
      if (unit.mode === "BuildingElemental") buildingCount--;
      setGoal(unit, cpuRetreatPosition(state, config, unit, beams));
      continue;
    }
    const intruder = defenders.get(unit.unitId);
    if (intruder) {
      if (unit.mode === "BuildingElemental") buildingCount--;
      setGoal(unit, cpuElementalAttackPosition(unit, intruder, config));
      continue;
    }
    if (unit.mode === "BuildingElemental" && canDevelop
      && !inFormationBeam(unit.position, beams, config)
      && isCpuBuildSafe(state, config, unit.position, unit.buildTimerSeconds)) continue;
    if (unit.mode === "BuildingElemental") buildingCount--;
    if (unit.unitType === "Ranged") {
      const nearest = [...enemies].sort((left, right) => distanceSq(unit.position, left.position) - distanceSq(unit.position, right.position))[0];
      if (nearest && distanceSq(unit.position, nearest.position) <= effectiveAttackRange(unit, config) ** 2) {
        // 射手は停止中だけ射撃する。接近された時は後方へ距離を取る。
        setGoal(unit, distanceSq(unit.position, nearest.position) < 1.7 ** 2
          ? leader.position : unit.position);
        continue;
      }
    }
    const campSite = unit.cardId === "SC014" ? sites[0] : unit.cardId === "SC013" ? sites[1] : undefined;
    const buildSite = canDevelop && elementals.length + buildingCount + reserved.length < config.maxElementalsPerTeam
      ? chooseCpuBuildSite(state, config, unit, reserved, campSite ? [campSite] : unit === frontBuilder ? sites.slice(2) : [])
      : undefined;
    if (buildSite && !inFormationBeam(buildSite, beams, config)) {
      if (distanceSq(unit.position, buildSite) <= .15 ** 2 && canPlaceElementalAtUnit(state, config, unit.unitId)) {
        commands.push({ commandType: "BeginElementalBuild", team: "Cpu", unitId: unit.unitId });
        buildingCount++;
      } else {
        reserved.push(buildSite);
        setGoal(unit, buildSite);
      }
      continue;
    }

    let goal: Vec2;
    const side = unit.cardId === "SC014" || unit.cardId === "SC003" ? -1 : 1;
    if (unit.unitType === "Ranged") {
      goal = advancing ? { x: activeSummon!.position.x + side * .8, y: activeSummon!.position.y + 2 }
        : { x: center.x + side * .8, y: center.y + .8 };
    } else {
      goal = focus?.position ?? (advancing
        ? { x: activeSummon!.position.x + side * .9, y: Math.max(enemyLeader.position.y, activeSummon!.position.y - .7) }
        : { x: center.x + side * .9, y: center.y - .8 });
    }
    setGoal(unit, goal);
  }

  for (const unit of allies) {
    if (unit.cardId === "SC014" || unit.cardId === "SC003") {
      const kind = unit.cardId === "SC014" ? "gauge" : "speed";
      const freshNodes = abilityTargets(state, config, unit.unitId, 0).elementalIds.some(id =>
        !state.elementals.find(node => node.elementalId === id)!.enchantments?.some(effect => effect.kind === kind));
      if (freshNodes && canUseAbility(state, config, unit.unitId, 0)) commands.push(ability(unit, 0));
    } else if (unit.cardId === "SC013" && unit.abilityAp >= 2) {
      const moving = allies.filter(ally => {
        const goal = goals.get(ally.unitId);
        return goal && distanceSq(ally.position, goal) > .8 ** 2
          && !ally.abilityEffects.some(effect => effect.abilityId === "SC013" && effect.remainingSeconds > 3);
      });
      const directions = moving.map(ally => Math.atan2(ally.position.x - unit.position.x, ally.position.y - unit.position.y));
      const best = directions.map(rotation => ({ rotation, count: abilityTargets(state, config, unit.unitId, rotation).unitIds
        .filter(id => moving.some(ally => ally.unitId === id)).length })).sort((left, right) => right.count - left.count)[0];
      if (best?.count && canUseAbility(state, config, unit.unitId, best.rotation)) commands.push(ability(unit, best.rotation));
    }
  }
  return commands;

  function setGoal(unit: CpuUnit, target: Vec2): void {
    const safe = avoidFormationBeams(unit.position, target, beams, config);
    goals.set(unit.unitId, safe);
    if (unit.mode === "BuildingElemental" || distanceSq(unit.destination, safe) > .1 ** 2) {
      commands.push({ commandType: "MoveUnit", team: "Cpu", unitId: unit.unitId, targetPosition: { ...safe } });
    }
  }
}

function ability(unit: CpuUnit, facingRotation: number): BattleCommand {
  return { commandType: "UseAbility", team: "Cpu", unitId: unit.unitId, facingRotation };
}
