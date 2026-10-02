import type { AbilityEvent, Vec2 } from '@reijin-summon/shared';
export function abilityEventTargetPositions(event: AbilityEvent, sourcePosition?: Vec2): Vec2[] {
  const targets = [...event.targets, ...event.elementalTargets].map(target => target.position);
  return targets.length ? targets : sourcePosition ? [sourcePosition] : [];
}
export function consumeAbilityEvents(events: readonly AbilityEvent[], lastSeen: number): { events: AbilityEvent[]; lastSeen: number } {
  const fresh = events.filter(event => event.eventId > lastSeen).sort((a,b) => a.eventId-b.eventId);
  return {events: fresh, lastSeen: fresh.at(-1)?.eventId ?? lastSeen};
}
