/**
 * Google Places API Service (Frontend)
 * Vercel Serverless Functions または開発用バックエンドAPI経由でスポットの写真を取得
 */

// APIベースURL - 本番環境では相対URL、開発環境ではlocalhost
const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const API_BASE_URL = isDev ? 'http://localhost:3001' : '';

// キャッシュ用のMap (URLとタイプ)
const photoCache = new Map<string, { url: string; types: string[] }>();

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
        return photoCache.get(cacheKey)?.url || null;
    }

    try {
        const params = new URLSearchParams({ name: placeName });
        if (lat !== undefined) params.append('lat', lat.toString());
        if (lng !== undefined) params.append('lng', lng.toString());

        const response = await fetch(`${API_BASE_URL}/api/places/photo?${params}`);
        const data = await response.json();

        if (data.photoUrl) {
            photoCache.set(cacheKey, { url: data.photoUrl, types: [] });
            return data.photoUrl;
        }

        return null;
    } catch (error) {
        // console.error('Error fetching place photo:', error);
        return null;
    }
}

/**
 * 複数の場所の写真URLを一括取得
 * @param places 場所の配列 [{name, lat, lng}]
 * @param onProgress 進捗通知用コールバック (部分的に取得できた結果を返す)
 * @returns 名前からデータへのMap
 */
export async function getPlacePhotosInBatch(
    places: Array<{ name: string; lat?: number; lng?: number }>,
    onProgress?: (newPhotos: Map<string, { url: string; types: string[] }>) => void
): Promise<Map<string, { url: string; types: string[] }>> {
    const results = new Map<string, { url: string; types: string[] }>();

    // キャッシュ済みのものを先にチェック
    const uncached = places.filter(place => {
        const cacheKey = `${place.name}-${place.lat}-${place.lng}`;
        if (photoCache.has(cacheKey)) {
            results.set(place.name, photoCache.get(cacheKey)!);
            return false;
        }
        return true;
    });

    // キャッシュヒットがあれば即時反映
    if (results.size > 0 && onProgress) {
        onProgress(new Map(results));
    }

    if (uncached.length === 0) {
        return results;
    }

    // Vercelのタイムアウトを回避するため、リクエストを分割して送信
    const BATCH_SIZE = 10;
    const CONCURRENT_REQUESTS = 3;

    try {
        const chunks = [];
        for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
            chunks.push(uncached.slice(i, i + BATCH_SIZE));
        }

        const queue = [...chunks];
        const activeWorkers = [];

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
                    // console.log('API Batch Response:', data); // Debug log

                    if (data.photos) {
                        const batchResults = new Map<string, { url: string; types: string[] }>();

                        for (const [name, result] of Object.entries(data.photos)) {
                            // 結果がオブジェクトでurlを含むか確認
                            // @ts-ignore
                            if (result && (typeof result === 'string' || (typeof result === 'object' && result.url))) {
                                // 以前の文字列のみのレスポンスとの互換性
                                // @ts-ignore
                                const entry = typeof result === 'string'
                                    ? { url: result, types: [] }
                                    // @ts-ignore
                                    : result as { url: string; types: string[] };

                                results.set(name, entry);
                                batchResults.set(name, entry);

                                // キャッシュに保存
                                const place = uncached.find(p => p.name === name);
                                if (place) {
                                    const cacheKey = `${place.name}-${place.lat}-${place.lng}`;
                                    photoCache.set(cacheKey, entry);
                                }
                            }
                        }

                        // 進捗があれば通知
                        if (onProgress && batchResults.size > 0) {
                            onProgress(batchResults);
                        }
                    }
                } catch (err) {
                    // エラーログ抑制
                }
            }
        };

        for (let i = 0; i < Math.min(chunks.length, CONCURRENT_REQUESTS); i++) {
            activeWorkers.push(worker());
        }

        await Promise.all(activeWorkers);

    } catch (error) {
        // エラーログ抑制
    }

    return results;
}
