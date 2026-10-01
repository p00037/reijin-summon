import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBattleConfig } from '../core/battleConfig.js';
import { createDefaultBattleState } from '../core/battleState.js';
import { createDeckBattleState } from '../core/deckBattleState.js';
import { getAbilityDefinition } from './abilityCatalog.js';
test('全20枚の定義は承認済みAPで、未知カードとレッドムーンに代替能力はない',()=>{
 const costs=[1,1,2,3,2,1,1,2,3,null,3,2,2,4,3,2,1,3,5,3];
 costs.forEach((cost,i)=>assert.equal(getAbilityDefinition(`SC${String(i+1).padStart(3,'0')}`)?.apCost??null,cost));
 assert.equal(getAbilityDefinition('unknown'),null);assert.equal(getAbilityDefinition(undefined),null);
});
test('初期状態は晴れ・効果なし、デッキのINTと国籍を設定し効果配列を共有しない',()=>{
 const config=createDefaultBattleConfig(),state=createDeckBattleState(config,['SC002','SC018'],['SC003']);
 assert.equal(state.rainRemainingSeconds,0);assert.deepEqual(state.recentAbilityEvents,[]);
 assert.deepEqual(state.units.map(u=>u.baseIntelligence),[6,6,5]);
 assert.ok(state.units.every(u=>u.nation==='ScaleGuild'&&u.abilityEffects.length===0));
 const unit=state.units[0];unit.abilityEffects.push({abilityId:'SC018',sourceUnitId:unit.unitId,castId:1,kind:'intelligence',amount:3,remainingSeconds:70});
 assert.equal(state.units[1].abilityEffects.length,0);assert.equal(createDefaultBattleState(config).units[0].abilityEffects.length,0);
});
