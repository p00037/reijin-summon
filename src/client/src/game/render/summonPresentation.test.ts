import test from "node:test";
import assert from "node:assert/strict";
import { summonCardFor } from "./summonPresentation";

test("召喚獣カードは選択された種類の専用画像を使い、既存の表示寸法を保つ", () => {
  const card = summonCardFor("leviathan");
  assert.equal(card.path, "/assets/summons/leviathan.png");
  assert.equal(card.textureKey, "summon-leviathan");
  assert.equal(card.displayWidth, 51.52 * 1.3);
  assert.equal(card.displayHeight, 92 * 1.3);
  assert.notEqual(summonCardFor("jackpot").textureKey, card.textureKey);
});
