const fs = require('fs');
const path = require('path');

// 1. Load Analysis Data
const analysisPath = path.join(__dirname, 'human_flow_analysis.json');
const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

const KYOTO_CITY_BOUNDS = {
    minLat: 34.85, maxLat: 35.12,
    minLon: 135.55, maxLon: 135.90
};

// 2. Helper Functions
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

function latLonToMesh1km(lat, lon) {
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

function isInKyotoCity(lat, lon) {
    return lat >= KYOTO_CITY_BOUNDS.minLat && lat <= KYOTO_CITY_BOUNDS.maxLat &&
        lon >= KYOTO_CITY_BOUNDS.minLon && lon <= KYOTO_CITY_BOUNDS.maxLon;
}

// 3. Calculate Stats for Kyoto City (Log Transformed) - ONLY Tourist Spot Meshes
console.log('Building mesh set from spots...');

// We need to parse spots FIRST to know which meshes to use for statistics
const spotServicePath = path.join(__dirname, 'services/spotService.ts');
let spotServiceContent = fs.readFileSync(spotServicePath, 'utf8');

const spotBlocks = [];
let depth = 0;
let blockStart = -1;
let inArray = false;
const arrayStart = spotServiceContent.indexOf('const KYOTO_SPOTS: Spot[] = [');

if (arrayStart === -1) {
    console.error('Could not find KYOTO_SPOTS array');
    process.exit(1);
}

const content = spotServiceContent.substring(arrayStart);
for (let i = 0; i < content.length; i++) {
    if (content[i] === '[' && !inArray) inArray = true;
    if (!inArray) continue;
    if (content[i] === '{') {
        if (depth === 0) blockStart = i;
        depth++;
    } else if (content[i] === '}') {
        depth--;
        if (depth === 0 && blockStart >= 0) {
            spotBlocks.push({
                start: arrayStart + blockStart,
                end: arrayStart + i + 1,
                content: content.substring(blockStart, i + 1)
            });
            blockStart = -1;
        }
    }
}

// Collect unique meshes for Kyoto City spots
const citySpotMeshes = new Set();
for (const block of spotBlocks) {
    const text = block.content;
    const latMatch = text.match(/"latitude"\s*:\s*([\d.]+)/);
    const lonMatch = text.match(/"longitude"\s*:\s*([\d.]+)/);

    if (!latMatch || !lonMatch) continue;

    const lat = parseFloat(latMatch[1]);
    const lon = parseFloat(lonMatch[1]);

    if (isInKyotoCity(lat, lon)) {
        const mesh = latLonToMesh1km(lat, lon);
        citySpotMeshes.add(mesh);
    }
}

console.log(`Found ${citySpotMeshes.size} unique meshes for Kyoto City tourist spots.`);

const kyotoCityLogPops = [];
for (const mesh of citySpotMeshes) {
    const pop = analysis.meshPopulations[mesh] || 0;
    // We include these in the stats calculation
    kyotoCityLogPops.push(Math.log10(pop + 1));
}

const n = kyotoCityLogPops.length;
const mean = kyotoCityLogPops.reduce((a, b) => a + b, 0) / n;
const variance = kyotoCityLogPops.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
const stdDev = Math.sqrt(variance);

console.log(`Kyoto City Tourist Spots Stats (Log10): N=${n}, Mean=${mean.toFixed(3)}, StdDev=${stdDev.toFixed(3)}`);

// 4. Scoring Functions
function getTScore(pop) {
    const logVal = Math.log10(pop + 1);
    return 50 + 10 * (logVal - mean) / stdDev;
}

function getLevelFromTScore(tScore) {
    // Slightly adjusted thresholds? Keep same for now to see distribution.
    if (tScore < 35) return 1;
    if (tScore < 45) return 2;
    if (tScore < 55) return 3;
    if (tScore < 65) return 4;
    return 5;
}

// 5. Outside Kyoto City Logic (Deviation Score) - ONLY Tourist Spot Meshes
console.log('Building outside mesh set from spots...');

const outsideSpotMeshes = new Set();
for (const block of spotBlocks) {
    const text = block.content;
    const latMatch = text.match(/"latitude"\s*:\s*([\d.]+)/);
    const lonMatch = text.match(/"longitude"\s*:\s*([\d.]+)/);

    if (!latMatch || !lonMatch) continue;

    const lat = parseFloat(latMatch[1]);
    const lon = parseFloat(lonMatch[1]);

    if (!isInKyotoCity(lat, lon)) {
        const mesh = latLonToMesh1km(lat, lon);
        outsideSpotMeshes.add(mesh);
    }
}

console.log(`Found ${outsideSpotMeshes.size} unique meshes for Outside tourist spots.`);

const outsideLogPops = [];
for (const mesh of outsideSpotMeshes) {
    const pop = analysis.meshPopulations[mesh] || 0;
    outsideLogPops.push(Math.log10(pop + 1));
}

const nOutside = outsideLogPops.length;
const meanOutside = outsideLogPops.reduce((a, b) => a + b, 0) / nOutside;
const varianceOutside = outsideLogPops.reduce((a, b) => a + Math.pow(b - meanOutside, 2), 0) / nOutside;
const stdDevOutside = Math.sqrt(varianceOutside);

console.log(`Outside Tourist Spots Stats (Log10): N=${nOutside}, Mean=${meanOutside.toFixed(3)}, StdDev=${stdDevOutside.toFixed(3)}`);

function getTScoreOutside(pop) {
    const logVal = Math.log10(pop + 1);
    return 50 + 10 * (logVal - meanOutside) / stdDevOutside;
}

function getLevelOutside(pop) {
    const tScore = getTScoreOutside(pop);
    // Use same T-score thresholds as City
    if (tScore < 35) return 1;
    if (tScore < 45) return 2;
    if (tScore < 55) return 3;
    if (tScore < 65) return 4;
    return 5;
}

// Export for usage in other scripts if needed (hacky way via console log or file?)
// For now just logging stats for the unification script to use manually or parsing
console.log(`STATS_OUTSIDE:${meanOutside},${stdDevOutside}`);

console.log(`Found ${spotBlocks.length} spots (Total)`);

const updates = [];
const stats = { city: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, outside: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

for (const block of spotBlocks) {
    const text = block.content;
    const idMatch = text.match(/"id"\s*:\s*"(spot-\d+)"/);
    const latMatch = text.match(/"latitude"\s*:\s*([\d.]+)/);
    const lonMatch = text.match(/"longitude"\s*:\s*([\d.]+)/);

    if (!idMatch || !latMatch || !lonMatch) continue;

    const spotId = idMatch[1];
    const lat = parseFloat(latMatch[1]);
    const lon = parseFloat(lonMatch[1]);

    const isCity = isInKyotoCity(lat, lon);
    const meshCode = latLonToMesh1km(lat, lon);
    const population = analysis.meshPopulations[meshCode] || 0;

    let newLevel;
    if (isCity) {
        const tScore = getTScore(population);
        newLevel = getLevelFromTScore(tScore);
        stats.city[newLevel]++;
    } else {
        newLevel = getLevelOutside(population);
        stats.outside[newLevel]++;
    }

    updates.push({
        spotId,
        start: block.start,
        end: block.end,
        newContent: block.content.replace(/"congestionLevel"\s*:\s*\d+/, `"congestionLevel": ${newLevel}`)
    });
}

// 7. Apply Updates
updates.sort((a, b) => b.start - a.start);
let result = spotServiceContent;
for (const update of updates) {
    result = result.substring(0, update.start) + update.newContent + result.substring(update.end);
}

// 8. Update Header
const newHeader = `import { Spot, Coordinates } from '../types';
import { getCongestionLevel } from './humanFlowService';

// 京都府観光施設データ
// 混雑度: 全エリアで偏差値(対数正規分布T-score)基準を採用
// 基準: L1(T<35), L2(35≤T<45), L3(45≤T<55), L4(55≤T<65), L5(T≥65)
// ※計算母集団は「市内観光地」と「市外観光地」で分離
const KYOTO_SPOTS: Spot[] = [`;

const oldHeaderEnd = result.indexOf('const KYOTO_SPOTS: Spot[] = [') + 'const KYOTO_SPOTS: Spot[] = ['.length;
result = newHeader + result.substring(oldHeaderEnd);

fs.writeFileSync(spotServicePath, result, 'utf8');

console.log('\n=== Update Complete ===');
console.log('City Distribution:');
console.log(JSON.stringify(stats.city, null, 2));
console.log('Outside Distribution:');
console.log(JSON.stringify(stats.outside, null, 2));
