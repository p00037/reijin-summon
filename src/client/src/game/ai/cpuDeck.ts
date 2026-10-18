import { createDeckBattleState } from "../core/deckBattleState";
import type { SummonId } from "../core/summonCatalog";
import type { BattleConfig, BattleState, Vec2 } from "../core/types";

export type CpuOpponentId = "deck1" | "deck2" | "deck3";
type CpuOpponent = {
  id: CpuOpponentId;
  name: string;
  description: string;
  cardIds: readonly string[];
  summonId: SummonId | "random";
};

export const cpuOpponents: readonly CpuOpponent[] = [
  { id: "deck1", name: "デッキ1：機動・召喚型", description: "左右から揺さぶり、グーで召喚を早めて攻める。",
    cardIds: ["SC012", "SC009", "SC005", "SC007"], summonId: "leviathan" },
  { id: "deck2", name: "デッキ2：雨・陣地型", description: "雨と大津波で前線を作り、ユグドラシルで全体を攻撃する。",
    cardIds: ["SC015", "SC009", "SC004", "SC007"], summonId: "yggdrasil" },
  { id: "deck3", name: "デッキ3：射撃・陣形型", description: "前衛で射手と強化エレメンタルを守り、召喚を繰り返す。",
    cardIds: ["SC014", "SC013", "SC003", "SC010"], summonId: "random" }
];

export function getCpuOpponent(id: unknown): CpuOpponent {
  return cpuOpponents.find(opponent => opponent.id === id) ?? cpuOpponents[0];
}

export function cpuFieldPosition(config: BattleConfig, horizontal: number, advance: number): Vec2 {
  return {
    x: (config.battlefieldMin.x + config.battlefieldMax.x) / 2
      + (config.battlefieldMax.x - config.battlefieldMin.x) * horizontal,
    y: config.cpuLeaderPosition.y + (config.playerLeaderPosition.y - config.cpuLeaderPosition.y) * advance
  };
}

export function createCpuBattleState(
  config: BattleConfig, playerCardIds: readonly string[], playerSummonId: SummonId, opponentId: CpuOpponentId = "deck1",
  random: () => number = Math.random
): BattleState {
  const opponent = getCpuOpponent(opponentId);
  const state = createDeckBattleState(config, playerCardIds, opponent.cardIds, playerSummonId, random);
  if (opponent.summonId !== "random") state.cpuSummonId = opponent.summonId;
  const positions: Record<string, Vec2> = {
    SC012: cpuFieldPosition(config, 0, .18),
    SC009: cpuFieldPosition(config, 0, .38),
    SC005: cpuFieldPosition(config, -.28, .28),
    SC007: cpuFieldPosition(config, .28, .28)
  };
  if (opponent.id === "deck2") {
    positions.SC015 = cpuFieldPosition(config, -.1, .38);
    positions.SC009 = cpuFieldPosition(config, -.28, .28);
    positions.SC004 = cpuFieldPosition(config, 0, .11);
  } else if (opponent.id === "deck3") {
    positions.SC014 = cpuFieldPosition(config, -.07, .16);
    positions.SC013 = cpuFieldPosition(config, .07, .16);
    positions.SC003 = cpuFieldPosition(config, 0, .4);
    positions.SC010 = cpuFieldPosition(config, .294, .36);
  }
  for (const unit of state.units.filter(unit => unit.team === "Cpu")) {
    const position = positions[unit.cardId!];
    unit.position = { ...position };
    unit.spawnPosition = { ...position };
    unit.destination = { ...position };
  }
  return state;
}
