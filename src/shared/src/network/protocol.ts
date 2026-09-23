import type {BattleCommand,BattleState,TeamId,MatchResult,UnitId,Vec2} from '../core/types.js';
import {isSummonId,type SummonId} from '../core/summonCatalog.js';
import {validateDeck} from '../deck/deckModel.js';
export const PROTOCOL_VERSION=1;
export type ValidationResult<T=undefined>={ok:true;value:T}|{ok:false;reason:string};
export const ok=<T>(value:T):ValidationResult<T>=>({ok:true,value});
export const fail=(reason:string):ValidationResult<never>=>({ok:false,reason});
export type CommandEnvelope={version:number;matchId:string;sequence:number;command:BattleCommand};
export type DeckChoice={cardIds:string[];summonId:SummonId};
export type RoomPhase='Waiting'|'Setup'|'Countdown'|'Battle'|'Result'|'Closed';
export type RoomView={phase:RoomPhase;matchId:string;countdown:number;ready:Record<TeamId,boolean>;connected:Record<TeamId,boolean>;result:MatchResult;reason:string;battle:BattleState|null};
export const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const point=(v:unknown):v is Vec2=>record(v)&&typeof v.x==='number'&&Number.isFinite(v.x)&&typeof v.y==='number'&&Number.isFinite(v.y);
export function parseDeck(value:unknown):ValidationResult<DeckChoice>{
 if(!record(value)||!Array.isArray(value.cardIds)||value.cardIds.length>5||!value.cardIds.every(id=>typeof id==='string'&&id.length<32)||!isSummonId(value.summonId as string))return fail('編成の形式が不正です');
 const valid=validateDeck(value.cardIds);return valid.valid?ok({cardIds:[...value.cardIds],summonId:value.summonId as SummonId}):fail(valid.errors.join(' / '));
}
export function parseName(value:unknown):ValidationResult<string>{if(typeof value!=='string')return fail('表示名を入力してください');const name=value.trim();return [...name].length>=1&&[...name].length<=20&&!/[\x00-\x1f\x7f]/.test(name)?ok(name):fail('表示名は制御文字を含まない1〜20文字です');}
export function parseCommandEnvelope(value:unknown):ValidationResult<CommandEnvelope>{
 if(!record(value)||value.version!==PROTOCOL_VERSION||typeof value.matchId!=='string'||value.matchId.length>80||!Number.isSafeInteger(value.sequence)||Number(value.sequence)<1||!record(value.command))return fail('操作の形式が不正です');
 const c=value.command;if(c.team!=='Player'&&c.team!=='Cpu')return fail('陣営が不正です');
 if(!['MoveUnit','BeginElementalBuild','PlaceInitialUnit','UseAbility','Summon','ReviveUnit'].includes(String(c.commandType)))return fail('操作が不正です');
 if(c.commandType!=='Summon'&&(typeof c.unitId!=='string'||c.unitId.length>80))return fail('ユニットが不正です');
 if(['MoveUnit','PlaceInitialUnit','ReviveUnit'].includes(String(c.commandType))&&!point(c.targetPosition))return fail('座標が不正です');
 if(c.commandType==='UseAbility'&&(typeof c.facingRotation!=='number'||!Number.isFinite(c.facingRotation)))return fail('向きが不正です');
 return ok(value as unknown as CommandEnvelope);
}
