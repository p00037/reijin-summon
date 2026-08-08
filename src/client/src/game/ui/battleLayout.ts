export type UiRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BattleLayout = {
  leftPanel: UiRect;
  field: UiRect;
  waitingArea: UiRect;
  playerHp: UiRect;
  cpuHp: UiRect;
  mp: UiRect;
  summonGauge: UiRect;
  remainingTime: UiRect;
  buildButton: UiRect;
  summonButton: UiRect;
  retryButton: UiRect;
};

const buttonSize = 52;

export function calculateBattleLayout(width: number, height: number): BattleLayout {
  const buttonX = roundToTenth(width - buttonSize - 0.4);

  return {
    leftPanel: { x: 6, y: 8, width: 106, height: 326 },
    cpuHp: { x: 25, y: 28, width: 12, height: 118 },
    playerHp: { x: 25, y: 174, width: 12, height: 118 },
    mp: { x: 75, y: 28, width: 12, height: 118 },
    summonGauge: { x: 75, y: 174, width: 12, height: 118 },
    field: { x: 120, y: 8, width: 456, height: 326 },
    waitingArea: {
      x: 120,
      y: 342,
      width: 456,
      height: roundToTenth(height - 342 - 10)
    },
    remainingTime: { x: buttonX, y: 8, width: buttonSize, height: 53 },
    buildButton: { x: buttonX, y: 69, width: buttonSize, height: buttonSize },
    summonButton: { x: buttonX, y: 129, width: buttonSize, height: buttonSize },
    retryButton: { x: buttonX, y: 189, width: buttonSize, height: buttonSize }
  };
}

export function isPointInHud(layout: BattleLayout, x: number, y: number): boolean {
  return [
    layout.leftPanel,
    layout.waitingArea,
    layout.remainingTime,
    layout.buildButton,
    layout.summonButton,
    layout.retryButton
  ].some((rect) => containsPoint(rect, x, y));
}

function containsPoint(rect: UiRect, x: number, y: number): boolean {
  return x >= rect.x
    && x <= rect.x + rect.width
    && y >= rect.y
    && y <= rect.y + rect.height;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
