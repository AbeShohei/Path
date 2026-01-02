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

    // Rate Limiting & Error Handling
    const lastFetchTime = useRef(0);
    const failedSpots = useRef<Set<string>>(new Set());
    const isProcessing = useRef(false);

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
            // Prevent overlapping checks
            if (isProcessing.current) return;
            isProcessing.current = true;

            try {
                const currentCoords = coordsRef.current;
                const currentSpots = spotsRef.current;
                const segment = currentSegmentRef.current;

                if (!currentCoords || !segment) {
                    isProcessing.current = false;
                    return;
                }

                // 1. Find spots within proximity radius
                const PROXIMITY_RADIUS = 50.0; // Keep 50km for showing all route spots
                const closeSpots = currentSpots.filter(spot => {
                    const distKm = getDistance(currentCoords, spot.location) / 1000;
                    return distKm <= PROXIMITY_RADIUS && !spot.name.includes('案内');
                });

                // INSTANT: Set nearby spots immediately for pin display
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
                    isProcessing.current = false;
                    return;
                }

                // 2. Prepare next point
                let nextPoint: Coordinates | undefined;
                if (segment.path && segment.path.length > 0) {
                    const end = segment.path[segment.path.length - 1];
                    nextPoint = { latitude: end.lat, longitude: end.lng };
                }

                // 3. Identify spots needing fetch
                // Exclude cached AND failed spots (temporary ignore)
                const spotsNeedingFetch = closeSpots.filter(s =>
                    !guideCache.current.has(s.id) && !failedSpots.current.has(s.id)
                );

                // console.log('Checking proximity...', closeSpots.length, 'spots nearby');

                // 4. Rate Limited Fetching
                // Only proceed if enough time has passed since last fetch (10000ms strict global limit)
                const now = Date.now();
                if (spotsNeedingFetch.length > 0 && now - lastFetchTime.current >= 10000) {
                    // console.log('Spots needing fetch:', spotsNeedingFetch.map(s => s.name));
                    setLoading(true);

                    // Take strictly 1 spot
                    const spot = spotsNeedingFetch[0];
                    // console.log(`Processing 1 spot: ${spot.name}`);

                    lastFetchTime.current = Date.now(); // Mark time BEFORE fetch to prevent parallel starts

                    try {
                        const guide = await fetchSpotGuide(spot, currentCoords, nextPoint);
                        guideCache.current.set(spot.id, guide);
                        // Clear from failed spots if it succeeds (in case it was there somehow)
                        failedSpots.current.delete(spot.id);
                    } catch (e) {
                        console.warn("Guide generation failed, backing off:", spot.name);
                        // Add to failed spots to prevent immediate retry
                        failedSpots.current.add(spot.id);
                        // Remove from blacklist after 2 minutes to retry
                        setTimeout(() => {
                            failedSpots.current.delete(spot.id);
                        }, 120000);
                    }
                } else if (spotsNeedingFetch.length > 0) {
                    // console.log(`Waiting for rate limit cooldown... (${10000 - (now - lastFetchTime.current)}ms remaining)`);
                }

                // 5. Update State
                const currentGuides = closeSpots
                    .map(s => guideCache.current.get(s.id))
                    .filter((g): g is GuideContent => !!g);
                setNearbyGuides(currentGuides);

                // Loading is only true if we are actively waiting on the queue
                setLoading(spotsNeedingFetch.length > 0);

            } finally {
                isProcessing.current = false;
            }
        };

        const interval = setInterval(checkProximity, 1000); // Check every second, but respect strict 5s limit inside
        checkProximity();

        return () => clearInterval(interval);

    }, [isNavigating]);

    return {
        nearbyGuides,
        nearbySpots, // NEW: For instant pin display
        loading
    };
}
