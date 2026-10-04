import { getSkillDefinition, type SkillEvent } from '@reijin-summon/shared';

export function skillEventLabel(event: SkillEvent): string {
  const name = getSkillDefinition(event.cardId)?.name ?? 'スキル';
  const amount = Math.round(event.amount);
  const detail = event.resource === 'revive' ? '復活'
    : event.resource === 'gauge' ? `召喚 +${Number((event.amount * 100).toFixed(2))}%`
    : `${event.resource.toUpperCase()} +${amount}`;
  return `${name}  ${detail}`;
}
