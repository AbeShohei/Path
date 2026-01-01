import { useState, useEffect, useRef } from 'react';
import { Coordinates, RouteSegment, Spot } from '../types';
import {
    fetchSpotGuide,
    getDistance,
    GuideContent
} from '../services/guideService';

interface UseGuideSystemProps {
    coords: Coordinates | null;
    currentSegment: RouteSegment | null;
    spots: Spot[];
    isNavigating: boolean;
}

export function useGuideSystem({
    coords,
    currentSegment,
    spots,
    isNavigating
}: UseGuideSystemProps) {
    const [nearbyGuides, setNearbyGuides] = useState<GuideContent[]>([]);
    const [nearbySpots, setNearbySpots] = useState<Spot[]>([]); // For instant pin display
    const [loading, setLoading] = useState(false);

    // Cache for already-fetched guides (persists across checks)
    const guideCache = useRef<Map<string, GuideContent>>(new Map());

    // Refs to hold latest values for the interval callback
    const coordsRef = useRef(coords);
    const spotsRef = useRef(spots);
    const currentSegmentRef = useRef(currentSegment);

    // Update refs on every render
    useEffect(() => {
        coordsRef.current = coords;
        spotsRef.current = spots;
        currentSegmentRef.current = currentSegment;
    }, [coords, spots, currentSegment]);

    useEffect(() => {
        if (!isNavigating) {
            setNearbyGuides([]);
            setNearbySpots([]);
            setLoading(false);
            return;
        }

        const checkProximity = async () => {
            const currentCoords = coordsRef.current;
            const currentSpots = spotsRef.current;
            const segment = currentSegmentRef.current;

            if (!currentCoords || !segment) return;

            // 1. Find spots within proximity radius
            const PROXIMITY_RADIUS = 50.0; // Keep 50km for showing all route spots
            const closeSpots = currentSpots.filter(spot => {
                const distKm = getDistance(currentCoords, spot.location) / 1000;
                return distKm <= PROXIMITY_RADIUS && !spot.name.includes('案内');
            });

            // INSTANT: Set nearby spots immediately for pin display (NO waiting for guides)
            if (closeSpots.length > 0) {
                closeSpots.sort((a, b) => {
                    const dA = getDistance(currentCoords, a.location);
                    const dB = getDistance(currentCoords, b.location);
                    return dA - dB;
                });
                setNearbySpots(closeSpots);
            } else {
                setNearbySpots([]);
                setNearbyGuides([]);
                return;
            }

            // 2. Prepare next point for guide generation
            let nextPoint: Coordinates | undefined;
            if (segment.path && segment.path.length > 0) {
                const end = segment.path[segment.path.length - 1];
                nextPoint = { latitude: end.lat, longitude: end.lng };
            }

            // 3. Check which spots need guide fetching (not in cache)
            const spotsNeedingFetch = closeSpots.filter(s => !guideCache.current.has(s.id));

            if (spotsNeedingFetch.length > 0) {
                setLoading(true);
            }

            // 4. PROGRESSIVE LOADING: Fetch guides one by one and update state immediately
            for (const spot of spotsNeedingFetch) {
                try {
                    // Small delay between calls for rate limit
                    if (guideCache.current.size > 0) {
                        await new Promise(r => setTimeout(r, 300)); // Reduced from 500ms
                    }

                    const guide = await fetchSpotGuide(spot, currentCoords, nextPoint);
                    guideCache.current.set(spot.id, guide);

                    // Update guides immediately after each fetch (progressive)
                    const currentGuides = closeSpots
                        .map(s => guideCache.current.get(s.id))
                        .filter((g): g is GuideContent => !!g);
                    setNearbyGuides(currentGuides);

                } catch (e) {
                    console.warn("Skipping guide for", spot.name, "due to error/limit");
                }
            }

            // 5. Final update with all cached guides in sorted order
            const sortedGuides = closeSpots
                .map(s => guideCache.current.get(s.id))
                .filter((g): g is GuideContent => !!g);
            setNearbyGuides(sortedGuides);
            setLoading(false);
        };

        const interval = setInterval(checkProximity, 5000);
        checkProximity(); // Initial check

        return () => clearInterval(interval);

    }, [isNavigating]);

    return {
        nearbyGuides,
        nearbySpots, // NEW: For instant pin display
        loading
    };
}
