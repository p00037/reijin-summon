import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Client } from 'colyseus.js';
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(check: () => boolean, ms = 12000) { const start = Date.now(); while (!check()) {
    if (Date.now() - start > ms)
        throw Error('timeout');
    await delay(25);
} }
test('2人の実接続で秘匿・同期・復帰を検証', async () => {
    const server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: process.cwd(), env: { ...process.env, PORT: '2678' }, stdio: 'pipe', windowsHide: true });
    let logs = '';
    server.stdout.on('data', d => logs += d);
    server.stderr.on('data', d => logs += d);
    let a: any, b: any;
    let stage = 'start';
    try {
        await until(() => logs.includes('listening'));
        const c = new Client('ws://127.0.0.1:2678');
        a = await c.create('arena', { name: '一人目', version: 1 });
        let welcome: any, view: any;
        a.onMessage('*', (type: any, v: any) => { if (type === 'welcome')
            welcome = v; if (type === 'room')
            view = v; });
        a.send('hello');
        await until(() => !!welcome);
        b = await c.joinById(welcome.code, { name: '二人目', version: 1 });
        b.onMessage('*', () => { });
        a.send('deck', { cardIds: ['SC001'], summonId: 'raphael' });
        b.send('deck', { cardIds: ['SC002'], summonId: 'bahamut' });
        await delay(150);
        assert.equal(a.state.battle, undefined);
        a.send('ready', true);
        b.send('ready', true);
        await delay(500);
        assert.equal(a.state.battle, undefined);
        stage = 'battle';
        await until(() => !!a.state.battle && !!b.state.battle);
        assert.equal(a.state.battle.cpuSummonId, 'bahamut');
        assert.equal(b.state.battle.units.length, 2);
        stage = 'reconnect';
        const token = a.reconnectionToken;
        await a.leave(false);
        a = await c.reconnect(token);
        a.onMessage('*', () => { });
        a.send('hello');
        await until(() => !!a.state.battle);
        assert.equal(a.state.battle.cpuSummonId, 'bahamut');
        stage = 'surrender';
        let result:any; b.onMessage('room',(v:any)=>result=v);
        await a.leave(); a=undefined;
        await until(()=>result?.phase==='Result');
        assert.equal(result.result,'CpuWin');assert.equal(result.reason,'surrender');
    }
    catch (e) {
        throw new Error(stage + ': ' + String(e) + '\n' + JSON.stringify(a?.state?.toJSON?.()) + '\n' + logs);
    }
    finally {
        await a?.leave();
        await b?.leave();
        server.kill();
    }
});
