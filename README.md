# reijin-summon

TypeScript + Phaser client and Node.js + Colyseus server starter.

## Requirements

- Node.js 22 or newer
- npm

On Windows PowerShell, use `npm.cmd` if `npm` is blocked by the script execution policy.

## Setup

```powershell
npm.cmd install
```

## Development

Run the Colyseus server and Phaser client together:

```powershell
npm.cmd run dev
```

- Client: http://localhost:5173
- Server: http://localhost:2567
- Health check: http://localhost:2567/health

ローカルCOM戦MVPだけを確認する場合は、クライアント単体で起動できます。
サーバーは不要です。

```powershell
npm.cmd run dev:client
```

- Client: http://localhost:5173

## Build

```powershell
npm.cmd run build
```

## Project Structure

```text
src/
  client/   # TypeScript + Phaser + Vite
  server/   # Node.js + Colyseus + TypeScript
```

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
