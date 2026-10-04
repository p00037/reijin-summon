export type SkillEffect =
  | { kind: 'lateDefense'; multiplier: number; seconds: number }
  | { kind: 'deathGauge'; amount: number }
  | { kind: 'leaderDamage'; attackPerStage: number; speedMultiplier: number }
  | { kind: 'deathAp' }
  | { kind: 'enemyHalf'; attack: number }
  | { kind: 'deathHealing'; healingPerLevel: number }
  | { kind: 'earlyAttack'; attack: number; seconds: number }
  | { kind: 'killAp'; chance: number; amount: number }
  | { kind: 'lowHpAttack'; attack: number; hpRatio: number }
  | { kind: 'deathMp'; chance: number }
  | { kind: 'rain'; attack: number; speedMultiplier: number }
  | { kind: 'healing'; multiplier: number }
  | { kind: 'apPower'; attackPerAp: number; rangeWidthsPerAp: number }
  | { kind: 'revive'; chance: number }
  | { kind: 'enemyLeaderHp'; attack: number; hpRatio: number };

export type SkillDefinition = {
  cardId: string;
  name: string;
  description: string;
  effect: SkillEffect;
};

function define(cardIds: string[], name: string, description: string, effect: SkillEffect): SkillDefinition[] {
  return cardIds.map(cardId => ({ cardId, name, description, effect }));
}

export const skillCatalog: readonly SkillDefinition[] = [
  ...define(['SC001'], '不屈の精神', '残り100秒以下で通常・召喚獣攻撃の被ダメージを5%軽減。', { kind: 'lateDefense', multiplier: .95, seconds: 100 }),
  ...define(['SC002'], '精霊の願い', '死亡時に味方召喚ゲージ＋6.75%。召喚中は増加しない。', { kind: 'deathGauge', amount: .0675 }),
  ...define(['SC003'], '底力', '味方召喚士HP75/50/25%以下でATK＋5/10/15。50%以下で速度×1.125。', { kind: 'leaderDamage', attackPerStage: 5, speedMultiplier: 1.125 }),
  ...define(['SC004'], '勝利への遺志', '死亡時の保持APを、生存中の味方1体へランダムに渡す。', { kind: 'deathAp' }),
  ...define(['SC005'], '狂戦士', '敵側の半面にいる間、ATK＋2。中央線上は対象外。', { kind: 'enemyHalf', attack: 2 }),
  ...define(['SC006'], '癒しの願い', '死亡時に生存中の味方1体を抽選し、HPを200×自身のLV回復。', { kind: 'deathHealing', healingPerLevel: 200 }),
  ...define(['SC007'], '士気旺盛', '残り200秒以上でATK＋3。', { kind: 'earlyAttack', attack: 3, seconds: 200 }),
  ...define(['SC008', 'SC011'], '士気高揚', '敵カードを撃破した時、50%の確率で自身のAP＋1。', { kind: 'killAp', chance: .5, amount: 1 }),
  ...define(['SC009'], '逆境の力', '自身のHPが20%以下でATK＋30。', { kind: 'lowHpAttack', attack: 30, hpRatio: .2 }),
  ...define(['SC012'], '不屈の精神', '残り100秒以下で通常・召喚獣攻撃の被ダメージを20%軽減。', { kind: 'lateDefense', multiplier: .8, seconds: 100 }),
  ...define(['SC013', 'SC020'], '意義ある撤退', '死亡時に50%の確率で、味方MPを自身のLV分回復。', { kind: 'deathMp', chance: .5 }),
  ...define(['SC014'], '不屈の精神', '残り100秒以下で通常・召喚獣攻撃の被ダメージを15%軽減。', { kind: 'lateDefense', multiplier: .85, seconds: 100 }),
  ...define(['SC015'], '水を得た魚', '雨の間、ATK＋10、移動速度×1.125。', { kind: 'rain', attack: 10, speedMultiplier: 1.125 }),
  ...define(['SC016'], '全てを飲み込む力', '生存中のHP回復量×4/3。復活時のHP設定は対象外。', { kind: 'healing', multiplier: 4 / 3 }),
  ...define(['SC017'], '集約する魔力', '保持AP1につきATK＋3、遠距離射程をカード横幅1枚分拡大。', { kind: 'apPower', attackPerAp: 3, rangeWidthsPerAp: 1 }),
  ...define(['SC018'], '戦士の意地', '死亡時に30%の確率で、その場にHP満タンで復活。MP消費なし。', { kind: 'revive', chance: .3 }),
  ...define(['SC019'], '非情なる追撃', '敵召喚士HPが30%以下でATK＋16。', { kind: 'enemyLeaderHp', attack: 16, hpRatio: .3 })
];

const skillsByCard = new Map(skillCatalog.map(skill => [skill.cardId, skill]));
export function getSkillDefinition(cardId: string | undefined): SkillDefinition | undefined {
  return cardId ? skillsByCard.get(cardId) : undefined;
}
