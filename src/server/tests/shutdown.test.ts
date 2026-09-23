import test from 'node:test';
import assert from 'node:assert/strict';
import { ArenaRoom } from '../src/rooms/ArenaRoom.js';
import { ArenaState } from '../src/rooms/schema/ArenaState.js';
test('サーバー終了は切断前に中断理由を通知する',()=>{
 const room=new ArenaRoom();room.setState(new ArenaState());const events:any[]=[];
 room.broadcast=((type:any,data:any)=>{events.push({type,data});}) as typeof room.broadcast;
 room.disconnect=(async()=>{events.push({type:'disconnect'});}) as typeof room.disconnect;
 room.onBeforeShutdown();
 assert.equal(events[0]?.type,'room');assert.equal(events[0]?.data.phase,'Closed');assert.equal(events[0]?.data.reason,'server-shutdown');assert.equal(events.at(-1)?.type,'disconnect');
});
