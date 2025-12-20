/**
 * Turn Detection Service
 * Detects turns from route coordinates for walking navigation
 */

import { Turn } from '../types';

type Coord = { lat: number; lng: number };

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function getDistanceInMeters(p1: Coord, p2: Coord): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calculate bearing (direction) between two points
 * Returns angle in degrees (0 = North, 90 = East, 180 = South, 270 = West)
 */
function getBearing(p1: Coord, p2: Coord): number {
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const lat1 = p1.lat * Math.PI / 180;
    const lat2 = p2.lat * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; // Normalize to 0-360
}

/**
 * Calculate turn angle between three consecutive points
 * Positive = right turn, Negative = left turn
 */
function getTurnAngle(p1: Coord, p2: Coord, p3: Coord): number {
    const bearing1 = getBearing(p1, p2);
    const bearing2 = getBearing(p2, p3);

    let angle = bearing2 - bearing1;

    // Normalize to -180 to 180
    if (angle > 180) angle -= 360;
    if (angle < -180) angle += 360;

    return angle;
}

/**
 * Get direction string from angle
 */
function getDirectionFromAngle(angle: number): '右' | '左' | '直進' | 'Uターン' {
    const absAngle = Math.abs(angle);

    if (absAngle < 20) return '直進';
    if (absAngle > 160) return 'Uターン';
    return angle > 0 ? '右' : '左';
}

/**
 * Generate instruction text
 */
function generateInstruction(direction: string, distanceToNext: number): string {
    if (direction === '直進') {
        return `${Math.round(distanceToNext)}m直進`;
    } else if (direction === 'Uターン') {
        return `Uターンして${Math.round(distanceToNext)}m`;
    } else {
        return `${direction}に曲がり${Math.round(distanceToNext)}m`;
    }
}

/**
 * Detect turns from a path of coordinates
 * @param path Array of coordinates
 * @param minTurnAngle Minimum angle to consider as a turn (default: 25 degrees)
 * @param minDistance Minimum distance between significant points (default: 10m)
 */
export function detectTurns(
    path: Coord[],
    minTurnAngle: number = 25,
    minDistance: number = 10
): Turn[] {
    if (path.length < 3) return [];

    const turns: Turn[] = [];
    let distanceFromStart = 0;

    // First, filter out points that are too close together
    const significantPoints: { coord: Coord; distanceFromStart: number }[] = [
        { coord: path[0], distanceFromStart: 0 }
    ];

    let accumulatedDistance = 0;
    for (let i = 1; i < path.length; i++) {
        const dist = getDistanceInMeters(path[i - 1], path[i]);
        accumulatedDistance += dist;

        if (accumulatedDistance >= minDistance || i === path.length - 1) {
            significantPoints.push({
                coord: path[i],
                distanceFromStart: significantPoints[significantPoints.length - 1].distanceFromStart + accumulatedDistance
            });
            accumulatedDistance = 0;
        }
    }

    // Now detect turns from significant points
    for (let i = 1; i < significantPoints.length - 1; i++) {
        const p1 = significantPoints[i - 1].coord;
        const p2 = significantPoints[i].coord;
        const p3 = significantPoints[i + 1].coord;

        const angle = getTurnAngle(p1, p2, p3);
        const absAngle = Math.abs(angle);

        // Only record significant turns
        if (absAngle >= minTurnAngle) {
            const direction = getDirectionFromAngle(angle);
            const distanceToNext = significantPoints[i + 1].distanceFromStart - significantPoints[i].distanceFromStart;

            turns.push({
                location: p2,
                direction,
                angle: Math.round(angle),
                distanceFromStart: Math.round(significantPoints[i].distanceFromStart),
                distanceToNext: Math.round(distanceToNext),
                instruction: generateInstruction(direction, distanceToNext)
            });
        }
    }

    return turns;
}

/**
 * Get the next turn from current position
 */
export function getNextTurn(
    currentLocation: Coord,
    turns: Turn[]
): { turn: Turn | null; distanceToTurn: number } {
    if (turns.length === 0) {
        return { turn: null, distanceToTurn: Infinity };
    }

    // Find the closest upcoming turn
    let minDistance = Infinity;
    let nextTurn: Turn | null = null;

    for (const turn of turns) {
        const distance = getDistanceInMeters(currentLocation, turn.location);
        if (distance < minDistance) {
            minDistance = distance;
            nextTurn = turn;
        }
    }

    return { turn: nextTurn, distanceToTurn: Math.round(minDistance) };
}

export default { detectTurns, getNextTurn };
