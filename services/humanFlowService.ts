/**
 * Human Flow Data Service with Monthly, Day Type, and Time-of-Day Support
 * 
 * Provides dynamic congestion levels based on:
 * - Month (1-12)
 * - Day type (weekday/weekend)
 * - Time of day (morning/noon/evening)
 * - Location (Kyoto city vs. outside)
 * 
 * Data source: opendata/human 2019-2021, 3-year average per month
 */

import humanFlowMonthlyData from '../human_flow_monthly.json';

export type TimeOfDay = 'morning' | 'noon' | 'evening';
export type Month = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12';
export type DayType = 'weekday' | 'weekend';
export type Region = 'city' | 'outside';
export type CongestionLevel = 1 | 2 | 3 | 4 | 5;

// Kyoto city bounds
const KYOTO_CITY_BOUNDS = humanFlowMonthlyData.kyotoCityBounds;

// Monthly data structure with weekday/weekend separation
const MONTHLY_DATA = humanFlowMonthlyData.monthlyData as Record<Month, {
    weekday: {
        meshPopulations: Record<string, { morning: number, noon: number, evening: number }>;
        meshRegions: Record<string, string>;
    };
    weekend: {
        meshPopulations: Record<string, { morning: number, noon: number, evening: number }>;
        meshRegions: Record<string, string>;
    };
}>;

/**
 * Get current month as 2-digit string
 */
export function getCurrentMonth(): Month {
    const month = new Date().getMonth() + 1; // 0-indexed to 1-indexed
    return month.toString().padStart(2, '0') as Month;
}

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
 * Get current day type (weekday or weekend)
 */
export function getCurrentDayType(): DayType {
    const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    return (day === 0 || day === 6) ? 'weekend' : 'weekday';
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
 * Get region for a mesh code (for a specific month and day type)
 */
export function getMeshRegion(meshCode: string, month?: Month, dayType?: DayType): Region {
    const m = month || getCurrentMonth();
    const d = dayType || getCurrentDayType();
    const monthData = MONTHLY_DATA[m];
    if (!monthData || !monthData[d]) return 'outside';
    return (monthData[d].meshRegions[meshCode] as Region) || 'outside';
}

/**
 * Get population for a mesh code at a specific time, month, and day type
 */
export function getMeshPopulation(meshCode: string, timeOfDay: TimeOfDay, month?: Month, dayType?: DayType): number {
    const m = month || getCurrentMonth();
    const d = dayType || getCurrentDayType();
    const monthData = MONTHLY_DATA[m];
    if (!monthData || !monthData[d]) return 0;
    const data = monthData[d].meshPopulations[meshCode];
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

// Population stats calculated from SPOT LOCATIONS ONLY - per time period, per month, per day type
let populationStatsCache: Record<string, Record<DayType, Record<TimeOfDay, { mean: number; stdDev: number }>>> = {};
let registeredSpotLocations: { lat: number; lng: number }[] = [];

/**
 * Register spot locations to calculate stats from spots only
 * Call this from spotService after loading spots
 */
export function registerSpotLocations(locations: { lat: number; lng: number }[]) {
    registeredSpotLocations = locations;
    populationStatsCache = {}; // Reset cache
}

// Get population statistics for a specific month and day type (cached)
function getStatsForMonthAndDayType(month: Month, dayType: DayType): Record<TimeOfDay, { mean: number; stdDev: number }> {
    const cacheKey = `${month}_${dayType}`;
    if (populationStatsCache[cacheKey]) {
        return populationStatsCache[cacheKey][dayType];
    }

    const monthData = MONTHLY_DATA[month];

    if (!monthData || !monthData[dayType]) {
        return {
            morning: { mean: 1000, stdDev: 500 },
            noon: { mean: 1000, stdDev: 500 },
            evening: { mean: 1000, stdDev: 500 }
        };
    }

    const spotPopulationsByTime: Record<TimeOfDay, number[]> = {
        morning: [],
        noon: [],
        evening: []
    };
    const seenMeshes = new Set<string>();

    // Collect mesh codes from spot locations
    const meshCodesToUse: string[] = [];

    if (registeredSpotLocations.length === 0) {
        // Fallback: use all meshes from month
        meshCodesToUse.push(...Object.keys(monthData[dayType].meshPopulations));
    } else {
        // Only use meshes where spots exist
        for (const loc of registeredSpotLocations) {
            const meshCode = latLonToMesh1km(loc.lat, loc.lng);
            if (!seenMeshes.has(meshCode)) {
                seenMeshes.add(meshCode);
                meshCodesToUse.push(meshCode);
            }
        }
    }

    // Collect population data per time period
    for (const meshCode of meshCodesToUse) {
        const data = monthData[dayType].meshPopulations[meshCode];
        if (data) {
            if (data.morning > 0) spotPopulationsByTime.morning.push(data.morning);
            if (data.noon > 0) spotPopulationsByTime.noon.push(data.noon);
            if (data.evening > 0) spotPopulationsByTime.evening.push(data.evening);
        }
    }

    // Calculate stats for each time period
    const stats = {
        morning: calculateStats(spotPopulationsByTime.morning),
        noon: calculateStats(spotPopulationsByTime.noon),
        evening: calculateStats(spotPopulationsByTime.evening)
    };

    if (!populationStatsCache[cacheKey]) {
        populationStatsCache[cacheKey] = {} as Record<DayType, Record<TimeOfDay, { mean: number; stdDev: number }>>;
    }
    populationStatsCache[cacheKey][dayType] = stats;
    return stats;
}

function calculateStats(values: number[]): { mean: number; stdDev: number } {
    if (values.length === 0) {
        return { mean: 1000, stdDev: 500 };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;

    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(avgSquareDiff);

    return { mean, stdDev: stdDev || 1 }; // Prevent division by zero
}

function populationToCongestionLevel(
    population: number,
    region: Region,
    timeOfDay: TimeOfDay,
    month?: Month,
    dayType?: DayType
): CongestionLevel {
    // Get stats for the specific month and day type
    const m = month || getCurrentMonth();
    const d = dayType || getCurrentDayType();
    const allStats = getStatsForMonthAndDayType(m, d);
    const stats = allStats[timeOfDay];

    if (!stats || stats.stdDev === 0) {
        // Fallback if stats not available
        return 3;
    }

    // Calculate deviation score (偏差値): 50 + 10 * (value - mean) / stdDev
    const deviationScore = 50 + 10 * (population - stats.mean) / stats.stdDev;

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
 * @param month Optional month override (defaults to current month)
 * @param dayType Optional day type override (defaults to current day type)
 */
export function getCongestionLevel(
    lat: number,
    lon: number,
    timeOfDay?: TimeOfDay,
    month?: Month,
    dayType?: DayType
): CongestionLevel {
    const time = timeOfDay || getCurrentTimeOfDay();
    const m = month || getCurrentMonth();
    const d = dayType || getCurrentDayType();
    const meshCode = latLonToMesh1km(lat, lon);
    const region = getMeshRegion(meshCode, m, d);
    const population = getMeshPopulation(meshCode, time, m, d);

    return populationToCongestionLevel(population, region, time, m, d);
}

/**
 * Get congestion levels for all time periods
 */
export function getAllCongestionLevels(lat: number, lon: number, dayType?: DayType): {
    morning: CongestionLevel;
    noon: CongestionLevel;
    evening: CongestionLevel;
    current: CongestionLevel;
} {
    const d = dayType || getCurrentDayType();
    return {
        morning: getCongestionLevel(lat, lon, 'morning', undefined, d),
        noon: getCongestionLevel(lat, lon, 'noon', undefined, d),
        evening: getCongestionLevel(lat, lon, 'evening', undefined, d),
        current: getCongestionLevel(lat, lon, undefined, undefined, d)
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

/**
 * Get day type label in Japanese
 */
export function getDayTypeLabel(dayType: DayType): string {
    switch (dayType) {
        case 'weekday': return '平日';
        case 'weekend': return '休日';
    }
}
