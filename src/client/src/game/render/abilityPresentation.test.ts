import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findUnit } from "../core/battleState";

async function loadAbilityPresentation(): Promise<
  Partial<typeof import("./abilityPresentation")>
> {
  return await import("./abilityPresentation").catch(() => ({}));
}

test("アビリティ対象表示は未選択またはAP不足なら表示しない", async () => {
  const module = await loadAbilityPresentation();
  assert.equal(typeof module.abilityTargetingPresentation, "function");
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.phase = "InProgress";

  assert.equal(
    module.abilityTargetingPresentation!(state, config, null),
    null
  );
  assert.equal(
    module.abilityTargetingPresentation!(state, config, "PlayerRanged"),
    null
  );
});

test("アビリティ対象表示は戦闘進行中でなければ表示しない", async () => {
  const module = await loadAbilityPresentation();
  assert.equal(typeof module.abilityTargetingPresentation, "function");
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  findUnit(state, "PlayerRanged").abilityAp = 2;

  state.phase = "Countdown";
  assert.equal(
    module.abilityTargetingPresentation!(state, config, "PlayerRanged"),
    null
  );

  state.phase = "InProgress";
  state.result = "PlayerWin";
  assert.equal(
    module.abilityTargetingPresentation!(state, config, "PlayerRanged"),
    null
  );
});

test("アビリティ対象表示はDefeatedの選択ユニットを表示しない", async () => {
  const module = await loadAbilityPresentation();
  assert.equal(typeof module.abilityTargetingPresentation, "function");
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.phase = "InProgress";
  const master = findUnit(state, "PlayerRanged");
  master.abilityAp = 2;
  master.mode = "Defeated";

  assert.equal(
    module.abilityTargetingPresentation!(state, config, "PlayerRanged"),
    null
  );
});

test("アビリティ対象表示はHP0の選択ユニットを表示しない", async () => {
  const module = await loadAbilityPresentation();
  assert.equal(typeof module.abilityTargetingPresentation, "function");
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.phase = "InProgress";
  const master = findUnit(state, "PlayerRanged");
  master.abilityAp = 2;
  master.currentHp = 0;

  assert.equal(
    module.abilityTargetingPresentation!(state, config, "PlayerRanged"),
    null
  );
});

test("アビリティ対象表示は満タンのマスター自身にCircleマークを表示する", async () => {
  const module = await loadAbilityPresentation();
  assert.equal(typeof module.abilityTargetingPresentation, "function");
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.phase = "InProgress";
  const master = findUnit(state, "PlayerRanged");
  master.position = { x: 2.5, y: 4.5 };
  master.abilityAp = 2;

  assert.deepEqual(
    module.abilityTargetingPresentation!(state, config, "PlayerRanged"),
    {
      area: null,
      markers: [{ kind: "Circle", position: { x: 2.5, y: 4.5 } }],
      color: 0xfacc15
    }
  );
});

test("アビリティ対象表示はシーカーの範囲円と範囲内UnitのLockOnを表示する", async () => {
  const module = await loadAbilityPresentation();
  assert.equal(typeof module.abilityTargetingPresentation, "function");
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.phase = "InProgress";
  const seeker = findUnit(state, "PlayerSpeed");
  const keeper = findUnit(state, "PlayerMelee");
  const master = findUnit(state, "PlayerRanged");
  seeker.position = { x: 1, y: 2 };
  keeper.position = { x: 1 + config.unitCardWorldHeight, y: 2 };
  master.position = { x: 99, y: 99 };
  seeker.abilityAp = 3;

  assert.deepEqual(
    module.abilityTargetingPresentation!(state, config, "PlayerSpeed"),
    {
      area: {
        center: { x: 1, y: 2 },
        radius: config.unitCardWorldHeight * 1.5,
        fillAlpha: 0.16,
        strokeAlpha: 0.9
      },
      markers: [
        { kind: "LockOn", position: { ...keeper.position } },
        { kind: "LockOn", position: { ...seeker.position } }
      ],
      color: 0xfacc15
    }
  );
});

test("アビリティ対象表示はキーパーの前方円と対象ElementalのLockOnを表示する", async () => {
  const module = await loadAbilityPresentation();
  assert.equal(typeof module.abilityTargetingPresentation, "function");
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.phase = "InProgress";
  const keeper = findUnit(state, "PlayerMelee");
  keeper.position = { x: 3, y: 4 };
  keeper.abilityAp = 2;
  state.elementals = [
    {
      elementalId: "Elemental1",
      team: "Player",
      position: { x: 3, y: 4 + config.unitCardWorldHeight },
      maxHp: 1000,
      currentHp: 1000,
      isComplete: true
    }
  ];

  assert.deepEqual(
    module.abilityTargetingPresentation!(state, config, "PlayerMelee"),
    {
      area: {
        center: { x: 3, y: 4 + config.unitCardWorldHeight },
        radius: config.unitCardWorldHeight / 2,
        fillAlpha: 0.16,
        strokeAlpha: 0.9
      },
      markers: [
        { kind: "LockOn", position: { ...state.elementals[0].position } }
      ],
      color: 0xfacc15
    }
  );
});

test("アビリティ対象表示はキーパーの対象が0でも前方範囲円を表示する", async () => {
  const module = await loadAbilityPresentation();
  assert.equal(typeof module.abilityTargetingPresentation, "function");
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.phase = "InProgress";
  const keeper = findUnit(state, "PlayerMelee");
  keeper.position = { x: 5, y: 6 };
  keeper.abilityAp = 2;
  state.elementals = [];

  assert.deepEqual(
    module.abilityTargetingPresentation!(state, config, "PlayerMelee"),
    {
      area: {
        center: { x: 5, y: 6 + config.unitCardWorldHeight },
        radius: config.unitCardWorldHeight / 2,
        fillAlpha: 0.16,
        strokeAlpha: 0.9
      },
      markers: [],
      color: 0xfacc15
    }
  );
});

test("アビリティ対象表示のCircleは選択円と区別できる二重円にする", async () => {
  const module = await loadAbilityPresentation();
  assert.equal(typeof module.abilityTargetMarkerScreenPresentation, "function");

  assert.deepEqual(
    module.abilityTargetMarkerScreenPresentation!("Circle", { x: 100, y: 80 }),
    {
      circles: [
        { center: { x: 100, y: 80 }, radius: 16 },
        { center: { x: 100, y: 80 }, radius: 22 }
      ],
      lines: []
    }
  );
});

test("アビリティ対象表示のLockOnは四隅の短いL字線にする", async () => {
  const module = await loadAbilityPresentation();
  assert.equal(typeof module.abilityTargetMarkerScreenPresentation, "function");

  assert.deepEqual(
    module.abilityTargetMarkerScreenPresentation!("LockOn", { x: 100, y: 80 }),
    {
      circles: [],
      lines: [
        { from: { x: 82, y: 69 }, to: { x: 82, y: 62 } },
        { from: { x: 82, y: 62 }, to: { x: 89, y: 62 } },
        { from: { x: 118, y: 69 }, to: { x: 118, y: 62 } },
        { from: { x: 118, y: 62 }, to: { x: 111, y: 62 } },
        { from: { x: 82, y: 91 }, to: { x: 82, y: 98 } },
        { from: { x: 82, y: 98 }, to: { x: 89, y: 98 } },
        { from: { x: 118, y: 91 }, to: { x: 118, y: 98 } },
        { from: { x: 118, y: 98 }, to: { x: 111, y: 98 } }
      ]
    }
  );
});

test("アビリティ対象表示オーバーレイはHPより前面で戦場クリップを要求する", async () => {
  const module = await loadAbilityPresentation();
  assert.equal(typeof module.abilityTargetOverlayPresentation, "function");

  assert.deepEqual(module.abilityTargetOverlayPresentation!(2), {
    depth: 2.5,
    clipToBattlefield: true
  });
});
