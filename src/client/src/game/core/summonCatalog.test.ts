import assert from "node:assert/strict";
import test from "node:test";
import { getSummonDefinition, isSummonId, pickCpuSummon, summonCatalog } from "./summonCatalog";

test("召喚獣6種類を一意なIDと専用画像で定義する", () => {
  assert.deepEqual(summonCatalog.map((summon) => summon.id), [
    "raphael", "jackpot", "yggdrasil", "leviathan", "bahamut", "dullahan"
  ]);
  assert.equal(new Set(summonCatalog.map((summon) => summon.imagePath)).size, 6);
  assert.equal(getSummonDefinition("leviathan").baseHp, 3150);
  assert.equal(getSummonDefinition("jackpot").attackStyle, "beam");
  assert.equal(getSummonDefinition("yggdrasil").attackStyle, "global");
});

test("召喚獣IDを未知値から判別する", () => {
  assert.equal(isSummonId("bahamut"), true);
  assert.equal(isSummonId("unknown"), false);
  assert.equal(isSummonId(null), false);
});

test("CPU抽選は乱数区間を6種類へ均等に割り当てる", () => {
  assert.deepEqual(
    [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 0.999999].map((value) => pickCpuSummon(() => value)),
    ["raphael", "jackpot", "yggdrasil", "leviathan", "bahamut", "dullahan", "dullahan"]
  );
});
