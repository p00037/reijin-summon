import {onlineRoomPresentation} from '../network/onlineInteraction';
import { OnlineSession } from '../network/onlineSession';
import './onlineLobby.css';
export function mountOnlineLobby(session: OnlineSession, onDeck: () => void, onBack: () => void) {
    const host = document.createElement('main');
    host.className = 'online-lobby';
    host.innerHTML = '<section><h1>オンライン対戦</h1><p>表示名とルーム番号で知人と対戦できます。</p><label>表示名<input name="name" maxlength="20" autocomplete="nickname"></label><button data-action="create">ルームを作成</button><label>ルーム番号<input name="code" inputmode="numeric" maxlength="6" autocomplete="off"></label><button data-action="join">番号で参加</button><button data-action="reconnect">前の対戦に復帰</button><p role="status"></p><button data-action="deck" hidden>デッキを選んで配置へ</button><button data-action="back">タイトルへ戻る</button></section>';
    document.body.append(host);
    let busy = false;
    const status = host.querySelector('[role=status]')!;
    const deck = host.querySelector<HTMLButtonElement>('[data-action=deck]')!;
    const update = () => { status.textContent = (session.code ? 'ルーム ' + session.code + ' ／ ' : '') + session.status + ' '+onlineRoomPresentation(session.view,session.team).warning + (session.error ? ' ／ ' + session.error : ''); deck.hidden = !session.connected; deck.textContent = ['Battle', 'Result', 'Countdown'].includes(session.view?.phase ?? '') ? '対戦画面へ戻る' : 'デッキを選んで配置へ'; for (const action of ['create', 'join', 'reconnect'])
        host.querySelector<HTMLButtonElement>('[data-action=' + action + ']')!.disabled = busy || session.connected; };
    const off = session.subscribe(update);
    update();
    host.querySelector('[data-action=reconnect]')!.toggleAttribute('hidden', !session.hasSaved());
    host.addEventListener('click', async (e) => { const action = (e.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.action; if (!action)
        return; if (action === 'back') {
        await session.leave();
        onBack();
        return;
    } if (action === 'deck') {
        onDeck();
        return;
    } if (busy)
        return; busy = true; update(); try {
        const name = host.querySelector<HTMLInputElement>('[name=name]')!.value.trim();
        if (action === 'create')
            await session.create(name);
        if (action === 'join')
            await session.join(name, host.querySelector<HTMLInputElement>('[name=code]')!.value.trim());
        if (action === 'reconnect')
            await session.reconnect();
    }
    catch (error) {
        session.error = String(error);
        update();
    }
    finally {
        busy = false;
        update();
    } });
    return () => { off(); host.remove(); };
}

export function mountOnlineBattleStatus(session:OnlineSession,onEdit:()=>void,onExit:()=>void,showEdit=true){
 const host=document.createElement('aside');host.className='online-status';const message=document.createElement('p');message.setAttribute('role','status');
 const edit=document.createElement('button');edit.textContent='編成を変更';edit.onclick=()=>{session.ready(false);onEdit();};
 const cancel=document.createElement('button');cancel.textContent='準備を取り消す';cancel.onclick=()=>session.ready(false);
 const exit=document.createElement('button');exit.onclick=()=>{if(session.view?.phase==='Battle'&&!confirm('降参して退出しますか？'))return;void session.leave();onExit();};
 const hint=document.createElement('p');hint.className='online-portrait-hint';hint.textContent='横向きにすると戦場を広く表示できます。';
 host.append(message,edit,cancel,exit,hint);document.body.append(host);
 const resize=()=>{document.documentElement.style.setProperty('--online-status-height',host.offsetHeight+16+'px');window.dispatchEvent(new Event('resize'));};
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 const update=()=>{const model=onlineRoomPresentation(session.view,session.team);message.textContent='ルーム '+session.code+' ／ '+session.status+' ／ '+(session.view?.names?.Player??'')+' vs '+(session.view?.names?.Cpu??'')+' ／ '+(session.error||model.message)+' '+model.warning;edit.hidden=!showEdit||!model.canEdit;edit.disabled=!session.connected;cancel.hidden=!model.canCancelReady;cancel.disabled=!session.connected;exit.textContent=model.exitLabel;};
 const off=session.subscribe(update);update();return()=>{off();observer.disconnect();host.remove();document.documentElement.style.removeProperty('--online-status-height');window.dispatchEvent(new Event('resize'));};
}
