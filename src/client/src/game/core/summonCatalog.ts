export type SummonId = "raphael" | "jackpot" | "yggdrasil" | "leviathan" | "bahamut" | "dullahan";

export type SummonAttackStyle = "melee" | "beam" | "global";

export type SummonDefinition = {
  id: SummonId;
  name: string;
  baseHp: number;
  attackDamage: number;
  leaderAttackDamage: number;
  leaderAttackIntervalSeconds: number;
  moveSpeed: number;
  damageMultiplier: number;
  attackStyle: SummonAttackStyle;
  imagePath: string;
  description: string;
};

export const summonCatalog: readonly SummonDefinition[] = [
  { id: "raphael", name: "癒しの天使ラファエル", baseHp: 1750, attackDamage: 99, leaderAttackDamage: 300, leaderAttackIntervalSeconds: 2, moveSpeed: 8.2 / 12, damageMultiplier: 0.375, attackStyle: "melee", imagePath: "/assets/summons/raphael.png", description: "白金の翼を持つ、堅実な近接型の召喚獣。" },
  { id: "jackpot", name: "混沌の卵ジャックポット", baseHp: 0, attackDamage: 52, leaderAttackDamage: 75, leaderAttackIntervalSeconds: 0.5, moveSpeed: 0, damageMultiplier: 0.6, attackStyle: "beam", imagePath: "/assets/summons/jackpot.png", description: "召喚位置から敵召喚士へ、敵味方を巻き込むレーザーを放つ。" },
  { id: "yggdrasil", name: "世界樹ユグドラシル", baseHp: 0, attackDamage: 10, leaderAttackDamage: 157, leaderAttackIntervalSeconds: 1.5, moveSpeed: 0, damageMultiplier: 0.95, attackStyle: "global", imagePath: "/assets/summons/yggdrasil.png", description: "召喚位置に根を張り、敵全体へ周期攻撃を行う。" },
  { id: "leviathan", name: "深海の魔龍リヴァイアサン", baseHp: 3150, attackDamage: 105, leaderAttackDamage: 1500, leaderAttackIntervalSeconds: 9, moveSpeed: 8.2 / 25, damageMultiplier: 0.325, attackStyle: "melee", imagePath: "/assets/summons/leviathan.png", description: "高い耐久力を持ち、召喚時と周期的に全体へ波動を放つ。" },
  { id: "bahamut", name: "天空の魔龍バハムート", baseHp: 1150, attackDamage: 99, leaderAttackDamage: 300, leaderAttackIntervalSeconds: 2, moveSpeed: 8.2 / 9, damageMultiplier: 0.325, attackStyle: "melee", imagePath: "/assets/summons/bahamut.png", description: "空を駆け、素早く敵陣へ迫る近接型の魔龍。" },
  { id: "dullahan", name: "冥界の騎士デュラハン", baseHp: 2000, attackDamage: 99, leaderAttackDamage: 300, leaderAttackIntervalSeconds: 2, moveSpeed: 8.2 / 12, damageMultiplier: 0.375, attackStyle: "melee", imagePath: "/assets/summons/dullahan.png", description: "高い基礎HPで前線を押し上げる冥界の騎士。" }
];

const summonById = new Map<SummonId, SummonDefinition>(summonCatalog.map((summon) => [summon.id, summon]));

export function isSummonId(value: unknown): value is SummonId {
  return typeof value === "string" && summonById.has(value as SummonId);
}

export function getSummonDefinition(id: SummonId): SummonDefinition {
  return summonById.get(id)!;
}

export function pickCpuSummon(random: () => number = Math.random): SummonId {
  const index = Math.min(summonCatalog.length - 1, Math.max(0, Math.floor(random() * summonCatalog.length)));
  return summonCatalog[index].id;
}
