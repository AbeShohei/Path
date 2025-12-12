import type { VercelRequest, VercelResponse } from '@vercel/node';

// キャッシュ
const photoCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!GOOGLE_API_KEY) {
        return res.status(500).json({ error: 'Google API key not configured' });
    }

    try {
        const { places } = req.body;

        if (!places || !Array.isArray(places)) {
            return res.status(400).json({ error: 'places array is required' });
        }

        const results: Record<string, string> = {};

        // 並列で処理（最大5件ずつ - サーバーレス関数のタイムアウトを考慮）
        const batchSize = 5;
        for (let i = 0; i < Math.min(places.length, 20); i += batchSize) {
            const batch = places.slice(i, i + batchSize);

            await Promise.all(batch.map(async (place: { name: string; lat?: number; lng?: number }) => {
                const { name, lat, lng } = place;
                const cacheKey = `${name}-${lat || ''}-${lng || ''}`;

                // キャッシュチェック
                const cached = photoCache.get(cacheKey);
                if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                    results[name] = cached.url;
                    return;
                }

                try {
                    let searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(name)}&inputtype=textquery&fields=place_id,photos&key=${GOOGLE_API_KEY}`;

                    if (lat && lng) {
                        searchUrl += `&locationbias=point:${lat},${lng}`;
                    }

                    const searchResponse = await fetch(searchUrl);
                    const searchData = await searchResponse.json();

                    if (searchData.status === 'OK' && searchData.candidates?.[0]?.photos?.[0]) {
                        const photoRef = searchData.candidates[0].photos[0].photo_reference;
                        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`;

                        photoCache.set(cacheKey, { url: photoUrl, timestamp: Date.now() });
                        results[name] = photoUrl;
                    }
                } catch (err) {
                    console.error(`Error fetching photo for ${name}:`, err);
                }
            }));
        }

        res.json({ photos: results });
    } catch (error) {
        console.error('Error fetching place photos:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
