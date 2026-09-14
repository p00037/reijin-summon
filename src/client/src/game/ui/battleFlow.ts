import type { BattleState } from "../core/types";
import "./battleFlow.css";

export function mountBattleFlow(callbacks: { start: () => void; retry: () => void; edit: () => void }): {
  update: (state: BattleState) => void;
  destroy: () => void;
} {
  const host = document.createElement("section");
  host.className = "battle-flow";
  host.setAttribute("aria-label", "戦闘操作");
  const title = document.createElement("h2");
  const hint = document.createElement("p");
  const actions = document.createElement("div");
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
  host.append(title, hint, actions);
  document.body.append(host);
  let lastMode = "";
  return {
    update(state) {
      const mode = state.result !== "InProgress" ? state.result : state.phase;
      if (mode === lastMode) return;
      lastMode = mode;
      const setup = mode === "Setup";
      const finished = state.result !== "InProgress";
      host.hidden = !setup && !finished;
      host.classList.toggle("battle-flow--result", finished);
      title.textContent = setup ? "初期配置" : mode === "PlayerWin" ? "勝利" : mode === "CpuWin" ? "敗北" : "引き分け";
      hint.textContent = setup ? "味方カードをドラッグして配置を調整できます。" : "同じ編成で再戦するか、デッキを組み直せます。";
      start.hidden = !setup;
      retry.hidden = !finished;
    },
    destroy() { host.remove(); }
  };
}
