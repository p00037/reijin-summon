# 召喚獣選択 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 承認済みの6種類を保存・選択して、固有攻撃と専用画像で対戦できるようにする。

**Architecture:** 種類定義をcore/summonCatalog.tsに集める。デッキ選択を戦闘状態へ渡し、共通召喚処理と攻撃方式を分離する。画像と描画は戦闘判定から独立させる。

**Tech Stack:** TypeScript、Phaser、node:test、tsx、Vite。

**Spec:** docs/superpowers/specs/2026-09-17-summon-selection-design.md（ユーザー承認済み）。

## 共通制約

- 1Cは1秒。HPは種類別基礎HP＋陣地面積1%につき60、自然消耗は毎秒120。
- 潜在能力とデッキカスタマイズは実装しない。
- 旧デッキはラファエルを補完し、カード・名前・選択状態を保つ。
- Wiki未確定部分は承認済み設計の仮値を使い、定義から調整可能にする。
- 専用画像は組み込みimage_genで生成し、public/assets/summonsへ保存する。
- 資料・UI説明は日本語とする。公開・pushは実施しない。

## Task 1: 定義・選択・保存

**Files:** core/summonCatalog.ts、deck/deckModel.ts、deck/deckStorage.ts、deck/deckEditor.ts、deck/deckEditor.css、scenes/DeckScene.ts、core/deckBattleState.ts、対応test.ts。

**Interfaces:** summonCatalog.tsはSummonId（raphael / jackpot / yggdrasil / leviathan / bahamut / dullahan）、summonCatalog配列、getSummonDefinition(id)、isSummonId(value)、pickCpuSummon(random = Math.random)を公開する。定義はid/name/baseHp/attackDamage/leaderAttackDamage/leaderAttackIntervalSeconds/moveSpeed/damageMultiplier/attackStyle/imagePath/descriptionを持つ。画像パスは/assets/summons/{id}.png。mountDeckEditorの出撃コールバックに第2引数summonIdを追加する。createDeckBattleStateの第4引数playerSummonId、第5引数randomを追加する。

- [x] 旧保存の移行、選択の保存、未知ID補完、CPU抽選と選択引継ぎの失敗テストを追加する。
- [x] `npm.cmd test -w src/client -- --test-name-pattern=召喚`相当の対象ファイル実行で失敗を確認する。
- [x] 6種類の定義とversion 2保存形式、選択UI、出撃接続を実装する。
- [x] 対象テストと型チェックを実行し、旧デッキ読込で内容を失わないことを確認する。

テスト例:
```typescript
const old = { version: 1, selectedDeckId: "saved", decks: [{ id: "saved", name: "保存", cardIds: ["SC002"] }] };
const result = loadDeckLibrary({ getItem: () => JSON.stringify(old) });
assert.equal(result.library.decks[0].summonId, "raphael");
assert.deepEqual(result.library.decks[0].cardIds, ["SC002"]);
```

## Task 2: 戦闘処理

**Files:** core/types.ts、core/battleState.ts、rules/summonSystem.ts、rules/summonAttacks.ts、rules/summonGeometry.ts、rules/combatDamage.ts、rules/unitSystem.ts、rules/gameSession.ts、対応test.ts。

**Interfaces:** BattleStateにplayerSummonId/cpuSummonId/recentSummonAttackEventsを追加。SummonedUnitStateにsummonId、damageMultiplier、specialAttackTimerSecondsを追加。召喚可否の理由はsummonUnavailableReason(state, config, team): string | null。レーザー形状はgetSummonBeam(summoned, state, config)、円との交差はisCircleInBeam(position, radius, beam)。イベントはsummonId/team/origin/targetsを保持する。

- [x] 種類別HP、自然消耗と防御の分離、面積0、味方レーザー、全体攻撃、周期の失敗テストを追加・実行する。
- [x] 基本値と戦闘状態を接続し、共通ダメージ関数を経由して倍率を1回だけ適用する。
- [x] 近接・レーザー・全体攻撃と召喚時効果を実装する。召喚直後の死亡・MP獲得・勝敗を処理する。
- [x] レーザーの敵だけの減速、周期更新、寿命切れ、戦闘終了を確認する。
- [x] 対象テストと既存の戦闘テストを実行する。

テスト例:
```typescript
state.playerSummonId = "jackpot";
state.playerSummonGauge = 1;
assert.equal(tryExecuteSummon(state, config, "Player"), false);
assert.equal(state.playerSummonGauge, 1);
```

## Task 3: 6種類のイラスト

**Files:** public/assets/summons/{raphael,jackpot,yggdrasil,leviathan,bahamut,dullahan}.png、同ディレクトリREADME.md。

- [x] imagegenスキルを読み、各種類を個別に生成する。
- [x] 白金の天使、熔岩の卵、世界樹、深海龍、天空龍、冥界騎士を縦長・文字なしの統一画風にする。
- [x] 生成結果を目視確認し、プロジェクトへコピーする。
- [x] READMEに使用ツールと各プロンプトを記録する。

## Task 4: 描画と統合検証

**Files:** scenes/BattleScene.ts、render/summonPresentation.ts、render/cardPresentation.ts、ui/battleHud.ts、ui/battleHudModel.ts、README.md。

- [x] 選択と画像の対応、レーザー形状と演出モデルのテストを追加・実行する。
- [x] 種類別画像と名前、画像失敗時の代替表示、レーザー・根・波動・斬撃を描画する。
- [x] 再戦でプレイヤー選択維持とCPU再抽選を接続する。
- [x] `npm.cmd test -w src/client`、`npm.cmd run typecheck`、`npm.cmd run build`を実行する。
- [x] ブラウザで保存・再読込・出撃・攻撃演出・再戦を確認する。タッチ用幅でも選択操作ができることを確認する。
- [x] 差分レビューを行い、発見事項を修正して再検証する。

## 実行記録

- 作業は現在のチェックアウトで専用ブランチcodex/summon-selectionに分離する。ユーザーに別チェックアウトへの移動を要求しない。
- Task 1とTask 3をサブエージェントへ委譲し、Task 2とTask 4を親エージェントが担当する。共通ファイルは担当を固定し、競合を避ける。
- 共通インターフェース確認: Task 1→Task 2は召喚獣IDと定義、Task 2→Task 4は状態と攻撃イベント、Task 3→Task 1/4は画像パス。すべて本計画の名称で揃える。

## 完了記録（2026年9月18日）

- 全331件のテスト、型チェック、ビルドが成功。Viteの既存のチャンクサイズ警告は残る。
- ブラウザで保存・再読込・出撃、6種類の画像と演出、試合終了時の演出解除、再戦の選択維持とCPU再抽選を確認。演出検証にはブラウザ内の一時的な戦闘状態を使用し、本番コードに検証用機能は追加していない。
- 390×844、1024×600、1024×768、1366×600で編成操作の到達性を確認。
- レビューで見つかった中間幅のスクロール不足とレーザー内の移動射撃判定を修正。後者は失敗する回帰テストで再現し、修正後の成功と再レビューを確認。
- 長い日本語名の折り返しを修正し、画面内に収まることを確認。
- 作業ブランチはcodex/summon-selection。公開・pushは行っていない。

