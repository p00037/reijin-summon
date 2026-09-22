import { createDefaultBattleState } from "./battleState.js";
import type { BattleConfig, BattleState, TeamId, UnitState, Vec2 } from "./types.js";
import { findCard } from "../deck/cardCatalog.js";
import { validateDeck } from "../deck/deckModel.js";
import { pickCpuSummon, type SummonId } from "./summonCatalog.js";

export function createDeckBattleState(
  config: BattleConfig,
  playerCardIds: readonly string[],
  cpuCardIds: readonly string[],
  playerSummonId: SummonId = "raphael",
  random: () => number = Math.random
): BattleState {
  for (const ids of [playerCardIds, cpuCardIds]) {
    const validation = validateDeck(ids);
    if (!validation.valid) throw new Error(validation.errors.join(" / "));
  }
  const state = createDefaultBattleState(config);
  state.playerSummonId = playerSummonId;
  state.cpuSummonId = pickCpuSummon(random);
  const templates = state.units;
  const makeTeam = (ids: readonly string[], team: TeamId): UnitState[] => ids.map((id, index) => {
    const card = findCard(id)!;
    const template = templates.find(unit => unit.team === team && unit.unitType === card.unitType)!;
    const span = Math.min(2.4 * (ids.length - 1), config.battlefieldMax.x - config.battlefieldMin.x - 2 * config.initialPlacementMargin);
    const position: Vec2 = {
      x: (config.battlefieldMin.x + config.battlefieldMax.x) / 2 + (ids.length === 1 ? 0 : -span / 2 + span * index / (ids.length - 1)),
      y: team === "Player" ? config.playerLeaderPosition.y + 1.1 : config.cpuLeaderPosition.y - 1.1
    };
    return {
      ...template,
      unitId: `${team}:${card.id}`,
      cardId: card.id,
      position: { ...position }, spawnPosition: { ...position }, destination: { ...position },
      stats: { ...config.statsByType[card.unitType], level: card.level, revivalCost: card.cost, maxHp: card.maxHp, attackDamage: card.attackDamage },
      currentHp: card.maxHp
    };
  });
  state.units = [...makeTeam(playerCardIds, "Player"), ...makeTeam(cpuCardIds, "Cpu")];
  return state;
}

export function createOnlineBattleState(config: BattleConfig, decks: Record<TeamId, {cardIds: readonly string[]; summonId: SummonId}>): BattleState {
 const state = createDeckBattleState(config, decks.Player.cardIds, decks.Cpu.cardIds, decks.Player.summonId);
 state.cpuSummonId = decks.Cpu.summonId;
 return state;
}
