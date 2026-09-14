import assert from "node:assert/strict";
import test from "node:test";
import { validateDeck } from "./deckModel";

test("空デッキを出撃不可にする", () => {
  const result = validateDeck([]);
  assert.equal(result.valid, false);
  assert.equal(result.cost, 0);
  assert.ok(result.errors.some((error) => error.includes("1枚")));
});

test("6枚のデッキを出撃不可にする", () => {
  const result = validateDeck(["SC001", "SC002", "SC003", "SC004", "SC007", "SC008"]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("5枚")));
});

test("同一カードを重複させたデッキを出撃不可にする", () => {
  const result = validateDeck(["SC002", "SC002"]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("重複")));
});

test("不明なカードIDを保持したデッキを出撃不可にする", () => {
  const result = validateDeck(["SC999"]);
  assert.equal(result.valid, false);
  assert.equal(result.cost, 0);
  assert.ok(result.errors.some((error) => error.includes("SC999")));
});

test("合計コストが10を超えるデッキを出撃不可にする", () => {
  const result = validateDeck(["SC014", "SC015", "SC002"]);
  assert.equal(result.cost, 10);
  assert.equal(result.valid, true);

  const over = validateDeck(["SC014", "SC015", "SC001"]);
  assert.equal(over.cost, 11);
  assert.equal(over.valid, false);
  assert.ok(over.errors.some((error) => error.includes("10")));
});

test("同兵種5枚でも重複なし・合計コスト10以下なら出撃可能にする", () => {
  assert.deepEqual(validateDeck(["SC001", "SC002", "SC004", "SC006", "SC008"]), {
    valid: true,
    cost: 7,
    errors: []
  });
});
