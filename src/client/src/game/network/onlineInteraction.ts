import type {BattleState,TeamId} from '../core/types';
import type {RoomView} from '@reijin-summon/shared/network/protocol';
export function consumeAttackEvents(state:BattleState){return state.recentAttackEvents.splice(0);}
export function bindInputReset(reset:()=>void,page:EventTarget,window:EventTarget){
 page.addEventListener('visibilitychange',reset);
 for(const event of ['blur','focus','resize'])window.addEventListener(event,reset);
 return()=>{page.removeEventListener('visibilitychange',reset);for(const event of ['blur','focus','resize'])window.removeEventListener(event,reset);};
}
export function onlineRoomPresentation(view:(Omit<RoomView,'battle'>&{expiresIn?:number})|undefined,team:TeamId){
 const phase=view?.phase;const warning=['Waiting','Setup','Result'].includes(phase??'')&&(view?.expiresIn??Infinity)<=30?'操作がないため、あと'+view!.expiresIn+'秒でルームを閉じます':'';
 const message=phase==='Battle'?'対戦中':phase==='Countdown'?'開始まで '+Math.ceil(view!.countdown)+'秒':phase==='Result'?'対戦終了。双方の再戦希望で編成に戻ります':phase==='Closed'?'対戦は終了しました':view?.ready[team]?'準備完了・相手を待っています':'配置を決めて準備完了してください';
 return {message,warning,canEdit:phase==='Waiting'||phase==='Setup',canCancelReady:phase==='Countdown',exitLabel:phase==='Battle'?'降参して退出':phase==='Closed'?'タイトルへ戻る':'ルームから退出'};
}
