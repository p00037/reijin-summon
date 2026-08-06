import assert from "node:assert/strict";
import test from "node:test";
import {
  attackEffectPresentation,
  drawAttackEvent,
  rangedAttackProjectileAssetPath,
  rangedAttackProjectileTextureKey
} from "./rangedAttackPresentation";

test("短距離のマスター攻撃はworld座標で判定して線・画像・Tweenを生成しない", () => {
  let lineCount = 0;
  let imageCount = 0;
  let tweenCount = 0;

  drawAttackEvent(
    "Ranged",
    { x: 10, y: 20 },
    { x: 10.5, y: 20 },
    { x: 100, y: 200 },
    { x: 900, y: 200 },
    {
      drawLine: () => {
        lineCount += 1;
      },
      createProjectile: () => {
        imageCount += 1;
        return {};
      },
      createProjectileTween: () => {
        tweenCount += 1;
      }
    }
  );

  assert.equal(lineCount, 0);
  assert.equal(imageCount, 0);
  assert.equal(tweenCount, 0);
});

test("マスターの遠距離攻撃は距離1.0以下ならエフェクトを表示しない", () => {
  for (const attackDistance of [0, 0.999, 1]) {
    assert.deepEqual(
      attackEffectPresentation(
        "Ranged",
        attackDistance,
        { x: 10, y: 20 },
        { x: 90, y: 20 }
      ),
      { kind: "None" }
    );
  }
});

test("マスターの遠距離攻撃は距離1.0を超えると500msの弾丸を返す", () => {
  assert.deepEqual(
    attackEffectPresentation(
      "Ranged",
      1.001,
      { x: 10, y: 20 },
      { x: 90, y: 20 }
    ),
    {
      kind: "RangedProjectile",
      origin: { x: 10, y: 20 },
      target: { x: 90, y: 20 },
      rotation: 0,
      displayWidth: 72,
      displayHeight: 72,
      durationMs: 500,
      depth: 3
    }
  );
});

test("マスター以外の攻撃は距離によらず既存の直線表示を返す", () => {
  for (const unitType of ["Melee", "Speed", null] as const) {
    for (const attackDistance of [0, 2]) {
      assert.deepEqual(
        attackEffectPresentation(
          unitType,
          attackDistance,
          { x: 10, y: 20 },
          { x: 90, y: 20 }
        ),
        {
          kind: "Line",
          origin: { x: 10, y: 20 },
          target: { x: 90, y: 20 }
        }
      );
    }
  }
});

test("弾丸表示は攻撃方向に合わせて回転する", () => {
  const cases = [
    { name: "下", target: { x: 10, y: 100 }, expectedRotation: Math.PI / 2 },
    { name: "上", target: { x: 10, y: -60 }, expectedRotation: -Math.PI / 2 },
    {
      name: "左下",
      target: { x: -70, y: 100 },
      expectedRotation: (Math.PI * 3) / 4
    }
  ];

  for (const { name, target, expectedRotation } of cases) {
    const presentation = attackEffectPresentation(
      "Ranged",
      2,
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
    2,
    { x: 10, y: 20 },
    { x: 10, y: 20 }
  );

  assert.equal(presentation.kind, "RangedProjectile");
  if (presentation.kind === "RangedProjectile") {
    assert.equal(presentation.rotation, 0);
    assert.equal(Number.isFinite(presentation.rotation), true);
  }
});

test("弾丸表示は指定された画像アセットを使用する", () => {
  assert.equal(rangedAttackProjectileTextureKey, "ranged-attack-projectile");
  assert.equal(
    rangedAttackProjectileAssetPath,
    "/assets/effects/melee_attack1.png"
  );
});
