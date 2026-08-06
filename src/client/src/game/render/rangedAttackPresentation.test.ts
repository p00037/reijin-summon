import assert from "node:assert/strict";
import test from "node:test";
import {
  attackEffectPresentation,
  createAttackEventRenderer,
  drawAttackEvent,
  rangedAttackProjectileAssetPath,
  rangedAttackProjectileTextureKey
} from "./rangedAttackPresentation";

type TestProjectile = {
  displaySize: [number, number] | null;
  rotation: number | null;
  depth: number | null;
  blendMode: string | null;
  destroyCount: number;
  setDisplaySize: (width: number, height: number) => void;
  setRotation: (rotation: number) => void;
  setDepth: (depth: number) => void;
  setBlendMode: (blendMode: string) => void;
  destroy: () => void;
};

type TestTween = {
  targets: TestProjectile;
  x: number;
  y: number;
  duration: number;
  ease: string;
  onComplete: () => void;
};

type TestRendererDependencies = {
  drawLine: (origin: { x: number; y: number }, target: { x: number; y: number }) => void;
  createImage: (x: number, y: number, textureKey: string) => TestProjectile;
  addTween: (tween: TestTween) => void;
  additiveBlendMode: string;
};

function createTestProjectile(): TestProjectile {
  const projectile: TestProjectile = {
    displaySize: null,
    rotation: null,
    depth: null,
    blendMode: null,
    destroyCount: 0,
    setDisplaySize: (width, height) => {
      projectile.displaySize = [width, height];
    },
    setRotation: (rotation) => {
      projectile.rotation = rotation;
    },
    setDepth: (depth) => {
      projectile.depth = depth;
    },
    setBlendMode: (blendMode) => {
      projectile.blendMode = blendMode;
    },
    destroy: () => {
      projectile.destroyCount += 1;
    }
  };
  return projectile;
}

function createTestAttackEventRenderer(
  dependencies: TestRendererDependencies
) {
  return createAttackEventRenderer(dependencies);
}

test("遠距離のマスター攻撃は画像と500ms Tweenを各1回生成し同じ弾丸を渡す", () => {
  const projectiles: TestProjectile[] = [];
  const tweens: TestTween[] = [];
  const renderer = createTestAttackEventRenderer({
    drawLine: () => assert.fail("遠距離のマスター攻撃で線を描画してはならない"),
    createImage: (x, y, textureKey) => {
      assert.deepEqual([x, y, textureKey], [
        100,
        200,
        rangedAttackProjectileTextureKey
      ]);
      const projectile = createTestProjectile();
      projectiles.push(projectile);
      return projectile;
    },
    addTween: (tween) => {
      tweens.push(tween);
    },
    additiveBlendMode: "ADD"
  });

  drawAttackEvent(
    "Ranged",
    { x: 10, y: 20 },
    { x: 13, y: 24 },
    { x: 100, y: 200 },
    { x: 900, y: 600 },
    renderer
  );

  assert.equal(projectiles.length, 1);
  assert.equal(tweens.length, 1);
  assert.equal(tweens[0].targets, projectiles[0]);
  assert.equal(tweens[0].duration, 500);
  assert.deepEqual([tweens[0].x, tweens[0].y], [900, 600]);
});

test("非Ranged攻撃は画面座標のLineだけを1回描画する", () => {
  const lines: Array<[{ x: number; y: number }, { x: number; y: number }]> = [];
  let imageCount = 0;
  let tweenCount = 0;
  const renderer = createTestAttackEventRenderer({
    drawLine: (origin, target) => {
      lines.push([origin, target]);
    },
    createImage: () => {
      imageCount += 1;
      return createTestProjectile();
    },
    addTween: () => {
      tweenCount += 1;
    },
    additiveBlendMode: "ADD"
  });

  drawAttackEvent(
    "Melee",
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 120, y: 220 },
    { x: 320, y: 420 },
    renderer
  );

  assert.deepEqual(lines, [[{ x: 120, y: 220 }, { x: 320, y: 420 }]]);
  assert.equal(imageCount, 0);
  assert.equal(tweenCount, 0);
});

test("距離判定にはworld座標を使いscreen座標は描画位置だけに使う", () => {
  const imagePositions: Array<[number, number]> = [];
  const tweens: TestTween[] = [];
  const renderer = createTestAttackEventRenderer({
    drawLine: () => assert.fail("マスター攻撃で線を描画してはならない"),
    createImage: (x, y) => {
      imagePositions.push([x, y]);
      return createTestProjectile();
    },
    addTween: (tween) => {
      tweens.push(tween);
    },
    additiveBlendMode: "ADD"
  });

  drawAttackEvent(
    "Ranged",
    { x: 0, y: 0 },
    { x: 0.5, y: 0 },
    { x: 100, y: 200 },
    { x: 900, y: 200 },
    renderer
  );
  assert.equal(imagePositions.length, 0);
  assert.equal(tweens.length, 0);

  drawAttackEvent(
    "Ranged",
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 300, y: 400 },
    { x: 300, y: 400 },
    renderer
  );
  assert.deepEqual(imagePositions, [[300, 400]]);
  assert.deepEqual([tweens[0].x, tweens[0].y], [300, 400]);
});

test("Tween完了時に同じ弾丸を1回破棄する", () => {
  const projectile = createTestProjectile();
  const tweens: TestTween[] = [];
  const renderer = createTestAttackEventRenderer({
    drawLine: () => assert.fail("遠距離のマスター攻撃で線を描画してはならない"),
    createImage: () => projectile,
    addTween: (tween) => {
      tweens.push(tween);
    },
    additiveBlendMode: "ADD"
  });

  drawAttackEvent(
    "Ranged",
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 100, y: 200 },
    { x: 300, y: 200 },
    renderer
  );
  assert.equal(tweens[0].targets, projectile);

  tweens[0].onComplete();

  assert.equal(projectile.destroyCount, 1);
});

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
