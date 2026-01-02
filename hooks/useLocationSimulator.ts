/**
 * Location Simulator Hook
 * Simulates GPS movement along a route path for testing navigation
 * Uses refs for internal state to prevent excessive re-renders
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { RouteSegment } from '../types';

interface Coordinate {
    lat: number;
    lng: number;
}

export interface SimulatorState {
    isRunning: boolean;
    currentPosition: Coordinate | null;
    progress: number;
    currentTransportMode: string;
    speed: number;
    currentSegmentIndex: number;
}

// Speed constants in m/s
const SPEED_BY_MODE: Record<string, number> = {
    WALK: 1.3,
    TRAIN: 25,
    SUBWAY: 15,
    BUS: 8
};

// Calculate distance between two coordinates in meters
function getDistanceInMeters(coord1: Coordinate, coord2: Coordinate): number {
    const R = 6371000;
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolate(coord1: Coordinate, coord2: Coordinate, t: number): Coordinate {
    return {
        lat: coord1.lat + (coord2.lat - coord1.lat) * t,
        lng: coord1.lng + (coord2.lng - coord1.lng) * t
    };
}

function findSegmentIndexForGlobalIndex(segments: RouteSegment[], globalIndex: number): number {
    let accumulated = 0;
    for (let i = 0; i < segments.length; i++) {
        const pathLength = segments[i].path?.length || 0;
        if (globalIndex < accumulated + pathLength) {
            return i;
        }
        accumulated += pathLength;
    }
    return segments.length - 1;
}

function findSegmentForIndex(segments: RouteSegment[], globalIndex: number): RouteSegment | null {
    const idx = findSegmentIndexForGlobalIndex(segments, globalIndex);
    return segments[idx] || null;
}

export function useLocationSimulator() {
    // Only this state triggers React re-renders
    const [displayState, setDisplayState] = useState<SimulatorState>({
        isRunning: false,
        currentPosition: null,
        progress: 0,
        currentTransportMode: 'WALK',
        speed: 1,
        currentSegmentIndex: 0
    });

    // All internal state uses refs (no re-renders)
    // State for global distance tracking
    const pathRef = useRef<Coordinate[]>([]);
    const segmentsRef = useRef<RouteSegment[]>([]);
    const pathDistancesRef = useRef<number[]>([]); // Cumulative distance at each point
    const totalDistanceRef = useRef(0);
    const travelledDistanceRef = useRef(0); // Current progress in meters
    const speedRef = useRef(1);
    const isRunningRef = useRef(false);
    const intervalRef = useRef<number | null>(null);
    const lastUIUpdateRef = useRef(0);
    const lastTickRef = useRef(0);

    const UPDATE_INTERVAL_MS = 50; // Faster tick for smoother high speed
    const UI_UPDATE_INTERVAL_MS = 200;

    const updatePosition = useCallback(() => {
        if (!isRunningRef.current) return;

        const now = Date.now();
        const deltaMs = now - lastTickRef.current;
        lastTickRef.current = now;

        const path = pathRef.current;
        const dists = pathDistancesRef.current;
        const total = totalDistanceRef.current;

        if (path.length < 2) return;

        // Calculate distance to travel this tick
        const tickDist = (speedRef.current * (deltaMs / 1000));
        travelledDistanceRef.current += tickDist;

        // Check end condition
        if (travelledDistanceRef.current >= total) {
            travelledDistanceRef.current = total;
            isRunningRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            // Final update
            setDisplayState({
                isRunning: false,
                currentPosition: path[path.length - 1],
                progress: 100,
                currentTransportMode: 'WALK', // Or retrieve from segment
                speed: speedRef.current,
                currentSegmentIndex: segmentsRef.current.length - 1
            });
            return;
        }

        // Find current segment using cumulative distances
        // dists[i] <= travelled < dists[i+1]
        let idx = 0;
        // Optimization: Start search from last known index to save time? 
        // For now, simple loop is fast enough for <1000 points.
        // Or binary search if needed. Linear scan is robust.
        while (idx < dists.length - 2 && travelledDistanceRef.current >= dists[idx + 1]) {
            idx++;
        }

        const segmentStartDist = dists[idx];
        const segmentEndDist = dists[idx + 1];
        const segmentLen = segmentEndDist - segmentStartDist;

        // Normalize t (0..1)
        const distInSegment = travelledDistanceRef.current - segmentStartDist;
        const t = segmentLen > 0 ? Math.min(Math.max(distInSegment / segmentLen, 0), 1) : 0;

        const startPoint = path[idx];
        const endPoint = path[idx + 1];
        const newPosition = interpolate(startPoint, endPoint, t);

        // Find route segment index
        // This maps the localized path index 'idx' back to the route segment
        const segmentIndex = findSegmentIndexForGlobalIndex(segmentsRef.current, idx);
        const currentSeg = segmentsRef.current[segmentIndex];

        // UI Update
        if (now - lastUIUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
            lastUIUpdateRef.current = now;
            setDisplayState({
                isRunning: true,
                currentPosition: newPosition,
                progress: (travelledDistanceRef.current / total) * 100,
                currentTransportMode: currentSeg?.type || 'WALK',
                speed: speedRef.current,
                currentSegmentIndex: segmentIndex
            });
        }

    }, []);

    const start = useCallback((segments: RouteSegment[]) => {
        // Build full path and cumulative distances
        const fullPath: Coordinate[] = [];
        const dists: number[] = [0];
        let runningTotal = 0;

        for (const segment of segments) {
            if (segment.path && segment.path.length > 0) {
                // If connecting from previous segment, ensure continuity?
                // Usually segment.path is standalone. We concat.
                // But duplicate points (end of A == start of B) should be handled.
                // Ideally we filter duplicates, but for now we just concat.
                // The linear scan handles 0-length segments fine (skips them).
                for (let i = 0; i < segment.path.length; i++) {
                    const coord = segment.path[i];
                    // Avoid duplicate adjacent point if we essentially appended
                    if (fullPath.length > 0) {
                        const last = fullPath[fullPath.length - 1];
                        let d = getDistanceInMeters(last, coord);
                        // Only add distance if it's a new point or > 0 distance
                        // If d is 0, we can still add the point, but distance doesn't increase.

                        // FIX: If this is the start of a new segment (i === 0), do not add distance.
                        // This prevents "flying" between the end of one segment and the start of another
                        // if they are not perfectly connected. We want instant snap.
                        if (i === 0) {
                            d = 0;
                        }

                        runningTotal += d;
                        dists.push(runningTotal);
                    }
                    fullPath.push(coord);
                }
            }
        }

        if (fullPath.length < 2) return;

        // Reset state
        if (intervalRef.current) clearInterval(intervalRef.current);

        pathRef.current = fullPath;
        pathDistancesRef.current = dists;
        totalDistanceRef.current = runningTotal;
        segmentsRef.current = segments;
        travelledDistanceRef.current = 0;
        speedRef.current = speedRef.current || 1; // Preserve speed or default
        isRunningRef.current = true;
        lastTickRef.current = Date.now();
        lastUIUpdateRef.current = 0;

        setDisplayState({
            isRunning: true,
            currentPosition: fullPath[0],
            progress: 0,
            currentTransportMode: segments[0]?.type || 'WALK',
            speed: speedRef.current,
            currentSegmentIndex: 0
        });

        intervalRef.current = window.setInterval(updatePosition, UPDATE_INTERVAL_MS);
    }, [updatePosition]);

    const stop = useCallback(() => {
        isRunningRef.current = false;
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setDisplayState({
            isRunning: false,
            currentPosition: null,
            progress: 0,
            currentTransportMode: 'WALK',
            speed: 1,
            currentSegmentIndex: 0
        });
    }, []);

    const pause = useCallback(() => {
        isRunningRef.current = false;
        setDisplayState(prev => ({ ...prev, isRunning: false }));
    }, []);

    const resume = useCallback(() => {
        isRunningRef.current = true;
        setDisplayState(prev => ({ ...prev, isRunning: true }));
    }, []);

    const setSpeed = useCallback((speed: number) => {
        speedRef.current = Math.max(0.5, Math.min(100, speed));
        setDisplayState(prev => ({ ...prev, speed: speedRef.current }));
    }, []);

    // Cleanup
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return {
        state: displayState,
        start,
        stop,
        pause,
        resume,
        setSpeed
    };
}

export default useLocationSimulator;
