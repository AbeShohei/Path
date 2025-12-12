// Script to analyze human flow data and calculate congestion thresholds
const fs = require('fs');
const path = require('path');

const OPENDATA_PATH = path.join(__dirname, 'opendata/human');
const CURRENT_MONTH = '12'; // December
const YEARS = ['2019', '2020', '2021'];

// Read CSV file and parse
function parseCSV(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        // Find header row (should be first line)
        const headerLine = lines[0];
        const headers = headerLine.split(',').map(h => h.trim());

        // Find population column index (look for 'population' or 'daytime' columns)
        let popIndex = headers.findIndex(h =>
            h.toLowerCase().includes('population') ||
            h.toLowerCase().includes('daytime') ||
            h.toLowerCase().includes('pop')
        );

        // If no population column found, try to find the value column (usually the last numeric column)
        if (popIndex === -1) {
            // Default: population is often at index 4 or 5 in these files
            for (let i = 4; i < headers.length; i++) {
                if (/^\d+$/.test(lines[1]?.split(',')[i]?.trim())) {
                    popIndex = i;
                    break;
                }
            }
        }

        console.log(`Headers: ${headers.join(' | ')}`);
        console.log(`Population column index: ${popIndex}`);

        const meshData = {};

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const meshCode = values[0]?.trim();
            if (!meshCode || !/^\d{8}$/.test(meshCode)) continue;

            // Get population value
            let population = 0;
            if (popIndex >= 0 && values[popIndex]) {
                population = parseInt(values[popIndex].trim()) || 0;
            }

            meshData[meshCode] = population;
        }

        return meshData;
    } catch (err) {
        console.error(`Error reading ${filePath}: ${err.message}`);
        return {};
    }
}

// Main analysis
function analyze() {
    const allPopulations = [];
    const meshAverages = {};

    console.log('\n=== Analyzing Human Flow Data ===\n');

    // Iterate years and ALL months
    const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

    for (const year of YEARS) {
        for (const month of MONTHS) {
            const csvPath = path.join(
                OPENDATA_PATH,
                year,
                month,
                'monthly_mdp_mesh1km.csv',
                'monthly_mdp_mesh1km.csv' // The structure seems to have double nesting based on file view
            );

            // console.log(`Processing: ${year}/${month}`); // Reduce log noise

            if (!fs.existsSync(csvPath)) {
                // console.log(`  File not found: ${csvPath}`);
                continue;
            }

            const data = parseCSV(csvPath);

            // Accumulate
            for (const [mesh, pop] of Object.entries(data)) {
                if (!meshAverages[mesh]) {
                    meshAverages[mesh] = { total: 0, count: 0 };
                }
                meshAverages[mesh].total += pop;
                meshAverages[mesh].count += 1;
            }
        }
        console.log(`Processed Year: ${year}`);
    }

    // Calculate averages
    console.log('\n\n=== 3-Year Average Statistics ===\n');

    for (const mesh of Object.keys(meshAverages)) {
        meshAverages[mesh].avg = meshAverages[mesh].total / meshAverages[mesh].count;
        allPopulations.push(meshAverages[mesh].avg);
    }

    // Sort populations to calculate percentiles
    allPopulations.sort((a, b) => a - b);

    const p20 = allPopulations[Math.floor(allPopulations.length * 0.2)];
    const p40 = allPopulations[Math.floor(allPopulations.length * 0.4)];
    const p60 = allPopulations[Math.floor(allPopulations.length * 0.6)];
    const p80 = allPopulations[Math.floor(allPopulations.length * 0.8)];
    const p100 = allPopulations[allPopulations.length - 1];

    console.log(`Total mesh codes (3-year): ${allPopulations.length}`);
    console.log(`Min: ${Math.round(allPopulations[0])}`);
    console.log(`Max: ${Math.round(p100)}`);
    console.log(`Median: ${Math.round(allPopulations[Math.floor(allPopulations.length / 2)])}`);

    console.log('\n=== Proposed 5-Level Congestion Thresholds ===\n');
    console.log(`Level 1 (快適):     0 - ${Math.round(p20)}`);
    console.log(`Level 2 (やや快適): ${Math.round(p20)} - ${Math.round(p40)}`);
    console.log(`Level 3 (通常):     ${Math.round(p40)} - ${Math.round(p60)}`);
    console.log(`Level 4 (やや混雑): ${Math.round(p60)} - ${Math.round(p80)}`);
    console.log(`Level 5 (混雑):     ${Math.round(p80)}+`);

    // Output TypeScript constants
    console.log('\n\n=== TypeScript Constants ===\n');
    console.log(`// 5-level congestion thresholds based on 3-year December average`);
    console.log(`export const CONGESTION_THRESHOLDS = {`);
    console.log(`  LEVEL_1_MAX: ${Math.round(p20)},   // 快適`);
    console.log(`  LEVEL_2_MAX: ${Math.round(p40)},   // やや快適`);
    console.log(`  LEVEL_3_MAX: ${Math.round(p60)},   // 通常`);
    console.log(`  LEVEL_4_MAX: ${Math.round(p80)},   // やや混雑`);
    console.log(`  // Level 5: > ${Math.round(p80)} (混雑)`);
    console.log(`};`);

    // Output mesh->congestion lookup for December
    console.log(`\n// Mesh code to population average (December, 3-year avg)`);
    console.log(`export const MESH_POPULATION = {`);
    let count = 0;
    for (const [mesh, data] of Object.entries(meshAverages)) {
        if (count++ < 20) { // Just show first 20 as sample
            console.log(`  '${mesh}': ${Math.round(data.avg)},`);
        }
    }
    console.log(`  // ... ${Object.keys(meshAverages).length} total entries`);
    console.log(`};`);

    return { meshAverages, thresholds: { p20, p40, p60, p80 } };
}

const result = analyze();

// Save analysis results to JSON file
const outputData = {
    month: 'ALL (01-12)',
    years: YEARS,
    totalMeshCodes: Object.keys(result.meshAverages).length,
    thresholds: {
        level1Max: Math.round(result.thresholds.p20),
        level2Max: Math.round(result.thresholds.p40),
        level3Max: Math.round(result.thresholds.p60),
        level4Max: Math.round(result.thresholds.p80)
    },
    description: {
        level1: 'kaitekI (comfortable)',
        level2: 'yaya_kaiteki (somewhat comfortable)',
        level3: 'tsujo (normal)',
        level4: 'yaya_konzatsu (somewhat crowded)',
        level5: 'konzatsu (crowded)'
    },
    meshPopulations: {}
};

for (const [mesh, data] of Object.entries(result.meshAverages)) {
    outputData.meshPopulations[mesh] = Math.round(data.avg);
}

fs.writeFileSync(
    path.join(__dirname, 'human_flow_analysis.json'),
    JSON.stringify(outputData, null, 2),
    'utf8'
);

console.log('Analysis saved to human_flow_analysis.json');
