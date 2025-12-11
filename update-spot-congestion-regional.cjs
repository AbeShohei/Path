// Script to update spotService.ts with regional congestion thresholds
const fs = require('fs');
const path = require('path');

// Load regional analysis
const analysisPath = path.join(__dirname, 'human_flow_analysis_regional.json');
const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

const KYOTO_CITY_BOUNDS = analysis.kyotoCityBounds;
const THRESHOLDS = analysis.thresholds;

/**
 * Convert lat/lon to 1km mesh code
 */
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

/**
 * Check if coordinates are in Kyoto city
 */
function isInKyotoCity(lat, lon) {
    return lat >= KYOTO_CITY_BOUNDS.minLat &&
        lat <= KYOTO_CITY_BOUNDS.maxLat &&
        lon >= KYOTO_CITY_BOUNDS.minLon &&
        lon <= KYOTO_CITY_BOUNDS.maxLon;
}

/**
 * Get congestion level with regional thresholds
 */
function populationToCongestionLevel(population, isCity) {
    const t = isCity ? THRESHOLDS.kyotoCity : THRESHOLDS.outside;
    if (population <= t.level1Max) return 1;
    if (population <= t.level2Max) return 2;
    if (population <= t.level3Max) return 3;
    if (population <= t.level4Max) return 4;
    return 5;
}

// Read spotService.ts
const spotServicePath = path.join(__dirname, 'services/spotService.ts');
let spotServiceContent = fs.readFileSync(spotServicePath, 'utf8');

// Find KYOTO_SPOTS array
const arrayStart = spotServiceContent.indexOf('const KYOTO_SPOTS: Spot[] = [');
if (arrayStart === -1) {
    console.error('Could not find KYOTO_SPOTS array');
    process.exit(1);
}

const content = spotServiceContent.substring(arrayStart);

// Parse spot blocks
const spotBlocks = [];
let depth = 0;
let blockStart = -1;
let inArray = false;

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

console.log(`Found ${spotBlocks.length} spot blocks`);

// Process each spot
let levelCounts = {
    city: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    outside: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
};
const updates = [];

for (const block of spotBlocks) {
    const text = block.content;

    const idMatch = text.match(/"id"\s*:\s*"(spot-\d+)"/);
    const latMatch = text.match(/"latitude"\s*:\s*([\d.]+)/);
    const lonMatch = text.match(/"longitude"\s*:\s*([\d.]+)/);
    const levelMatch = text.match(/"congestionLevel"\s*:\s*(\d+)/);

    if (!idMatch || !latMatch || !lonMatch || !levelMatch) continue;

    const spotId = idMatch[1];
    const lat = parseFloat(latMatch[1]);
    const lon = parseFloat(lonMatch[1]);
    const oldLevel = parseInt(levelMatch[1]);

    const isCity = isInKyotoCity(lat, lon);
    const meshCode = latLonToMesh1km(lat, lon);
    const population = analysis.meshPopulations[meshCode] || 0;
    const newLevel = populationToCongestionLevel(population, isCity);

    if (isCity) levelCounts.city[newLevel]++;
    else levelCounts.outside[newLevel]++;

    updates.push({
        spotId, lat, lon, isCity, meshCode, population, oldLevel, newLevel,
        start: block.start, end: block.end, content: block.content,
        newContent: block.content.replace(/"congestionLevel"\s*:\s*\d+/, `"congestionLevel": ${newLevel}`)
    });
}

console.log(`\n=== Level Distribution ===`);
console.log(`\nKyoto City spots:`);
console.log(`  Level 1: ${levelCounts.city[1]}`);
console.log(`  Level 2: ${levelCounts.city[2]}`);
console.log(`  Level 3: ${levelCounts.city[3]}`);
console.log(`  Level 4: ${levelCounts.city[4]}`);
console.log(`  Level 5: ${levelCounts.city[5]}`);

console.log(`\nOutside spots:`);
console.log(`  Level 1: ${levelCounts.outside[1]}`);
console.log(`  Level 2: ${levelCounts.outside[2]}`);
console.log(`  Level 3: ${levelCounts.outside[3]}`);
console.log(`  Level 4: ${levelCounts.outside[4]}`);
console.log(`  Level 5: ${levelCounts.outside[5]}`);

// Apply updates
updates.sort((a, b) => b.start - a.start);
let result = spotServiceContent;
for (const update of updates) {
    result = result.substring(0, update.start) + update.newContent + result.substring(update.end);
}

// Update header
const citySpots = Object.values(levelCounts.city).reduce((a, b) => a + b, 0);
const outsideSpots = Object.values(levelCounts.outside).reduce((a, b) => a + b, 0);

const newHeader = `import { Spot, Coordinates } from '../types';

// 京都府観光施設データ（260002kankoushisetsu.csvより生成）
// 総数: ${updates.length}件（京都市内: ${citySpots}件, 市外: ${outsideSpots}件）
// 混雑度: 人流データ（opendata/human）2019-2021年12月の3年平均より算出
// 京都市内閾値: L1≤${THRESHOLDS.kyotoCity.level1Max}, L2≤${THRESHOLDS.kyotoCity.level2Max}, L3≤${THRESHOLDS.kyotoCity.level3Max}, L4≤${THRESHOLDS.kyotoCity.level4Max}
// 市外閾値: L1≤${THRESHOLDS.outside.level1Max}, L2≤${THRESHOLDS.outside.level2Max}, L3≤${THRESHOLDS.outside.level3Max}, L4≤${THRESHOLDS.outside.level4Max}
const KYOTO_SPOTS: Spot[] = [`;

const oldHeaderEnd = result.indexOf('const KYOTO_SPOTS: Spot[] = [') + 'const KYOTO_SPOTS: Spot[] = ['.length;
result = newHeader + result.substring(oldHeaderEnd);

fs.writeFileSync(spotServicePath, result, 'utf8');
console.log(`\nUpdated spotService.ts with regional thresholds`);

// Show samples
console.log(`\nSample Kyoto City spots:`);
updates.filter(u => u.isCity).slice(0, 5).forEach(u => {
    console.log(`  ${u.spotId}: pop=${u.population}, level=${u.newLevel}`);
});

console.log(`\nSample Outside spots:`);
updates.filter(u => !u.isCity).slice(0, 5).forEach(u => {
    console.log(`  ${u.spotId}: pop=${u.population}, level=${u.newLevel}`);
});
