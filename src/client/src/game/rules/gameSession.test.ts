import test from "node:test";
import assert from "node:assert/strict";
import { GameSession } from "./gameSession";

test("CPUリーダーHPが0になるとPlayerWinになる", () => {
  const session = new GameSession();
  session.state.leaders.find((leader) => leader.team === "Cpu")!.currentHp = 0;
  session.tick(0);
  assert.equal(session.state.result, "PlayerWin");
});

test("時間切れ時はリーダーHPの高い側が勝つ", () => {
  const session = new GameSession();
  session.state.remainingSeconds = 0.1;
  session.state.leaders.find((leader) => leader.team === "Player")!.currentHp = 900;
  session.state.leaders.find((leader) => leader.team === "Cpu")!.currentHp = 800;
  session.tick(0.2);
  assert.equal(session.state.result, "PlayerWin");
});
