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

  return {
    topBar: { x: 0, y: 0, width, height: topBarHeight },
    field,
    bottomBar: { x: 0, y: height - bottomBarHeight, width, height: bottomBarHeight },
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
