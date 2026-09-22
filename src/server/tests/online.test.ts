import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomRegistry } from '../src/online/roomRegistry.js';
import { MatchController } from '../src/online/matchController.js';
import { parseCommandEnvelope } from '@reijin-summon/shared/network/protocol';
test('10席上限と二重解放', () => { const r = new RoomRegistry(); const ids = []; for (let i = 0; i < 5; i++) {
    const code = r.create();
    ids.push(r.reserve(code), r.reserve(code));
} assert.equal(r.occupiedSeats, 10); assert.throws(() => r.reserve(r.create())); r.release(ids[0]); r.release(ids[0]); assert.equal(r.occupiedSeats, 9); });
test('不正入力を拒否する', () => { for (const value of [null, {}, { version: 1, matchId: 'x', sequence: 1, command: { commandType: 'MoveUnit', unitId: 'PlayerMelee', team: 'Player', targetPosition: { x: NaN, y: 0 } } }])
    assert.equal(parseCommandEnvelope(value).ok, false); });
test('開始まで秘匿し双方の準備から試合を開始', () => { const m = new MatchController(); m.setConnected('Player', true); m.setConnected('Cpu', true); m.setDeck('Player', ['SC001'], 'raphael'); m.setDeck('Cpu', ['SC002'], 'bahamut'); assert.equal(m.publicView().battle, null); m.setReady('Player', true); m.setReady('Cpu', true); m.advance(4.9); assert.equal(m.publicView().battle, null); m.advance(.1); assert.equal(m.publicView().battle?.cpuSummonId, 'bahamut'); });
test('確定結果を切断で上書きしない', () => { const m = new MatchController(); m.finish('Draw', 'time-limit'); m.finish('PlayerWin', 'disconnect'); assert.equal(m.publicView().result, 'Draw'); });
import { ConnectionLifecycle } from '../src/online/connectionLifecycle.js';
test('30秒の復帰猶予と双方不在', () => { const life = new ConnectionLifecycle(); life.disconnect('Player', 0); assert.deepEqual(life.advance(29999), []); life.reconnect('Player', 29999); assert.deepEqual(life.advance(30000), []); life.disconnect('Player', 40000); assert.deepEqual(life.advance(70000), ['Player']); });
import { allowedOrigin, RateLimit, connectionPolicy } from '../src/online/requestLimits.js';
test('公開時は許可した接続元だけを通し、IPごとに参加要求を制限する', () => {
    const policy = connectionPolicy(['https://game.example'], 2);
    assert.equal(policy('https://other.example', 'ip-a', 0), 403);
    assert.equal(policy(undefined, 'ip-a', 0), 403);
    assert.equal(policy('https://game.example', 'ip-a', 0), 200);
    assert.equal(policy('https://game.example', 'ip-a', 1), 200);
    assert.equal(policy('https://game.example', 'ip-a', 2), 429);
    assert.equal(policy('https://game.example', 'ip-b', 2), 200);
    assert.equal(policy('https://game.example', 'ip-a', 60000), 200);
});
test('準備解除と切断で開始を取り消し、編集ロックを解除する', () => {
    const m = new MatchController();
    for (const team of ['Player', 'Cpu'] as const) {
        m.setConnected(team, true);
        m.setDeck(team, ['SC001'], 'raphael');
        m.setReady(team, true);
    }
    assert.equal(m.setDeck('Player', ['SC002'], 'bahamut').ok, false);
    assert.equal(m.setReady('Player', false).ok, true);
    assert.equal(m.publicView().phase, 'Setup');
    assert.equal(m.publicView().ready.Cpu, true);
    m.setReady('Player', true);
    m.setConnected('Cpu', false);
    m.advance(5);
    assert.equal(m.publicView().phase, 'Setup');
    assert.equal(m.publicView().battle, null);
});
test('古い試合と相手のユニットを操作できず、再戦は双方の同意が必要', () => {
    const m = new MatchController();
    for (const team of ['Player', 'Cpu'] as const) {
        m.setConnected(team, true);
        m.setDeck(team, ['SC001'], 'raphael');
        m.setReady(team, true);
    }
    m.advance(5);
    const oldId = m.publicView().matchId;
    const command = { commandType: 'MoveUnit', team: 'Player', unitId: 'Cpu:SC001', targetPosition: { x: 0, y: 0 } } as const;
    assert.equal(m.apply('Player', { version: 1, matchId: oldId, sequence: 1, command } as any).ok, false);
    m.finish('Draw', 'time-limit');
    m.requestRematch('Player');
    assert.equal(m.publicView().phase, 'Result');
    m.requestRematch('Cpu');
    assert.equal(m.publicView().phase, 'Setup');
    assert.notEqual(m.publicView().matchId, oldId);
    assert.equal(m.apply('Player', { version: 1, matchId: oldId, sequence: 2, command } as any).ok, false);
});

test('受理済みの配置交換をプレビューと戦闘開始にそのまま反映する',()=>{
 const m=new MatchController();m.setConnected('Player',true);m.setConnected('Cpu',true);m.setDeck('Player',['SC001','SC002'],'raphael');m.setDeck('Cpu',['SC003'],'raphael');
 const [a,b]=m.privateView('Player')!.units;const first={...a.position},second={...b.position};
 assert.equal(m.place('Player',a.unitId,{x:5,y:-3}).ok,true);assert.equal(m.place('Player',b.unitId,first).ok,true);assert.equal(m.place('Player',a.unitId,second).ok,true);
 assert.deepEqual(m.privateView('Player')!.units.map(u=>u.position),[second,first]);m.setReady('Player',true);m.setReady('Cpu',true);m.advance(5);assert.deepEqual(m.publicView().battle!.units.filter(u=>u.team==='Player').map(u=>u.position),[second,first]);
});
