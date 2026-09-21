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

## デッキ編成

タイトルの「デッキ編成へ」から、カードを選んで詳細を確認し、「このカードを加える」で編成します。編成中のカードを押すと取り外せます。合計コスト10以下・1〜5枚で出撃でき、同じ兵種は複数採用できますが、同じカードは重複できません。

「新規」で複数のデッキを作り、名前を付けて保存できます。保存数にアプリ側の上限はありませんが、利用中のブラウザの保存容量に従います。保存は端末・ブラウザ・サイトごとで、編集内容は「デッキを保存」を押した時に保存されます。

出撃後はカードをドラッグして初期配置を調整し、「配置を確定して戦闘開始」を押します。戦闘終了後は「同じデッキで再戦」と「編成に戻る」を選べます。CPUはSC020・SC019・SC014の固定編成です。

カードは[参照一覧](https://w.atwiki.jp/ewwiki/pages/25.html)のSC001〜SC020を収録し、番号・名前・兵種・CO/LV・HP・AT・INTを登録しています。移動・射程・生成時間・アビリティは既存の兵種共通値です。INTは表示のみで、カード固有アビリティは対象外です。

### 召喚獣の選択

デッキ編成画面でラファエル、ジャックポット、ユグドラシル、リヴァイアサン、バハムート、デュラハンの6種類から1体を選び、デッキと一緒に保存できます。旧形式の保存デッキにはラファエルを補完します。CPUは対戦ごとに抽選し、再戦でも再抽選します。対戦中は種類を変更できません。

種類別のHP・移動速度・攻撃力・被ダメージ倍率と専用画像を実装しています。ジャックポットの味方を巻き込むレーザー、ユグドラシルの全体攻撃、リヴァイアサンの召喚時・周期波動にも対応しています。HPは基礎値＋陣地面積1%につき60、自然消耗は毎秒120です。基礎HPが0の2種類は陣地面積が0のとき召喚できません。潜在能力とデッキによる召喚獣カスタマイズは含みません。

数値・対象範囲・Wikiに記載のない部分の仮設定は[召喚獣選択仕様](docs/superpowers/specs/2026-09-17-summon-selection-design.md)、画像の生成記録は[画像README](src/client/public/assets/summons/README.md)に記載しています。

既存画像の対応番号は、旧blue001 → SC009（レッドアイ）、旧blue002 → SC012（グー）、旧blue003 → SC017（ローレライ）です。残る17枚は個別に生成したイラストを使い、画面と画像パスをSC番号に統一しています。

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
