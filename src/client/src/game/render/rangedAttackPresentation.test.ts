import assert from "node:assert/strict";
import test from "node:test";
import {
  attackEffectPresentation,
  rangedAttackProjectileAssetPath,
  rangedAttackProjectileTextureKey
} from "./rangedAttackPresentation";

test("マスター遠距離攻撃は右向きの弾丸表示を返す", () => {
  assert.deepEqual(
    attackEffectPresentation("Ranged", { x: 10, y: 20 }, { x: 90, y: 20 }),
    {
      kind: "RangedProjectile",
      origin: { x: 10, y: 20 },
      target: { x: 90, y: 20 },
      rotation: 0,
      displayWidth: 72,
      displayHeight: 72,
      durationMs: 250,
      depth: 3
    }
  );
});

test("マスター以外の攻撃は既存の直線表示を返す", () => {
  for (const unitType of ["Melee", "Speed", null] as const) {
    assert.deepEqual(
      attackEffectPresentation(unitType, { x: 10, y: 20 }, { x: 90, y: 20 }),
      {
        kind: "Line",
        origin: { x: 10, y: 20 },
        target: { x: 90, y: 20 }
      }
    );
  }
});

test("弾丸表示は指定された画像アセットを使用する", () => {
  assert.equal(rangedAttackProjectileTextureKey, "ranged-attack-projectile");
  assert.equal(
    rangedAttackProjectileAssetPath,
    "/assets/effects/melee_attack1.png"
  );
});

test("弾丸表示は攻撃方向に合わせて回転する", () => {
  const cases = [
    {
      name: "下",
      target: { x: 10, y: 100 },
      expectedRotation: Math.PI / 2
    },
    {
      name: "上",
      target: { x: 10, y: -60 },
      expectedRotation: -Math.PI / 2
    },
    {
      name: "左下",
      target: { x: -70, y: 100 },
      expectedRotation: Math.PI * 3 / 4
    }
  ];

  for (const { name, target, expectedRotation } of cases) {
    const presentation = attackEffectPresentation(
      "Ranged",
      { x: 10, y: 20 },
      target
    );
    assert.equal(presentation.kind, "RangedProjectile", name);
    if (presentation.kind === "RangedProjectile") {
      assert.ok(
        Math.abs(presentation.rotation - expectedRotation) < 1e-12,
        name
      );
    }
  }
});

test("攻撃元と対象が同一点でも有限な回転値を返す", () => {
  const presentation = attackEffectPresentation(
    "Ranged",
    { x: 10, y: 20 },
    { x: 10, y: 20 }
  );

  assert.equal(presentation.kind, "RangedProjectile");
  if (presentation.kind === "RangedProjectile") {
    assert.equal(presentation.rotation, 0);
    assert.equal(Number.isFinite(presentation.rotation), true);
  }
});
