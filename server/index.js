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

// Google Places API Key
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

// キャッシュ（メモリ内、簡易版）
const photoCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間

/**
 * ヘルスチェックエンドポイント
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * 場所の写真URLを取得
 * GET /api/places/photo?name=場所名&lat=緯度&lng=経度
 */
app.get('/api/places/photo', async (req, res) => {
    try {
        const { name, lat, lng } = req.query;

        if (!name) {
            return res.status(400).json({ error: 'name parameter is required' });
        }

        if (!GOOGLE_API_KEY) {
            return res.status(500).json({ error: 'Google API key not configured' });
        }

        // キャッシュをチェック
        const cacheKey = `v2-${name}-${lat || ''}-${lng || ''}`;
        const cached = photoCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return res.json({ photoUrl: cached.url, types: cached.types || [], cached: true });
        }

        // Place Search APIで場所を検索
        let searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(name)}&inputtype=textquery&fields=place_id,photos,name,types&key=${GOOGLE_API_KEY}`;

        if (lat && lng) {
            searchUrl += `&locationbias=point:${lat},${lng}`;
        }

        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (searchData.status !== 'OK' || !searchData.candidates || searchData.candidates.length === 0) {
            return res.json({ photoUrl: null, reason: 'Place not found' });
        }

        const place = searchData.candidates[0];

        if (!place.photos || place.photos.length === 0) {
            return res.json({ photoUrl: null, reason: 'No photos available' });
        }

        // 写真URLを生成
        const photoRef = place.photos[0].photo_reference;
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`;

        // キャッシュに保存 (typesはsingle endpointでは取ってないが、整合性のため形式合わせるなら本当は取るべきだが、今回はlistの方が重要)
        // Note: Single fetch endpoint logic remains mostly for backward compat or direct calls.
        photoCache.set(cacheKey, { url: photoUrl, types: place.types || [], timestamp: Date.now() });

        res.json({ photoUrl, types: place.types || [], placeId: place.place_id });
    } catch (error) {
        console.error('Error fetching place photo:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * 複数の場所の写真URLを一括取得
 * POST /api/places/photos
 * Body: { places: [{ name, lat, lng }] }
 */
app.post('/api/places/photos', async (req, res) => {
    try {
        const { places } = req.body;

        if (!places || !Array.isArray(places)) {
            return res.status(400).json({ error: 'places array is required' });
        }

        if (!GOOGLE_API_KEY) {
            return res.status(500).json({ error: 'Google API key not configured' });
        }

        const results = {};

        // 並列で処理（最大10件ずつ）
        const batchSize = 10;
        for (let i = 0; i < places.length; i += batchSize) {
            const batch = places.slice(i, i + batchSize);

            await Promise.all(batch.map(async (place) => {
                const { name, lat, lng } = place;
                // Cache key version 2 (v2-) to force refresh
                const cacheKey = `v2-${name}-${lat || ''}-${lng || ''}`;

                // キャッシュチェック
                const cached = photoCache.get(cacheKey);
                if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                    results[name] = { url: cached.url, types: cached.types || [] };
                    return;
                }

                try {
                    let searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(name)}&inputtype=textquery&fields=place_id,photos,types&key=${GOOGLE_API_KEY}`;

                    if (lat && lng) {
                        searchUrl += `&locationbias=point:${lat},${lng}`;
                    }

                    const searchResponse = await fetch(searchUrl);
                    const searchData = await searchResponse.json();

                    if (searchData.status === 'OK' && searchData.candidates?.[0]) {
                        const candidate = searchData.candidates[0];
                        const photoResult = { url: '', types: candidate.types || [] };

                        if (candidate.photos?.[0]) {
                            const photoRef = candidate.photos[0].photo_reference;
                            photoResult.url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`;
                        }

                        photoCache.set(cacheKey, { ...photoResult, timestamp: Date.now() });
                        results[name] = photoResult;
                    }
                } catch (err) {
                    console.error(`Error fetching photo for ${name}:`, err.message);
                }
            }));
        }

        res.json({ photos: results });
    } catch (error) {
        console.error('Error fetching place photos:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`🚀 Places API Server running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
    if (!GOOGLE_API_KEY) {
        console.warn('⚠️  Warning: GOOGLE_MAPS_API_KEY is not set');
    }
});
