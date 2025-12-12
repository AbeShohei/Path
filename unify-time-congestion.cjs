const fs = require('fs');
const path = require('path');

// 1. Load Analysis Data to calculate Stats Dynamically
const analysisPath = path.join(__dirname, 'human_flow_analysis.json');
const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

// Helper Data & Functions
const KYOTO_CITY_BOUNDS = { minLat: 34.85, maxLat: 35.12, minLon: 135.55, maxLon: 135.90 };

function isInKyotoCity(lat, lon) {
    return lat >= KYOTO_CITY_BOUNDS.minLat && lat <= KYOTO_CITY_BOUNDS.maxLat &&
        lon >= KYOTO_CITY_BOUNDS.minLon && lon <= KYOTO_CITY_BOUNDS.maxLon;
}

// Convert
function latLonToMesh1km(lat, lon) {
    const lat1 = Math.floor(lat * 1.5); const lon1 = Math.floor(lon) - 100;
    const lat2 = Math.floor((lat * 1.5 - lat1) * 8); const lon2 = Math.floor((lon - Math.floor(lon)) * 8);
    const lat3 = Math.floor(((lat * 1.5 - lat1) * 8 - lat2) * 10); const lon3 = Math.floor(((lon - Math.floor(lon)) * 8 - lon2) * 10);
    return `${lat1 * 100 + lon1}${lat2 * 10 + lon2}${(lat3 * 10 + lon3).toString().padStart(2, '0')}`;
}

// Extract Tourist Spot Meshes (Need to parse spotService.ts again)
console.log('Parsing spotService.ts to extract Tourist Spot Meshes...');
const spotServicePath = path.join(__dirname, 'services/spotService.ts');
const spotServiceContent = fs.readFileSync(spotServicePath, 'utf8');
const citySpotMeshes = new Set();
const outsideSpotMeshes = new Set();

const spotBlocks = [];
let depth = 0, blockStart = -1, inArray = false;
const arrayStart = spotServiceContent.indexOf('const KYOTO_SPOTS: Spot[] = [');
if (arrayStart > 0) {
    const content = spotServiceContent.substring(arrayStart);
    for (let i = 0; i < content.length; i++) {
        if (content[i] === '[' && !inArray) inArray = true;
        if (!inArray) continue;
        if (content[i] === '{') { if (depth === 0) blockStart = i; depth++; }
        else if (content[i] === '}') {
            depth--; if (depth === 0 && blockStart >= 0) {
                spotBlocks.push(content.substring(blockStart, i + 1)); blockStart = -1;
            }
        }
    }
}

for (const block of spotBlocks) {
    const latM = block.match(/"latitude"\s*:\s*([\d.]+)/);
    const lonM = block.match(/"longitude"\s*:\s*([\d.]+)/);
    if (latM && lonM) {
        const lat = parseFloat(latM[1]), lon = parseFloat(lonM[1]);
        const mesh = latLonToMesh1km(lat, lon);
        if (isInKyotoCity(lat, lon)) citySpotMeshes.add(mesh);
        else outsideSpotMeshes.add(mesh);
    }
}

// Calculate Stats
function calcStats(meshes) {
    const logs = [];
    for (const m of meshes) {
        const p = analysis.meshPopulations[m] || 0;
        logs.push(Math.log10(p + 1));
    }
    const n = logs.length;
    if (n === 0) return { mean: 0, stdDev: 1 }; // Fallback
    const mean = logs.reduce((a, b) => a + b, 0) / n;
    const v = logs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    return { mean, stdDev: Math.sqrt(v) };
}

const cityStats = calcStats(citySpotMeshes);
const outsideStats = calcStats(outsideSpotMeshes);

console.log(`City Stats (Spots N=${citySpotMeshes.size}): Mean=${cityStats.mean.toFixed(3)}, StdDev=${cityStats.stdDev.toFixed(3)}`);
console.log(`Outside Stats (Spots N=${outsideSpotMeshes.size}): Mean=${outsideStats.mean.toFixed(3)}, StdDev=${outsideStats.stdDev.toFixed(3)}`);

// 2. Helper to calculate population threshold
function tScoreToPop(t, mean, stdDev) {
    const logVal = mean + ((t - 50) / 10) * stdDev;
    return Math.round(Math.pow(10, logVal) - 1);
}

// 3. Calculate Unified Thresholds
const cityThresholds = {
    level1Max: tScoreToPop(35, cityStats.mean, cityStats.stdDev),
    level2Max: tScoreToPop(45, cityStats.mean, cityStats.stdDev),
    level3Max: tScoreToPop(55, cityStats.mean, cityStats.stdDev),
    level4Max: tScoreToPop(65, cityStats.mean, cityStats.stdDev)
};

const outsideThresholds = {
    level1Max: tScoreToPop(35, outsideStats.mean, outsideStats.stdDev),
    level2Max: tScoreToPop(45, outsideStats.mean, outsideStats.stdDev),
    level3Max: tScoreToPop(55, outsideStats.mean, outsideStats.stdDev),
    level4Max: tScoreToPop(65, outsideStats.mean, outsideStats.stdDev)
};

console.log('City Thresholds:', cityThresholds);
console.log('Outside Thresholds:', outsideThresholds);

// 4. Update human_flow_by_time.json
const jsonPath = path.join(__dirname, 'human_flow_by_time.json');
if (fs.existsSync(jsonPath)) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Apply strict thresholds to ALL time slots
    ['morning', 'noon', 'evening'].forEach(time => {
        data.thresholds.kyotoCity[time] = { ...cityThresholds };
        data.thresholds.outside[time] = { ...outsideThresholds };
    });

    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('\nUpdated human_flow_by_time.json with unified unified thresholds for City AND Outside.');
} else {
    console.error('human_flow_by_time.json not found!');
}
