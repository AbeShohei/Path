// Script to create adjusted regional thresholds for Kyoto city
const fs = require('fs');
const path = require('path');

// Load the original analysis
const analysisPath = path.join(__dirname, 'human_flow_analysis.json');
const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

// Kyoto city bounds
const KYOTO_CITY_BOUNDS = {
    minLat: 34.85,
    maxLat: 35.12,
    minLon: 135.55,
    maxLon: 135.90
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
    const latitude = (lat1 + (lat2 + (lat3 + 0.5) / 10) / 8) / 1.5;
    const longitude = lon1 + (lon2 + (lon3 + 0.5) / 10) / 8;
    return { latitude, longitude };
}

function isInKyotoCity(lat, lon) {
    return lat >= KYOTO_CITY_BOUNDS.minLat && lat <= KYOTO_CITY_BOUNDS.maxLat &&
        lon >= KYOTO_CITY_BOUNDS.minLon && lon <= KYOTO_CITY_BOUNDS.maxLon;
}

console.log('=== Adjusting Kyoto City Thresholds ===\n');

// Separate by region
const kyotoCityPops = [];
const outsidePops = [];
const meshRegions = {};

for (const [mesh, pop] of Object.entries(analysis.meshPopulations)) {
    const coords = mesh1kmToLatLon(mesh);
    if (coords && isInKyotoCity(coords.latitude, coords.longitude)) {
        kyotoCityPops.push(pop);
        meshRegions[mesh] = 'city';
    } else {
        outsidePops.push(pop);
        meshRegions[mesh] = 'outside';
    }
}

kyotoCityPops.sort((a, b) => a - b);
outsidePops.sort((a, b) => a - b);

console.log(`Kyoto City: ${kyotoCityPops.length} meshes`);
console.log(`  Min: ${kyotoCityPops[0]}, Max: ${kyotoCityPops[kyotoCityPops.length - 1]}`);
console.log(`Outside: ${outsidePops.length} meshes`);

// Use MORE GENEROUS percentiles for Kyoto city (30, 55, 75, 92)
// This means Level 5 only for top 8% (instead of top 20%)
function getPercentile(arr, p) {
    return arr[Math.floor(arr.length * p)] || 0;
}

const cityThresholds = {
    level1Max: getPercentile(kyotoCityPops, 0.30),  // Bottom 30% = Level 1
    level2Max: getPercentile(kyotoCityPops, 0.55),  // Next 25% = Level 2
    level3Max: getPercentile(kyotoCityPops, 0.75),  // Next 20% = Level 3
    level4Max: getPercentile(kyotoCityPops, 0.92),  // Next 17% = Level 4
    // Level 5 = Top 8%
};

// Keep outside thresholds at 20/40/60/80 percentile
const outsideThresholds = {
    level1Max: getPercentile(outsidePops, 0.20),
    level2Max: getPercentile(outsidePops, 0.40),
    level3Max: getPercentile(outsidePops, 0.60),
    level4Max: getPercentile(outsidePops, 0.80),
};

console.log(`\n=== Adjusted Kyoto City Thresholds ===`);
console.log(`Level 1 (快適): 0 - ${cityThresholds.level1Max} (bottom 30%)`);
console.log(`Level 2 (やや快適): ${cityThresholds.level1Max + 1} - ${cityThresholds.level2Max} (next 25%)`);
console.log(`Level 3 (通常): ${cityThresholds.level2Max + 1} - ${cityThresholds.level3Max} (next 20%)`);
console.log(`Level 4 (やや混雑): ${cityThresholds.level3Max + 1} - ${cityThresholds.level4Max} (next 17%)`);
console.log(`Level 5 (混雑): ${cityThresholds.level4Max + 1}+ (top 8%)`);

console.log(`\n=== Outside Thresholds (unchanged) ===`);
console.log(`Level 1: 0 - ${outsideThresholds.level1Max}`);
console.log(`Level 2: ${outsideThresholds.level1Max + 1} - ${outsideThresholds.level2Max}`);
console.log(`Level 3: ${outsideThresholds.level2Max + 1} - ${outsideThresholds.level3Max}`);
console.log(`Level 4: ${outsideThresholds.level3Max + 1} - ${outsideThresholds.level4Max}`);
console.log(`Level 5: ${outsideThresholds.level4Max + 1}+`);

// Save
const outputData = {
    month: analysis.month,
    years: analysis.years,
    kyotoCityBounds: KYOTO_CITY_BOUNDS,
    totalMeshCodes: analysis.totalMeshCodes,
    kyotoCityMeshCount: kyotoCityPops.length,
    outsideMeshCount: outsidePops.length,
    thresholds: {
        kyotoCity: cityThresholds,
        outside: outsideThresholds
    },
    meshPopulations: analysis.meshPopulations,
    meshRegions: meshRegions
};

fs.writeFileSync(
    path.join(__dirname, 'human_flow_analysis_regional.json'),
    JSON.stringify(outputData, null, 2),
    'utf8'
);

console.log('\nSaved to human_flow_analysis_regional.json');
