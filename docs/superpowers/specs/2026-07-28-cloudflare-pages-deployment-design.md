# Cloudflare Pages 自動デプロイ設計

## 目的

現在のローカルCOM戦版クライアントを、Cloudflare Pagesへ無料で公開できる状態にする。GitHubの対象ブランチへ変更をpushすると、Cloudflare Pagesがクライアントを自動でビルドして配信する。

## 対象範囲

- Phaser + Viteで構成された `src/client` の静的配信
- ルートワークスペースから実行できるクライアント専用ビルドコマンド
- Cloudflare Pagesプロジェクトの作成・設定・更新方法を説明する日本語ドキュメント
- production buildと生成された静的アセットの検証

Node.js + Colyseusの `src/server` は今回デプロイしない。オンライン対戦サーバーの公開、独自ドメイン、Cloudflare Workers、GitHub Actionsからの直接デプロイも対象外とする。

## デプロイ方式

Cloudflare PagesのGit連携を使用する。GitHub ActionsやCloudflare APIトークンは追加せず、Cloudflare側がGitHubリポジトリを監視してビルドと公開を行う。

Cloudflare Pagesには次の値を設定する。

| 項目 | 値 |
| --- | --- |
| Framework preset | `None` または `Vite` |
| Root directory | リポジトリルート |
| Build command | `npm run build:client` |
| Build output directory | `src/client/dist` |
| Node.js version | `22` |

## リポジトリの変更

ルートの `package.json` に `build:client` スクリプトを追加する。このスクリプトはnpm workspacesを使い、`src/client` の既存 `build` スクリプトだけを実行する。

READMEには以下を日本語で追記する。

1. Cloudflare PagesプロジェクトとGitHubリポジトリの接続方法
2. 必要なビルド設定値
3. 初回デプロイ後の確認方法
4. 対象ブランチへのpushによる自動更新
5. 現時点ではローカルCOM戦版のみが対象で、Colyseusサーバーは公開されないこと

Cloudflare Pagesはサイトをドメインのルートで配信するため、現在の `/assets/...` 形式の画像パスは変更しない。クライアントは単一ページかつURLルーティングを使用していないため、`_redirects` は追加しない。

## エラー時の扱い

- ビルドが失敗した場合は、Cloudflare PagesのデプロイログでNode.jsバージョンとビルドコマンドを確認する。
- 画像が表示されない場合は、`src/client/dist/assets` に対象ファイルが出力されているか確認する。
- オンライン対戦を有効にする場合は、本設計を拡張せず、Colyseusサーバー用の別デプロイ設計を作成する。

## 検証

実装後に次を実行・確認する。

1. クライアントの自動テストが成功する。
2. クライアントの型チェックが成功する。
3. `npm run build:client` が成功し、`src/client/dist/index.html` が生成される。
4. `src/client/dist/assets` にゲームで使用する画像が含まれる。
5. 既存の未コミット画像や対象外ファイルを変更していない。

