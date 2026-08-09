import { findUnit, isUnitAlive } from "../core/battleState";
import type {
  BattleConfig,
  BattleState,
  PlayerUnitId,
  Vec2
} from "../core/types";
import {
  abilityApCost,
  abilityArea,
  abilityTargets
} from "../rules/abilitySystem";

export type AbilityTargetingPresentation = {
  area: {
    center: Vec2;
    radius: number;
    fillAlpha: number;
    strokeAlpha: number;
  } | null;
  markers: Array<{
    kind: "Circle" | "LockOn";
    position: Vec2;
  }>;
  color: number;
};

export type AbilityTargetMarkerScreenPresentation = {
  circles: Array<{ center: Vec2; radius: number }>;
  lines: Array<{ from: Vec2; to: Vec2 }>;
};

export type AbilityTargetOverlayPresentation = {
  depth: number;
  clipToBattlefield: true;
};

const abilityMarkerColor = 0xfacc15;

export function abilityTargetingPresentation(
  state: BattleState,
  config: BattleConfig,
  selectedUnitId: PlayerUnitId | null
): AbilityTargetingPresentation | null {
  if (
    selectedUnitId === null
    || state.result !== "InProgress"
    || state.phase !== "InProgress"
  ) {
    return null;
  }

  const selectedUnit = findUnit(state, selectedUnitId);
  if (
    !isUnitAlive(selectedUnit)
    || selectedUnit.abilityAp < abilityApCost(selectedUnit.unitType)
  ) {
    return null;
  }

  const area = abilityArea(state, config, selectedUnitId);
  if (area === null) {
    return {
      area: null,
      markers: [{ kind: "Circle", position: { ...selectedUnit.position } }],
      color: abilityMarkerColor
    };
  }

  const targets = abilityTargets(state, config, selectedUnitId);
  const unitMarkers = targets.unitIds.map((unitId) => ({
    kind: "LockOn" as const,
    position: { ...findUnit(state, unitId).position }
  }));
  const elementalMarkers = targets.elementalIds.map((elementalId) => {
    const elemental = state.elementals.find(
      (candidate) => candidate.elementalId === elementalId
    );
    if (!elemental) {
      throw new Error(`Elemental not found: ${elementalId}`);
    }
    return {
      kind: "LockOn" as const,
      position: { ...elemental.position }
    };
  });

  return {
    area: {
      center: { ...area.center },
      radius: area.radius,
      fillAlpha: 0.16,
      strokeAlpha: 0.9
    },
    markers: [...unitMarkers, ...elementalMarkers],
    color: abilityMarkerColor
  };
}

export function abilityTargetMarkerScreenPresentation(
  kind: "Circle" | "LockOn",
  center: Vec2
): AbilityTargetMarkerScreenPresentation {
  if (kind === "Circle") {
    return {
      circles: [
        { center: { ...center }, radius: 16 },
        { center: { ...center }, radius: 22 }
      ],
      lines: []
    };
  }

  const left = center.x - 18;
  const right = center.x + 18;
  const top = center.y - 18;
  const bottom = center.y + 18;
  const innerLeft = center.x - 11;
  const innerRight = center.x + 11;
  const innerTop = center.y - 11;
  const innerBottom = center.y + 11;
  return {
    circles: [],
    lines: [
      { from: { x: left, y: innerTop }, to: { x: left, y: top } },
      { from: { x: left, y: top }, to: { x: innerLeft, y: top } },
      { from: { x: right, y: innerTop }, to: { x: right, y: top } },
      { from: { x: right, y: top }, to: { x: innerRight, y: top } },
      { from: { x: left, y: innerBottom }, to: { x: left, y: bottom } },
      { from: { x: left, y: bottom }, to: { x: innerLeft, y: bottom } },
      { from: { x: right, y: innerBottom }, to: { x: right, y: bottom } },
      { from: { x: right, y: bottom }, to: { x: innerRight, y: bottom } }
    ]
  };
}

export function abilityTargetOverlayPresentation(
  battleStatusOverlayDepth: number
): AbilityTargetOverlayPresentation {
  return {
    depth: battleStatusOverlayDepth + 0.5,
    clipToBattlefield: true
  };
}
