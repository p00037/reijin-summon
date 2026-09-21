import "./deckEditor.css";

import { createDefaultBattleConfig } from "../core/battleConfig";
import { getSummonDefinition, summonCatalog, type SummonId } from "../core/summonCatalog";
import type { UnitType } from "../core/types";
import { cardCatalog, findCard, standardDeckCardIds, type CardDefinition } from "./cardCatalog";
import type { DeckLibrary, SavedDeck } from "./deckModel";
import { validateDeck } from "./deckModel";
import { loadDeckLibrary, saveDeckLibrary } from "./deckStorage";

type DeckDraft = { id: string; name: string; cardIds: string[]; summonId: SummonId; isNew: boolean };

type EditorSession = {
  library: DeckLibrary;
  drafts: Map<string, DeckDraft>;
  selectedDeckId: string;
  selectedCardId: string;
  notice: string | null;
  noticeKind: "info" | "error";
  storageLoadError: string | null;
};

const typePresentation: Record<UnitType, { label: string; ability: string }> = {
  Melee: {
    label: "キーパー",
    ability: "守護の潮流（AP 2）：前方の完成済み味方エレメンタルに、周囲の味方の移動速度を1.5倍にする加護を付与。"
  },
  Speed: {
    label: "シーカー",
    ability: "海駆けの号令（AP 3）：自身を含む周囲の生存中の味方へ15秒間、攻撃力+10。"
  },
  Ranged: {
    label: "マスター",
    ability: "深海の照準（AP 2）：自身の攻撃射程を20秒間1.5倍にする。"
  }
};

const battleConfig = createDefaultBattleConfig();
let editorSession: EditorSession | null = null;

function browserStorage(): Pick<Storage, "getItem" | "setItem"> {
  return {
    getItem(key: string) {
      return window.localStorage.getItem(key);
    },
    setItem(key: string, value: string) {
      window.localStorage.setItem(key, value);
    }
  };
}

function newId(): string {
  try {
    return `deck-${crypto.randomUUID()}`;
  } catch {
    return `deck-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function initialSession(): EditorSession {
  const loaded = loadDeckLibrary(browserStorage());
  const library = loaded.library;
  const firstDeck = library.decks.find((deck) => deck.id === library.selectedDeckId) ?? library.decks[0];
  const fallback: SavedDeck = {
    id: "standard",
    name: "標準デッキ",
    cardIds: [...standardDeckCardIds],
    summonId: "raphael"
  };
  const selected = firstDeck ?? fallback;
  if (library.decks.length === 0) {
    library.decks.push(fallback);
    library.selectedDeckId = fallback.id;
  }
  return {
    library,
    drafts: new Map(),
    selectedDeckId: selected.id,
    selectedCardId: selected.cardIds.find((id) => findCard(id) !== undefined) ?? cardCatalog[0].id,
    notice: loaded.error ?? loaded.notice ?? null,
    noticeKind: loaded.error ? "error" : "info",
    storageLoadError: loaded.error
  };
}

function savedDeck(session: EditorSession, id: string): SavedDeck | undefined {
  return session.library.decks.find((deck) => deck.id === id);
}

function currentDraft(session: EditorSession): DeckDraft {
  const existing = session.drafts.get(session.selectedDeckId);
  if (existing) return existing;
  const saved = savedDeck(session, session.selectedDeckId);
  const draft: DeckDraft = saved
    ? { id: saved.id, name: saved.name, cardIds: [...saved.cardIds], summonId: saved.summonId, isNew: false }
    : { id: session.selectedDeckId, name: "新しいデッキ", cardIds: [], summonId: "raphael", isNew: true };
  session.drafts.set(draft.id, draft);
  return draft;
}

function isDirty(session: EditorSession, draft: DeckDraft): boolean {
  const saved = savedDeck(session, draft.id);
  return draft.isNew
    || saved === undefined
    || saved.name !== draft.name
    || saved.summonId !== draft.summonId
    || saved.cardIds.length !== draft.cardIds.length
    || saved.cardIds.some((id, index) => id !== draft.cardIds[index]);
}

function allDecks(session: EditorSession): DeckDraft[] {
  const saved = session.library.decks.map((deck) => session.drafts.get(deck.id) ?? {
    id: deck.id,
    name: deck.name,
    cardIds: [...deck.cardIds],
    summonId: deck.summonId,
    isNew: false
  });
  const savedIds = new Set(saved.map((deck) => deck.id));
  return [...saved, ...[...session.drafts.values()].filter((deck) => !savedIds.has(deck.id))];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  })[character] ?? character);
}

function cardDetail(card: CardDefinition): string {
  const type = typePresentation[card.unitType];
  const stats = battleConfig.statsByType[card.unitType];
  return `
    <div class="deck-editor__detail-art"><img src="${card.imagePath}" alt="" draggable="false"></div>
    <div class="deck-editor__detail-copy">
      <p class="deck-editor__eyebrow">${card.id} · ${type.label}</p>
      <h2>${escapeHtml(card.name)}</h2>
      <div class="deck-editor__primary-stats" aria-label="カード能力値">
        <span><small>CO / LV</small><strong>${card.cost} / ${card.level}</strong></span>
        <span><small>HP</small><strong>${card.maxHp}</strong></span>
        <span><small>AT</small><strong>${card.attackDamage}</strong></span>
        <span><small>INT</small><strong>${card.intelligence}</strong></span>
      </div>
      <p class="deck-editor__reference-note">INTは参照値です。現在の戦闘効果には使用されません。</p>
      <dl class="deck-editor__combat-stats">
        <div><dt>移動速度</dt><dd>${stats.moveSpeed.toFixed(3)}</dd></div>
        <div><dt>攻撃射程</dt><dd>${stats.attackRange}</dd></div>
        <div><dt>攻撃間隔</dt><dd>${stats.attackIntervalSeconds}秒</dd></div>
        <div><dt>生成時間</dt><dd>${stats.elementalBuildSeconds}秒</dd></div>
        <div><dt>復活MP</dt><dd>${card.cost}</dd></div>
      </dl>
      <div class="deck-editor__ability"><span>現在の兵種アビリティ</span><p>${type.ability}</p></div>
    </div>`;
}

/** デッキ編成画面をマウントし、破棄用関数を返す。 */
export function mountDeckEditor(
  parent: HTMLElement,
  onStart: (cardIds: string[], summonId: SummonId) => void
): () => void {
  const session = editorSession ??= initialSession();
  const root = document.createElement("section");
  root.className = "deck-editor";
  root.setAttribute("aria-label", "デッキ編成");
  parent.append(root);

  let pendingDeleteId: string | null = null;
  let storageReplacePending = false;

  const render = (options: { revealDetail?: boolean } = {}): void => {
    const previousScrollTop = root.scrollTop;
    const panelScroll = new Map(
      [...root.querySelectorAll<HTMLElement>("[data-scroll-panel]")].map((panel) => [
        panel.dataset.scrollPanel ?? "",
        panel.scrollTop
      ])
    );
    const active = document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
      ? {
          action: document.activeElement.dataset.action,
          card: document.activeElement.dataset.card,
          remove: document.activeElement.dataset.remove
        }
      : null;
    const draft = currentDraft(session);
    const validation = validateDeck(draft.cardIds);
    const selected = findCard(session.selectedCardId) ?? cardCatalog[0];
    const dirty = isDirty(session, draft);
    const selectedSummon = getSummonDefinition(draft.summonId);
    const selectedIds = new Set(draft.cardIds);
    const deckOptions = allDecks(session).map((deck) =>
      `<option value="${escapeHtml(deck.id)}"${deck.id === draft.id ? " selected" : ""}>${escapeHtml(deck.name || "名称未設定")}${isDirty(session, deck) ? " *" : ""}</option>`
    ).join("");
    const slots = Array.from({ length: Math.max(5, draft.cardIds.length) }, (_, index) => {
      const cardId = draft.cardIds[index];
      const card = cardId ? findCard(cardId) : undefined;
      if (!cardId) return `<li class="deck-editor__slot deck-editor__slot--empty"><span>${index + 1}</span><p>空きスロット</p></li>`;
      if (!card) return `<li class="deck-editor__slot deck-editor__slot--unknown"><span>${index + 1}</span><p>${escapeHtml(cardId)}<small>不明なカード</small></p><button type="button" data-remove="${index}" aria-label="${escapeHtml(cardId)}を外す">外す</button></li>`;
      return `<li class="deck-editor__slot"><span>${index + 1}</span><img src="${card.imagePath}" alt="" draggable="false"><button type="button" data-remove="${index}" aria-label="${escapeHtml(card.name)}を外す"><strong>${escapeHtml(card.name)}</strong><small>${card.id} · CO ${card.cost}</small></button></li>`;
    }).join("");
    const cards = cardCatalog.map((card) => {
      const active = card.id === selected.id;
      const included = selectedIds.has(card.id);
      return `<button type="button" class="deck-editor__card${active ? " is-active" : ""}${included ? " is-included" : ""}" data-card="${card.id}" aria-pressed="${active}">
        <span class="deck-editor__card-art"><img src="${card.imagePath}" alt="" loading="lazy" draggable="false"><i>${included ? "編成中" : `CO ${card.cost}`}</i></span>
        <span class="deck-editor__card-copy"><small>${card.id} · ${typePresentation[card.unitType].label}</small><strong>${escapeHtml(card.name)}</strong><span>HP ${card.maxHp} · AT ${card.attackDamage}</span></span>
      </button>`;
    }).join("");
    const selectedIncluded = selectedIds.has(selected.id);
    const addCheck = validateDeck([...draft.cardIds, selected.id]);
    const addReason = selectedIncluded
      ? "このカードは編成済みです。"
      : draft.cardIds.length >= 5
        ? "5枚まで編成できます。"
        : addCheck.cost > 10
          ? `追加すると合計コスト${addCheck.cost}になります。`
          : "";
    const summons = summonCatalog.map((summon) => `<button type="button" class="deck-editor__summon${summon.id === draft.summonId ? " is-active" : ""}" data-summon="${summon.id}" aria-pressed="${summon.id === draft.summonId}">
      <span class="deck-editor__summon-art"><span aria-hidden="true">${escapeHtml(summon.name)}</span><img src="${summon.imagePath}" alt="" loading="lazy" draggable="false" data-image-fallback></span>
      <strong>${escapeHtml(summon.name)}</strong>
    </button>`).join("");

    root.innerHTML = `
      <header class="deck-editor__header">
        <div><p class="deck-editor__kicker">OCEAN GUILD / FORMATION</p><h1>蒼海のデッキ編成</h1></div>
        <div class="deck-editor__library-controls">
          <label>保存デッキ<select data-action="select-deck">${deckOptions}</select></label>
          <button type="button" data-action="new">新規</button>
          <button type="button" data-action="delete" class="deck-editor__quiet">削除</button>
        </div>
        <nav class="deck-editor__mobile-nav" aria-label="画面内ナビゲーション">
          <button type="button" data-action="go-detail">詳細</button>
          <button type="button" data-action="go-catalog">カード一覧</button>
          <button type="button" data-action="go-formation">編成中</button>
        </nav>
      </header>
      ${session.storageLoadError ? `<div class="deck-editor__notice deck-editor__notice--error" role="alert"><strong>保存データを安全に読み込めませんでした。</strong><span>${escapeHtml(session.storageLoadError)} 元の保存データはまだ上書きしていません。</span></div>` : ""}
      ${session.notice && session.notice !== session.storageLoadError ? `<p class="deck-editor__notice deck-editor__notice--${session.noticeKind}" role="${session.noticeKind === "error" ? "alert" : "status"}">${escapeHtml(session.notice)}</p>` : ""}
      <main class="deck-editor__main">
        <section class="deck-editor__catalog" data-scroll-panel="catalog" aria-labelledby="deck-catalog-title">
          <div class="deck-editor__section-heading"><div><p>01 / CARD ARCHIVE</p><h2 id="deck-catalog-title">カード一覧</h2></div><span>全20枚</span></div>
          <div class="deck-editor__card-grid">${cards}</div>
        </section>
        <aside class="deck-editor__detail" data-scroll-panel="detail" aria-live="polite">
          ${cardDetail(selected)}
          <button type="button" class="deck-editor__add" data-action="add" ${addReason ? "disabled" : ""}>${selectedIncluded ? "編成済み" : "このカードを加える"}</button>
          ${addReason ? `<p class="deck-editor__add-reason">${addReason}</p>` : ""}
        </aside>
        <section class="deck-editor__formation" data-scroll-panel="formation" aria-labelledby="deck-formation-title">
          <div class="deck-editor__section-heading"><div><p>02 / YOUR CREW</p><h2 id="deck-formation-title">編成中</h2></div><strong>${draft.cardIds.length}<small>/ 5枚</small></strong></div>
          <label class="deck-editor__name">デッキ名<input data-action="name" maxlength="40" value="${escapeHtml(draft.name)}" autocomplete="off"></label>
          <ol class="deck-editor__slots">${slots}</ol>
          <section class="deck-editor__summon-selection" aria-labelledby="deck-summon-title">
            <div class="deck-editor__summon-heading"><h3 id="deck-summon-title">召喚獣</h3><span>デッキと一緒に保存</span></div>
            <div class="deck-editor__summon-grid">${summons}</div>
            <div class="deck-editor__summon-detail">
              <strong>${escapeHtml(selectedSummon.name)}</strong>
              <span>基礎HP ${selectedSummon.baseHp} · 攻撃 ${selectedSummon.attackDamage} · 被ダメージ ${Math.round(selectedSummon.damageMultiplier * 100)}%</span>
              <p>${escapeHtml(selectedSummon.description)}</p>
            </div>
          </section>
          <div class="deck-editor__cost"><span>合計コスト</span><strong>${validation.cost}<small>/ 10</small></strong></div>
          <div class="deck-editor__validation" ${validation.valid ? "hidden" : ""} role="status">${validation.errors.map(escapeHtml).join("<br>")}</div>
          <div class="deck-editor__actions">
            <button type="button" data-action="save" class="deck-editor__save">${dirty ? "デッキを保存" : "保存済み"}</button>
            <button type="button" data-action="start" class="deck-editor__start" ${validation.valid ? "" : "disabled"}>この編成で出撃</button>
          </div>
          ${storageReplacePending ? `<div class="deck-editor__confirm" role="alert"><p>読み込めなかった保存データを、現在のデッキ一覧で置き換えますか？ この操作後は元のデータを復元できません。</p><div><button type="button" data-action="cancel-replace">戻る</button><button type="button" data-action="confirm-replace" class="deck-editor__danger">保存データを置き換える</button></div></div>` : ""}
          ${pendingDeleteId === draft.id ? `<div class="deck-editor__confirm" role="group" aria-label="デッキ削除の確認"><p>「${escapeHtml(draft.name || "名称未設定")}」を削除しますか？</p><div><button type="button" data-action="cancel-delete">戻る</button><button type="button" data-action="confirm-delete" data-deck-id="${escapeHtml(draft.id)}" class="deck-editor__danger">削除する</button></div></div>` : ""}
        </section>
      </main>`;

    root.scrollTop = previousScrollTop;
    for (const panel of root.querySelectorAll<HTMLElement>("[data-scroll-panel]")) {
      panel.scrollTop = panelScroll.get(panel.dataset.scrollPanel ?? "") ?? 0;
    }
    if (active) {
      const candidates = root.querySelectorAll<HTMLElement>("button, input, select");
      const replacement = [...candidates].find((element) =>
        element.dataset.action === active.action
        && element.dataset.card === active.card
        && element.dataset.remove === active.remove
      );
      replacement?.focus({ preventScroll: true });
    }
    if (options.revealDetail && window.matchMedia("(max-width: 760px)").matches) {
      root.querySelector<HTMLElement>(".deck-editor__detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const saveDraft = (allowStorageReplacement: boolean): void => {
    const draft = currentDraft(session);
    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      session.notice = "デッキ名を入力してください。";
      session.noticeKind = "error";
      render();
      return;
    }
    if (session.storageLoadError && !allowStorageReplacement) {
      storageReplacePending = true;
      session.notice = "保存前に、読み込めなかった保存データを置き換える確認が必要です。";
      session.noticeKind = "error";
      render();
      return;
    }
    const candidateDeck: SavedDeck = { id: draft.id, name: trimmedName, cardIds: [...draft.cardIds], summonId: draft.summonId };
    const decks = session.library.decks.some((deck) => deck.id === draft.id)
      ? session.library.decks.map((deck) => deck.id === draft.id ? candidateDeck : deck)
      : [...session.library.decks, candidateDeck];
    const candidateLibrary: DeckLibrary = { version: 2, selectedDeckId: draft.id, decks };
    const result = saveDeckLibrary(browserStorage(), candidateLibrary);
    storageReplacePending = false;
    if (result.error) {
      session.notice = `${result.error} 編集内容はこの画面に保持しています。`;
      session.noticeKind = "error";
    } else {
      session.library = candidateLibrary;
      draft.name = trimmedName;
      draft.isNew = false;
      session.storageLoadError = null;
      session.notice = "デッキを保存しました。";
      session.noticeKind = "info";
    }
    render();
  };

  root.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    const draft = currentDraft(session);
    const cardId = button.dataset.card;
    if (cardId) {
      session.selectedCardId = cardId;
      if (!session.storageLoadError) session.notice = null;
      render({ revealDetail: true });
      return;
    }
    const summonId = button.dataset.summon as SummonId | undefined;
    if (summonId) {
      draft.summonId = summonId;
      session.notice = null;
      render();
      return;
    }
    if (button.dataset.remove !== undefined) {
      draft.cardIds.splice(Number(button.dataset.remove), 1);
      session.notice = null;
      render();
      return;
    }
    switch (button.dataset.action) {
      case "add": {
        const candidate = [...draft.cardIds, session.selectedCardId];
        if (validateDeck(candidate).errors.length === 0) draft.cardIds = candidate;
        render();
        break;
      }
      case "new": {
        const id = newId();
        session.drafts.set(id, { id, name: "新しいデッキ", cardIds: [], summonId: "raphael", isNew: true });
        session.selectedDeckId = id;
        session.notice = "新しいデッキを作成しました。名前とカードを選んで保存してください。";
        session.noticeKind = "info";
        pendingDeleteId = null;
        storageReplacePending = false;
        render();
        break;
      }
      case "save":
        saveDraft(false);
        break;
      case "delete":
        pendingDeleteId = draft.id;
        storageReplacePending = false;
        render();
        break;
      case "cancel-delete":
        pendingDeleteId = null;
        render();
        break;
      case "confirm-delete": {
        if (button.dataset.deckId !== draft.id || pendingDeleteId !== draft.id) break;
        if (session.storageLoadError && savedDeck(session, draft.id)) {
          pendingDeleteId = null;
          session.notice = "読み込めなかった保存データが残っているため削除できません。先に「デッキを保存」から保存データの置き換えを確認してください。";
          session.noticeKind = "error";
          render();
          break;
        }
        if (draft.isNew || !savedDeck(session, draft.id)) {
          session.drafts.delete(draft.id);
        } else {
          const remaining = session.library.decks.filter((deck) => deck.id !== draft.id);
          const nextId = remaining[0]?.id ?? null;
          const candidate: DeckLibrary = { version: 2, selectedDeckId: nextId, decks: remaining };
          const result = saveDeckLibrary(browserStorage(), candidate);
          if (result.error) {
            session.notice = `${result.error} デッキは削除されていません。`;
            session.noticeKind = "error";
            pendingDeleteId = null;
            render();
            break;
          }
          session.library = candidate;
          session.drafts.delete(draft.id);
        }
        const next = allDecks(session)[0];
        if (next) {
          session.selectedDeckId = next.id;
        } else {
          const id = newId();
          session.drafts.set(id, { id, name: "新しいデッキ", cardIds: [], summonId: "raphael", isNew: true });
          session.selectedDeckId = id;
        }
        pendingDeleteId = null;
        session.notice = "デッキを削除しました。";
        session.noticeKind = "info";
        render();
        break;
      }
      case "cancel-replace":
        storageReplacePending = false;
        render();
        break;
      case "confirm-replace":
        saveDraft(true);
        break;
      case "start":
        if (validateDeck(draft.cardIds).valid) onStart([...draft.cardIds], draft.summonId);
        break;
      case "go-detail":
        root.querySelector<HTMLElement>(".deck-editor__detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      case "go-catalog":
        root.querySelector<HTMLElement>(".deck-editor__catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      case "go-formation":
        root.querySelector<HTMLElement>(".deck-editor__formation")?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
    }
  });

  root.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.dataset.action !== "name") return;
    currentDraft(session).name = input.value;
    const saveButton = root.querySelector<HTMLButtonElement>('[data-action="save"]');
    if (saveButton) saveButton.textContent = "デッキを保存";
  });

  root.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.hasAttribute("data-image-fallback")) return;
    image.hidden = true;
    image.parentElement?.classList.add("has-image-error");
  }, true);

  root.addEventListener("change", (event) => {
    const select = event.target as HTMLSelectElement;
    if (select.dataset.action !== "select-deck") return;
    session.selectedDeckId = select.value;
    const next = currentDraft(session).cardIds.find((id) => findCard(id) !== undefined);
    if (next) session.selectedCardId = next;
    const selectedIsSaved = savedDeck(session, select.value) !== undefined;
    if (selectedIsSaved && !session.storageLoadError) {
      const candidate: DeckLibrary = { ...session.library, selectedDeckId: select.value };
      const result = saveDeckLibrary(browserStorage(), candidate);
      if (result.error) {
        session.notice = `${result.error} 選択中のデッキと編集内容はこの画面に保持しています。`;
        session.noticeKind = "error";
      } else {
        session.library = candidate;
        session.notice = null;
      }
    } else if (!session.storageLoadError) {
      session.notice = null;
    }
    pendingDeleteId = null;
    storageReplacePending = false;
    render();
  });

  render();
  return () => root.remove();
}
