export interface UnitSelectionCirclePresentation {
  radius: number;
  strokeWidth: number;
  strokeColor: number;
  strokeAlpha: number;
}

export function unitSelectionCirclePresentation(
  collisionRadius: number,
  battlefieldScreenWidth: number,
  battlefieldWorldWidth: number
): UnitSelectionCirclePresentation {
  return {
    radius: Math.abs(
      collisionRadius * battlefieldScreenWidth / battlefieldWorldWidth
    ),
    strokeWidth: 3,
    strokeColor: 0xfacc15,
    strokeAlpha: 1
  };
}
