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

    // Fetch image URL for a spot by name
    async getSpotImage(spotName: string): Promise<string | null> {
        // Check cache first
        if (this.cache.has(spotName)) {
            return this.cache.get(spotName) || null;
        }

        try {
            const query = encodeURIComponent(spotName);
            const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${query}&gsrlimit=3&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=600&format=json&origin=*`;

            const response = await fetch(url);
            if (!response.ok) {
                console.warn('Wikimedia API request failed:', response.statusText);
                return null;
            }

            const data = await response.json();

            if (!data.query || !data.query.pages) {
                return null;
            }

            // Find the first image result
            const pages = Object.values(data.query.pages) as any[];
            for (const page of pages) {
                if (page.imageinfo && page.imageinfo.length > 0) {
                    const imageInfo = page.imageinfo[0];
                    // Prefer thumbnail URL (sized appropriately) over original
                    const imageUrl = imageInfo.thumburl || imageInfo.url;

                    if (imageUrl) {
                        // Cache the result
                        this.cache.set(spotName, imageUrl);
                        return imageUrl;
                    }
                }
            }

            return null;
        } catch (error) {
            console.warn('Wikimedia image fetch error for', spotName, error);
            return null;
        }
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
