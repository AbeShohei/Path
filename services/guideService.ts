import { Spot, Coordinates } from '../types';
import { generateGuideContent, GuideContent } from './aiService';
import { wikimediaService } from './wikimediaService';

// --- Types ---
// Re-export GuideContent from aiService to ensure consistency
export type { GuideContent } from './aiService';

const GUIDE_CACHE_KEY = 'kyoto_guide_cache_v5__prompt_debug';

interface GuideCache {
    [spotId: string]: GuideContent;
}

// --- Helper: Distance ---

export function getDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371000;
    const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Cache Management ---

function loadCache(): GuideCache {
    try {
        const json = localStorage.getItem(GUIDE_CACHE_KEY);
        return json ? JSON.parse(json) : {};
    } catch (e) {
        console.warn('Failed to load guide cache', e);
        return {};
    }
}

function saveCache(cache: GuideCache) {
    try {
        localStorage.setItem(GUIDE_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.warn('Failed to save guide cache', e);
    }
}

// --- Main Orchestrator ---

export async function fetchSpotGuide(
    spot: Spot
): Promise<GuideContent> {
    const cache = loadCache();

    // 1. Check Cache
    if (cache[spot.id]) {
        const cachedGuide = cache[spot.id];

        // Invalid Cache Check: If it contains the fallback error message, treat as missing
        if (cachedGuide.text.includes('申し訳ありませんが') || cachedGuide.text.includes('ガイド情報を生成できませんでした')) {
            // Fall through to fetch
        } else {
            // Image Recovery: If image is missing, try to fetch it (it might be in spot_images.json now)
            if (!cachedGuide.imageUrl) {
                const img = await wikimediaService.getSpotImage(spot.name);
                if (img) {
                    cachedGuide.imageUrl = img;
                    // Update cache with new image
                    cache[spot.id] = cachedGuide;
                    saveCache(cache);
                }
            }

            return cachedGuide;
        }
    }

    // 2. Generate Content (AI / Mock)
    const guide = await generateGuideContent(spot);

    // 4. Fetch Image (Wikimedia)
    const imageUrl = await wikimediaService.getSpotImage(spot.name);
    if (imageUrl) {
        guide.imageUrl = imageUrl;
    }

    // 5. Save to Cache
    cache[spot.id] = guide;
    saveCache(cache);

    return guide;
}


