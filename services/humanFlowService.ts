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
 * Calculate congestion level (1-5) from population using DEVIATION SCORE (偏差値)
 * 
 * This distributes spots across all 5 levels based on relative population.
 * - Level 1 (快適): Bottom 20% (deviation < 42)
 * - Level 2 (やや快適): 20-40% (deviation 42-48)
 * - Level 3 (通常): 40-60% (deviation 48-52)
 * - Level 4 (やや混雑): 60-80% (deviation 52-58)
 * - Level 5 (混雑): Top 20% (deviation >= 58)
 */

// Population stats calculated from SPOT LOCATIONS ONLY
let populationStats: { mean: number; stdDev: number } | null = null;
let registeredSpotLocations: { lat: number; lng: number }[] = [];

/**
 * Register spot locations to calculate stats from spots only
 * Call this from spotService after loading spots
 */
export function registerSpotLocations(locations: { lat: number; lng: number }[]) {
    registeredSpotLocations = locations;
    populationStats = null; // Reset to recalculate

}

// Initialize population statistics from SPOT MESHES ONLY
function initPopulationStats() {
    if (populationStats !== null) return;

    const spotPopulations: number[] = [];
    const seenMeshes = new Set<string>();

    // If no spots registered, use all meshes as fallback
    if (registeredSpotLocations.length === 0) {

        for (const meshCode of Object.keys(MESH_POPULATIONS)) {
            const data = MESH_POPULATIONS[meshCode];
            if (data) {
                if (data.morning > 0) spotPopulations.push(data.morning);
                if (data.noon > 0) spotPopulations.push(data.noon);
                if (data.evening > 0) spotPopulations.push(data.evening);
            }
        }
    } else {
        // Collect population data ONLY from meshes where spots exist
        for (const loc of registeredSpotLocations) {
            const meshCode = latLonToMesh1km(loc.lat, loc.lng);
            if (seenMeshes.has(meshCode)) continue;
            seenMeshes.add(meshCode);

            const data = MESH_POPULATIONS[meshCode];
            if (data) {
                if (data.morning > 0) spotPopulations.push(data.morning);
                if (data.noon > 0) spotPopulations.push(data.noon);
                if (data.evening > 0) spotPopulations.push(data.evening);
            }
        }

    }

    if (spotPopulations.length === 0) {
        populationStats = { mean: 1000, stdDev: 500 };
        return;
    }

    // Calculate mean
    const sum = spotPopulations.reduce((a, b) => a + b, 0);
    const mean = sum / spotPopulations.length;

    // Calculate standard deviation
    const squareDiffs = spotPopulations.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / spotPopulations.length;
    const stdDev = Math.sqrt(avgSquareDiff);

    populationStats = { mean, stdDev };

}

function populationToCongestionLevel(
    population: number,
    region: Region,
    timeOfDay: TimeOfDay
): CongestionLevel {
    // Initialize stats if not done
    initPopulationStats();

    if (!populationStats || populationStats.stdDev === 0) {
        // Fallback if stats not available
        return 3;
    }

    // Calculate deviation score (偏差値): 50 + 10 * (value - mean) / stdDev
    const deviationScore = 50 + 10 * (population - populationStats.mean) / populationStats.stdDev;

    // Map deviation score to congestion level (1-5)
    // Using 20% percentile thresholds
    if (deviationScore < 42) return 1;      // Bottom 20%: 快適
    if (deviationScore < 48) return 2;      // 20-40%: やや快適
    if (deviationScore < 52) return 3;      // 40-60%: 通常
    if (deviationScore < 58) return 4;      // 60-80%: やや混雑
    return 5;                                // Top 20%: 混雑
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
