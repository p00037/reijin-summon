import type { UnitType } from "../core/types.js";

export type CardDefinition = {
  id: string;
  name: string;
  unitType: UnitType;
  cost: number;
  level: number;
  maxHp: number;
  attackDamage: number;
  intelligence: number;
  imagePath: string;
};

type CardData = Omit<CardDefinition, "imagePath">;

function defineCard(card: CardData): CardDefinition {
  return { ...card, imagePath: `/assets/units/cards/${card.id}.png` };
}

export const cardCatalog: readonly CardDefinition[] = [
  defineCard({ id: "SC001", name: "海の商人 ユージアル", unitType: "Ranged", cost: 2, level: 2, maxHp: 800, attackDamage: 31, intelligence: 6 }),
  defineCard({ id: "SC002", name: "海の森の占い師 シリカ", unitType: "Ranged", cost: 1, level: 1, maxHp: 500, attackDamage: 18, intelligence: 6 }),
  defineCard({ id: "SC003", name: "王宮警備兵 スペサルティン", unitType: "Melee", cost: 2, level: 2, maxHp: 860, attackDamage: 53, intelligence: 5 }),
  defineCard({ id: "SC004", name: "王宮書記官 クリン", unitType: "Ranged", cost: 1, level: 1, maxHp: 500, attackDamage: 19, intelligence: 5 }),
  defineCard({ id: "SC005", name: "王宮親衛隊 タイガーアイ", unitType: "Speed", cost: 2, level: 2, maxHp: 830, attackDamage: 46, intelligence: 4 }),
  defineCard({ id: "SC006", name: "王宮魔導師 セレ", unitType: "Ranged", cost: 2, level: 2, maxHp: 800, attackDamage: 30, intelligence: 7 }),
  defineCard({ id: "SC007", name: "紅海の騎兵 ローズクォーツ", unitType: "Speed", cost: 1, level: 1, maxHp: 520, attackDamage: 29, intelligence: 4 }),
  defineCard({ id: "SC008", name: "紅海の魔導師 ルチル", unitType: "Ranged", cost: 1, level: 1, maxHp: 500, attackDamage: 17, intelligence: 6 }),
  defineCard({ id: "SC009", name: "鮫の王 レッドアイ", unitType: "Speed", cost: 3, level: 3, maxHp: 1062, attackDamage: 59, intelligence: 3 }),
  defineCard({ id: "SC010", name: "紫海の歩兵 レッドムーン", unitType: "Melee", cost: 1, level: 1, maxHp: 540, attackDamage: 40, intelligence: 5 }),
  defineCard({ id: "SC011", name: "紫海の防衛者 タンジェリーナ", unitType: "Ranged", cost: 4, level: 4, maxHp: 1225, attackDamage: 39, intelligence: 8 }),
  defineCard({ id: "SC012", name: "深淵に棲む者 グー", unitType: "Melee", cost: 4, level: 4, maxHp: 1311, attackDamage: 74, intelligence: 5 }),
  defineCard({ id: "SC013", name: "深遠の歌い手 チェルミ", unitType: "Ranged", cost: 3, level: 3, maxHp: 1025, attackDamage: 40, intelligence: 4 }),
  defineCard({ id: "SC014", name: "深海の教官 アウイン", unitType: "Ranged", cost: 4, level: 4, maxHp: 1225, attackDamage: 44, intelligence: 5 }),
  defineCard({ id: "SC015", name: "ダライアス", unitType: "Melee", cost: 5, level: 5, maxHp: 1496, attackDamage: 75, intelligence: 6 }),
  defineCard({ id: "SC016", name: "腹ぺこ ザンダー", unitType: "Melee", cost: 5, level: 5, maxHp: 1496, attackDamage: 82, intelligence: 5 }),
  defineCard({ id: "SC017", name: "三日月の魔女 ローレライ", unitType: "Ranged", cost: 5, level: 5, maxHp: 1400, attackDamage: 47, intelligence: 8 }),
  defineCard({ id: "SC018", name: "緑海の幻術士 ステラ", unitType: "Ranged", cost: 3, level: 3, maxHp: 1025, attackDamage: 35, intelligence: 6 }),
  defineCard({ id: "SC019", name: "緑海の重装騎兵 エレスティア", unitType: "Speed", cost: 3, level: 3, maxHp: 1062, attackDamage: 55, intelligence: 5 }),
  defineCard({ id: "SC020", name: "緑海の重装歩兵 ティアーズ", unitType: "Melee", cost: 3, level: 3, maxHp: 1099, attackDamage: 56, intelligence: 6 })
];

const cardsById = new Map(cardCatalog.map((card) => [card.id, card]));

export const standardDeckCardIds = ["SC020", "SC019", "SC014"] as const;

export function findCard(id: string): CardDefinition | undefined {
  return cardsById.get(id);
}
