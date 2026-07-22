import assert from "node:assert/strict";
import test from "node:test";
import { healingAreaPresentation } from "./healingAreaPresentation";

test("回復エリアは指定半径と薄緑半透明の描画値を返す", () => {
  assert.deepEqual(healingAreaPresentation(2), {
    radius: 2,
    fillColor: 0x86efac,
    fillAlpha: 0.12,
    strokeColor: 0x86efac,
    strokeAlpha: 0.45,
    strokeWidth: 2
  });
});
