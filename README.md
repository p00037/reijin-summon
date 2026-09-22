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

タイトルの「CPU戦へ」から、カードを選んで詳細を確認し、「このカードを加える」で編成します。編成中のカードを押すと取り外せます。合計コスト10以下・1〜5枚で出撃でき、同じ兵種は複数採用できますが、同じカードは重複できません。

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

この手順ではゲーム画面を公開します。CPU戦はそのまま利用できます。オンライン対戦には、後述の対戦サーバーの公開と接続先の設定が別途必要です。

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

## オンライン対戦（公開前の検証中）

タイトルから「CPU戦へ」または「オンライン対戦」を選択します。CPU戦は従来どおり端末内で動作します。オンライン対戦は表示名を入力してルームを作成し、6桁の番号を相手に伝えて参加します。双方が編成・配置を決めて準備完了すると、5秒後に戦闘が始まります。相手の編成と配置は開始まで配信しません。

切断中も試合は進み、30秒以内は同じタブまたは「前の対戦に復帰」から戻れます。期限を過ぎると切断側が敗北します。双方が戻らない場合は中断です。サーバー再起動時の復旧・戦績保存はありません。

### ローカル・タブレットでの検証

1. Node.js 22を使用し、ルートで npm ci、npm run dev を実行します。
2. PCでは http://localhost:5173 を2つのタブで開きます。
3. タブレットはPCと同じWi-Fiに接続し、PCのLANアドレスの5173番を開きます（localhostはタブレット自身を指すので使いません）。PCのファイアウォールでプライベートネットワークの5173・2567番を許可してください。
4. 接続元を制限する場合は src/server/.env.example を src/server/.env にコピーし、ALLOWED_ORIGINS に実際のLANアドレスを含めます。
5. 検証結果・未確認事項は [検証記録](docs/online-battle-validation.md) を参照してください。

全自動試験は npm test、型検査は npm run typecheck、製品ビルドは npm run build です。10人・5試合・10分の負荷検証は npm run build:server 後に npm run test:online:load -- --spawn で専用のローカルサーバーを起動して実行できます。

### インターネット公開時に変更するもの

- ゲーム画面は既存のCloudflare Pages、対戦サーバーはRenderの単一インスタンスを候補とします。
- サーバー用の render.yaml を用意しています。無料プランを選び、ALLOWED_ORIGINS に実際のPagesのHTTPS URLを設定します（末尾の / は付けません）。未設定の本番起動は失敗します。
- Pagesのビルド環境で VITE_GAME_SERVER_URL を実際のRenderの wss:// URLへ変更し、クライアントを再ビルドします。HTTPS画面から ws:// には接続できません。
- サーバーはホストの PORT を使います。複数インスタンスへの拡張はこの構成の対象外です。更新は試合がない時間に手動で行います。
- 2026-09-22確認時点の [Render無料枠](https://render.com/docs/free) は、通信がない状態が15分続くと休止し、次の接続で起動します。起動待ち・予告なしの再起動による試合中断があり得ます。
- 無料インスタンスでも転送量の超過は別料金の対象です。[Render FAQ](https://render.com/docs/faq) によると支払方法未登録なら課金が必要になった時点でサービス停止となります。公開前にアカウントの支払方法・無料枠を確認し、費用が発生する変更は行いません。

現在は公開先を作成していません。実機と公開環境での検証が済むまで公開完了とは扱いません。
