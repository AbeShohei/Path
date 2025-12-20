/**
 * Dify Context Generator Service
 * Generates structured context data for Dify AI Guide
 * Based on dify_integration_design.md specifications
 */

import { RouteSegment, Coordinates, Turn } from '../types';
import { getNextTurn } from './turnDetectionService';

// Navigation stages matching the design document
export type NavigationStage =
    | 'DEPARTURE'      // 出発
    | 'TRANSIT_HUB'    // 乗換拠点到着
    | 'ON_BOARD'       // 乗車中
    | 'ALIGHTING'      // 降車予兆
    | 'FINAL_LEG';     // ラストマイル

// Trigger events for Dify
export type GuideTrigger =
    | 'GUIDE_DEPARTURE'
    | 'GUIDE_TRANSIT_HUB'
    | 'GUIDE_ON_BOARD'
    | 'GUIDE_ALIGHTING'
    | 'GUIDE_FINAL_LEG'
    | 'GUIDE_SILENCE_BREAK';  // 沈黙検知時

// Dify context structure matching the design document
export interface DifyContext {
    trigger: GuideTrigger;
    expected_output_structure: {
        traffic_content: string;
        tourism_content: string;
    };
    user_state: {
        current_location: { lat: number; lng: number };
        transport_mode: 'WALK' | 'BUS' | 'TRAIN' | 'SUBWAY';
        is_off_route: boolean;
    };
    transit_context?: {
        line_name: string;
        bound_for: string;
        next_stop?: string;
        stops_remaining: number;
        delay_minutes: number;
        platform_info?: string;
        gateway?: string;         // 改札口 (e.g. "中央口")
        getoff?: string;          // 降車位置 (e.g. "前")
        duration_minutes?: number; // 乗車時間
        line_color?: string;      // 路線カラー
        company_name?: string;    // 鉄道会社名
        train_type?: string;      // 普通/快速等
    };
    tourism_context?: {
        nearby_spots: { name: string; distance: number; description: string }[];
        current_area_name: string;
        season: string;
    };
    walking_context?: {
        next_turn_distance: number;
        next_turn_direction: string;
        landmark_at_corner?: string;
        total_distance_remaining: number;
    };
}

/**
 * Get current season in Japanese
 */
function getCurrentSeason(): string {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return '春';
    if (month >= 6 && month <= 8) return '夏';
    if (month >= 9 && month <= 11) return '秋';
    return '冬';
}

/**
 * Generate walking context from segment data
 */
export function generateWalkingContext(
    segment: RouteSegment,
    currentLocation: { lat: number; lng: number }
): DifyContext['walking_context'] | undefined {
    if (segment.type !== 'WALK' || !segment.turns) {
        return undefined;
    }

    const { turn, distanceToTurn } = getNextTurn(currentLocation, segment.turns);

    return {
        next_turn_distance: distanceToTurn,
        next_turn_direction: turn?.direction || '直進',
        landmark_at_corner: undefined, // Would need POI data
        total_distance_remaining: segment.distance || 0
    };
}

/**
 * Generate transit context from segment data
 */
export function generateTransitContext(
    segment: RouteSegment,
    stopsRemaining?: number
): DifyContext['transit_context'] | undefined {
    if (segment.type === 'WALK') {
        return undefined;
    }

    return {
        line_name: segment.text || '',
        bound_for: segment.direction || '',
        next_stop: segment.stops?.[0],
        stops_remaining: stopsRemaining ?? segment.stopCount ?? 0,
        delay_minutes: 0, // Would need real-time data
        platform_info: segment.platform,
        gateway: segment.gateway,
        getoff: segment.getoff,
        duration_minutes: segment.durationMinutes,
        line_color: segment.lineColor,
        company_name: segment.companyName,
        train_type: segment.trainType
    };
}

/**
 * Generate full Dify context for a navigation stage
 */
export function generateDifyContext(
    stage: NavigationStage,
    currentSegment: RouteSegment,
    currentLocation: { lat: number; lng: number },
    nearbySpots: { name: string; distance: number; description: string }[] = [],
    areaName: string = '京都',
    stopsRemaining?: number
): DifyContext {
    // Map stage to trigger
    const triggerMap: Record<NavigationStage, GuideTrigger> = {
        'DEPARTURE': 'GUIDE_DEPARTURE',
        'TRANSIT_HUB': 'GUIDE_TRANSIT_HUB',
        'ON_BOARD': 'GUIDE_ON_BOARD',
        'ALIGHTING': 'GUIDE_ALIGHTING',
        'FINAL_LEG': 'GUIDE_FINAL_LEG'
    };

    const context: DifyContext = {
        trigger: triggerMap[stage],
        expected_output_structure: {
            traffic_content: '交通案内文（事実のみ）',
            tourism_content: '観光案内文（歴史・風景）'
        },
        user_state: {
            current_location: currentLocation,
            transport_mode: currentSegment.type,
            is_off_route: false
        },
        tourism_context: {
            nearby_spots: nearbySpots.slice(0, 3), // Limit to 3 spots
            current_area_name: areaName,
            season: getCurrentSeason()
        }
    };

    // Add context based on transport mode
    if (currentSegment.type === 'WALK') {
        context.walking_context = generateWalkingContext(currentSegment, currentLocation);
    } else {
        context.transit_context = generateTransitContext(currentSegment, stopsRemaining);
    }

    return context;
}

/**
 * Generate simplified context for Dify prompt
 * This creates a concise summary for the AI to use
 */
export function generatePromptContext(context: DifyContext): string {
    const lines: string[] = [];

    lines.push(`【状況】${context.trigger.replace('GUIDE_', '')}`);
    lines.push(`【移動手段】${context.user_state.transport_mode}`);

    if (context.transit_context) {
        const tc = context.transit_context;
        lines.push(`【路線】${tc.line_name} ${tc.bound_for}方面`);
        if (tc.train_type) lines.push(`【種別】${tc.train_type}`);
        if (tc.gateway) lines.push(`【改札口】${tc.gateway}`);
        if (tc.platform_info) lines.push(`【のりば】${tc.platform_info}`);
        if (tc.duration_minutes) lines.push(`【乗車時間】${tc.duration_minutes}分`);
        if (tc.getoff) lines.push(`【降車位置】${tc.getoff}下車`);
        if (tc.next_stop) lines.push(`【次の駅】${tc.next_stop}`);
        if (tc.stops_remaining > 0) lines.push(`【残り駅数】${tc.stops_remaining}駅`);
    }

    if (context.walking_context) {
        const wc = context.walking_context;
        if (wc.next_turn_distance < 1000) {
            lines.push(`【次の曲がり角】${wc.next_turn_distance}m先を${wc.next_turn_direction}`);
        }
        if (wc.total_distance_remaining > 0) {
            lines.push(`【残り距離】約${Math.round(wc.total_distance_remaining)}m`);
        }
    }

    if (context.tourism_context?.nearby_spots.length > 0) {
        const spots = context.tourism_context.nearby_spots
            .map(s => `${s.name}(${s.distance}m)`)
            .join('、');
        lines.push(`【周辺スポット】${spots}`);
    }

    lines.push(`【エリア】${context.tourism_context?.current_area_name || '京都'}`);
    lines.push(`【季節】${context.tourism_context?.season || getCurrentSeason()}`);

    return lines.join('\n');
}

export default {
    generateDifyContext,
    generateWalkingContext,
    generateTransitContext,
    generatePromptContext
};
