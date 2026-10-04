import { getMpState, getSummonGauge, isUnitAlive, setMpState, setSummonGauge } from '../core/battleState.js';
import type { BattleConfig, BattleState, UnitId, UnitState, SkillEvent } from '../core/types.js';
import { getAbilityDefinition } from './abilityCatalog.js';
import { hasActiveSummon } from './abilityEnchantments.js';
import { restoreUnit } from './resurrectionSystem.js';
import { getSkillDefinition } from './skillCatalog.js';
import { healUnit } from './skillEffects.js';

export type DefeatSnapshot = { unit: UnitState; ap: number; sourceUnitId: UnitId | null };

function recoverAp(unit: UnitState, amount: number): number {
  const cap = getAbilityDefinition(unit.cardId)?.apCost ?? 0;
  const before = unit.abilityAp;
  unit.abilityAp = Math.min(cap, unit.abilityAp + amount);
  if (unit.abilityAp >= cap) unit.abilityRecoverySeconds = 0;
  return Math.max(0, unit.abilityAp - before);
}

function publishSkill(state: BattleState, unit: UnitState, resource: SkillEvent['resource'], amount: number, targets: UnitState[] = []): void {
  if (amount <= 0) return;
  state.recentSkillEvents.push({
    eventId: state.nextSkillEventId++, sourceUnitId: unit.unitId, cardId: unit.cardId!,
    position: { ...unit.position }, resource, amount,
    targets: targets.map(target => ({ unitId: target.unitId, position: { ...target.position } }))
  });
  if (state.recentSkillEvents.length > 128) state.recentSkillEvents.splice(0, state.recentSkillEvents.length - 128);
}

export function triggerDefeatSkills(state: BattleState, config: BattleConfig, defeats: DefeatSnapshot[], random: () => number): void {
  if (state.phase !== 'InProgress' || state.result !== 'InProgress') return;
  // 死亡者は全員除外し、復活は味方への受渡しを全て終えてから行う。
  const survivors = state.units.filter(isUnitAlive);
  for (const { unit, sourceUnitId } of defeats) {
    const killer = survivors.find(candidate => candidate.unitId === sourceUnitId && candidate.team !== unit.team);
    const effect = getSkillDefinition(killer?.cardId)?.effect;
    if (killer && effect?.kind === 'killAp' && random() < effect.chance)
      publishSkill(state, killer, 'ap', recoverAp(killer, effect.amount), [killer]);
  }
  for (const { unit, ap } of defeats) {
    const effect = getSkillDefinition(unit.cardId)?.effect;
    if (!effect) continue;
    switch (effect.kind) {
      case 'deathGauge': {
        if (hasActiveSummon(state, unit.team)) break;
        const before = getSummonGauge(state, unit.team);
        const next = Math.min(1, before + effect.amount);
        setSummonGauge(state, unit.team, next);
        publishSkill(state, unit, 'gauge', next - before);
        break;
      }
      case 'deathAp':
      case 'deathHealing': {
        if (effect.kind === 'deathAp' && ap <= 0) break;
        const candidates = survivors.filter(candidate => candidate.team === unit.team);
        if (candidates.length === 0) break;
        const target = candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))];
        const amount = effect.kind === 'deathAp' ? recoverAp(target, ap) : healUnit(target, effect.healingPerLevel * unit.stats.level);
        publishSkill(state, unit, effect.kind === 'deathAp' ? 'ap' : 'hp', amount, [target]);
        break;
      }
      case 'deathMp': {
        if (random() >= effect.chance) break;
        const before = getMpState(state, unit.team);
        const current = Math.min(config.maxMp, before.current + unit.stats.level);
        setMpState(state, unit.team, current, current >= config.maxMp ? 0 : before.recoveryProgress, current >= config.maxMp ? 0 : before.leaderDamageProgress);
        publishSkill(state, unit, 'mp', current - before.current);
        break;
      }
    }
  }
  for (const { unit } of defeats) {
    const effect = getSkillDefinition(unit.cardId)?.effect;
    if (effect?.kind === 'revive' && random() < effect.chance) {
      restoreUnit(unit, unit.position);
      publishSkill(state, unit, 'revive', unit.currentHp, [unit]);
    }
  }
}
