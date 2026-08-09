import test from "node:test";
import assert from "node:assert/strict";
import { transitionRevivalDragRelease } from "./revivalDrag";

test("撤退カードをMP充足状態で回復エリアへ置くとReviveUnitを生成する", () => {
  const transition = transitionRevivalDragRelease(
    { draggedUnitId: "PlayerMelee" },
    {
      phase: "InProgress",
      targetDefeated: true,
      enoughMp: true,
      insideBattlefield: true,
      insideHealingArea: true
    },
    { x: 0, y: -4.1 }
  );

  assert.deepEqual(transition.command, {
    commandType: "ReviveUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: 0, y: -4.1 }
  });
  assert.equal(transition.draggedUnitId, null);
});

for (const invalid of [
  { targetDefeated: false },
  { enoughMp: false },
  { insideBattlefield: false },
  { insideHealingArea: false },
  { phase: "Countdown" as const }
]) {
  test(`無効な復活ドロップはコマンドを生成しない: ${JSON.stringify(invalid)}`, () => {
    const transition = transitionRevivalDragRelease(
      { draggedUnitId: "PlayerMelee" },
      {
        phase: "InProgress",
        targetDefeated: true,
        enoughMp: true,
        insideBattlefield: true,
        insideHealingArea: true,
        ...invalid
      },
      { x: 0, y: -4.1 }
    );
    assert.equal(transition.command, null);
    assert.equal(transition.draggedUnitId, null);
  });
}
