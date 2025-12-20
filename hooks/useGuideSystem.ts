import { useState, useEffect, useRef } from 'react';
import { Coordinates, RouteSegment, Spot } from '../types';
import {
    GuideContent,
    TRIGGER_CONFIG,
    filterRelevantSpots,
    generateTransitGuide,
    generateWalkGuide,
    generateTourismGuide,
    GuideContext,
    calculateRelativeDirection
} from '../services/guideService';

interface UseGuideSystemProps {
    coords: Coordinates | null;
    currentSegment: RouteSegment | null;
    nextSegment: RouteSegment | null;
    routeSegments: RouteSegment[];
    spots: Spot[];
    isNavigating: boolean;
    onPlayGuide: (text: string) => void;
}

// Helper to avoid import issues if not exported
function getDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371000;
    const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGuideSystem({
    coords,
    currentSegment,
    nextSegment,
    routeSegments,
    spots,
    isNavigating,
    onPlayGuide
}: UseGuideSystemProps) {
    const [activeGuide, setActiveGuide] = useState<GuideContent | null>(null);
    const [nearbySpots, setNearbySpots] = useState<Spot[]>([]);

    // Track triggered IDs to prevent repetition
    const triggeredIdsRef = useRef<Set<string>>(new Set());
    // Track processed Tourism IDs to limit Dify calls (or mock calls)
    const processedTourismIdsRef = useRef<Set<string>>(new Set());

    // Reset state when navigation stops
    useEffect(() => {
        if (!isNavigating) {
            triggeredIdsRef.current.clear();
            processedTourismIdsRef.current.clear();
            setActiveGuide(null);
            setNearbySpots([]);
        }
    }, [isNavigating]);

    // Main Guide Loop
    useEffect(() => {
        if (!isNavigating || !coords || !currentSegment) return;

        const checkTriggers = async () => {
            // 1. TRANSIT Logic (Bus/Train alighting)
            if (currentSegment.type === 'TRAIN' || currentSegment.type === 'SUBWAY' || currentSegment.type === 'BUS') {
                // Calculate distance to destination (last point of path)
                let distToDest = 99999;
                if (currentSegment.path && currentSegment.path.length > 0) {
                    const endPoint = currentSegment.path[currentSegment.path.length - 1];
                    distToDest = getDistance(coords, { latitude: endPoint.lat, longitude: endPoint.lng });
                }

                const transitGuide = generateTransitGuide(currentSegment, nextSegment, distToDest);
                if (transitGuide && !triggeredIdsRef.current.has(transitGuide.id)) {
                    triggeredIdsRef.current.add(transitGuide.id);
                    setActiveGuide(transitGuide);
                    onPlayGuide(transitGuide.text);
                    return; // Priority handling: Transit first
                }
            }

            // 2. WALKING Logic (Turns)
            if (currentSegment.type === 'WALK' && currentSegment.path && currentSegment.path.length > 0) {
                // Simplified: Check distance to end of segment (assumed turn or goal)
                const endOfSegment = currentSegment.path[currentSegment.path.length - 1];
                const distToEnd = getDistance(coords, { latitude: endOfSegment.lat, longitude: endOfSegment.lng });

                // Determine direction (mocked for now, real implementation needs turn angle)
                const direction = nextSegment ? 'right' : ''; // Mock: defaulting to 'right' for demo if not last leg
                if (direction) {
                    const walkGuide = generateWalkGuide(currentSegment, distToEnd, direction);
                    if (walkGuide && !triggeredIdsRef.current.has(walkGuide.id)) {
                        triggeredIdsRef.current.add(walkGuide.id);
                        setActiveGuide(walkGuide);
                        onPlayGuide(walkGuide.text);
                        return;
                    }
                }
            }

            // 3. TOURISM Logic (Lower priority)
            // Filter spots based on simple rules
            const relevantSpots = filterRelevantSpots(coords, spots, 20);
            setNearbySpots(relevantSpots);

            for (const spot of relevantSpots) {
                const isTransit = currentSegment.type === 'TRAIN' || currentSegment.type === 'SUBWAY' || currentSegment.type === 'BUS';
                // Using 'prepare' distance for transit as 'play' for now to catch wider area
                const triggerThreshold = isTransit ? TRIGGER_CONFIG.TRANSIT.SPOT.play : TRIGGER_CONFIG.WALK.SPOT.play;

                const dist = getDistance(coords, spot.location);

                if (dist < triggerThreshold && !processedTourismIdsRef.current.has(spot.id)) {
                    processedTourismIdsRef.current.add(spot.id);

                    // Generate content using Adaptive Context
                    try {
                        let directionToSpot: 'LEFT' | 'RIGHT' | 'FRONT' | 'BACK' | undefined = undefined;

                        // Calculate relative direction if we have a valid path forward
                        // Finding the "next" point on the path relative to current coords
                        let nextPoint: Coordinates | null = null;
                        if (currentSegment.path && currentSegment.path.length > 0) {
                            // Find closest point on path, then take the next one
                            // Simple approximation: just take the last point (destination) for direction general reference?
                            // Better: Find the first point in path that is somewhat ahead.
                            // For this MVP, let's use the segment's end point as the "heading" vector reference if start point is missing
                            // refined: projected heading.
                            const endPoint = currentSegment.path[currentSegment.path.length - 1];
                            nextPoint = { latitude: endPoint.lat, longitude: endPoint.lng };
                        }

                        if (coords && nextPoint) {
                            directionToSpot = calculateRelativeDirection(coords, nextPoint, spot.location);
                        }

                        const guideContext: GuideContext = {
                            mode: isTransit ? 'TRANSIT' : 'WALK',
                            status: 'RIDING',
                            current_location: {
                                latitude: coords.latitude,
                                longitude: coords.longitude
                            },
                            route_summary: {
                                origin: routeSegments[0]?.text || '出発地',
                                destination: routeSegments[routeSegments.length - 1]?.text || '目的地'
                            },
                            current_segment_details: {
                                text: currentSegment.text,
                                type: currentSegment.type,
                                line_name: currentSegment.text, // Often contains line name
                                direction: currentSegment.direction,
                                destination: currentSegment.direction, // Using direction (bound for) as destination
                                departure_time: currentSegment.departureTime,
                                arrival_time: currentSegment.arrivalTime,
                                gateway: currentSegment.gateway,
                                getoff: currentSegment.getoff,
                                company_name: currentSegment.companyName,
                                stop_count: currentSegment.stopCount
                            },
                            target_spot_details: {
                                // description: spot.description, // Removed
                                relative_direction: directionToSpot
                            }
                        };

                        // Update status if close to end of segment
                        let distToDest = 99999;
                        if (currentSegment.path && currentSegment.path.length > 0) {
                            const endPoint = currentSegment.path[currentSegment.path.length - 1];
                            distToDest = getDistance(coords, { latitude: endPoint.lat, longitude: endPoint.lng });
                            if (distToDest < 500) guideContext.status = 'ALIGHTING';
                        }

                        const guide = await generateTourismGuide(spot, guideContext);

                        if (!triggeredIdsRef.current.has(guide.id)) {
                            triggeredIdsRef.current.add(guide.id);
                            setActiveGuide(guide);
                            onPlayGuide(guide.text);
                        }
                    } catch (e) {
                        console.error("Failed to generate tourism guide", e);
                    }
                }
            }
        };

        const intervalId = setInterval(checkTriggers, 2000); // Check every 2 seconds
        return () => clearInterval(intervalId);

    }, [coords, currentSegment, nextSegment, isNavigating, onPlayGuide, spots]);

    return {
        activeGuide,
        nearbySpots
    };
}
