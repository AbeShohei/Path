/**
 * Human Flow Data Service with Time-of-Day Support
 * 
 * Provides dynamic congestion levels based on:
 * - Time of day (morning/noon/evening)
 * - Location (Kyoto city vs. outside)
 * 
 * Data source: opendata/human 2019-2021 December, 3-year average
 */

import humanFlowData from '../human_flow_by_time.json';

export type TimeOfDay = 'morning' | 'noon' | 'evening';
export type Region = 'city' | 'outside';
export type CongestionLevel = 1 | 2 | 3 | 4 | 5;

// Kyoto city bounds
const KYOTO_CITY_BOUNDS = humanFlowData.kyotoCityBounds;

// Thresholds per region and time
const THRESHOLDS = humanFlowData.thresholds;

// Mesh population data
const MESH_POPULATIONS = humanFlowData.meshPopulations as Record<string, { morning: number, noon: number, evening: number }>;

// Mesh regions
const MESH_REGIONS = humanFlowData.meshRegions as Record<string, string>;

/**
 * Get current time of day
 */
export function getCurrentTimeOfDay(): TimeOfDay {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'noon';
    return 'evening';
}

/**
 * Convert latitude/longitude to 1km mesh code (8 digits)
 * Based on JIS X 0410 standard
 */
export function latLonToMesh1km(lat: number, lon: number): string {
    const lat1 = Math.floor(lat * 1.5);
    const lon1 = Math.floor(lon) - 100;
    const mesh1 = lat1 * 100 + lon1;

    const lat2 = Math.floor((lat * 1.5 - lat1) * 8);
    const lon2 = Math.floor((lon - Math.floor(lon)) * 8);
    const mesh2 = lat2 * 10 + lon2;

    const lat3 = Math.floor(((lat * 1.5 - lat1) * 8 - lat2) * 10);
    const lon3 = Math.floor(((lon - Math.floor(lon)) * 8 - lon2) * 10);
    const mesh3 = lat3 * 10 + lon3;

    return `${mesh1}${mesh2.toString().padStart(2, '0')}${mesh3.toString().padStart(2, '0')}`;
}

/**
 * Check if coordinates are in Kyoto city
 */
export function isInKyotoCity(lat: number, lon: number): boolean {
    return lat >= KYOTO_CITY_BOUNDS.minLat &&
        lat <= KYOTO_CITY_BOUNDS.maxLat &&
        lon >= KYOTO_CITY_BOUNDS.minLon &&
        lon <= KYOTO_CITY_BOUNDS.maxLon;
}

/**
 * Get region for a mesh code
 */
export function getMeshRegion(meshCode: string): Region {
    return (MESH_REGIONS[meshCode] as Region) || 'outside';
}

/**
 * Get population for a mesh code at a specific time
 */
export function getMeshPopulation(meshCode: string, timeOfDay: TimeOfDay): number {
    const data = MESH_POPULATIONS[meshCode];
    if (!data) return 0;
    return data[timeOfDay] || 0;
}

/**
 * Calculate congestion level (1-5) from population
 */
function populationToCongestionLevel(
    population: number,
    region: Region,
    timeOfDay: TimeOfDay
): CongestionLevel {
    const thresholds = region === 'city'
        ? THRESHOLDS.kyotoCity[timeOfDay]
        : THRESHOLDS.outside[timeOfDay];

    if (population <= thresholds.level1Max) return 1;
    if (population <= thresholds.level2Max) return 2;
    if (population <= thresholds.level3Max) return 3;
    if (population <= thresholds.level4Max) return 4;
    return 5;
}

/**
 * Get congestion level for a spot at current time
 * 
 * @param lat Latitude
 * @param lon Longitude
 * @param timeOfDay Optional time override (defaults to current time)
 */
export function getCongestionLevel(
    lat: number,
    lon: number,
    timeOfDay?: TimeOfDay
): CongestionLevel {
    const time = timeOfDay || getCurrentTimeOfDay();
    const meshCode = latLonToMesh1km(lat, lon);
    const region = getMeshRegion(meshCode);
    const population = getMeshPopulation(meshCode, time);

    return populationToCongestionLevel(population, region, time);
}

/**
 * Get congestion levels for all time periods
 */
export function getAllCongestionLevels(lat: number, lon: number): {
    morning: CongestionLevel;
    noon: CongestionLevel;
    evening: CongestionLevel;
    current: CongestionLevel;
} {
    return {
        morning: getCongestionLevel(lat, lon, 'morning'),
        noon: getCongestionLevel(lat, lon, 'noon'),
        evening: getCongestionLevel(lat, lon, 'evening'),
        current: getCongestionLevel(lat, lon)
    };
}

/**
 * Get congestion level label in Japanese
 */
export function getCongestionLabel(level: CongestionLevel): string {
    switch (level) {
        case 1: return '快適';
        case 2: return 'やや快適';
        case 3: return '通常';
        case 4: return 'やや混雑';
        case 5: return '混雑';
    }
}

/**
 * Get time of day label in Japanese
 */
export function getTimeOfDayLabel(time: TimeOfDay): string {
    switch (time) {
        case 'morning': return '朝 (6-12時)';
        case 'noon': return '昼 (12-18時)';
        case 'evening': return '夕方 (18-24時)';
    }
}
