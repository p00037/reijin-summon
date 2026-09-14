import { createDefaultBattleState } from "./battleState";
import type { BattleConfig, BattleState, TeamId, UnitState, Vec2 } from "./types";
import { findCard } from "../deck/cardCatalog";
import { validateDeck } from "../deck/deckModel";

export function createDeckBattleState(
  config: BattleConfig,
  playerCardIds: readonly string[],
  cpuCardIds: readonly string[]
): BattleState {
  for (const ids of [playerCardIds, cpuCardIds]) {
    const validation = validateDeck(ids);
    if (!validation.valid) throw new Error(validation.errors.join(" / "));
  }
  const state = createDefaultBattleState(config);
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
