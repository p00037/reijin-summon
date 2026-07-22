# 最終レビュー指摘 修正レポート

## 変更内容

- `BattleConfig` から旧共通設定 `elementalBuildSeconds` を削除した。
- `createDefaultBattleConfig()` から旧既定値 `elementalBuildSeconds: 5` を削除した。
- `rg -n "elementalBuildSeconds" src/client/src` で再確認し、残存箇所は `UnitStats` の定義、兵種別設定、テスト、または `unit.stats.elementalBuildSeconds` を使う処理のみであることを確認した。
- public assets は変更していない。

## 検証

| コマンド | 結果 |
| --- | --- |
| `node --import tsx --test src/game/core/battleState.test.ts`（`src/client`） | 成功: 2 passed, 0 failed |
| `npm.cmd test`（`src/client`） | 成功: 84 passed, 0 failed |
| `npm.cmd run typecheck`（`src/client`） | 成功 |
| `npm.cmd run build`（リポジトリルート） | 成功: server/client build 完了 |

`npm.cmd run build` には既存の Vite chunk-size warning（500 kB 超の chunk）が出力されたが、ビルドは成功した。

## 変更ファイル

- `src/client/src/game/core/types.ts`
- `src/client/src/game/core/battleConfig.ts`
- `.superpowers/sdd/final-fix-report.md`

## 自己レビュー

- 差分は型定義と既定設定に残っていた旧共通プロパティの削除のみで、兵種別の `UnitStats.elementalBuildSeconds` は維持している。
- 実際の生成時間設定は `elementalSystem.ts` の `unit.stats.elementalBuildSeconds` 経由であることを再検索で確認した。
- `git diff --check` を実行し、空白エラーはなかった。

## 残存 Minor

- `BattleScene` の両リーダーの fill/stroke と world 半径変換をまとめて検証する Phaser 統合描画テストはない。
- presentation 定数テストは存在し、最終レビューでは merge blocker ではないと評価されているため、今回の最小修正には追加しない。
