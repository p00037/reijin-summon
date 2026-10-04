import test from 'node:test';
import assert from 'node:assert/strict';
import * as presentation from './skillEventPresentation';
import type { SkillEvent } from '@reijin-summon/shared';
import { consumeAbilityEvents } from './abilityEventPresentation';

test('スキル通知は実際の回復量とゲージの百分率を表示し、復活を区別する', () => {
 const base: SkillEvent = {eventId: 1, sourceUnitId: 'PlayerMelee', cardId: 'SC002', position: {x: 0, y: 0}, resource: 'gauge', amount: .0675, targets: []};
 assert.equal(presentation.skillEventLabel(base), '精霊の願い  召喚 +6.75%');
 assert.equal(presentation.skillEventLabel({...base, cardId: 'SC006', resource: 'hp', amount: 533.333}), '癒しの願い  HP +533');
 assert.equal(presentation.skillEventLabel({...base, cardId: 'SC018', resource: 'revive', amount: 1025}), '戦士の意地  復活');
});

test('重複した同期状態ではスキル通知を再生しない', () => {
 const event: SkillEvent = {eventId: 8, sourceUnitId: 'PlayerMelee', cardId: 'SC013', position: {x: 0, y: 0}, resource: 'mp', amount: 3, targets: []};
 const first = consumeAbilityEvents([event], 7);
 assert.deepEqual(first.events, [event]);
 assert.deepEqual(consumeAbilityEvents([event], first.lastSeen).events, []);
});
