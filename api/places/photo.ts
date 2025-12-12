import type { VercelRequest, VercelResponse } from '@vercel/node';

// キャッシュ（メモリ内、サーバーレス関数ではコールド起動時にリセットされる）
const photoCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

    try {
        const { name, lat, lng } = req.query;

        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'name parameter is required' });
        }

        if (!GOOGLE_API_KEY) {
            return res.status(500).json({ error: 'Google API key not configured' });
        }

        // キャッシュをチェック
        const cacheKey = `${name}-${lat || ''}-${lng || ''}`;
        const cached = photoCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return res.json({ photoUrl: cached.url, cached: true });
        }

        // Place Search APIで場所を検索
        let searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(name)}&inputtype=textquery&fields=place_id,photos,name&key=${GOOGLE_API_KEY}`;

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

        // キャッシュに保存
        photoCache.set(cacheKey, { url: photoUrl, timestamp: Date.now() });

        res.json({ photoUrl, placeId: place.place_id });
    } catch (error) {
        console.error('Error fetching place photo:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
