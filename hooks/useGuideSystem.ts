import { useState, useEffect, useRef } from 'react';
import { Coordinates, RouteSegment, Spot } from '../types';
import {
    fetchSpotGuide,
    getDistance,
    GuideContent
} from '../services/guideService';
import { isAIAvailable } from '../services/aiService';

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

                // 2. Identify spots needing fetch
                // Exclude cached AND failed spots (temporary ignore)
                const spotsNeedingFetch = closeSpots.filter(s =>
                    !guideCache.current.has(s.id) && !failedSpots.current.has(s.id)
                );

                const now = Date.now();
                const aiAvailable = isAIAvailable();

                // 3. Fetching Strategy
                if (spotsNeedingFetch.length > 0) {
                    if (!aiAvailable) {
                        // NO AI: Process ALL spots INSTANTLY with basic info
                        // No rate limiting, no waiting
                        for (const spot of spotsNeedingFetch) {
                            try {
                                const guide = await fetchSpotGuide(spot);
                                guideCache.current.set(spot.id, guide);
                            } catch (e) {
                                // Should not fail for basic info, but log just in case
                                console.warn("Basic guide failed:", spot.name, e);
                            }
                        }
                        // All spots processed, no more loading
                        setLoading(false);
                    } else {
                        // AI AVAILABLE: Use rate limiting (4s between API calls = ~15 RPM, under 20 RPM limit)
                        if (now - lastFetchTime.current >= 4000) {
                            setLoading(true);
                            const spot = spotsNeedingFetch[0];
                            lastFetchTime.current = Date.now();

                            try {
                                const guide = await fetchSpotGuide(spot);
                                guideCache.current.set(spot.id, guide);
                                failedSpots.current.delete(spot.id);
                            } catch (e) {
                                console.warn("Guide generation failed, backing off:", spot.name);
                                failedSpots.current.add(spot.id);
                                setTimeout(() => {
                                    failedSpots.current.delete(spot.id);
                                }, 120000);
                            }
                        }
                        setLoading(spotsNeedingFetch.length > 0);
                    }
                }

                // 5. Update State
                const currentGuides = closeSpots
                    .map(s => guideCache.current.get(s.id))
                    .filter((g): g is GuideContent => !!g);
                setNearbyGuides(currentGuides);

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
