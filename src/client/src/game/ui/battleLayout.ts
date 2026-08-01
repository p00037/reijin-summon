export type UiRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BattleLayout = {
  topBar: UiRect;
  field: UiRect;
  bottomBar: UiRect;
  playerHp: UiRect;
  cpuHp: UiRect;
  summonGauge: UiRect;
  buildButton: UiRect;
  summonButton: UiRect;
  retryButton: UiRect;
};

const topBarHeight = 48;
const fieldTopGap = 8;
const fieldWidth = 515.2;
const fieldHeight = 368;
const buttonSize = 52;
const buttonGap = 8;
const buttonFieldGap = 12;
const hpBarOuterInset = 4;
const remainingTimeWidth = 52;
const hpBarHeight = 28;
const hpBarTopInset = 10;
const summonGaugeWidth = 360;
const summonGaugeHeight = 28;
const summonGaugeFieldGap = 8;

export function calculateBattleLayout(width: number, height: number): BattleLayout {
  const field: UiRect = {
    x: roundToTenth((width - fieldWidth) / 2),
    y: topBarHeight + fieldTopGap,
    width: fieldWidth,
    height: fieldHeight
  };
  const fieldBottom = roundToTenth(field.y + field.height);
  const buttonX = roundToTenth(field.x + field.width + buttonFieldGap);
  const retryY = roundToTenth(fieldBottom - buttonSize);
  const hpBarWidth = roundToTenth(
    (width - hpBarOuterInset * 2 - remainingTimeWidth) / 2
  );
  const playerHp: UiRect = {
    x: hpBarOuterInset,
    y: hpBarTopInset,
    width: hpBarWidth,
    height: hpBarHeight
  };
  const cpuHp: UiRect = {
    x: roundToTenth(width - hpBarOuterInset - hpBarWidth),
    y: hpBarTopInset,
    width: hpBarWidth,
    height: hpBarHeight
  };
  const summonGauge: UiRect = {
    x: roundToTenth((width - summonGaugeWidth) / 2),
    y: roundToTenth(fieldBottom + summonGaugeFieldGap),
    width: summonGaugeWidth,
    height: summonGaugeHeight
  };

  return {
    topBar: { x: 0, y: 0, width, height: topBarHeight },
    field,
    bottomBar: {
      x: 0,
      y: fieldBottom,
      width,
      height: roundToTenth(height - fieldBottom)
    },
    playerHp,
    cpuHp,
    summonGauge,
    buildButton: {
      x: buttonX,
      y: retryY - (buttonSize + buttonGap) * 2,
      width: buttonSize,
      height: buttonSize
    },
    summonButton: {
      x: buttonX,
      y: retryY - buttonSize - buttonGap,
      width: buttonSize,
      height: buttonSize
    },
    retryButton: { x: buttonX, y: retryY, width: buttonSize, height: buttonSize }
  };
}

export function isPointInHud(layout: BattleLayout, x: number, y: number): boolean {
  return [
    layout.topBar,
    layout.bottomBar,
    layout.summonGauge,
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
