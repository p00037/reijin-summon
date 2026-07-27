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
const bottomBarHeight = 48;
const fieldTopGap = 8;
const legacyHudHeight = 132;
const legacyVerticalPadding = 20;
const legacyHorizontalAllowance = 68;
const battlefieldAspectRatio = 1.4;
const buttonSize = 52;
const buttonGap = 8;
const buttonFieldGap = 12;
const hpBarWidth = 320;
const hpBarHeight = 28;
const hpBarSideInset = 106;
const hpBarTopInset = 10;
const summonGaugeWidth = 360;
const summonGaugeHeight = 28;
const summonGaugeFieldGap = 8;

export function calculateBattleLayout(width: number, height: number): BattleLayout {
  const legacyHudTop = height - legacyHudHeight;
  const availableHeight = legacyHudTop - legacyVerticalPadding * 2;
  const availableWidth = width - legacyHorizontalAllowance;
  const fieldHeight = roundToTenth(
    Math.min(availableHeight, availableWidth / battlefieldAspectRatio)
  );
  const fieldWidth = roundToTenth(fieldHeight * battlefieldAspectRatio);
  const field: UiRect = {
    x: roundToTenth((width - fieldWidth) / 2),
    y: topBarHeight + fieldTopGap,
    width: fieldWidth,
    height: fieldHeight
  };
  const buttonX = roundToTenth(field.x + field.width + buttonFieldGap);
  const retryY = roundToTenth(field.y + field.height - buttonSize);
  const playerHp: UiRect = {
    x: hpBarSideInset,
    y: hpBarTopInset,
    width: hpBarWidth,
    height: hpBarHeight
  };
  const cpuHp: UiRect = {
    x: width - hpBarSideInset - hpBarWidth,
    y: hpBarTopInset,
    width: hpBarWidth,
    height: hpBarHeight
  };
  const summonGauge: UiRect = {
    x: roundToTenth((width - summonGaugeWidth) / 2),
    y: roundToTenth(field.y + field.height + summonGaugeFieldGap),
    width: summonGaugeWidth,
    height: summonGaugeHeight
  };

  return {
    topBar: { x: 0, y: 0, width, height: topBarHeight },
    field,
    bottomBar: { x: 0, y: height - bottomBarHeight, width, height: bottomBarHeight },
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
