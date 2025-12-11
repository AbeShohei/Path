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

## 🚀 実装済み機能

### 📍 混雑度可視化

- **データソース**: 京都市オープンデータ (KDDI Location Analyzer由来)
- 過去3年間の12月データをメッシュ(1km)ごとに分析し、5段階の混雑レベルを算出
- 地図上のピンの色（青〜赤）で視覚化
- 時間帯連動（朝・昼・夕で基準が変化）

### 🗺️ ルート検索

- **データソース**: NAVITIME Route (TotalNavi) API via RapidAPI
- 公共交通機関（バス・地下鉄）と徒歩を組み合わせた最適ルート
- 実際の時刻表に基づいた経路、運賃、所要時間
- `shape_transit` エンドポイントで正確な道路形状を描画

### 🤖 AIガイド

- **データソース**: Google Gemini / DeepSeek via OpenRouter API
- 移動手段・目的地に応じたリアルタイムガイド生成
- 移動時間に合わせた文章量の自動調整
- 車窓の景色・歴史的背景を含む観光ガイド視点

### 🗣️ 音声読み上げ & カラオケ字幕

- **エンジン**: Web Speech API
- 読み上げ速度に合わせた自動スクロール
- ドラッグで字幕エリアのサイズ調整可能
- ミュート時は字幕アニメーションのみ

### 📱 UI/UX機能

- 混雑フィルター（5段階で絞り込み）
- スポット一覧（混雑度→距離でソート）
- ピンタップで地図中央に移動・シート最小化
- 到着画面（ブラー背景 + 周辺スポット表示）
- ルート詳細のインライン展開

---

## ⚠️ シミュレーション部分

以下は外部データ未接続のため、推定・シミュレーションで動作:

- **バスのリアルタイム位置**: タイマーによる擬似カウントダウン
- **交通状況連動ガイド**: 渋滞情報等は未反映

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
