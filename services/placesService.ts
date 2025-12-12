/**
 * Google Places API Service (Frontend)
 * Vercel Serverless Functions または開発用バックエンドAPI経由でスポットの写真を取得
 */

// APIベースURL - 本番環境では相対URL、開発環境ではlocalhost
const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const API_BASE_URL = isDev ? 'http://localhost:3001' : '';

// キャッシュ用のMap
const photoCache = new Map<string, string>();

/**
 * 場所の名前から写真URLを取得
 * @param placeName 場所の名前
 * @param lat 緯度(オプション)
 * @param lng 経度(オプション)
 * @returns 写真のURL、または取得できない場合はnull
 */
export async function getPlacePhotoUrl(
    placeName: string,
    lat?: number,
    lng?: number
): Promise<string | null> {
    // キャッシュをチェック
    const cacheKey = `${placeName}-${lat}-${lng}`;
    if (photoCache.has(cacheKey)) {
        return photoCache.get(cacheKey) || null;
    }

    try {
        const params = new URLSearchParams({ name: placeName });
        if (lat !== undefined) params.append('lat', lat.toString());
        if (lng !== undefined) params.append('lng', lng.toString());

        const response = await fetch(`${API_BASE_URL}/api/places/photo?${params}`);
        const data = await response.json();

        if (data.photoUrl) {
            photoCache.set(cacheKey, data.photoUrl);
            return data.photoUrl;
        }

        return null;
    } catch (error) {
        console.error('Error fetching place photo:', error);
        return null;
    }
}

/**
 * 複数の場所の写真URLを一括取得
 * @param places 場所の配列 [{name, lat, lng}]
 * @returns 名前からURLへのMap
 */
export async function getPlacePhotosInBatch(
    places: Array<{ name: string; lat?: number; lng?: number }>
): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // キャッシュ済みのものを先にチェック
    const uncached = places.filter(place => {
        const cacheKey = `${place.name}-${place.lat}-${place.lng}`;
        if (photoCache.has(cacheKey)) {
            results.set(place.name, photoCache.get(cacheKey)!);
            return false;
        }
        return true;
    });

    if (uncached.length === 0) {
        return results;
    }

    // Vercelのタイムアウトを回避するため、リクエストを分割して送信
    // 1バッチあたり20件まで（サーバーレス関数の制限に合わせる）
    // さらに並列数も制限する
    const BATCH_SIZE = 10;
    const CONCURRENT_REQUESTS = 3;

    try {
        // 全体の処理バッチを作成
        const chunks = [];
        for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
            chunks.push(uncached.slice(i, i + BATCH_SIZE));
        }

        console.log(`[placesService] Processing ${uncached.length} places in ${chunks.length} chunks`);

        // 並列処理用のキュー
        const queue = [...chunks];
        const activeWorkers = [];

        // ワーカー関数：キューから取り出してAPIを呼ぶ
        const worker = async () => {
            while (queue.length > 0) {
                const chunk = queue.shift();
                if (!chunk) break;

                try {
                    const response = await fetch(`${API_BASE_URL}/api/places/photos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ places: chunk })
                    });

                    const data = await response.json();

                    if (data.photos) {
                        for (const [name, url] of Object.entries(data.photos)) {
                            if (typeof url === 'string') {
                                results.set(name, url);
                                // キャッシュに保存
                                const place = uncached.find(p => p.name === name);
                                if (place) {
                                    const cacheKey = `${place.name}-${place.lat}-${place.lng}`;
                                    photoCache.set(cacheKey, url);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('[placesService] Batch fetch error:', err);
                }
            }
        };

        // ワーカーを並列起動
        for (let i = 0; i < Math.min(chunks.length, CONCURRENT_REQUESTS); i++) {
            activeWorkers.push(worker());
        }

        // 全ワーカーの完了を待機
        await Promise.all(activeWorkers);

    } catch (error) {
        console.error('Error in batch processing:', error);
    }

    return results;
}
