import { Client, type Room } from 'colyseus.js';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(check: () => boolean) { const start = Date.now(); while (!check()) {
    if (Date.now() - start > 15000)
        throw Error('状態同期がタイムアウトしました');
    await delay(25);
} }
async function main() {
    const isolated = process.argv.includes('--spawn');
    const smoke = process.argv.includes('--smoke');
    const endpoint = process.argv.find(a => a.startsWith('--endpoint='))?.slice(11) ?? (isolated ? 'ws://127.0.0.1:2679' : 'ws://localhost:2567');
    const duration = smoke ? 20000 : 600000;
    const http = endpoint.replace(/^ws/, 'http');
    const server = isolated ? spawn(process.execPath, ['src/server/dist/index.js'], { env: { ...process.env, PORT: '2679', ENABLE_METRICS: '1', NODE_ENV: 'test', ALLOWED_ORIGINS: '' }, stdio: 'pipe', windowsHide: true }) : null;
    let log = '';
    server?.stdout.on('data', d => log += d);
    server?.stderr.on('data', d => log += d);
    const clients: {
        room: Room;
        view: any;
        seq: number;
        team: 'Player' | 'Cpu';
    }[] = [];
    const attach = (entry: typeof clients[number], room: Room) => { entry.room = room; room.onMessage('*', (type: any, data: any) => { if (type === 'room')
        entry.view = data; }); room.send('hello'); };
    const metrics: any[] = [];
    const results = new Set<string>();
    let reconnected = false;let maxClockDriftSeconds=0;const clocks=new Map<string,{wall:number;remaining:number}>();
    try {
        if (server)
            await until(() => log.includes('listening'));
        const sdk = new Client(endpoint);
        for (let i = 0; i < 5; i++) {
            const a = { room: await sdk.create('arena', { name: '負荷検証' + i + 'A', version: 1 }), view: null, seq: 0, team: 'Player' as const };
            attach(a, a.room);
            clients.push(a);
            const b = { room: await sdk.joinById(a.room.roomId, { name: '負荷検証' + i + 'B', version: 1 }), view: null, seq: 0, team: 'Cpu' as const };
            attach(b, b.room);
            clients.push(b);
        }
        await assert.rejects(() => sdk.create('arena', { name: '11人目', version: 1 }));
        const prepared = new Set<string>();
        const start = Date.now();
        let nextReport = 0;
        while (Date.now() - start < duration) {
            for (let i = 0; i < clients.length; i += 2) {
                const a = clients[i], b = clients[i + 1];
                if (!a.view || !b.view)
                    continue;
                if (a.view.phase === 'Setup' && b.view.phase === 'Setup' && !prepared.has(a.view.matchId)) {
                    prepared.add(a.view.matchId);
                    for (const c of [a, b]) {
                        c.seq = 0;
                        c.room.send('deck', { cardIds: ['SC001', 'SC002', 'SC003', 'SC004', 'SC005'], summonId: 'bahamut' });
                    }
                    await delay(150);
                    for (const c of [a, b])
                        c.room.send('ready', true);
                }
                if (a.view.phase === 'Result' && b.view.phase === 'Result' && !results.has(a.view.matchId)) {
                    assert.equal(a.view.result, b.view.result);
                    results.add(a.view.matchId);
                    a.room.send('rematch');
                    b.room.send('rematch');
                }
                for (const c of [a, b])
                    if (c.view.phase === 'Battle') {
                        const battle=c.room.state?.battle;
                        if(battle?.result==='InProgress'){
                            const key=c.room.roomId+':'+c.team+':'+c.view.matchId;
                            const anchor=clocks.get(key);
                            if(!anchor)clocks.set(key,{wall:Date.now(),remaining:battle.remainingSeconds});
                            else{const drift=Math.abs((Date.now()-anchor.wall)/1000-(anchor.remaining-battle.remainingSeconds));maxClockDriftSeconds=Math.max(maxClockDriftSeconds,drift);assert.ok(drift<2.5,'実時間と試合時間の差が蓄積: '+drift+'秒');}
                        }
                        const send = (command: any) => c.room.send('command', { version: 1, matchId: c.view.matchId, sequence: ++c.seq, command: { ...command, team: c.team } });
                        const units = c.room.state?.battle?.units ?? [];
                        for (const unit of units)
                            if (unit.team === c.team) {
                                if (unit.mode === 'Defeated')
                                    send({ commandType: 'ReviveUnit', unitId: unit.unitId, targetPosition: { x: 0, y: c.team === 'Player' ? -3 : 3 } });
                                else {
                                    send({ commandType: 'MoveUnit', unitId: unit.unitId, targetPosition: { x: Math.sin((Date.now() - start) / 8000) * 2, y: c.team === 'Player' ? 3 : -3 } });
                                    send({ commandType: 'UseAbility', unitId: unit.unitId, facingRotation: c.team === 'Player' ? 0 : Math.PI });
                                }
                            }
                        send({ commandType: 'Summon' });
                    }
            }
            if (!reconnected && Date.now() - start > (smoke ? 10000 : 60000)) {
                const c = clients[0], token = c.room.reconnectionToken;
                await c.room.leave(false);
                await delay(1000);
                attach(c, await sdk.reconnect(token));
                await until(() => !!c.room.state?.battle);
                reconnected = true;
            }
            if (Date.now() - start >= nextReport) {
                const m = await (await fetch(http + '/metrics')).json();
                metrics.push(m);
                console.log(JSON.stringify({ elapsedSeconds: Math.round((Date.now() - start) / 1000), results: results.size, ...m }));
                nextReport += 30000;
            }
            await delay(1000);
        }
        const final = await (await fetch(http + '/metrics')).json() as any;
        metrics.push(final);
        assert.ok(reconnected);
        assert.ok(metrics.every(m => m.tickP95Ms < 50));
        assert.ok(final.maxPendingMs < 50);
        if (!smoke)
            assert.ok(results.size >= 5, '各試合の決着が必要です');
        console.log(JSON.stringify({ success: true, durationSeconds: duration / 1000, clients: 10, results: results.size, reconnected, maxClockDriftSeconds, metrics: final }));
    }
    catch (e) {
        console.error(log.slice(-3000));
        throw e;
    }
    finally {
        await Promise.allSettled(clients.map(c => c.room.leave()));
        server?.kill();
    }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
