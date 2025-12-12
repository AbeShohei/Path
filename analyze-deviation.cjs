const fs = require('fs');
const path = require('path');

// Load original analysis
const analysisPath = path.join(__dirname, 'human_flow_analysis.json');
const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

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
    const latitude = (lat1 + (lat2 + (lat3 + 0.5) / 10) / 8) / 1.5;
    const longitude = lon1 + (lon2 + (lon3 + 0.5) / 10) / 8;
    return { latitude, longitude };
}

function isInKyotoCity(lat, lon) {
    return lat >= KYOTO_CITY_BOUNDS.minLat && lat <= KYOTO_CITY_BOUNDS.maxLat &&
        lon >= KYOTO_CITY_BOUNDS.minLon && lon <= KYOTO_CITY_BOUNDS.maxLon;
}

// 1. Extract Kyoto City Populations
const kyotoCityPops = [];
const meshData = {};

for (const [mesh, pop] of Object.entries(analysis.meshPopulations)) {
    const coords = mesh1kmToLatLon(mesh);
    if (coords && isInKyotoCity(coords.latitude, coords.longitude)) {
        if (pop > 0) { // Only consider populated meshes for stat calculation? Or all? Usually populated.
            kyotoCityPops.push(pop);
            meshData[mesh] = pop;
        }
    }
}

// 2. Calculate Mean and Standard Deviation (Log Transformed)
// Population data is usually log-normal.
const kyotoCityLogPops = kyotoCityPops.map(p => Math.log10(p + 1));

const n = kyotoCityLogPops.length;
const mean = kyotoCityLogPops.reduce((a, b) => a + b, 0) / n;
const variance = kyotoCityLogPops.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
const stdDev = Math.sqrt(variance);

console.log('=== Kyoto City Statistics (Log10 Transformed) ===');
console.log(`Count: ${n}`);
console.log(`Mean Log: ${mean.toFixed(2)}`);
console.log(`StdDev Log: ${stdDev.toFixed(2)}`);

// 3. Define T-Score Calculation
function getTScore(val) {
    const logVal = Math.log10(val + 1);
    return 50 + 10 * (logVal - mean) / stdDev;
}

// 4. Test Thresholds
// Level 1: T < 40
// Level 2: 40 <= T < 50
// Level 3: 50 <= T < 60
// Level 4: 60 <= T < 70
// Level 5: 70 <= T

const thresholds = {
    L1_MAX: 40,
    L2_MAX: 50,
    L3_MAX: 60,
    L4_MAX: 70
};

// Calculate population values for these T-scores (Reverse Log)
function tScoreToPop(t) {
    const logVal = mean + ((t - 50) / 10) * stdDev;
    return Math.pow(10, logVal) - 1;
}

const popThresholds = {
    level1Max: Math.round(tScoreToPop(40)),
    level2Max: Math.round(tScoreToPop(50)),
    level3Max: Math.round(tScoreToPop(60)),
    level4Max: Math.round(tScoreToPop(70))
};

console.log('\n=== T-Score based Population Thresholds (Log scale) ===');
console.log(`Level 1 (T < 40): 0 - ${popThresholds.level1Max}`);
console.log(`Level 2 (40 <= T < 50): ${popThresholds.level1Max} - ${popThresholds.level2Max}`);
console.log(`Level 3 (50 <= T < 60): ${popThresholds.level2Max} - ${popThresholds.level3Max}`);
console.log(`Level 4 (60 <= T < 70): ${popThresholds.level3Max} - ${popThresholds.level4Max}`);
console.log(`Level 5 (70 <= T): ${popThresholds.level4Max}+`);

// 5. Simulate Distribution
const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
for (const pop of kyotoCityPops) {
    const t = getTScore(pop);
    if (t < 40) counts[1]++;
    else if (t < 50) counts[2]++;
    else if (t < 60) counts[3]++;
    else if (t < 70) counts[4]++;
    else counts[5]++;
}

console.log('\n=== Distribution Results ===');
console.log(`Level 1: ${counts[1]} (${(counts[1] / n * 100).toFixed(1)}%)`);
console.log(`Level 2: ${counts[2]} (${(counts[2] / n * 100).toFixed(1)}%)`);
console.log(`Level 3: ${counts[3]} (${(counts[3] / n * 100).toFixed(1)}%)`);
console.log(`Level 4: ${counts[4]} (${(counts[4] / n * 100).toFixed(1)}%)`);
console.log(`Level 5: ${counts[5]} (${(counts[5] / n * 100).toFixed(1)}%)`);
