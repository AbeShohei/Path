/**
 * Backend Server for Google Places API
 * スポットの写真を取得するためのAPIサーバー
 */

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env and .env.local (like Vite does)
config({ path: join(__dirname, '..', '.env') });
config({ path: join(__dirname, '..', '.env.local') });

const app = express();
const PORT = process.env.API_PORT || 3001;

// CORS設定 - Viteの開発サーバーからのリクエストを許可
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    credentials: true
}));

app.use(express.json());

// Google Places API endpoints have been removed as part of migration to Leaflet/OSM.
// This server now only provides a health check.

/**
 * ヘルスチェックエンドポイント
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
});
