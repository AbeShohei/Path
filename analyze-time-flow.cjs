// Script to create time-of-day population data
const fs = require('fs');
const path = require('path');

const OPENDATA_PATH = path.join(__dirname, 'opendata/human');
const CURRENT_MONTH = '12';
const YEARS = ['2019', '2020', '2021'];

// timezone: 0=朝 (6-12時), 1=昼 (12-18時), 2=夕方/夜 (18-24時)
const TIMEZONES = {
    0: 'morning',   // 朝
    1: 'noon',      // 昼
    2: 'evening'    // 夕方/夜
};

// Kyoto city bounds
const KYOTO_CITY_BOUNDS = {
    minLat: 34.85, maxLat: 35.12,
    minLon: 135.55, maxLon: 135.90
};

function mesh1kmToLatLon(meshCode) {
    if (!/^\d{8}$/.test(meshCode)) return null;
    const mesh1 = parseInt(meshCode.substring(0, 4));
    const mesh2 = parseInt(meshCode.substring(4, 6));
    const mesh3 = parseInt(meshCode.substring(6, 8));
    const lat1 = Math.floor(mesh1 / 100);
    const lon1 = mesh1 % 100 + 100;
    const lat2 = Math.floor(mesh2 / 10);
    const lon2 = mesh2 % 10;
    const lat3 = Math.floor(mesh3 / 10);
    const lon3 = mesh3 % 10;
    return {
        latitude: (lat1 + (lat2 + (lat3 + 0.5) / 10) / 8) / 1.5,
        longitude: lon1 + (lon2 + (lon3 + 0.5) / 10) / 8
    };
}

function isInKyotoCity(lat, lon) {
    return lat >= KYOTO_CITY_BOUNDS.minLat && lat <= KYOTO_CITY_BOUNDS.maxLat &&
        lon >= KYOTO_CITY_BOUNDS.minLon && lon <= KYOTO_CITY_BOUNDS.maxLon;
}

console.log('=== Creating Time-of-Day Population Data ===\n');

// Data structure: { meshCode: { morning: [...], noon: [...], evening: [...] } }
const meshData = {};

for (const year of YEARS) {
    const csvPath = path.join(OPENDATA_PATH, year, CURRENT_MONTH,
        'monthly_mdp_mesh1km.csv', 'monthly_mdp_mesh1km.csv');

    console.log(`Processing: ${year}/${CURRENT_MONTH}`);

    if (!fs.existsSync(csvPath)) continue;

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').slice(1); // Skip header

    for (const line of lines) {
        if (!line.trim()) continue;
        const [mesh, prefcode, citycode, yr, month, dayflag, timezone, population] = line.split(',');

        if (!/^\d{8}$/.test(mesh)) continue;

        const tz = parseInt(timezone);
        const pop = parseInt(population) || 0;

        if (tz !== 0 && tz !== 1 && tz !== 2) continue;

        if (!meshData[mesh]) {
            meshData[mesh] = { morning: [], noon: [], evening: [] };
        }

        const tzName = TIMEZONES[tz];
        meshData[mesh][tzName].push(pop);
    }
}

// Calculate averages for each timezone
const meshAverages = {};
for (const [mesh, data] of Object.entries(meshData)) {
    const avg = (arr) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    meshAverages[mesh] = {
        morning: avg(data.morning),
        noon: avg(data.noon),
        evening: avg(data.evening)
    };
}

console.log(`\nTotal meshes with time data: ${Object.keys(meshAverages).length}`);

// Separate by region and calculate thresholds for each timezone
const cityPops = { morning: [], noon: [], evening: [] };
const outsidePops = { morning: [], noon: [], evening: [] };
const meshRegions = {};

for (const [mesh, data] of Object.entries(meshAverages)) {
    const coords = mesh1kmToLatLon(mesh);
    const isCity = coords && isInKyotoCity(coords.latitude, coords.longitude);
    meshRegions[mesh] = isCity ? 'city' : 'outside';

    const target = isCity ? cityPops : outsidePops;
    if (data.morning > 0) target.morning.push(data.morning);
    if (data.noon > 0) target.noon.push(data.noon);
    if (data.evening > 0) target.evening.push(data.evening);
}

// Calculate percentile thresholds for each region and timezone
function getPercentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * p)] || 0;
}

function calcThresholds(pops, percentiles = [0.30, 0.55, 0.75, 0.92]) {
    return {
        level1Max: getPercentile(pops, percentiles[0]),
        level2Max: getPercentile(pops, percentiles[1]),
        level3Max: getPercentile(pops, percentiles[2]),
        level4Max: getPercentile(pops, percentiles[3])
    };
}

const thresholds = {
    kyotoCity: {
        morning: calcThresholds(cityPops.morning, [0.30, 0.55, 0.75, 0.92]),
        noon: calcThresholds(cityPops.noon, [0.30, 0.55, 0.75, 0.92]),
        evening: calcThresholds(cityPops.evening, [0.30, 0.55, 0.75, 0.92])
    },
    outside: {
        morning: calcThresholds(outsidePops.morning),
        noon: calcThresholds(outsidePops.noon),
        evening: calcThresholds(outsidePops.evening)
    }
};

console.log('\n=== Kyoto City Thresholds by Time ===');
for (const tz of ['morning', 'noon', 'evening']) {
    const t = thresholds.kyotoCity[tz];
    console.log(`${tz}: L1≤${t.level1Max}, L2≤${t.level2Max}, L3≤${t.level3Max}, L4≤${t.level4Max}`);
}

console.log('\n=== Outside Thresholds by Time ===');
for (const tz of ['morning', 'noon', 'evening']) {
    const t = thresholds.outside[tz];
    console.log(`${tz}: L1≤${t.level1Max}, L2≤${t.level2Max}, L3≤${t.level3Max}, L4≤${t.level4Max}`);
}

// Save to JSON
const output = {
    month: CURRENT_MONTH,
    years: YEARS,
    kyotoCityBounds: KYOTO_CITY_BOUNDS,
    totalMeshCodes: Object.keys(meshAverages).length,
    timezones: { 0: 'morning (6-12時)', 1: 'noon (12-18時)', 2: 'evening (18-24時)' },
    thresholds: thresholds,
    meshPopulations: meshAverages,
    meshRegions: meshRegions
};

fs.writeFileSync(
    path.join(__dirname, 'human_flow_by_time.json'),
    JSON.stringify(output, null, 2),
    'utf8'
);

console.log('\nSaved to human_flow_by_time.json');
