# TypeScript + Phaser Migration Spec

Unity版の現状をもとに、TypeScript + Phaserへ移行するための仕様メモ。主な一次情報は `src/Assets/Scripts/EternalWheel/Runtime` と `src/Assets/Tests/EditMode/EternalWheel`。

## 現在のゲーム概要

`The Eternal Wheel` は、プレイヤー対CPUのリアルタイム盤面制圧バトル。各チームはリーダー1体と通常ユニット3体を持ち、ユニットを移動させながらエレメンタルを生成し、リーダーとエレメンタルで作る領域を使って召喚ユニットを出す。

MVP設計時点では「召喚で敵リーダーへ即時ダメージ」だったが、現在のC#実装では「召喚ユニットを生成し、敵リーダーへ進軍させ、接触中にダメージを与える」仕様へ進んでいる。

## 画面と入力

- タイトル画面: `The Eternal Wheel MVP` と `Start Battle` ボタン。
- バトル画面: 横長の2Dフィールド、上下左右の壁、左右にリーダー、各チーム3ユニット。
- HUD: Player HP、CPU HP、Time、Summon HP / CD、Result、Build Elemental、Summon、Retry。
- Result: `PlayerWin`、`CpuWin`、`Draw` のいずれかを表示。
- 入力:
  - 左クリックで自軍ユニットを選択。
  - 選択後に盤面を左クリックすると移動先指定。
  - `Build Elemental` ボタンで選択ユニットがエレメンタル生成開始。
  - `Summon` ボタンでプレイヤー召喚。
  - `Retry` はシーン再読み込み相当。

Phaserでは、`pointerdown` をワールド座標へ変換し、ユニットの当たり判定半径 `0.45` 以内なら選択、それ以外なら移動コマンドに変換する。

## 座標と初期配置

Unityの `Vector2` は、TypeScriptでは `{ x: number; y: number }` などへ置き換える。

| 項目 | 値 |
| --- | --- |
| フィールド最小座標 | `(-7.5, -4.5)` |
| フィールド最大座標 | `(7.5, 4.5)` |
| プレイヤーリーダー | `(-7, 0)` |
| CPUリーダー | `(7, 0)` |
| プレイヤー近接 | `(-5, 1.5)` |
| プレイヤー速度 | `(-5, 0)` |
| プレイヤー遠距離 | `(-5, -1.5)` |
| CPU近接 | `(5, 1.5)` |
| CPU速度 | `(5, 0)` |
| CPU遠距離 | `(5, -1.5)` |

## 型・ID

移行先でも同じ列挙値を使うとテスト移植が楽。

- `TeamId`: `Player`, `Cpu`
- `UnitType`: `Melee`, `Speed`, `Ranged`
- `UnitId`: `PlayerMelee`, `PlayerSpeed`, `PlayerRanged`, `CpuMelee`, `CpuSpeed`, `CpuRanged`
- `LeaderId`: `Player`, `Cpu`
- `ElementalId`: `None`, `Elemental1` から `Elemental8`
- `CommandType`: `MoveUnit`, `BeginElementalBuild`, `Summon`
- `MatchResult`: `InProgress`, `PlayerWin`, `CpuWin`, `Draw`
- `UnitMode`: `Active`, `BuildingElemental`, `Defeated`

コマンドは将来のオンライン化を見越して、入力元を問わず共通形式にする。

```ts
type BattleCommand =
  | { commandType: "MoveUnit"; team: TeamId; unitId: UnitId; targetPosition: Vec2 }
  | { commandType: "BeginElementalBuild"; team: TeamId; unitId: UnitId; targetPosition: Vec2 }
  | { commandType: "Summon"; team: TeamId; unitId?: UnitId; targetPosition: Vec2 };
```

## チューニング値

| 項目 | 値 |
| --- | --- |
| 試合時間 | `180` 秒 |
| リーダー最大HP | `1000` |
| エレメンタル生成時間 | `5` 秒 |
| チームごとの最大エレメンタル数 | `4` |
| 召喚に必要なエレメンタル数 | `2` |
| 召喚クールダウン | `30` 秒 |
| エレメンタル最大HP | `120` |
| 通常ユニットのリーダー直接攻撃倍率 | `0.25` |
| ユニット復活時間 | `10` 秒 |
| 接触判定半径 | `0.45` |
| 接触時移動速度倍率 | `1 / 3` |
| リーダー表示サイズ | `0.8` |
| リーダー回復半径 | `2.0` |

召喚ユニット関連:

| 項目 | 値 |
| --- | --- |
| HP最小倍率 | 近接HPの `3` 倍 |
| HP最大倍率 | 近接HPの `10` 倍 |
| 面積ごとのHP倍率加算 | `area * 1` |
| 攻撃力倍率 | 近接攻撃力の `3` 倍 |
| HP自然減少 | 最小HPの `0.1` / 秒 |

旧仕様値として `SummonMinDamage = 200`、`SummonMaxDamage = 500`、`SummonAreaDamageFactor = 2` が残っているが、現行の召喚ユニット実装では直接ダメージ計算には使われていない。

## ユニット性能

| 種類 | 最大HP | 移動速度 | 攻撃力 | 射程 | 攻撃間隔 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Melee | `350` | `3.5 / 3` | `45` | `1.25` | `1.2` 秒 |
| Speed | `250` | `5.5 / 3` | `30` | `1.0` | `0.8` 秒 |
| Ranged | `220` | `1.0` | `35` | `3.5` | `1.4` 秒 |

遠距離ユニットは移動中に攻撃しない。停止判定は `distanceSq(position, destination) <= 0.0001`。

## ゲーム進行

`GameSession.Tick(deltaSeconds)` 相当の順序:

1. 残り時間を減らす。
2. 召喚クールダウンを減らす。
3. エレメンタル生成を進める。
4. 通常ユニットを移動させる。
5. リーダー周辺の味方ユニットを回復する。
6. 通常ユニットの戦闘を解決する。
7. 召喚ユニットを移動・攻撃・自然減少させる。
8. 撃破ユニットの復活タイマーを進める。
9. 破壊済みエレメンタルを除去する。
10. 勝敗判定を更新する。

試合結果が `InProgress` 以外になった後は、コマンドもTickも状態を変更しない。

## 勝敗

- 両リーダーHPが同時に0以下: `Draw`
- CPUリーダーHPが0以下: `PlayerWin`
- プレイヤーリーダーHPが0以下: `CpuWin`
- 時間切れ:
  - プレイヤーリーダーHPが高い: `PlayerWin`
  - CPUリーダーHPが高い: `CpuWin`
  - 同値: `Draw`

## 移動

- 移動コマンドを受けたユニットは、エレメンタル生成中でも生成をキャンセルして `Active` に戻り、目的地を更新する。
- 目的地と現在位置はフィールド範囲内にクランプする。
- `Active` かつ生存中のユニットのみ移動する。
- 敵通常ユニットまたは敵エレメンタルと `0.45` 以内で接触中なら移動速度は `1 / 3`。

## 戦闘

通常ユニットは攻撃タイマーが0になった時、射程内の最も近い敵ターゲットを攻撃する。

攻撃対象:

1. 敵通常ユニット
2. 完成済み、未破壊の敵エレメンタル
3. 敵召喚ユニット
4. 敵リーダー

実装上は上記カテゴリをすべて走査し、射程内で最短距離の対象を選ぶ。自軍、未完成エレメンタル、破壊済み対象は攻撃しない。

ダメージ:

- 通常ユニット・エレメンタル・召喚ユニットへは攻撃力そのまま。
- リーダーへは `attackDamage * 0.25`。
- 通常ユニットHPが0以下になると `Defeated` になり、生成中エレメンタルはキャンセルされ、`10` 秒後にスポーン地点で全回復復活。

## リーダー回復エリア

各リーダーの前方半円に入った味方通常ユニットは、毎秒 `unit.attackDamage` 分だけ回復する。最大HPを超えない。

- プレイヤー側リーダー: リーダーより右側の半円。
- CPU側リーダー: リーダーより左側の半円。
- 半径は `LeaderVisualSize * 2.5 = 2.0`。

## エレメンタル生成

- 生成開始条件:
  - ユニットが `Active`
  - ユニットが生存中
  - 自チームの完成済み未破壊エレメンタル数 + 生成予約数が上限未満
  - `Elemental1` から `Elemental8` の空きIDがある
- 生成開始時:
  - ユニットを `BuildingElemental` にする。
  - `BuildTimerSeconds = 5`
  - 空きIDを `PendingElementalId` に入れる。
- 生成中ユニットは移動も攻撃もしない。
- 生成完了時:
  - ユニットの現在位置に、同チームの完成済みエレメンタルを作る。
  - HPは `120`。
  - ユニットは `Active` に戻る。
- 移動指示、撃破、明示キャンセルで生成は失敗し、エレメンタルは作られない。
- HPが0以下のエレメンタルは戦闘状態から除去する。

## 領域計算

召喚領域は、自チームリーダー位置 + 完成済み未破壊の自チームエレメンタル位置の凸包面積。

- エレメンタルが2個未満なら面積は `0`。
- 重複点は除外する。
- 3点未満なら面積は `0`。
- 凸包は単調連鎖法、面積はshoelace formula。

テスト例:

- リーダー `(0, 0)`、エレメンタル `(4, 0)`, `(0, 3)` => `6`
- リーダー `(0, 0)`、エレメンタル `(2,0)`, `(2,2)`, `(0,2)`, `(1,1)` => `4`

## 召喚

召喚可能条件:

- 自リーダーが生存中。
- チームの召喚クールダウンが `0`。
- 完成済み・未破壊の自チームエレメンタルが2個以上。

実行時:

- 自リーダー位置に召喚ユニットを1体生成する。
- 目的地は敵リーダー位置。
- 召喚クールダウンを `30` 秒にする。
- エレメンタルは消費しない。
- 敵リーダーには即時ダメージを与えない。

召喚ユニット:

- 最大HP = `melee.maxHp * clamp(3 + area, 3, 10)`
- 攻撃力 = `melee.attackDamage * 3`
- 移動速度 = `melee.moveSpeed`
- HP自然減少 = `melee.maxHp * 3 * 0.1` / 秒
- 毎Tickで敵リーダー位置へ目的地を更新する。
- 接触半径 `0.45` 内の最寄り敵対象に `attackDamage * deltaSeconds` の接触ダメージを与える。
- 接触中にダメージした場合、そのTickの移動速度は `1 / 3`。
- HP自然減少で0以下になった召喚ユニットは除去され、そのTickでは攻撃しない。

## CPU AI

`CpuPlanner.PlanCommands` は1秒ごとに呼ばれる。

優先度:

1. CPUが召喚可能なら `Summon(Cpu)` のみ返す。
2. 使用可能なCPUユニットがあり、CPU完成済みエレメンタル数が上限未満なら、最初の使用可能ユニットへ `BeginElementalBuild`。
3. それ以外は、すべての生存・ActiveなCPUユニットにプレイヤーリーダー位置への移動を指示。
4. 使用可能ユニットがなければ空リスト。

## 表示仕様

現状は抽象的なチェス風・盤面駒風の矩形スプライト。

| 種別 | 色 | 描画順 | サイズ目安 |
| --- | --- | ---: | --- |
| リーダー | 白 | `0` | `0.8` |
| 通常ユニット | 青 | `10` | `0.45` |
| エレメンタル | 黄 | `20` | `0.3` |
| 召喚ユニット | マゼンタ | `25` | リーダーの `1.5` 倍 |

HPバー:

- 各駒の上に小さな横バー。
- 背景は暗色、前景は緑。
- 残HP比率を `0..1` にクランプし、左端を固定して幅を変更する。
- 幅:
  - リーダー `1.1`
  - 通常ユニット `0.75`
  - エレメンタル `0.55`
  - 召喚ユニット `1.4`
- 高さ `0.08`、Yオフセット `0.75`。

遠距離攻撃時は、攻撃イベントから小さな水色の弾を生成し、速度 `9` で攻撃対象位置へ移動させる。

## Phaser実装への移植方針

再利用しやすいC#:

- `Core/BattleCore.cs`: 型、状態、初期値、ユニット性能。TypeScriptの型定義と初期化関数へほぼ直訳できる。
- `Rules/AreaCalculator.cs`: Unity依存が `Vector2` と `Mathf` だけなので、`Vec2` と `Math` に置き換えて直訳可能。
- `Rules/ElementalSystem.cs`: ほぼ純粋ロジック。状態変更関数として直訳可能。
- `Rules/SummonSystem.cs`: ほぼ純粋ロジック。召喚ユニット接触処理も移植対象。
- `Rules/UnitSystem.cs`: ほぼ純粋ロジック。ただし `Vector2.MoveTowards/Distance` を自前関数に置き換える。
- `Rules/GameSession.cs`: Phaserの更新ループから呼ぶゲーム進行の中心として直訳可能。
- `AI/CpuPlanner.cs`: そのままCPUコマンド生成関数にできる。
- `Tests/EditMode/EternalWheel/*.cs`: TypeScriptテストへ移植する価値が高い。特に `BattleCoreTests`, `UnitSystemTests`, `ElementalSystemTests`, `SummonSystemTests`, `GameSessionTests`, `CpuPlannerTests`, `AreaCalculatorTests`。

Unity依存が強く、仕様だけ参照するC#:

- `Unity/BattleRunner.cs`: Phaser Scene側の責務に置き換える。入力、表示生成、Tick呼び出し、CPU周期、ビュー同期の流れだけ参照。
- `Unity/BattlePieceView.cs`: Phaser GameObject/Container/Graphicsで駒とHPバーを作る際の表示仕様として参照。
- `Unity/AreaView.cs`: Phaser Graphicsの線描画に置き換え。
- `UI/BattleHud.cs`: HTML UIまたはPhaser UIテキストへ置き換え。
- `UI/TitleAndResultFlow.cs`: Phaser Scene状態またはDOM UIへ置き換え。
- `Editor/MvpSceneBuilder.cs`: Unity scene生成専用なので移植不要。ただし初期UI配置の参考になる。

Phaser側で用意したいユーティリティ:

- `distance(a, b)`
- `distanceSq(a, b)`
- `moveTowards(current, target, maxDelta)`
- `clamp(value, min, max)`
- `clampVec2(position, min, max)`
- `oppositeTeam(team)`
- `teamForUnit(unitId)`

## 推奨TypeScript構成

```text
src/
  game/
    core/
      types.ts
      battleConfig.ts
      battleState.ts
      vector.ts
    rules/
      areaCalculator.ts
      elementalSystem.ts
      summonSystem.ts
      unitSystem.ts
      gameSession.ts
    ai/
      cpuPlanner.ts
    scenes/
      BattleScene.ts
      TitleScene.ts
    ui/
      battleHud.ts
  tests/
    areaCalculator.test.ts
    battleCore.test.ts
    elementalSystem.test.ts
    summonSystem.test.ts
    unitSystem.test.ts
    gameSession.test.ts
    cpuPlanner.test.ts
```

## 移行時の注意点

- Unityの単位とPhaserのピクセル単位を分ける。ゲームロジックはUnity版と同じワールド座標で持ち、描画時だけスケール変換するのが安全。
- 既存の日本語ドキュメントには文字化けしているものがあるため、仕様確認はC#実装とテストを優先する。
- `SummonMinDamage` など旧ダメージ式の値が残っている。現行実装に合わせるなら召喚ユニット方式を正とする。
- 現行の駒色はチーム差ではなく種別差。プレイしやすさを優先するなら、Phaser移行時にチーム色を追加検討してよい。
- `InputSystem_Actions.inputactions` はUnity標準テンプレート由来の要素が多く、現行バトル操作は主に `BattleRunner` のマウス処理とUIボタンで成立している。
