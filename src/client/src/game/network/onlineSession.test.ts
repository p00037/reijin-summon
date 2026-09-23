import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlineSession, activeOnline, setActiveOnline } from './onlineSession';
import type { Client, Room } from 'colyseus.js';
test('退出したセッションを次のCPU戦や新規対戦に残さない', async () => {
    const session = new OnlineSession({} as Client);
    setActiveOnline(session);
    await session.leave();
    assert.equal(activeOnline, null);
});
test('接続中に戻った場合、遅れて成功した部屋からも退出する', async () => {
    let complete!: (room: Room) => void;
    let left = false;
    const client = { create: () => new Promise<Room>(r => complete = r) } as unknown as Client;
    const session = new OnlineSession(client);
    const connecting = session.create('参加者');
    await session.leave();
    complete({ leave: async () => { left = true; } } as unknown as Room);
    await connecting;
    assert.equal(left, true);
    assert.equal(session.connected, false);
});

function transport(){const messages=new Map<string,(value:any)=>void>();let stateChange:(value:any)=>void=()=>{};const sent:any[]=[];const room={reconnectionToken:'test-token',onMessage:(type:string,fn:any)=>messages.set(type,fn),onStateChange:(fn:any)=>stateChange=fn,onLeave:()=>{},send:(...args:any[])=>sent.push(args),leave:async()=>{}} as unknown as Room;return {room,messages,sent,state:(v:any)=>stateChange(v)};}
test('最新状態の受信前は復帰前の操作を送らず、古い攻撃演出も破棄する',async()=>{const t=transport();const session=new OnlineSession({create:async()=>t.room} as unknown as Client);session.state.recentAttackEvents.push({attackerUnitId:'PlayerMelee',origin:{x:0,y:0},targetPosition:{x:0,y:1}});await session.create('試験');session.applyCommand({commandType:'Summon',team:'Player'});assert.equal(t.sent.filter(v=>v[0]==='command').length,0);assert.equal(session.state.recentAttackEvents.length,0);t.messages.get('welcome')!({team:'Player',code:'123456',version:1});t.messages.get('private')!(session.state);session.applyCommand({commandType:'Summon',team:'Player'});assert.equal(t.sent.filter(v=>v[0]==='command').length,1);});

test('保存機能が使えなくても同じタブの切断から復帰する',async()=>{const first=transport(),restored=transport();let received='';const session=new OnlineSession({create:async()=>first.room,reconnect:async(token:string)=>{received=token;return restored.room;}} as unknown as Client);await session.create('試験');first.messages.get('welcome')!({team:'Cpu',code:'123456',version:1});await session.reconnect();assert.equal(received,'test-token');assert.equal(session.team,'Cpu');assert.equal(session.room,restored.room);await session.leave();});
