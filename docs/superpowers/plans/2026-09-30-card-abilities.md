# カード固有アビリティ実装計画

> **実装担当へ:** 必須スキルは `superpowers:executing-plans` または `superpowers:subagent-driven-development`。実行方式はユーザーの選択に従い、以下のチェック項目を順番に実施する。

実装・検証: 2026-10-01。全タスク完了。独立レビューのImportant1件を修正し、全386件・型チェック・ビルドが成功。実装上の判断と検証内容は[検証記録](../../card-abilities-validation.md)に記載。

**目的:** SC001〜SC020の手動アビリティを承認済み仕様へ置き換え、ローカル戦・オンライン戦で同じ効果を提供する。

**構成:** カード別定義、時間制効果、対象判定、エンチャント更新を共有パッケージに置く。戦闘処理とサーバーが共通関数を使い、クライアントは確定状態から表示する。

**技術:** TypeScript、Node.js標準テストランナー＋tsx、Phaser、Colyseus。新規依存なし。

**仕様:** [承認済み設計](../specs/2026-09-30-card-abilities-design.md)。数値・対象条件・範囲の唯一の基準とし、原典へ戻って上書きしない。

## 全体制約

- COMの自動使用判断、スキル、関連キャラクター、召喚獣カスタマイズは追加しない。
- 1c=1秒、20秒/AP1、AP上限はカード必要量。成功・死亡・復活でAPと進捗0。
- INT倍率 `max(0.1, 1+0.1*(casterInt-targetInt))`。SC002/005/008/011/020は時間、大津波は威力へ適用。ザンダー双方22秒・味方強化固定。
- 通常カードだけをユニット対象とする。エレメントは完成済み・生存・味方・同国。
- 表示は固有名・AP・効果説明・天候・候補/実対象。効果残り時間・状態一覧は追加しない。
- 日本語で資料・説明文を記載する。既存の未コミット変更を保護し、作業開始時に作業場所を確認する。

## 重点レビューと担当テスト

1. 空の効果配列から最初の付与をオンライン配信できること（タスク6）。
2. 後攻視点で発動元・対象IDが反転し、解除と表示が一致すること（タスク6）。
3. ザンダーの再使用失敗で前回効果が消えないこと（タスク3）。
4. 破壊後に同じエレメントIDを再利用しても周期・付与が残らないこと（タスク4）。
5. 重複スナップショットで演出を再生せず、新しい対戦では連番をリセットできること（タスク7）。

## ファイルと責務

新規共有ファイル: `rules/abilityCatalog.ts`（定義）、`rules/abilityEffects.ts`（実効値・期限）、`rules/abilityTargets.ts`（範囲・候補）、`rules/abilityEnchantments.ts`（オーラ・周期）。各々同階層に `.test.ts` を作る。

共有変更: `core/types.ts`、`core/battleState.ts`、`core/deckBattleState.ts`、`core/battleConfig.ts`、`deck/cardCatalog.ts`、`index.ts`、`rules/abilitySystem.ts`、`rules/gameSession.ts`、`rules/unitSystem.ts`、`rules/combatDamage.ts`、`rules/summonSystem.ts`、`rules/summonAttacks.ts`、`rules/elementalSystem.ts`、`rules/resurrectionSystem.ts`。上記パスの接頭辞は `src/shared/src/`。

通信変更: `src/server/src/rooms/schema/ArenaState.ts`、`src/client/src/game/network/battlePerspective.ts`。コマンド自体は既存のUseAbilityを維持し、受信・所有権検証を不必要に変更しない。

表示変更: `src/client/src/game/render/abilityPresentation.ts`、`render/unitCardAttackPowerPresentation.ts`、`ui/battleHudModel.ts`、`ui/battleHud.ts`、`scenes/BattleScene.ts`。オンライン表示側の接続箇所は `scenes/OnlineScene.ts` と `network/onlineSession.ts` を確認して既存の描画経路へ接続する。

## タスク1: 定義・状態・初期化

**入出力:** `getAbilityDefinition(cardId: string | undefined): AbilityDefinition | null`、`abilityApCost(unit: UnitState): number | null`。定義は `id/name/description/apCost/area/target/effect` を持つ判別共用体。範囲は `none/self/circle/half/all`、circleは `forwardHeight/radiusHeight`。数値は設計の全20行を登録する。

状態は `UnitState.baseIntelligence/nation/abilityEffects`、`ElementalState.nation/enchantments`、`BattleState.rainRemainingSeconds/recentAbilityEvents/nextAbilityEventId` を追加。効果は `{abilityId, sourceUnitId, castId, kind, amount, remainingSeconds}`。エンチャントは `{kind, elapsedSeconds}`。イベントは `{eventId, sourceUnitId, abilityId, targets: {unitId, position}[], elementalTargets: {elementalId, position}[]}`。最終レビューで、エンチャントの実対象表示に必要な後者の配列を補った。国籍はカードへ定義し、現対象はScaleGuild。

- [x] `abilityCatalog.test.ts` に20枚のAP配列 `[1,1,2,3,2,1,1,2,3,null,3,2,2,4,3,2,1,3,5,3]`、未知IDはnull、初期効果空・晴れ、配列がユニット間で共有されないテストを作る。
- [x] `npm test -w src/shared` で新規ケースの失敗を確認。
- [x] 上記定義・型・生成処理を実装。旧デフォルト3兵種には標準デッキの対応カードSC020/019/014を明示し、既存基礎ステータスはこの作業で無関係に変えない。デッキ生成ではカードのINT・国籍を設定し、配列は各ユニットに新規生成する。
- [x] 呼出側をユニットによるAP取得へ移行し、nullを0で割らない。旧効果は後続置換まで移行用として残し、最終的に撤去する。
- [x] `npm run typecheck` と共有テストを実行し成功を確認。対象ファイルだけをステージしてコミットする。

## タスク2: 実効値・期限・INT補正

**出力:** `intelligenceMultiplier(casterInt: number, targetInt: number): number`、`effectiveIntelligence(unit: UnitState): number`、`effectiveAttackDamage(state: BattleState, config: BattleConfig, unit: UnitState): number`、`effectiveMoveSpeed(state: BattleState, config: BattleConfig, unit: UnitState): number`、`tickUnitEffects(unit: UnitState, seconds: number): void`、`clearUnitEffects(unit: UnitState): void`、`applyTimedEffect(unit: UnitState, effect: TimedAbilityEffect): void`。オーラ集計はタスク4の関数を利用できる境界で分離する。

- [x] `abilityEffects.test.ts` にM=1/1.3/0.7/0.1、期限境界、同アビ更新、異種加減算、ステラ独立期限、ATK下限0を検証するケースを作る。数値は近似比較を使う。
- [x] 共有テストで失敗を確認。
- [x] 設計どおり実効値を実装。速度は `(基礎+固定加算)*倍率積*接敵倍率`。接敵倍率は移動側で既に適用されているならここでは掛けず、最終経路で一度だけ掛ける。
- [x] 効果期限は0以下で除去。INTと基礎値を書き換えない。旧射程強化は固有アビリティへ持ち込まない。
- [x] 共有テスト成功後コミット。

## タスク3: 候補・抽選・手動発動

**出力:** `abilityArea(state, config, unitId, facingRotation): AbilityArea | null`、`abilityTargets(state, config, unitId, facingRotation): AbilityTargets`。引数型は既存と同じ。AbilityAreaは円と半面矩形と全域矩形の判別共用体へ拡張。`tryUseAbility(state: BattleState, config: BattleConfig, unitId: string, facingRotation: number, random: () => number = Math.random): boolean`、`canUseAbility(...)`、`resetUnitAbilityState(unit)`を維持・拡張する。

- [x] `abilityTargets.test.ts` にS/F/L/Cの寸法・向き・境界、味方自身、未完成/敵国除外、大津波中央線の両陣営ケースを作る。
- [x] `abilitySystem.test.ts` を共有側に追加し、設計の19種を各最低1ケース検証。乱数0と0.999で候補両端、対象なしなら乱数呼出0回・AP保持、解除効果なしの敵も抽選候補であることを固定する。
- [x] 共有テストで失敗を確認。
- [x] 通常強化弱体、解除、天候、ゲージ、吸収を実装。無効コマンドで例外・状態変更なし。INTは発動時に確定。グーは満タン/召喚中不可、雨限定2種は晴れで不可。
- [x] ザンダーは発動成立後に前回の双方残存効果を除去して再計算。`失敗→前回効果不変`、`再使用→非累積`、`敵死亡/片側解除→他方維持`を追加検証。
- [x] 成功時にAPを0へ戻し、実対象を含む連番イベントを発行。プレビューで乱数を消費しない。
- [x] 共有テスト成功後コミット。

## タスク4: エンチャント・AP・天候周期

**出力:** `enchantElemental(elemental: ElementalState, kind: EnchantmentKind): void`、`tickEnchantments(state: BattleState, config: BattleConfig, seconds: number): void`、`elementalSpeedBonus(state, config, unit): number`、`elementalAttackPenalty(state, config, unit): number`。後二者の引数型はBattleState/BattleConfig/UnitState。既存 `tickAbilities(state, config, seconds): void` にAP・天候・効果の更新を統合する。

- [x] `abilityEnchantments.test.ts` に速度加算0.1025（既定キーパー速度0.205の半分）、複数基非重複、シャコ貝−11×基数、出入り、異種併存を作る。
- [x] アウイン19.999秒で加算なし、20秒で1体5%、40秒で2回、召喚中の持越しなし、再付与で周期維持、破壊後同ID再生成で空のテストを追加する。
- [x] AP20秒境界、満タン超過破棄、SC010蓄積なし、晴れ→雨100→晴れ、雨再使用更新をテストし、共有テストの失敗を確認。
- [x] 発動のエンチャント分岐と更新を実装。周期数はfloorで求め、余りを保持。人数は各周期処理時の状態から計数。通常のセッション更新ではタスク5の小刻み処理と組み合わせる。
- [x] 終了後・Setup・Countdownでは効果/雨/APの時間を進めない。共有テスト成功後コミット。

## タスク5: 戦闘・死亡・復活への統合

**入出力:** GameSessionの既存公開APIを保持し、コンストラクタ末尾へ任意の乱数関数を追加する。`damageUnit(target: UnitState, amount: number, kind: 'normal' | 'summon' | 'ability'): void` をcombatDamageへ追加し、ローズクォーツの軽減はnormal/summonだけに適用。

- [x] `src/shared/src/rules/abilityCombat.test.ts` に基準100が6基防御で70、abilityは100、ATK0の通常攻撃は全対象0、即時アビリティ撃破後に対象が行動できないケースを作る。
- [x] 発動者死亡後の他者効果継続、対象死亡/復活で効果・AP0、エレメント破壊の即時無効化、建築中発動で進捗不変を追加する。
- [x] 共有テストで失敗を確認。
- [x] unitSystem、summonSystem、summonAttacksの直接HP減算箇所を集約し、能力参照を実効値へ移す。大津波後にもmarkDefeatedUnitsを適用する。召喚士被ダメージMP処理等は維持する。
- [x] GameSessionの戦闘更新を最大1/60秒で分割し、長いdeltaでも移動中の周期・期限を段階処理する。通常イベントの初期化は外側で1回、終了時は残余時間を処理しない。0.5秒一括と1/60秒×30で新効果の結果が一致するケースを追加する。
- [x] 旧仮効果フィールドと処理を撤去し、旧アビリティテストは新カード仕様の検証へ置き換える。無関係な戦闘回帰テストは維持する。
- [x] `npm run build:shared`、共有・クライアントテスト、型チェックを実行。失敗修正後コミット。

## タスク6: オンライン状態と視点変換

**出力:** `publishBattle` と `toLocalState` の公開APIを維持し、新しい状態・イベントを欠落なく往復する。

- [x] `src/server/tests/abilitySync.test.ts` に空配列→最初の効果→期限削除、複数エンチャント、雨、発動イベントのSchemaエンコード/デコードを検証する。
- [x] `battlePerspective.test.ts` にsourceUnitId、targets内unitId、効果内sourceUnitIdの反転と位置変換、eventId/abilityId/国籍が不変であるケースを追加する。
- [x] サーバー・クライアントの対象テストで失敗を確認。
- [x] ArenaStateの空配列に明示的な要素テンプレートを登録する。動的Schema登録は空配列の先頭を型として読めないため省略しない。視点変換のIDキー対応を追加する。
- [x] `src/server/tests/online.test.ts` または新規テストに両陣営のUseAbility、他人のユニット操作拒否、発動でサーバー確定した1対象だけが配信されるケースを追加する。
- [x] `npm run build:shared` 後にサーバー/クライアントテスト、型チェックを実行し成功後コミット。

## タスク7: HUD・候補・実対象表示

**出力:** BattleHudModelへ `abilityName: string`、`abilityDescription: string`、`weatherText: string` を追加。新規 `render/abilityEventPresentation.ts` に `consumeAbilityEvents(events: readonly AbilityEvent[], lastSeen: number): {events: AbilityEvent[]; lastSeen: number}` を定義する。

- [x] HUDテストにSC010はアビリティなし/非活性/比率0、SC019はAP5、晴れと雨の文言、固有説明のケースを作る。
- [x] abilityPresentationテストへ円・半面・全域、候補全員表示、予告で抽選しないケースを追加。abilityEventPresentationテストで重複イベント排除と新対戦時lastSeen=0を検証する。
- [x] クライアントテストで失敗を確認。
- [x] HUDとBattleSceneを接続し、実対象は成功から0.8秒表示。オンラインは確定イベントのみ描画し、戦闘開始/退出でイベント既読状態を初期化する。全域/半面を戦場内にクリップする。
- [x] 攻撃力表示もタスク2の実効値を参照。画面へ効果残り時間・強化弱体一覧は追加しない。
- [x] ビルド済み共有パッケージでクライアントテスト・型チェックを実行し成功後コミット。

## タスク8: 全体検証・成果整理

- [x] `npm test` を実行し、共有・クライアント・サーバーすべて成功を確認。
- [x] `npm run typecheck` と `npm run build` を実行し成功を確認。
- [x] 実画面でSC010、味方/敵抽選、雨、エンチャント、INT補正の組合せ、オンライン両視点の予告と実対象を確認。デッキコストを守り、検証のための製品データ改変を残さない。
- [x] `git diff --check` と変更一覧を確認し、COM自動使用判断・スキル実装が混入していないことを確認。
- [x] `docs/card-abilities-validation.md` に実施結果・未実施項目・暫定バランス値を日本語で記録し、関連資料の実装状態を更新する。
- [x] 選択された実行方式に沿ってレビューし、指摘の修正・関連検証後に結果を報告する。PR作成・統合はその時点の指示に従う。

## 計画の確認結果

設計の全20枚、AP、国籍、INT、期限、解除、天候、防御、範囲、周期、通信、表示をタスク1〜7へ対応付けた。重点レビュー5件はそれぞれ担当タスクへテストを追加済み。追加ライブラリは不要。実装開始前に計画レビューと実行方式選択を行う。
