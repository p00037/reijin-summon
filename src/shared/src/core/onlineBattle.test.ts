import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSession, createDefaultBattleConfig,createOnlineBattleState,findUnit,tryPlaceInitialUnit} from '../index.js';
test('両者の選択した召喚獣と対称な配置を採用する',()=>{
 const c=createDefaultBattleConfig(); const s=createOnlineBattleState(c,{Player:{cardIds:['SC001'],summonId:'raphael'},Cpu:{cardIds:['SC002'],summonId:'bahamut'}});
 assert.equal(s.cpuSummonId,'bahamut');assert.equal(s.playerSummonId,'raphael');
 assert.equal(tryPlaceInitialUnit(s,c,'Cpu:SC002',{x:4,y:2}),true);
 assert.equal(tryPlaceInitialUnit(s,c,'Cpu:SC002',{x:4,y:-2}),false);
 const g=new GameSession(c,s);g.applyCommand({commandType:'PlaceInitialUnit',team:'Player',unitId:'Cpu:SC002',targetPosition:{x:2,y:2}} as any);
 assert.deepEqual(findUnit(s,'Cpu:SC002').position,{x:4,y:2});
});
test('未知IDと不正座標の操作は状態を変えない',()=>{
 const g=new GameSession(); const before=structuredClone(g.state);
 for(const command of [{commandType:'PlaceInitialUnit',team:'Player',unitId:'missing',targetPosition:{x:0,y:-2}}, {commandType:'PlaceInitialUnit',team:'Player',unitId:'PlayerMelee',targetPosition:{x:NaN,y:-2}}])g.applyCommand(command as any);
 assert.deepEqual(g.state,before);
});
