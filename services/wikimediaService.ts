// Wikimedia Commons API service for fetching tourist spot images
// Uses free API with no key required

interface WikimediaImage {
    title: string;
    url: string;
    thumbUrl: string;
    description?: string;
}

class WikimediaService {
    private cache: Map<string, string> = new Map();
    private staticLoadPromise: Promise<void>;

    constructor() {
        this.staticLoadPromise = this.loadStaticData();
    }

    private async loadStaticData() {
        try {
            const res = await fetch('/data/spot_images.json');
            if (res.ok) {
                const data = await res.json();
                Object.entries(data).forEach(([key, value]) => {
                    this.cache.set(key, value as string);
                });

            }
        } catch (e) {
            console.warn('[WikimediaService] Failed to load static spot images', e);
        }
    }

    // Fetch image URL for a spot by name
    async getSpotImage(spotName: string): Promise<string | null> {
        await this.staticLoadPromise; // Wait for prebuilt data

        // 1. Check Memory Cache (includes Static Data)
        if (this.cache.has(spotName)) {
            return this.cache.get(spotName) || null;
        }

        // 2. Check LocalStorage Cache
        const cacheKey = `img_cache_${spotName}`;
        const lsValue = localStorage.getItem(cacheKey);
        if (lsValue) {
            this.cache.set(spotName, lsValue);
            return lsValue;
        }

        // 3. NO API FALLBACK (Offline Mode)
        // User requested to rely strictly on prebuild/local data
        // console.warn(`[WikimediaService] Image not found locally: ${spotName}`);
        return null;
    }

    // Batch fetch images for multiple spots
    async getSpotImages(spotNames: string[]): Promise<Map<string, string>> {
        const results = new Map<string, string>();

        // Fetch in parallel with limited concurrency
        const batchSize = 5;
        for (let i = 0; i < spotNames.length; i += batchSize) {
            const batch = spotNames.slice(i, i + batchSize);
            const promises = batch.map(async name => {
                const url = await this.getSpotImage(name);
                if (url) {
                    results.set(name, url);
                }
            });
            await Promise.all(promises);
        }

        return results;
    }
}

export const wikimediaService = new WikimediaService();
