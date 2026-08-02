export interface UnitSelectionCirclePresentation {
  radius: number;
  strokeWidth: number;
  strokeColor: number;
  strokeAlpha: number;
}

export function unitSelectionCirclePresentation(
  contactRadius: number,
  battlefieldScreenWidth: number,
  battlefieldWorldWidth: number
): UnitSelectionCirclePresentation {
  return {
    radius: Math.abs(
      contactRadius * battlefieldScreenWidth / battlefieldWorldWidth
    ),
    strokeWidth: 3,
    strokeColor: 0xfacc15,
    strokeAlpha: 1
  };
}
