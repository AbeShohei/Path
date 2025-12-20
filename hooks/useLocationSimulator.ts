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
    const pathRef = useRef<Coordinate[]>([]);
    const segmentsRef = useRef<RouteSegment[]>([]);
    const currentIndexRef = useRef(0);
    const distanceInSegmentRef = useRef(0);
    const speedRef = useRef(1);
    const isRunningRef = useRef(false);
    const intervalRef = useRef<number | null>(null);
    const lastUIUpdateRef = useRef(0);

    const UPDATE_INTERVAL_MS = 100;
    const UI_UPDATE_INTERVAL_MS = 500; // Only update React state every 500ms

    const updatePosition = useCallback(() => {
        if (!isRunningRef.current) return;

        const path = pathRef.current;
        const segments = segmentsRef.current;
        if (path.length < 2) return;

        let currentIndex = currentIndexRef.current;
        let distanceTraveled = distanceInSegmentRef.current;

        // Get current transport mode and speed
        const segment = findSegmentForIndex(segments, currentIndex);
        const transportMode = segment?.type || 'WALK';
        const baseSpeed = SPEED_BY_MODE[transportMode] || SPEED_BY_MODE.WALK;

        // Calculate distance to travel
        const distanceThisTick = (baseSpeed * speedRef.current * UPDATE_INTERVAL_MS) / 1000;
        distanceTraveled += distanceThisTick;

        // Check if reached end
        if (currentIndex >= path.length - 1) {
            isRunningRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            setDisplayState({
                isRunning: false,
                currentPosition: path[path.length - 1],
                progress: 100,
                currentTransportMode: transportMode,
                speed: speedRef.current,
                currentSegmentIndex: segments.length - 1
            });
            return;
        }

        // Move through segments
        const segmentStart = path[currentIndex];
        const segmentEnd = path[currentIndex + 1];
        let segmentDistance = getDistanceInMeters(segmentStart, segmentEnd);

        while (distanceTraveled >= segmentDistance && currentIndex < path.length - 2) {
            distanceTraveled -= segmentDistance;
            currentIndex++;
            if (currentIndex < path.length - 1) {
                segmentDistance = getDistanceInMeters(path[currentIndex], path[currentIndex + 1]);
            }
        }

        currentIndexRef.current = currentIndex;
        distanceInSegmentRef.current = distanceTraveled;

        // Calculate position
        const startPoint = path[currentIndex];
        const endPoint = path[currentIndex + 1] || path[currentIndex];
        const currentSegmentDistance = getDistanceInMeters(startPoint, endPoint);
        const t = currentSegmentDistance > 0 ? Math.min(distanceTraveled / currentSegmentDistance, 1) : 0;
        const newPosition = interpolate(startPoint, endPoint, t);

        // Calculate progress
        const progress = Math.min(100, ((currentIndex + t) / (path.length - 1)) * 100);

        // Update React state only every UI_UPDATE_INTERVAL_MS
        const now = Date.now();
        if (now - lastUIUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
            lastUIUpdateRef.current = now;
            const currentSeg = findSegmentForIndex(segments, currentIndex);
            const currentSegIndex = findSegmentIndexForGlobalIndex(segments, currentIndex);
            setDisplayState({
                isRunning: true,
                currentPosition: newPosition,
                progress,
                currentTransportMode: currentSeg?.type || 'WALK',
                speed: speedRef.current,
                currentSegmentIndex: currentSegIndex
            });
        }
    }, []);

    const start = useCallback((segments: RouteSegment[]) => {
        // Build full path
        const fullPath: Coordinate[] = [];
        for (const segment of segments) {
            if (segment.path && segment.path.length > 0) {
                fullPath.push(...segment.path);
            }
        }

        if (fullPath.length < 2) return;

        // Stop existing
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Initialize refs
        pathRef.current = fullPath;
        segmentsRef.current = segments;
        currentIndexRef.current = 0;
        distanceInSegmentRef.current = 0;
        isRunningRef.current = true;
        lastUIUpdateRef.current = Date.now();

        // Set initial state
        setDisplayState({
            isRunning: true,
            currentPosition: fullPath[0],
            progress: 0,
            currentTransportMode: segments[0]?.type || 'WALK',
            speed: speedRef.current,
            currentSegmentIndex: 0
        });

        // Start loop
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
        speedRef.current = Math.max(0.5, Math.min(10, speed));
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
