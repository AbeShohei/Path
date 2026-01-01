import { Spot, Coordinates } from '../types';
import { generateGuideContent, GuideContent } from './geminiService';
import { wikimediaService } from './wikimediaService';

// --- Types ---
// Re-export GuideContent from geminiService to ensure consistency
export type { GuideContent } from './geminiService';

const GUIDE_CACHE_KEY = 'kyoto_guide_cache_v1';

interface GuideCache {
    [spotId: string]: GuideContent;
}

// --- Helper: Direction ---

/**
 * Calculates relative direction of a target from current heading.
 * Returns only LEFT or RIGHT based on which side of the path the spot is.
 */
export function calculateRelativeDirection(
    current: Coordinates,
    next: Coordinates,
    target: Coordinates
): 'LEFT' | 'RIGHT' {
    const getBearing = (start: Coordinates, end: Coordinates): number => {
        const startLat = start.latitude * Math.PI / 180;
        const startLng = start.longitude * Math.PI / 180;
        const endLat = end.latitude * Math.PI / 180;
        const endLng = end.longitude * Math.PI / 180;

        const y = Math.sin(endLng - startLng) * Math.cos(endLat);
        const x = Math.cos(startLat) * Math.sin(endLat) -
            Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
        const θ = Math.atan2(y, x);
        return (θ * 180 / Math.PI + 360) % 360;
    };

    const heading = getBearing(current, next);
    const targetBearing = getBearing(current, target);

    let diff = targetBearing - heading;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;

    // Positive diff = target is to the right; Negative = left
    return diff >= 0 ? 'RIGHT' : 'LEFT';
}

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
    spot: Spot,
    currentLocation?: Coordinates,
    nextLocation?: Coordinates
): Promise<GuideContent> {
    const cache = loadCache();

    // 1. Check Cache
    // 1. Check Cache
    if (cache[spot.id]) {
        const cachedGuide = cache[spot.id];

        // Dynamic Context Update (Direction)
        if (currentLocation && nextLocation) {
            cachedGuide.direction = calculateRelativeDirection(currentLocation, nextLocation, spot.location);
        }

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

    // 2. Prepare Context
    // Calculate relative direction for the prompt
    let direction: 'LEFT' | 'RIGHT' | 'FRONT' | 'BACK' | undefined = undefined;
    if (currentLocation && nextLocation) {
        direction = calculateRelativeDirection(currentLocation, nextLocation, spot.location);
    }

    // 3. Generate Content (AI / Mock)
    const guide = await generateGuideContent(spot, direction);

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


