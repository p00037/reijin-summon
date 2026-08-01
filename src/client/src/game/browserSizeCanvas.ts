import { gameViewport } from "./gameViewport";

export type BrowserSizeCanvas = Readonly<{
  renderScale: number;
  width: number;
  height: number;
}>;

const minimumRenderScale = 1;
const maximumRenderScale = 2;

export function calculateBrowserRenderScale(
  viewportWidth: number | undefined,
  viewportHeight: number | undefined
): number {
  if (
    viewportWidth === undefined
    || viewportHeight === undefined
    || !Number.isFinite(viewportWidth)
    || !Number.isFinite(viewportHeight)
    || viewportWidth <= 0
    || viewportHeight <= 0
  ) {
    return minimumRenderScale;
  }

  const renderScale = Math.min(
    viewportWidth / gameViewport.width,
    viewportHeight / gameViewport.height
  );
  return Math.min(
    Math.max(renderScale, minimumRenderScale),
    maximumRenderScale
  );
}

export function calculateBrowserSizeCanvas(
  viewportWidth: number | undefined,
  viewportHeight: number | undefined
): BrowserSizeCanvas {
  const renderScale = calculateBrowserRenderScale(
    viewportWidth,
    viewportHeight
  );
  return {
    renderScale,
    width: Math.round(gameViewport.width * renderScale),
    height: Math.round(gameViewport.height * renderScale)
  };
}

export function toLogicalCanvasPoint(
  point: Readonly<{ x: number; y: number }>,
  renderScale: number
): { x: number; y: number } {
  return {
    x: point.x / renderScale,
    y: point.y / renderScale
  };
}

export function withCanvasTextResolution<T extends object>(
  style: T,
  renderScale = browserSizeCanvas.renderScale
): T & { resolution: number } {
  return {
    ...style,
    resolution: renderScale
  };
}

export const browserSizeCanvas = calculateBrowserSizeCanvas(
  typeof window === "undefined" ? undefined : window.innerWidth,
  typeof window === "undefined" ? undefined : window.innerHeight
);
