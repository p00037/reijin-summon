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

export function mountOnlineBattleStatus(session: OnlineSession, _onEdit: () => void, onExit: () => void, battleScreen = true) {
    const host = document.createElement('aside');
    host.className = 'online-status';
    host.setAttribute('aria-label', 'オンライン対戦情報');
    const header = document.createElement('div');
    header.className = 'online-status__header';
    const connection = document.createElement('span');
    connection.setAttribute('role', 'status');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = '⋯';
    toggle.setAttribute('aria-label', 'ルーム情報と操作メニュー');
    const details = document.createElement('div');
    details.className = 'online-status__details';
    details.id = 'online-room-details';
    const room = document.createElement('p');
    room.className = 'online-status__room';
    const players = document.createElement('p');
    players.className = 'online-status__players';
    const message = document.createElement('p');
    message.setAttribute('role', 'status');
    details.append(room, players, message);
    const actions = document.createElement('div');
    actions.className = 'online-status__actions';
    actions.id = 'online-room-actions';
    toggle.setAttribute('aria-controls', `${details.id} ${actions.id}`);
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '準備を取り消す';
    cancel.onclick = () => session.ready(false);
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.onclick = () => {
        if (session.view?.phase === 'Battle' && !confirm('降参して退出しますか？')) return;
        void session.leave();
        onExit();
    };
    actions.append(cancel, exit);
    const warning = document.createElement('p');
    warning.className = 'online-status__warning';
    warning.setAttribute('role', 'status');
    header.append(connection, toggle);
    host.append(header, details, actions, warning);
    document.body.append(host);
    const canvas = document.querySelector('#game canvas');
    let expanded = false;
    let compact = true;
    let frame = 0;
    let lastPhase = session.view?.phase;
    const renderExpansion = () => {
        details.hidden = compact && !expanded;
        actions.hidden = !expanded;
        toggle.setAttribute('aria-expanded', String(expanded));
        host.classList.toggle('online-status--compact', compact);
    };
    const position = () => {
        const rect = canvas?.getBoundingClientRect();
        const available = (rect?.left ?? 0) - 24;
        compact = !battleScreen || available < 220 || ['Battle', 'Countdown'].includes(session.view?.phase ?? '');
        host.style.width = compact ? '' : `${Math.min(260, available)}px`;
        const top = battleScreen && rect ? Math.max(8, rect.top + 8) : 8;
        host.style.top = `${top}px`;
        host.style.maxHeight = `${Math.max(44, window.innerHeight - top - 8)}px`;
        renderExpansion();
    };
    const schedulePosition = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(position);
    };
    toggle.onclick = () => { expanded = !expanded; renderExpansion(); };
    const dismiss = (event: PointerEvent) => {
        if (event.target instanceof Node && !host.contains(event.target)) {
            expanded = false;
            renderExpansion();
        }
    };
    const escape = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && expanded) {
            expanded = false;
            renderExpansion();
            toggle.focus();
        }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', schedulePosition);
    const observer = new ResizeObserver(schedulePosition);
    if (canvas) observer.observe(canvas);
    const update = () => {
        if (lastPhase !== session.view?.phase) expanded = false;
        lastPhase = session.view?.phase;
        const model = onlineRoomPresentation(session.view, session.team);
        connection.textContent = (session.connected ? '● ' : '○ ') + session.status;
        host.classList.toggle('online-status--disconnected', !session.connected);
        room.textContent = 'ルーム ' + session.code;
        const names = session.view?.names;
        players.textContent = names ? (['Player', 'Cpu'] as const).map(team =>
            `${names[team] || '参加待ち'}${team === session.team ? '（あなた）' : ''}：${session.view?.ready[team] ? '準備完了' : '未準備'}`
        ).join('\n') : '対戦相手を待っています';
        message.textContent = model.message;
        cancel.hidden = !model.canCancelReady;
        cancel.disabled = !session.connected;
        exit.textContent = model.exitLabel;
        warning.textContent = [session.error, model.warning].filter(Boolean).join('\n');
        warning.hidden = !warning.textContent;
        position();
    };
    const off = session.subscribe(update);
    update();
    return () => {
        off();
        observer.disconnect();
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', schedulePosition);
        document.removeEventListener('pointerdown', dismiss);
        document.removeEventListener('keydown', escape);
        host.remove();
    };
}
