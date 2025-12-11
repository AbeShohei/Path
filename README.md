# 京都スマートガイド (Kyoto Smart Guide)

**京都の「地域データ」と「生成AI」を組み合わせた、新しい観光ナビゲーションアプリ**

移動時間を「観光体験」に変えることをコンセプトに、AIガイドがリアルタイムで観光案内を行います。

---

## 🎯 コアコンセプト

- **"Travel as a Story"** - 移動時間を、AIが語る土地の物語（歴史・文化）で彩る
- **"Data Driven"** - オープンデータを活用した混雑回避と、正確なルート案内

---

## 📁 プロジェクト構成

```
KyotoGuide/
├── api/                          # Vercel Serverless Functions
│   ├── navitime-maps/            # NAVITIME Maps API プロキシ
│   └── navitime-route/           # NAVITIME Route API プロキシ
├── components/
│   ├── Map.tsx                   # Leaflet地図コンポーネント
│   ├── LyricsReader.tsx          # カラオケ風字幕表示
│   └── LiveGuide.tsx             # AIガイドウィジェット
├── services/
│   ├── navitimeService.ts        # ルート検索 (NAVITIME API)
│   ├── humanFlowService.ts       # 混雑度分析
│   ├── geminiService.ts          # AIガイド生成 (OpenRouter)
│   ├── spotService.ts            # 観光スポットデータ
│   └── audioUtils.ts             # 音声再生ユーティリティ
├── data/
│   └── spots.json                # 観光スポットマスタ
├── opendata/                     # 京都市オープンデータ (人流)
├── App.tsx                       # メインアプリケーション
├── vercel.json                   # Vercel設定
└── vite.config.ts                # Vite設定
```

---

## 🧠 システムロジック詳細解説

### 1. 混雑度分析ロジック (Mesh Processing)

京都市オープンデータ（KDDI Location Analyzer 人流データ）を基に、以下のロジックで混雑レベルを算出しています。

- **メッシュ処理**: JIS X 0410準拠の「標準1kmメッシュ」を使用。
  - ユーザーまたはスポットの緯度経度から、一意な**8桁のメッシュコード**を算出（`services/humanFlowService.ts`）。
  - 各メッシュごとの「平均滞留人口」データを参照。

- **時間帯別・エリア別閾値**:
  - 単一の基準ではなく、**時間帯**（朝 6-12時 / 昼 12-18時 / 夕 18-24時）と**エリア特性**（市内中心部 / 郊外）に応じて基準値を動的に変更。
  - 例：昼間の市内中心部は、郊外よりも高い人口密度でも「通常」と判定される（都市部の許容量を考慮）。

### 2. 混雑度レベルの定義

算出された人口データを、以下の5段階に分類して表示します。

| レベル | 表示 | 色 (Tailwind) | 状態定義 |
|:---:|:---|:---|:---|
| **1** | 快適 | `Blue-400` | 人が少なく、非常に快適に観光できる |
| **2** | やや快適 | `Cyan-400` | 比較的空いている |
| **3** | 通常 | `Green-400` | 一般的な賑わい、ストレスなく移動可能 |
| **4** | やや混雑 | `Yellow-400` | 人が多く、若干の移動のしづらさを感じる |
| **5** | 混雑 | `Red-400` | 非常に混雑しており、回避を推奨 |

※到着時の「おすすめスポット」提案では、レベル3（通常）以下のスポットのみを、距離が近い順に提案します。

### 3. ルート沿い観光スポット抽出 (Route Filtering)

ナビゲーションモードにおいて、ルート周辺の観光スポットのみを表示するフィルタリングを行っています。

- **アルゴリズム**:
  - 検索されたルートデータ（ポリラインを構成する全座標点）と、全観光スポットとの距離計算を実施。
  - 現在の実装では、ルート上のいずれかの点から**0.05度（約5km圏内）**に含まれるスポットを抽出。
  - これにより、移動経路上にある立ち寄り可能なスポットを効率的に提示します。

### 4. AIガイド生成パイプライン (Google Gemini)

移動の文脈に合わせた観光ガイドを生成するために、以下の情報をプロンプトとして構成し、OpenRouter API経由で生成しています。

1. **基本情報**: 現在地、目的地、移動手段（バス/徒歩/地下鉄）。
2. **コンテキスト**:
   - そのルートから見える景色やランドマーク。
   - 今現在の混雑状況。
3. **役割設定 (Persona)**:
   - 「京都に詳しい親切なガイド」。
   - 移動時間という「隙間時間」を埋めるのに丁度よい長さ（200文字程度）に調整。

### 5. 地図アプリケーション連携

- **Google Maps API**:
  - ベースマップおよびマーカー、ルート描画に使用。
  - **ジェスチャー制御**: `gestureHandling: 'greedy'` により、モバイルでも直感的な操作（1本指でのスクロール）を可能に設定。
  - **自動追従 (Auto-Pan)**:
    - ナビゲーション中は現在地を追従するが、ユーザーが地図をドラッグして動かした場合は**自動追従を一時停止**し、自由に地図を閲覧できる仕様。
    - 「現在地に戻る」ボタンで追従を再開。

- **NAVITIME Route API**:
  - `route_transit` エンドポイントを使用し、公共交通機関を含む正確なルートを探索。
  - 取得した経路情報（`shape_transit`）をGoogle Maps上のPolylineとして描画。

---

## 🔧 開発環境セットアップ

### 必要な環境変数

`.env.local` ファイルを作成:

```env
GEMINI_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
NAVITIME_API_KEY=your_navitime_api_key
X-RAPIDAPI-KEY=your_rapidapi_key
```

### ローカル開発

```bash
npm install
npm run dev
```

### ビルド

```bash
npm run build
npm run preview
```

---

## 🌐 Vercelデプロイ

### 1. デプロイ

```bash
npx vercel
```

### 2. 環境変数設定

Vercel Dashboard → Settings → Environment Variables:

| 変数名 | 説明 |
|--------|------|
| `OPENROUTER_API_KEY` | AIガイド生成用 |
| `GOOGLE_MAPS_API_KEY` | Google Maps (未使用) |
| `NAVITIME_API_KEY` | NAVITIME API |
| `X_RAPIDAPI_KEY` | RapidAPI (ハイフン→アンダースコア) |

### 3. 再デプロイ

環境変数設定後、再デプロイを実行。

---

## 🛠️ 技術スタック

| 領域 | 技術 |
|------|------|
| フロントエンド | React 19, TypeScript, Vite |
| 地図 | Leaflet |
| スタイリング | Tailwind CSS (インライン) |
| AI | OpenRouter API (Gemini/DeepSeek) |
| ルート検索 | NAVITIME Route API (RapidAPI) |
| 音声 | Web Speech API |
| デプロイ | Vercel (Serverless Functions) |

---

## 📈 今後のロードマップ

### Phase 1: リアルタイムデータ連携

- GTFS-Realtime (バス位置情報)
- 公共交通オープンデータセンター (ODPT) 連携

### Phase 2: 音声品質向上

- Google Cloud Text-to-Speech
- OpenAI Audio API

### Phase 3: 自前ルート検索

- Valhalla / GraphHopper
- GTFS静的データ活用

---

## 📄 ライセンス

Private Project
