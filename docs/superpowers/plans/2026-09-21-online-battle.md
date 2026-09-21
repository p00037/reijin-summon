# ルーム制オンライン対戦 実装計画

> **実行担当へ:** 必須スキルは `superpowers:executing-plans`（このタスク内で順次実装する場合）、または `superpowers:subagent-driven-development`（ユーザーが分担を選択した場合）。チェックボックスで進捗を管理する。

**目的:** タブレットを優先し、ログイン不要のルーム番号共有で2人が最後まで対戦できるようにする。

**構成:** 戦闘処理を `src/shared` に移し、CPU戦はブラウザ、対人戦はColyseusサーバーで実行する。サーバーが勝敗・時間・操作の有効性を決定し、クライアントは入力と描画を担当する。待機中の私有データは公開スキーマへ入れない。

**技術:** 既存TypeScript、Node.js 22以上、Phaser、Colyseus 0.16系、schema 3系、Vite、node:test、tsx。バージョン更新は目的に含めない。

**仕様:** [承認済み設計書](../specs/2026-09-21-online-battle-design.md)。実装担当は先に全文を読む。

## 共通制約

- ローカルで検証してからインターネット公開する。
- ログイン不要。表示名とルーム番号で参加する。
- 通信切断中も試合は進行し、30秒以内は復帰可能。期限を過ぎると切断側の敗北。
- 相手のデッキと初期配置は戦闘開始時に公開する。
- タブレットを優先し、既存のタッチ・複数指操作を維持する。
- 公開費用は無料。接続規模は最大10人を想定する。
- 初期値として戦闘更新20回/秒、状態配信10回/秒を採用する。
- コマンドは1接続あたり毎秒30件まで、メッセージは8KiBまで。
- 作成・参加要求はIPあたり毎分30回を初期上限とする。
- 既存CPU戦、20枚のカード、6種類の召喚獣、300カウントの試合、デッキ保存を維持する。
- 説明資料・ユーザー向け表示は日本語。公開アカウントの秘密情報をリポジトリに保存しない。

## 重点レビュー項目

1. カウントダウン中のデッキ情報漏洩。開始前は通信内容にも含めない（タスク4）。
2. 古い試合の遅延入力が再戦で実行される問題。試合IDと連番で拒否する（タスク3・6）。
3. 後参加側の能力範囲・復活位置の反転誤り。画面とサーバー座標を往復して一致させる（タスク2・7）。
4. 切断期限と通常勝敗の競合。結果を一度だけ確定し、通常決着を優先する（タスク5）。
5. タブレット復帰時に指や移動指示が残る問題。入力状態を破棄して最新状態から再開する（タスク7・8）。

## ファイルの責務

| 場所 | 責務 |
| --- | --- |
| `src/shared/src/core/`, `rules/`, `deck/` | 既存の純粋な戦闘処理・定義・デッキ検証を移動 |
| `src/shared/src/network/protocol.ts` | 通信バージョン、入力・通知の型と実行時検証 |
| `src/server/src/online/roomRegistry.ts` | 部屋番号、10席の予約と解放 |
| `src/server/src/online/matchController.ts` | 待機・準備・開始・戦闘・再戦の状態遷移 |
| `src/server/src/online/connectionLifecycle.ts` | 切断猶予・退出・期限切れ |
| `src/server/src/online/requestLimits.ts` | 入力頻度、サイズ、接続元の制限 |
| `src/server/src/rooms/ArenaRoom.ts` | Colyseusと進行管理の接続 |
| `src/server/src/rooms/schema/ArenaState.ts` | 公開状態のスキーマと値の反映 |
| `src/client/src/game/network/onlineSession.ts` | 接続、通知、再接続、操作送信 |
| `src/client/src/game/network/battleDriver.ts` | CPU戦・対人戦に共通の描画側インターフェース |
| `src/client/src/game/network/battlePerspective.ts` | 自分基準の座標・ゲージ・結果変換 |
| `src/client/src/game/ui/onlineLobby.ts`, `.css` | 名前、作成・参加、待機、準備状況 |
| `src/client/src/game/scenes/OnlineScene.ts` | ロビーと既存編成・戦闘画面の接続 |
| `scripts/online-load-test.ts` | 10クライアント・5試合の負荷検証 |
| `docs/online-battle-validation.md` | 自動検証・ブラウザ・実機・公開確認の証跡 |

## タスク1: 共有戦闘パッケージとCPU戦の維持

**変更:** ルートの `package.json`、`package-lock.json`、クライアント／サーバーの `package.json`、既存戦闘コードのimport。
**追加:** `src/shared/package.json`, `tsconfig.json`, `src/index.ts`。
**移動:** `src/client/src/game/core/`、`rules/` 内の実装とテスト、および `deck/cardCatalog.ts`, `deckModel.ts` と対応テストを、同じ相対構造で共有側へ移す。ブラウザ保存・エディターは移さない。

**入出力:** 既存の `GameSession`, `BattleState`, `BattleConfig`, `createDeckBattleState`, `validateDeck` を `@reijin-summon/shared` から公開する。既存関数の挙動はこのタスクでは変更しない。

- [ ] `npm.cmd test -w src/client`、`npm.cmd run typecheck`、`npm.cmd run build` を実行し移動前の基準を記録する。
- [ ] 実装時に作業場所を確認する。通常チェックアウトならworktreeの希望を確認し、既存worktreeならそのまま使う。
- [ ] 共有パッケージのNode向け読込試験を先に追加し、パッケージ未存在の失敗を確認する。

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '@reijin-summon/shared';
test('Nodeで戦闘を初期化できる', () => {
  assert.equal(new GameSession().state.result, 'InProgress');
});
```

- [ ] 共有側をNodeNext／ESM出力にし、相対importに `.js` を付ける。package exportsはビルド済みJSと宣言ファイルを指す。
- [ ] 共有コードのテストを移植し、クライアントのimportを公開パッケージへ変更する。
- [ ] ルートの `build:shared`, `build:server`, `test` を追加する。`dev` は共有ビルド後に共有watch・サーバー・クライアントを起動し、`build:client` も共有ビルドを先行する。
- [ ] 上記Node読込試験、共有／クライアント試験、型検査、全体ビルドを実行。CPU戦を開始から結果まで確認してコミットする。

## タスク2: 両陣営の配置・能力・召喚を対称化

**変更:** 共有側の `core/types.ts`, `core/deckBattleState.ts`, `rules/initialPlacement.ts`, `rules/abilitySystem.ts`, `rules/gameSession.ts` と対応テスト。

**入出力:** `GameSession.applyCommand(command: BattleCommand): void` を維持し、配置・能力コマンドに両陣営を許可する。`createOnlineBattleState(config, decks: Record<TeamId, {cardIds: readonly string[]; summonId: SummonId}>): BattleState` を追加し、両者が選んだ召喚獣を確定する。

- [ ] 既存AP試験を両陣営向けへ変更し、意図した失敗を確認する。

```ts
test('両陣営の遠距離ユニットに同じAPがたまる', () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);
  state.phase = 'InProgress';
  tickAbilities(state, config, 40);
  for (const id of ['PlayerRanged', 'CpuRanged'] as const) {
    assert.equal(findUnit(state, id).abilityAp, 2);
  }
});
```

- [ ] 自陣配置範囲、未知ID、他陣営の操作、NaN、無限値、能力範囲の180度回転、同時召喚、復活条件のケースを対応する既存テストへ追加する。
- [ ] `Player` 限定判定を陣営・所有権に基づく判定へ置換。方向入力は共通座標に統一し、CPU固定向きの分岐をなくす。
- [ ] CPU戦の `StartBattle` は既存導線を維持し、オンラインの開始決定はタスク4の進行管理へ委ねる。CPUの判断ロジックは変更しない。
- [ ] 共有・クライアント試験、型検査、ビルドが通ったらコミットする。

## タスク3: 通信契約・入力検証・定員管理

**追加:** `shared/src/network/protocol.ts`, `protocol.test.ts`; サーバーの `online/roomRegistry.ts`, `requestLimits.ts` と対応テスト。サーバーにnode:testの実行スクリプトを追加する。

**入出力:**

```ts
export const PROTOCOL_VERSION = 1;
export type CommandEnvelope = {
  version: number; matchId: string; sequence: number; command: BattleCommand;
};
export type ValidationResult<T> = {ok: true; value: T} | {ok: false; reason: string};
export function parseCommandEnvelope(value: unknown): ValidationResult<CommandEnvelope>;
// RoomRegistryは同期的に予約し、非同期処理を挟んで上限を超えない。
export interface RoomRegistry {
  create(): string; reserve(code: string): string; release(seatId: string): void;
  close(code: string): void; readonly occupiedSeats: number;
}
```

- [ ] 型外入力・未知コマンド・過大文字列・非整数連番を拒否する試験を先に書く。

```ts
test('有限でない移動座標を拒否する', () => {
  const result = parseCommandEnvelope({version: 1, matchId: 'm1', sequence: 1,
    command: {commandType: 'MoveUnit', team: 'Player', unitId: 'PlayerRanged',
      targetPosition: {x: NaN, y: 0}}});
  assert.equal(result.ok, false);
});
```

- [ ] 6桁番号の衝突時再抽選、10席目成功・11席目拒否、解放の二重呼出し、復帰予約の維持を試験する。
- [ ] 毎秒30操作、8KiB、IP毎分30要求を検証する関数を実装する。超過が3秒連続した接続を切断する。サイズ制限はデコード前のtransportと実行時検証の双方で適用する。
- [ ] 表示名の空文字・制御文字・20文字超過、未知召喚獣、不正デッキを拒否する。受信側はunknownから検証し、型アサーションだけで通さない。
- [ ] `npm.cmd test -w src/shared` と `npm.cmd test -w src/server` が通ったらコミットする。

## タスク4: 非公開の準備からサーバー戦闘へ

**追加:** `server/src/online/matchController.ts`, `matchController.test.ts`, `rooms/ArenaRoom.test.ts`。
**変更:** `rooms/ArenaRoom.ts`, `rooms/schema/ArenaState.ts`, `server/src/index.ts`。

**入出力:** `MatchController` は `setDeck(team, cardIds, summonId)`, `place(team, unitId, position)`, `setReady(team, ready)`, `advance(deltaSeconds)`, `apply(team, envelope)`, `requestRematch(team)` を持つ。`privateView(team)` は本人向け準備データ、`publicView()` は公開メタ情報と戦闘開始後だけの `BattleState | null` を返す。各操作はタスク3の `ValidationResult` を返す。

- [ ] `publicView().battle` が準備・カウントダウンでnull、開始時のみ戦闘状態になる試験を追加する。

```ts
test('準備中は戦闘データを公開しない', () => {
  const match = new MatchController();
  match.setDeck('Player', ['SC001'], 'raphael');
  match.setDeck('Cpu', ['SC002'], 'bahamut');
  assert.equal(match.publicView().battle, null);
});
```

- [ ] 準備後の編集拒否、片側だけでは開始しない、5秒未満では相手データなし、双方の再戦合意で新試合ID、第三者参加不可を試験する。
- [ ] 純粋な進行管理を実装し、50ms固定ステップで `GameSession.tick(0.05)` を呼ぶ。ループの処理時間と蓄積遅延を測定可能にする。
- [ ] 公開スキーマを入れ子のSchema／ArraySchemaへ写す。準備データ・トークンを含めず、開始時に戦闘スキーマを生成する。
- [ ] `ArenaRoom` の2人制限、予約、所有権、試合ID・連番検査、100ms配信を接続する。配信間の演出は番号付きイベントとして蓄積・送信する。
- [ ] 実際の2クライアント接続試験で開始前の受信スキーマ・メッセージに相手カードがないことを確認する。通常撃破・時間切れ・引き分け・両者の状態一致を試験しコミットする。

## タスク5: 再接続と一度だけの結果確定

**追加:** `server/src/online/connectionLifecycle.ts`, `.test.ts`。
**変更:** `matchController.ts`, `ArenaRoom.ts`, 対応統合テスト。

**入出力:** `ConnectionLifecycle.disconnect(team, nowMs)`, `reconnect(team, nowMs)`, `advance(nowMs)` を実装する。時刻は外部注入し、テストの実時間待機を不要にする。進行管理に `finish(result, reason)` を追加し、確定済み結果を上書きしない。

- [ ] 29,999ms以内の復帰、30,000ms期限切れ、両者不在、片側だけ復帰、決着と同時の期限切れを時計注入で試験する。

```ts
test('確定済みの通常結果は切断結果で変わらない', () => {
  const match = new MatchController();
  match.finish('Draw', 'time-limit');
  match.finish('PlayerWin', 'disconnect');
  assert.equal(match.publicView().result, 'Draw');
});
```

- [ ] Colyseusのインストール済み型・実装から再接続APIを確認し、秘密トークンで元の席のみ復帰させる。明示退出は猶予なし、自然切断は30秒予約とする。
- [ ] 準備・カウントダウンの切断、待機10分・準備最終操作10分・結果2分の期限を実装する。予告は30秒前から通知する。
- [ ] 通常勝敗、切断、降参、両者不在、サーバー終了の理由を別の値で通知する。終了処理で席・タイマー・部屋番号を解放する。
- [ ] 実接続で切断と復帰、偽トークン、重複復帰、満員中の予約者復帰を検証しコミットする。

## タスク6: クライアント接続と待機画面

**追加:** `client/src/game/network/onlineSession.ts`, `.test.ts`, `ui/onlineLobby.ts`, `.css`, `scenes/OnlineScene.ts`。
**変更:** `main.ts`, `scenes/TitleScene.ts`, `scenes/DeckScene.ts`, `ui/titleScreen.ts`, `deck/deckEditor.ts`。

**入出力:** `OnlineSession` は `create(name)`, `join(name, code)`, `setDeck(cardIds, summonId)`, `setReady(ready)`, `send(command)`, `reconnect()`, `leave()` を公開する。接続段階・自分の陣営・準備状態・戦闘状態・結果を購読できるようにする。通信依存を注入できる構造とし、単体試験では偽transportを使う。

- [ ] プロトコル不一致、二重クリック、古い更新番号、再接続中の送信拒否、古い試合の操作破棄を試験する。
- [ ] 接続先を次の規則で解決し、HTTPS画面からWSへの接続は明示エラーにする。

```ts
const configuredUrl = import.meta.env.VITE_GAME_SERVER_URL;
const localUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:2567`;
const serverUrl = configuredUrl || localUrl;
```

- [ ] タブレットのLAN接続でlocalhostを使わない。休止後の初回接続は最大90秒まで待機表示と中止操作を用意する。再接続はサーバーの30秒期限内だけ指数的に間隔を広げて試みる。
- [ ] 名前・ルーム番号をtextContentで描画し、保存デッキ選択と既存編成画面へ接続する。相手の名前・準備状態のみを開始前に表示する。
- [ ] 再接続情報をsessionStorageへ保存し、終了時に消す。保存不可でも現在タブの接続を維持し、再読み込み復帰不可を表示する。
- [ ] 型検査・クライアント試験と、2画面での作成・参加・編成を確認しコミットする。

## タスク7: 戦闘画面の接続とタブレット入力

**追加:** `network/battleDriver.ts`, `battlePerspective.ts`, `battlePerspective.test.ts`。
**変更:** `scenes/BattleScene.ts`, `ui/battleFlow.ts`, `ui/battleHudModel.ts`, `input/dragMovement.ts`, 必要な対応テスト。

**入出力:**

```ts
export interface BattleDriver {
  readonly state: BattleState;
  readonly config: BattleConfig;
  readonly localTeam: TeamId;
  send(command: BattleCommand): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}
export function perspectivePoint(point: Vec2, team: TeamId): Vec2 {
  return team === 'Player' ? {...point} : {x: -point.x, y: -point.y};
}
```

- [ ] 座標の往復、向きにπ加算して正規化、相手側のMP・AP・勝敗表示、ID保持のテストを書く。

```ts
test('後参加側の座標変換は往復して元に戻る', () => {
  const point = {x: 2, y: -3};
  assert.deepEqual(perspectivePoint(perspectivePoint(point, 'Cpu'), 'Cpu'), point);
});
```

- [ ] CPU戦用driverは既存のtickとCPU判断を担当し、オンラインdriverではローカルの戦闘tickを実行しない。BattleSceneの直接session操作をdriverへ集約する。
- [ ] 描画の自軍判定をlocalTeamへ置き換える。後参加側の移動・復活・能力方向を逆変換して送り、全描画対象と演出も変換する。
- [ ] 位置だけを補間し、HP・結果などを端末で予測しない。演出番号で重複再生を防ぐ。
- [ ] 再接続・画面回転でドラッグと選択中の指を解放する。主要操作44 CSS px、マルチタッチ、領域外pointerup、縦向き案内を実装する。
- [ ] 2画面で両側の配置・通常攻撃・生成・能力・召喚・復活・再戦を実施し、CPU戦も再確認してコミットする。

## タスク8: 結合・負荷・端末検証

**追加:** `scripts/online-load-test.ts`, `docs/online-battle-validation.md`。
**変更:** ルートの `package.json` に `test:online:load` を追加。サーバー統合試験を拡張する。

- [ ] 10クライアントで5ルームを作り、両側準備→操作→決着→再戦を10分以上繰り返すハーネスを作る。通常は `ws://localhost:2567`、指定時だけ明示した検証サーバーへ接続する。
- [ ] 11人目拒否・途中離脱と復帰を含め、各試合の両者の結果一致をassertする。全クライアントの接続はfinallyで閉じる。
- [ ] サーバーのtick所要時間・遅延蓄積、RSS、送信bytes、結果数を記録する。95パーセンタイルは次の計算で50ms未満を確認する。

```ts
const sorted = samplesMs.toSorted((a, b) => a - b);
const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
assert.ok(p95 < 50, `更新時間p95=${p95}ms`);
```

- [ ] 型検査・全体ビルド・共有／クライアント／サーバー試験を実行する。
- [ ] タブレット寸法のブラウザで横縦・複数指・通信断・再読み込み・復帰を確認する。iPadOS Safari／Android Chrome実機がない場合は未確認として残し、実機成功と記載しない。
- [ ] 検証記録に実行日時、環境、成功数、測定値、未確認事項を記載する。問題を修正した場合は対応する検証だけ追加で繰り返す。

## タスク9: 無料公開の準備と公開先での確認

**追加:** `src/client/.env.example`, `src/server/.env.example`, `render.yaml`。
**変更:** `server/src/index.ts`, `server/src/online/requestLimits.ts`, `README.md`, 検証記録。

- [ ] CORSとWebSocket Originの許可・拒否、ヘルスチェック、PORT適用の統合試験を作成する。プロキシ越しのIPを偽装ヘッダーだけで変更できないことも試験する。
- [ ] サーバーを `0.0.0.0`、ホスト指定PORTで待ち受けさせる。`ALLOWED_ORIGINS` を完全一致で検査し、本番で未設定なら起動を失敗させる。開発用許可元は明示設定する。
- [ ] Render構成は1インスタンス、無料プラン、build=`npm ci && npm run build:server`、start=`npm start`、health=`/health` とする。Cloudflare Pagesは既存の `npm run build:client` と出力先を維持する。
- [ ] READMEにLANアドレス、HTTPS／WSS、環境変数、公開時の再ビルド、無料枠の休止と中断、更新時の試合終了を日本語で記載する。
- [ ] ローカル検証完了後にRenderの公式無料枠・課金設定を再確認する。接続済みアカウントがなければ、その時点で必要な操作だけユーザーに依頼する。未確認の公開URLを作らない。
- [ ] 公開先を作成したら正しいURL・Originで配備し、別ネットワークのタブレットで1試合・復帰・休止後起動を検証する。公開先でも5試合性能を測定して無料構成の適否を報告する。
- [ ] 費用が発生する変更は行わない。無料枠で実測条件を満たせない場合は測定結果と制約を報告し、ローカル完成と公開未達を区別する。

## 実施・レビュー

- タスクは1→9の順に進め、各タスクで試験の失敗→実装→成功を確認する。大きな既存コード移動では回帰試験を優先する。
- ファイル数だけを理由に分担せず、共有型と同期方式の整合性を維持する。
- 設計の条件を緩める必要が判明した場合は、測定結果と変更案を示してから変更する。
- 完了時はローカル、実機、公開の検証状況を別々に報告する。固有スキル・CPU強化は別の作業として残す。
- 計画レビュー後の推奨実行方法は、現在のタスク内で担当エージェントが順番に実装する方式。共有型・ルーム・画面の依存が強いため。

## 計画の自己確認

- 仕様1〜3の範囲・方式: タスク1・2・3。
- 仕様4の対戦導線: タスク4・6・7。
- 仕様5〜6の対称化・同期・秘匿: タスク2・3・4・7。
- 仕様7の切断・期限・再戦: タスク4・5・6。
- 仕様8の定員・入力・Origin: タスク3・9。
- 仕様9のタブレット: タスク6・7・8。
- 仕様10〜11の無料公開・完了条件: タスク8・9。
- コード断片のAPIは各タスクで導入する。メッセージや公開状態の具体的な型はタスク3・4で同時に確定し、後続はそれをimportする。
