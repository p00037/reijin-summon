import assert from "node:assert/strict";
import test from "node:test";
import { cardCatalog, findCard, standardDeckCardIds } from "./cardCatalog";

test("SC001〜SC020をWiki記載のカード情報で提供する", () => {
  assert.equal(cardCatalog.length, 20);
  assert.deepEqual(cardCatalog.map((card) => card.id),
    Array.from({ length: 20 }, (_, index) => `SC${String(index + 1).padStart(3, "0")}`));
  assert.deepEqual(findCard("SC001"), {
    id: "SC001", name: "海の商人 ユージアル", unitType: "Ranged", cost: 2,
    level: 2, maxHp: 800, attackDamage: 31, intelligence: 6,
    imagePath: "/assets/units/cards/SC001.png"
  });
  assert.deepEqual(findCard("SC020"), {
    id: "SC020", name: "緑海の重装歩兵 ティアーズ", unitType: "Melee", cost: 3,
    level: 3, maxHp: 1099, attackDamage: 56, intelligence: 6,
    imagePath: "/assets/units/cards/SC020.png"
  });
  assert.equal(findCard("SC021"), undefined);
  assert.deepEqual(standardDeckCardIds, ["SC020", "SC019", "SC014"]);
});
