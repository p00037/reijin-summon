import { gameViewport } from "./gameViewport";

export type HighDpiCanvas = Readonly<{
  renderScale: number;
  width: number;
  height: number;
}>;

const maximumRenderScale = 2;

export function normalizeRenderScale(
  devicePixelRatio: number | undefined
): number {
  if (
    devicePixelRatio === undefined
    || !Number.isFinite(devicePixelRatio)
    || devicePixelRatio < 1
  ) {
    return 1;
  }
  return Math.min(devicePixelRatio, maximumRenderScale);
}

export function calculateHighDpiCanvas(
  devicePixelRatio: number | undefined
): HighDpiCanvas {
  const renderScale = normalizeRenderScale(devicePixelRatio);
  return {
    renderScale,
    width: Math.round(gameViewport.width * renderScale),
    height: Math.round(gameViewport.height * renderScale)
  };
}

export const highDpiCanvas = calculateHighDpiCanvas(
  typeof window === "undefined" ? undefined : window.devicePixelRatio
);
