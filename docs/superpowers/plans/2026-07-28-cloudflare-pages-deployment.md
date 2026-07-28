# Cloudflare Pages自動デプロイ実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub連携したCloudflare Pagesが、リポジトリルートからローカルCOM戦版クライアントを自動ビルドして公開できるようにする。

**Architecture:** Cloudflare Pages固有のAPIトークンやGitHub Actionsは追加せず、Cloudflare Pages標準のGit連携を利用する。ルートのnpm workspaceにクライアント専用ビルド入口を追加し、Cloudflare管理画面で使う設定と運用手順をREADMEへ記載する。

**Tech Stack:** npm workspaces、TypeScript、Vite、Phaser、Cloudflare Pages

## 全体制約

- ドキュメントは日本語で記載する。
- Node.jsバージョンは `22` とする。
- Cloudflare PagesのBuild commandは `npm run build:client` とする。
- Cloudflare PagesのBuild output directoryは `src/client/dist` とする。
- `src/server`、オンライン対戦サーバー、独自ドメイン、Cloudflare Workers、GitHub Actionsは変更対象外とする。
- 現在の `/assets/...` 画像パスは維持し、`_redirects` は追加しない。
- ユーザーが変更中の画像ファイルには触れない。

---

### Task 1: クライアント専用ビルド入口

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: `src/client/package.json` の既存 `build` スクリプト
- Produces: ルートで実行できる `npm run build:client` コマンド

- [ ] **Step 1: コマンドが未定義であることを確認する**

Run:

```powershell
npm.cmd run build:client
```

Expected: `Missing script: "build:client"` でFAILする。

- [ ] **Step 2: 最小のビルドスクリプトを追加する**

`package.json` の `scripts` に次を追加する。

```json
"build:client": "npm run build -w src/client"
```

- [ ] **Step 3: クライアント専用ビルドを確認する**

Run:

```powershell
npm.cmd run build:client
```

Expected: Viteのproduction buildが終了コード0で完了し、`src/client/dist/index.html` が生成される。

- [ ] **Step 4: 静的アセットの生成を確認する**

Run:

```powershell
$requiredAssets = @(
  "src/client/dist/assets/buttons/element_button.png",
  "src/client/dist/assets/buttons/summon_button.png",
  "src/client/dist/assets/elements/crystal.png",
  "src/client/dist/assets/summoners/summoner.png",
  "src/client/dist/assets/units/blue/blue001.png",
  "src/client/dist/assets/units/blue/blue002.png",
  "src/client/dist/assets/units/blue/blue003.png"
)
$missingAssets = $requiredAssets | Where-Object { -not (Test-Path $_) }
if ($missingAssets) { throw "Missing assets: $($missingAssets -join ', ')" }
```

Expected: 例外が発生せず終了する。

### Task 2: Cloudflare Pages公開手順

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1の `npm run build:client`
- Produces: Cloudflare Pages管理画面へ入力する設定値と自動更新手順

- [ ] **Step 1: READMEへ公開手順を追加する**

以下の内容を日本語で追記する。

```markdown
## Cloudflare Pagesへの公開

この手順で公開されるのはローカルCOM戦版のクライアントです。`src/server` のColyseusサーバーは公開されません。

1. Cloudflareダッシュボードで **Workers & Pages** を開く。
2. **Create application** から **Pages** を選び、GitHubリポジトリを接続する。
3. ビルド設定に次の値を入力する。

| 項目 | 値 |
| --- | --- |
| Framework preset | `None` |
| Root directory | `/` |
| Build command | `npm run build:client` |
| Build output directory | `src/client/dist` |

環境変数 `NODE_VERSION` に `22` を設定してデプロイする。デプロイ完了後、発行された `*.pages.dev` のURLを開き、タイトル画面とゲーム内画像が表示されることを確認する。

以後はCloudflare Pagesで設定したproduction branchへpushすると、自動的に再ビルド・再公開される。
```

- [ ] **Step 2: READMEのコマンドと実装が一致することを確認する**

Run:

```powershell
rg -n "npm run build:client|src/client/dist|NODE_VERSION|production branch" README.md
```

Expected: Cloudflare Pages公開節から4項目すべてが見つかる。

### Task 3: 全体検証とコミット

**Files:**
- Verify: `package.json`
- Verify: `README.md`
- Verify: `src/client/dist`

**Interfaces:**
- Consumes: Task 1とTask 2の成果物
- Produces: テスト・型チェック・production buildに合格したCloudflare Pages公開設定

- [ ] **Step 1: クライアントテストを実行する**

Run:

```powershell
npm.cmd test -w src/client
```

Expected: 全テストがPASSする。

- [ ] **Step 2: クライアント型チェックを実行する**

Run:

```powershell
npm.cmd run typecheck -w src/client
```

Expected: 終了コード0で完了する。

- [ ] **Step 3: production buildを再実行する**

Run:

```powershell
npm.cmd run build:client
```

Expected: 終了コード0で完了する。

- [ ] **Step 4: 変更範囲を確認する**

Run:

```powershell
git diff --check
git status --short
```

Expected: whitespace errorがなく、今回の実装対象は `package.json`、`README.md`、本計画書のみである。既存の画像変更はそのまま残っている。

- [ ] **Step 5: 実装対象だけをコミットする**

```powershell
git add package.json README.md docs/superpowers/plans/2026-07-28-cloudflare-pages-deployment.md
git commit -m "feat: Cloudflare Pages公開設定を追加"
```

