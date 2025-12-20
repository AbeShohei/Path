import { RouteSegment, Spot, Coordinates } from '../types';
import { getCongestionLevel } from './humanFlowService';

// --- Types ---

export type GuideCategory = 'TRANSIT' | 'WALK' | 'TOURISM';
export type GuidePriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface GuideContent {
    id: string;
    text: string;
    category: GuideCategory;
    priority: GuidePriority;
    timestamp: number;
    spotId?: string; // Linked spot if any
}

export interface GuideTriggerConfig {
    prepareDistance: number; // Meters before point to generate/fetch
    playDistance: number;    // Meters before point to play
}

// Dify Flattened Payload Structure
export type TriggerType =
    | 'NAVIGATION_START'
    | 'WALK_GUIDE'
    | 'TRANSIT_DEPART'
    | 'TRANSIT_RIDING'
    | 'TRANSIT_ALIGHTING'
    | 'SPOT_GUIDE'
    | 'ERROR_OFF_ROUTE'
    | 'ERROR_DELAY';

export interface DifyGuidePayload {
    // --- Control ---
    trigger_type: TriggerType;

    // --- Basic Context ---
    user_mode?: 'TRANSIT' | 'WALK' | 'STAY';
    current_time?: string;

    // --- Navigation Info (Functional) ---
    nav_origin?: string;
    nav_destination?: string;
    nav_line_name?: string;       // e.g. "市営バス205系統"
    nav_bound_for?: string;       // e.g. "金閣寺道"
    nav_platform?: string;        // e.g. "B3乗り場"
    nav_stops_remaining?: number;
    nav_getoff_door?: string;     // e.g. "後ろ"
    nav_gateway?: string;         // e.g. "中央口"
    nav_turn_direction?: string;  // "右", "左", "直進"
    nav_distance_remaining?: string; // e.g. "500m"

    // --- Tourism Info (Emotional) ---
    spot_name?: string;           // Target spot name
    spot_search_query?: string;   // Keyword for RAG (e.g. "金閣寺 歴史")
    spot_direction?: string;      // "右手", "左手"
    nearby_spots_data?: string;   // JSON string of en-route spots (excluding immediate vicinity)

    // --- Error/Status ---
    error_message?: string;
}

export interface GuideContext {
    mode: 'TRANSIT' | 'WALK' | 'STAY';
    status: 'RIDING' | 'ALIGHTING' | 'TURN' | 'NORMAL';
    current_location: {
        latitude: number;
        longitude: number;
    };
    // ... other fields kept optional for backward compatibility if code uses them
}


// Configuration by mode
export const TRIGGER_CONFIG = {
    WALK: {
        TURN: { prepare: 50, play: 30 }, // Widen play distance
        DESTINATION: { prepare: 100, play: 40 },
        SPOT: { prepare: 100, play: 30 } // For tourism spots
    },
    TRANSIT: {
        ALIGHTING: { prepare: 1500, play: 1000 }, // Play much earlier (1km) to ensure it triggers
        NEXT_STOP: { prepare: 1000, play: 500 },
        SPOT: { prepare: 800, play: 300 } // Scenic view from train window
    }
};

// --- Helpers ---

export function getDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371000; // meters
    const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculates the bearing between two points (in degrees)
 */
function getBearing(start: Coordinates, end: Coordinates): number {
    const startLat = start.latitude * Math.PI / 180;
    const startLng = start.longitude * Math.PI / 180;
    const endLat = end.latitude * Math.PI / 180;
    const endLng = end.longitude * Math.PI / 180;

    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) -
        Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    const θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360; // 0-360 degrees
}

/**
 * Calculates relative direction of a target from current heading
 */
export function calculateRelativeDirection(
    current: Coordinates,
    next: Coordinates,
    target: Coordinates
): 'LEFT' | 'RIGHT' | 'FRONT' | 'BACK' {
    const heading = getBearing(current, next);
    const targetBearing = getBearing(current, target);

    let diff = targetBearing - heading;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;

    if (Math.abs(diff) <= 45) return 'FRONT';
    if (Math.abs(diff) >= 135) return 'BACK';
    return diff > 0 ? 'RIGHT' : 'LEFT';
}

// --- Core Logic ---

/**
 * Filter tourist spots based on distance rules
 * < 5 min (approx 400m) -> 50m radius
 * 5-15 min (approx 1200m) -> 100m radius
 * > 15 min -> 200m radius
 */
export function filterRelevantSpots(
    currentLocation: Coordinates,
    spots: Spot[],
    remainingTimeMinutes: number
): Spot[] {
    let searchRadius = 200; // Default max

    if (remainingTimeMinutes < 5) {
        searchRadius = 50;
    } else if (remainingTimeMinutes < 15) {
        searchRadius = 100;
    }

    return spots.filter(spot => {
        // Exclude "Information/Guide" centers as requested
        if (spot.name.includes('案内')) return false;

        const dist = getDistance(currentLocation, spot.location);
        return dist <= searchRadius;
    });
}

/**
 * Generate local template guidance (Level 1)
 */
export function generateTransitGuide(
    segment: RouteSegment,
    nextSegment: RouteSegment | null,
    distanceToNext: number
): GuideContent | null {
    const isTrain = segment.type === 'TRAIN' || segment.type === 'SUBWAY';
    const isBus = segment.type === 'BUS';

    if (!isTrain && !isBus) return null;

    // Alighting trigger (Approaching destination)
    // Here we assume distanceToNext is distance to the segment's destination
    if (distanceToNext <= TRIGGER_CONFIG.TRANSIT.ALIGHTING.play && distanceToNext > TRIGGER_CONFIG.TRANSIT.ALIGHTING.play - 200) {
        // Play Trigger
        const stationName = segment.direction || '目的地';
        const transferInfo = nextSegment ? `次は${nextSegment.type === 'WALK' ? '徒歩' : '乗り換え'}です。` : '';

        // Use text + type as pseudo ID
        const segmentId = `${segment.type}-${segment.text?.replace(/\s+/g, '-') || 'unknown'}`;

        return {
            id: `alight-${segmentId}`,
            text: `まもなく、${stationName}に到着します。${transferInfo}お忘れ物にご注意ください。`,
            category: 'TRANSIT',
            priority: 'HIGH',
            timestamp: Date.now()
        };
    }

    // Departure trigger (Just started segment) - simplified check
    // If total distance is large (e.g. > 2km) and we are far from destination?
    // Not easy without "distanceFromStart". 
    // Alternative: We can handle this in useGuideSystem by detecting segment change.
    // For now, let's stick to reliable Alighting triggers.

    return null;
}

export function generateWalkGuide(
    segment: RouteSegment,
    distanceToTurn: number,
    turnDirection: string // 'left' | 'right' | 'straight'
): GuideContent | null {
    if (segment.type !== 'WALK') return null;

    if (distanceToTurn <= TRIGGER_CONFIG.WALK.TURN.play && distanceToTurn > TRIGGER_CONFIG.WALK.TURN.play - 10) {
        let text = '';
        if (turnDirection === 'right') text = 'まもなく、右方向です。';
        else if (turnDirection === 'left') text = 'まもなく、左方向です。';
        else return null;

        return {
            id: `turn-${Date.now()}`, // Simple ID
            text: text,
            category: 'TRANSIT',
            priority: 'HIGH',
            timestamp: Date.now()
        };
    }
    return null;
}

/**
 * Mock Dify Call for Tourism Guide (Level 2)
 * Uses local description data for now
 */
/**
 * Mock Dify Call for Tourism Guide (Level 2)
 * Uses local description data as the "Knowledge" and route info as "Context"
 */
/**
 * Call Dify API for Tourism Guide (Level 2)
 * Connects to the Unified Adaptive Workflow
 */
export async function generateTourismGuide(
    spot: Spot,
    context: GuideContext
): Promise<GuideContent> {
    const API_KEY = import.meta.env.VITE_DIFY_API_KEY;
    const API_URL = import.meta.env.VITE_DIFY_API_URL || 'https://api.dify.ai/v1';

    // Fallback function in case of API failure
    const useFallback = (errorMsg: string): GuideContent => {
        console.warn(`Dify API Failed: ${errorMsg}. Using local fallback.`);
        const desc = spot.description.length > 80 ? spot.description.substring(0, 80) + '...' : spot.description;
        let prefix = `近くに${spot.name}があります。`;
        if (context.mode === 'TRANSIT') prefix = `車窓、${context.target_spot_details?.relative_direction === 'LEFT' ? '左手' : context.target_spot_details?.relative_direction === 'RIGHT' ? '右手' : ''}に見えますのが、${spot.name}です。`;

        return {
            id: `spot-${spot.id}`,
            text: `${prefix}${desc}`,
            category: 'TOURISM',
            priority: 'LOW',
            timestamp: Date.now(),
            spotId: spot.id
        };
    };

    if (!API_KEY) {
        return useFallback('API Key not configured');
    }

    try {
        const payload = {
            inputs: {
                guide_context: JSON.stringify(context),
                target_name: spot.name
                // Removed target_description to rely on RAG
            },
            response_mode: "blocking",
            user: "kyoto-guide-user"
        };

        const response = await fetch(`${API_URL}/workflows/run`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const guideText = data.data.outputs.text;

        if (!guideText) {
            throw new Error('No text in response');
        }

        return {
            id: `spot-${spot.id}`,
            text: guideText,
            category: 'TOURISM',
            priority: 'LOW',
            timestamp: Date.now(),
            spotId: spot.id
        };

    } catch (error) {
        return useFallback(error instanceof Error ? error.message : 'Unknown error');
    }
}

