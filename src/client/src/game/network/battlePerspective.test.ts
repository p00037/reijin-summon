import test from 'node:test';
import assert from 'node:assert/strict';
import { perspectivePoint, toLocalState, toServerCommand } from './battlePerspective';
import { createDefaultBattleConfig } from '../core/battleConfig';
import { createDefaultBattleState } from '../core/battleState';
test('後参加者の画面座標と入力が対称になる', () => { assert.deepEqual(perspectivePoint({ x: 2, y: -3 }, 'Cpu'), { x: -2, y: 3 }); const s = createDefaultBattleState(createDefaultBattleConfig()); s.cpuMp = 7; s.playerMp = 2; const local = toLocalState(s, 'Cpu'); assert.equal(local.playerMp, 7); assert.equal(local.units.find(u => u.unitId === 'PlayerMelee')?.team, 'Player'); const c = toServerCommand({ commandType: 'MoveUnit', team: 'Player', unitId: 'PlayerMelee', targetPosition: { x: 2, y: -3 } }, 'Cpu'); assert.deepEqual(c, { commandType: 'MoveUnit', team: 'Cpu', unitId: 'CpuMelee', targetPosition: { x: -2, y: 3 } }); });
