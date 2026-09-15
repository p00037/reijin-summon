import type { BattleState } from "../core/types";
import { gameViewport } from "../gameViewport";
import { calculateBattleLayout } from "./battleLayout";
import "./battleFlow.css";

export function mountBattleFlow(callbacks: { start: () => void; retry: () => void; edit: () => void }): {
  update: (state: BattleState) => void;
  destroy: () => void;
} {
  const host = document.createElement("section");
  host.className = "battle-flow";
  host.setAttribute("aria-label", "戦闘操作");
  const copy = document.createElement("div");
  copy.className = "battle-flow__copy";
  const eyebrow = document.createElement("span");
  eyebrow.className = "battle-flow__eyebrow";
  const title = document.createElement("h2");
  title.setAttribute("aria-live", "polite");
  const hint = document.createElement("p");
  const actions = document.createElement("div");
  actions.className = "battle-flow__actions";
  const button = (label: string, action: () => void) => {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.addEventListener("click", action);
    actions.append(element);
    return element;
  };
  const start = button("配置を確定して戦闘開始", callbacks.start);
  const retry = button("同じデッキで再戦", callbacks.retry);
  button("編成に戻る", callbacks.edit);
  copy.append(eyebrow, title, hint);
  host.append(copy, actions);
  document.body.append(host);
  const canvas = document.querySelector("#game canvas");
  let finished = false;
  let frame = 0;
  const position = () => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / gameViewport.width;
    const area = calculateBattleLayout(gameViewport.width, gameViewport.height).waitingArea;
    host.style.setProperty("--battle-scale", String(scale));
    host.style.left = `${rect.left + (finished ? gameViewport.width / 2 : area.x) * scale}px`;
    host.style.top = `${rect.top + (finished ? 205 : area.y) * scale}px`;
    host.style.width = `${finished ? Math.min(440, rect.width - 24) : area.width * scale}px`;
    host.style.minHeight = finished ? "" : `${area.height * scale}px`;
  };
  const schedulePosition = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(position); };
  const observer = new ResizeObserver(schedulePosition);
  if (canvas) observer.observe(canvas);
  window.addEventListener("resize", schedulePosition);
  let lastMode = "";
  return {
    update(state) {
      const mode = state.result !== "InProgress" ? state.result : state.phase;
      if (mode === lastMode) return;
      lastMode = mode;
      const setup = mode === "Setup";
      finished = state.result !== "InProgress";
      host.hidden = !setup && !finished;
      host.classList.toggle("battle-flow--result", finished);
      host.dataset.result = mode;
      eyebrow.textContent = setup ? "PREPARE YOUR FORMATION" : mode === "PlayerWin" ? "VICTORY" : mode === "CpuWin" ? "DEFEAT" : "DRAW";
      title.textContent = setup ? "初期配置" : mode === "PlayerWin" ? "勝利を、その手に。" : mode === "CpuWin" ? "次の一手が、運命を変える。" : "拮抗する、ふたつの力。";
      hint.textContent = setup ? "味方カードをドラッグして配置を調整" : "同じ編成で再び挑むか、新たな戦略を組み立てましょう。";
      start.hidden = !setup;
      retry.hidden = !finished;
      position();
    },
    destroy() {
      observer.disconnect();
      window.removeEventListener("resize", schedulePosition);
      cancelAnimationFrame(frame);
      host.remove();
    }
  };
}
