# デッキ編成 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. 承認済みのため追加確認なしで継続する。

**Goal:** SC001〜SC020からコスト10以下・1〜5枚のデッキを編集・複数保存し、COM戦で使用できるようにする。

**Architecture:** 純TypeScriptのカード一覧・編成検証・保存処理と、DOMのタッチ対応編成画面を分離する。戦闘はカードIDと個体IDを分離して既存Phaserシーンへ接続する。

**Tech Stack:** TypeScript、Phaser、Vite、Node.js test runner。

**Spec:** `docs/superpowers/specs/2026-09-13-deck-building-design.md`

## 共通制約

- 日本語UI・資料。SC001〜SC020を表示とカード定義の識別に使用する。
- コスト10以下、1〜5枚、同兵種可、同一カード不可。保存件数の独自上限なし。
- INTは表示・記録のみ。既存の兵種別能力と移動等を継承する。
- CPU標準案はSC020・SC019・SC014。画像生成失敗時は既存画像を共用できる。
- 既存テスト290件が開始時点で成功。現在の作業ブランチfeature18で変更をレビュー可能な状態に残す。

## Task 1: カード一覧、編成検証、保存

対象: `src/client/src/game/deck/cardCatalog.ts`, `deckModel.ts`, `deckStorage.ts`と各テスト。

公開契約:

```ts
type CardDefinition = { id: string; name: string; unitType: UnitType; cost: number; level: number; maxHp: number; attackDamage: number; intelligence: number; imagePath: string };
type SavedDeck = { id: string; name: string; cardIds: string[] };
type DeckLibrary = { version: 1; selectedDeckId: string | null; decks: SavedDeck[] };
// cardCatalog: readonly CardDefinition[]
// findCard(id: string): CardDefinition | undefined
// validateDeck(cardIds: readonly string[]): { valid: boolean; cost: number; errors: string[] }
// loadDeckLibrary(storage: Pick<Storage, 'getItem'>): { library: DeckLibrary; error: string | null }
// saveDeckLibrary(storage: Pick<Storage, 'setItem'>, library: DeckLibrary): { error: string | null }
```

- [x] コスト超過、0枚、6枚、重複、不明ID、合法5枚をテストし失敗確認。
- [x] 指定Wikiを照合し20件を登録。既存画像はSC009（旧blue001）、残る2枚は絵と既存能力の対応を確認して番号化。
- [x] 検証処理を実装し対象テストを成功させる。
- [x] 複数デッキ往復、保存拒否、破損データ、不明ID保持と出撃拒否をテストし失敗確認。
- [x] 保存処理を実装しテストを成功させる。

## Task 2: 可変編成の戦闘

対象: `core/types.ts`, `core/battleState.ts`, `rules/gameSession.ts`, `render/cardPresentation.ts`, `scenes/BattleScene.ts`, 関連テスト。

- [x] 1〜5体、同兵種別カード、敵味方同カード、初期配置の間隔、カード別復活MPをテストして失敗確認。
- [x] `createDeckBattleState(config, playerCardIds, cpuCardIds)`で検証済みカードから状態を生成する。`Player:SC001`形式の個体IDを使い、カード番号を別途保持する。
- [x] テスト用に既存の既定状態生成を維持しつつ、製品の戦闘入口をデッキ状態へ切り替える。
- [x] 描画をカードIDで選び、待機欄・カード番号表示を可変枚数へ対応。旧画像パスの使用を番号付きパスへ移行する。
- [x] 戦闘開始時にデッキをコピーし、再戦時は同じ双方の編成を初期化。終了時に編成へ戻る操作を追加。
- [x] 関連テストと全体型チェックを成功させる。

## Task 3: タッチ対応の編成画面と統合

対象: `deck/deckEditor.ts`, `deck/deckEditor.css`, `scenes/DeckScene.ts`, `scenes/TitleScene.ts`, `main.ts`。

- [x] DOMでカード一覧、詳細、編成5枠、合計コストと制限理由、出撃を表示。
- [x] 名前付きデッキの作成・選択・保存・名前変更・削除を接続。編集中の変更と保存状態を区別し、保存失敗を通知。
- [x] タイトルから編成、初期配置、戦闘、再戦、編成へ戻る導線を接続。
- [x] 画像生成を試み、生成できた画像をカード別番号付きパスへ保存。失敗時は承認済みの既存画像を利用。
- [x] 全テスト、型チェック、ビルド。実ブラウザで狭幅・タブレット幅、保存復元、5枚編成、同兵種操作、再戦を確認。
- [x] コードレビューと修正を行い、READMEとこの計画に結果を記録。

## 実行記録

- 設計とユーザー追加指示を確認。カード番号は一覧のSC表記で統一。
- 作業開始時のクライアントテスト: 290成功、0失敗。

### 完了結果（2026-09-13）

- SC001〜SC020の定義、編成検証、名前付き複数保存、戦闘への接続を実装。
- 既存画像の対応はSC009・SC012・SC017へ修正。残る17枚は個別画像を生成。
- 全311テスト成功。クライアント・サーバーの型チェックと製品ビルド成功。Viteのバンドルサイズ警告は残る。
- コードレビューの指摘を修正し、再レビューで未解決の指摘なし。
- ブラウザで5枚編成の保存・再読み込み・選択復元、同兵種2枚の独立配置、実際の戦闘終了、同じ編成での再戦、編成画面への復帰を確認。
- 1024×768、768×1024、390×844の表示を確認。縦向きの編成枠で長い名前が重なる問題を修正し、詳細欄をスクロール可能にした。
- カード回転後も番号と攻撃力表示が重ならないことを確認。
- 実機タブレットでの複数指操作は未確認。ブラウザの画面幅変更とポインター操作による検証。
- READMEへ利用方法と今回の対応範囲を追記。変更はfeature18の作業ツリーに保持。
