import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBattleConfig } from "../core/battleConfig";
import { createDefaultBattleState, findUnit } from "../core/battleState";
import { cardRotationForMovement } from "./cardFacing";
async function loadAbilityPresentation() { return import('./abilityPresentation'); }

test('未選択・AP不足・能力なし・戦闘不能・試合終了では予告を表示しない',async()=>{
 const module=await loadAbilityPresentation(),config=createDefaultBattleConfig(),state=createDefaultBattleState(config);
 state.phase='InProgress';const unit=state.units[0];unit.cardId='SC002';
 assert.equal(module.abilityTargetingPresentation(state,config,null,0),null);
 assert.equal(module.abilityTargetingPresentation(state,config,'PlayerMelee',0),null);
 unit.abilityAp=1;unit.cardId='SC010';assert.equal(module.abilityTargetingPresentation(state,config,'PlayerMelee',0),null);
 unit.cardId='SC002';unit.currentHp=0;assert.equal(module.abilityTargetingPresentation(state,config,'PlayerMelee',0),null);
 unit.currentHp=100;unit.mode='Defeated';assert.equal(module.abilityTargetingPresentation(state,config,'PlayerMelee',0),null);
 unit.mode='Active';state.phase='Countdown';assert.equal(module.abilityTargetingPresentation(state,config,'PlayerMelee',0),null);
 state.phase='InProgress';state.result='Draw';assert.equal(module.abilityTargetingPresentation(state,config,'PlayerMelee',0),null);
});
test('抽選前は候補全員を表示し、抽選イベントは生成しない',async()=>{
 const module=await loadAbilityPresentation(),config=createDefaultBattleConfig(),state=createDefaultBattleState(config);
 state.phase='InProgress';const unit=state.units[0];unit.cardId='SC002';unit.abilityAp=1;unit.position={x:0,y:0};
 state.units.slice(3).forEach(u=>u.position={x:0,y:2});
 const before=structuredClone(state),p=module.abilityTargetingPresentation(state,config,'PlayerMelee',0)!;
 assert.equal(p.markers.length,3);assert.equal(p.area?.kind,'circle');assert.deepEqual(state,before);
});
test('大津波は半面、雨の全体強化は戦場全域を表示',async()=>{
 const module=await loadAbilityPresentation(),config=createDefaultBattleConfig(),state=createDefaultBattleState(config);
 state.phase='InProgress';const unit=state.units[0];unit.cardId='SC015';unit.abilityAp=3;unit.position.y=-1;
 let p=module.abilityTargetingPresentation(state,config,'PlayerMelee',0)!;
 assert.equal(p.area?.kind,'rectangle');if(p.area?.kind==='rectangle') assert.equal(p.area.max.y,0);
 unit.cardId='SC009';state.rainRemainingSeconds=100;p=module.abilityTargetingPresentation(state,config,'PlayerMelee',0)!;
 if(p.area?.kind==='rectangle') {assert.deepEqual(p.area.min,config.battlefieldMin);assert.deepEqual(p.area.max,config.battlefieldMax);}
 else assert.fail('全域矩形が必要');
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

test("画面右移動から得たカード回転角はキーパー範囲をworld +X側に表示する", async () => {
  const module = await loadAbilityPresentation();
  assert.equal(typeof module.abilityTargetingPresentation, "function");
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.phase = "InProgress";
  const keeper = findUnit(state, "PlayerMelee");
  keeper.position = { x: 3, y: 4 };
  keeper.cardId = 'SC002';
  keeper.abilityAp = 1;

  const facingRotation = cardRotationForMovement(
    { x: 100, y: 100 },
    { x: 110, y: 100 },
    0
  );
  const presentation = module.abilityTargetingPresentation!(
    state,
    config,
    "PlayerMelee",
    facingRotation
  )!;

  assert.equal(facingRotation, Math.PI / 2);
  assert.equal(presentation.area?.kind, 'circle');
  if (presentation.area?.kind !== 'circle') assert.fail('円が必要');
  assert.ok(
    Math.abs(
      presentation.area!.center.x
      - (keeper.position.x + config.unitCardWorldHeight)
    ) < 1e-12
  );
  assert.ok(Math.abs(presentation.area!.center.y - keeper.position.y) < 1e-12);
});
