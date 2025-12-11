// Script to update spotService.ts with human flow data congestion levels
const fs = require('fs');
const path = require('path');

// Import analysis data
const analysisPath = path.join(__dirname, 'human_flow_analysis.json');
const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

// Thresholds from analysis
const THRESHOLDS = {
    LEVEL_1_MAX: analysis.thresholds.level1Max,  // 14
    LEVEL_2_MAX: analysis.thresholds.level2Max,  // 30
    LEVEL_3_MAX: analysis.thresholds.level3Max,  // 113
    LEVEL_4_MAX: analysis.thresholds.level4Max,  // 672
};

/**
 * Convert lat/lon to 1km mesh code (8 digits)
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
 * Get congestion level (1-5) from population
 */
function populationToCongestionLevel(population) {
    if (population <= THRESHOLDS.LEVEL_1_MAX) return 1;
    if (population <= THRESHOLDS.LEVEL_2_MAX) return 2;
    if (population <= THRESHOLDS.LEVEL_3_MAX) return 3;
    if (population <= THRESHOLDS.LEVEL_4_MAX) return 4;
    return 5;
}

// Read current spotService.ts
const spotServicePath = path.join(__dirname, 'services/spotService.ts');
let spotServiceContent = fs.readFileSync(spotServicePath, 'utf8');

// First, let's extract all spots as objects
// Pattern: Look for { "id": "spot-X", ... } blocks

// Find each spot block between { and }, handling nested objects
const spotBlocks = [];
let depth = 0;
let blockStart = -1;
let inArray = false;

// Find KYOTO_SPOTS array start
const arrayStart = spotServiceContent.indexOf('const KYOTO_SPOTS: Spot[] = [');
if (arrayStart === -1) {
    console.error('Could not find KYOTO_SPOTS array');
    process.exit(1);
}

const content = spotServiceContent.substring(arrayStart);

for (let i = 0; i < content.length; i++) {
    if (content[i] === '[' && !inArray) {
        inArray = true;
    }
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

// Parse each spot and calculate new congestion level
let levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
let matchedSpots = 0;
const updates = [];

for (const block of spotBlocks) {
    const text = block.content;

    // Extract spot ID
    const idMatch = text.match(/"id"\s*:\s*"(spot-\d+)"/);
    if (!idMatch) continue;
    const spotId = idMatch[1];

    // Extract latitude
    const latMatch = text.match(/"latitude"\s*:\s*([\d.]+)/);
    if (!latMatch) continue;
    const lat = parseFloat(latMatch[1]);

    // Extract longitude
    const lonMatch = text.match(/"longitude"\s*:\s*([\d.]+)/);
    if (!lonMatch) continue;
    const lon = parseFloat(lonMatch[1]);

    // Extract current congestion level
    const levelMatch = text.match(/"congestionLevel"\s*:\s*(\d+)/);
    if (!levelMatch) continue;
    const oldLevel = parseInt(levelMatch[1]);

    // Calculate new level from human flow data
    const meshCode = latLonToMesh1km(lat, lon);
    const population = analysis.meshPopulations[meshCode] || 0;
    const newLevel = populationToCongestionLevel(population);

    if (population > 0) matchedSpots++;
    levelCounts[newLevel]++;

    // Store update
    updates.push({
        spotId,
        start: block.start,
        end: block.end,
        oldContent: block.content,
        newContent: block.content.replace(
            /"congestionLevel"\s*:\s*\d+/,
            `"congestionLevel": ${newLevel}`
        ),
        meshCode,
        population,
        oldLevel,
        newLevel
    });
}

console.log(`\nSpots with mesh data: ${matchedSpots}`);
console.log(`\nLevel distribution:`);
console.log(`  Level 1 (快適): ${levelCounts[1]}`);
console.log(`  Level 2 (やや快適): ${levelCounts[2]}`);
console.log(`  Level 3 (通常): ${levelCounts[3]}`);
console.log(`  Level 4 (やや混雑): ${levelCounts[4]}`);
console.log(`  Level 5 (混雑): ${levelCounts[5]}`);

// Apply updates in reverse order (to preserve positions)
updates.sort((a, b) => b.start - a.start);
let result = spotServiceContent;
for (const update of updates) {
    result = result.substring(0, update.start) + update.newContent + result.substring(update.end);
}

// Update the header comment
const newHeader = `import { Spot, Coordinates } from '../types';

// 京都府観光施設データ（260002kankoushisetsu.csvより生成）
// 総数: ${updates.length}件
// 混雑度: 人流データ（opendata/human）2019-2021年12月の3年平均より算出
// 閾値: Level 1 ≤${THRESHOLDS.LEVEL_1_MAX}, Level 2 ≤${THRESHOLDS.LEVEL_2_MAX}, Level 3 ≤${THRESHOLDS.LEVEL_3_MAX}, Level 4 ≤${THRESHOLDS.LEVEL_4_MAX}, Level 5 >${THRESHOLDS.LEVEL_4_MAX}
const KYOTO_SPOTS: Spot[] = [`;

// Replace header
const oldHeaderEnd = result.indexOf('const KYOTO_SPOTS: Spot[] = [') + 'const KYOTO_SPOTS: Spot[] = ['.length;
result = newHeader + result.substring(oldHeaderEnd);

// Write updated file
fs.writeFileSync(spotServicePath, result, 'utf8');

console.log(`\nUpdated spotService.ts with human flow data congestion levels`);
console.log(`Changes: ${updates.length} spots updated`);

// Show some examples
console.log(`\nSample updates:`);
for (let i = 0; i < 10 && i < updates.length; i++) {
    const u = updates[updates.length - 1 - i]; // Show first spots
    console.log(`  ${u.spotId}: mesh=${u.meshCode}, pop=${u.population}, level: ${u.oldLevel} -> ${u.newLevel}`);
}
