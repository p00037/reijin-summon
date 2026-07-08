import test from "node:test";
import assert from "node:assert/strict";
import {
  meleeAnimationKeyForUnit,
  meleeAnimationFrameRate,
  meleeFrameStart,
  rangedAnimationKeyForUnit,
  rangedAnimationFrameRate,
  rangedFrameStart,
  speedAnimationKeyForUnit,
  speedAnimationFrameRate,
  speedFrameStart,
  summonedAnimationKeyForUnit,
  summonedAnimationFrameRate,
  summonedFrameStart
} from "./unitAnimation";
import type { LeaderState, SummonedUnitState, UnitState } from "../core/types";

const rangedUnit = {
  unitId: "PlayerRanged",
  team: "Player",
  unitType: "Ranged",
  position: { x: 0, y: 0 },
  spawnPosition: { x: 0, y: 0 },
  destination: { x: 0, y: 0 },
  stats: {
    maxHp: 220,
    moveSpeed: 1,
    attackDamage: 35,
    attackRange: 3.5,
    attackIntervalSeconds: 1.4
  },
  currentHp: 220,
  mode: "Active",
  buildTimerSeconds: 0,
  respawnTimerSeconds: 0,
  attackTimerSeconds: 0,
  pendingElementalId: null
} satisfies UnitState;

const speedUnit = {
  ...rangedUnit,
  unitId: "PlayerSpeed",
  unitType: "Speed",
  stats: {
    maxHp: 250,
    moveSpeed: 5.5 / 3,
    attackDamage: 30,
    attackRange: 1,
    attackIntervalSeconds: 0.8
  },
  currentHp: 250
} satisfies UnitState;

const meleeUnit = {
  ...rangedUnit,
  unitId: "PlayerMelee",
  unitType: "Melee",
  stats: {
    maxHp: 350,
    moveSpeed: 3.5 / 3,
    attackDamage: 45,
    attackRange: 1.25,
    attackIntervalSeconds: 1.2
  },
  currentHp: 350
} satisfies UnitState;

const cpuLeader = {
  leaderId: "Cpu",
  team: "Cpu",
  position: { x: 7, y: 0 },
  maxHp: 1000,
  currentHp: 1000
} satisfies LeaderState;

const summonedUnit = {
  summonedUnitId: 1,
  team: "Player",
  position: { x: 0, y: 0 },
  destination: { x: 7, y: 0 },
  maxHp: 1200,
  currentHp: 1200,
  attackDamage: 100,
  moveSpeed: 1,
  healthDecayPerSecond: 10
} satisfies SummonedUnitState;

test("Rangedユニットは状態からモーションキーを選ぶ", () => {
  assert.equal(rangedAnimationKeyForUnit(rangedUnit, []), "ranged-idle");
  assert.equal(
    rangedAnimationKeyForUnit({ ...rangedUnit, destination: { x: 1, y: 0 } }, []),
    "ranged-walk"
  );
  assert.equal(
    rangedAnimationKeyForUnit(rangedUnit, [{ attackerUnitId: "PlayerRanged", origin: { x: 0, y: 0 }, targetPosition: { x: 1, y: 0 } }]),
    "ranged-attack"
  );
  assert.equal(rangedAnimationKeyForUnit({ ...rangedUnit, mode: "Defeated", currentHp: 0 }, []), "ranged-defeated");
});

test("mermaid.pngの行構成に対応する開始フレームを返す", () => {
  assert.equal(rangedFrameStart("idle"), 0);
  assert.equal(rangedFrameStart("walk"), 4);
  assert.equal(rangedFrameStart("attack"), 8);
  assert.equal(rangedFrameStart("damage"), 12);
  assert.equal(rangedFrameStart("defeated"), 16);
});

test("Speedユニットは状態からshark用モーションキーを選ぶ", () => {
  assert.equal(speedAnimationKeyForUnit(speedUnit, []), "speed-idle");
  assert.equal(speedAnimationKeyForUnit({ ...speedUnit, destination: { x: 1, y: 0 } }, []), "speed-walk");
  assert.equal(
    speedAnimationKeyForUnit(speedUnit, [{ attackerUnitId: "PlayerSpeed", origin: { x: 0, y: 0 }, targetPosition: { x: 1, y: 0 } }]),
    "speed-attack"
  );
  assert.equal(speedAnimationKeyForUnit({ ...speedUnit, mode: "Defeated", currentHp: 0 }, []), "speed-defeated");
});

test("shark.pngの行構成に対応する開始フレームを返す", () => {
  assert.equal(speedFrameStart("idle"), 0);
  assert.equal(speedFrameStart("walk"), 4);
  assert.equal(speedFrameStart("attack"), 8);
  assert.equal(speedFrameStart("damage"), 12);
  assert.equal(speedFrameStart("defeated"), 16);
});

test("Meleeユニットは状態からoctopus用モーションキーを選ぶ", () => {
  assert.equal(meleeAnimationKeyForUnit(meleeUnit, []), "melee-idle");
  assert.equal(meleeAnimationKeyForUnit({ ...meleeUnit, destination: { x: 1, y: 0 } }, []), "melee-walk");
  assert.equal(
    meleeAnimationKeyForUnit(meleeUnit, [{ attackerUnitId: "PlayerMelee", origin: { x: 0, y: 0 }, targetPosition: { x: 1, y: 0 } }]),
    "melee-attack"
  );
  assert.equal(meleeAnimationKeyForUnit({ ...meleeUnit, mode: "Defeated", currentHp: 0 }, []), "melee-defeated");
});

test("octopus.pngの行構成に対応する開始フレームを返す", () => {
  assert.equal(meleeFrameStart("idle"), 0);
  assert.equal(meleeFrameStart("walk"), 4);
  assert.equal(meleeFrameStart("attack"), 8);
  assert.equal(meleeFrameStart("damage"), 12);
  assert.equal(meleeFrameStart("defeated"), 16);
});

test("召喚獣は敵リーダーに接触中だけattackモーションを選ぶ", () => {
  assert.equal(summonedAnimationKeyForUnit(summonedUnit, cpuLeader, 0.45), "summoned-walk");
  assert.equal(
    summonedAnimationKeyForUnit({ ...summonedUnit, position: { x: 6.8, y: 0 } }, cpuLeader, 0.45),
    "summoned-attack"
  );
});

test("seiryuu.pngの行構成に対応する開始フレームを返す", () => {
  assert.equal(summonedFrameStart("walk"), 0);
  assert.equal(summonedFrameStart("attack"), 4);
});

test("通常ユニットのidleモーションだけ低いフレームレートを返す", () => {
  assert.equal(rangedAnimationFrameRate("idle"), 4);
  assert.equal(speedAnimationFrameRate("idle"), 4);
  assert.equal(meleeAnimationFrameRate("idle"), 4);
  assert.equal(rangedAnimationFrameRate("walk"), 7);
  assert.equal(speedAnimationFrameRate("attack"), 7);
  assert.equal(meleeAnimationFrameRate("defeated"), 7);
});

test("召喚獣のattackモーションだけ少し低いフレームレートを返す", () => {
  assert.equal(summonedAnimationFrameRate("walk"), 7);
  assert.equal(summonedAnimationFrameRate("attack"), 5);
});
