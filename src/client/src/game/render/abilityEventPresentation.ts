import type { AbilityEvent } from '@reijin-summon/shared';
export function consumeAbilityEvents(events: readonly AbilityEvent[], lastSeen: number): { events: AbilityEvent[]; lastSeen: number } {
  const fresh = events.filter(event => event.eventId > lastSeen).sort((a,b) => a.eventId-b.eventId);
  return {events: fresh, lastSeen: fresh.at(-1)?.eventId ?? lastSeen};
}
