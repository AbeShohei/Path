// Script to generate TypeScript data file from human flow analysis
const fs = require('fs');
const path = require('path');

const analysisPath = path.join(__dirname, 'human_flow_analysis.json');
const outputPath = path.join(__dirname, 'data/meshPopulationData.ts');

// Read analysis results
const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

// Generate TypeScript file
let tsContent = `/**
 * Mesh Population Data
 * 
 * Pre-calculated 3-year December average population per 1km mesh.
 * Source: opendata/human (2019-2021 December data)
 * 
 * Total mesh codes: ${analysis.totalMeshCodes}
 * 
 * Congestion Thresholds (percentile-based):
 * - Level 1 (快適): 0-${analysis.thresholds.level1Max}
 * - Level 2 (やや快適): ${analysis.thresholds.level1Max + 1}-${analysis.thresholds.level2Max}
 * - Level 3 (通常): ${analysis.thresholds.level2Max + 1}-${analysis.thresholds.level3Max}
 * - Level 4 (やや混雑): ${analysis.thresholds.level3Max + 1}-${analysis.thresholds.level4Max}
 * - Level 5 (混雑): ${analysis.thresholds.level4Max + 1}+
 */

export const MESH_POPULATION_DATA: Record<string, number> = {
`;

// Add mesh population entries
const entries = Object.entries(analysis.meshPopulations);
for (let i = 0; i < entries.length; i++) {
    const [mesh, pop] = entries[i];
    tsContent += `  '${mesh}': ${pop}`;
    if (i < entries.length - 1) tsContent += ',';
    tsContent += '\n';
}

tsContent += `};

/**
 * Get population for a mesh code
 * @param meshCode 8-digit mesh code
 * @returns Population count or 0 if not found
 */
export function getMeshPopulation(meshCode: string): number {
  return MESH_POPULATION_DATA[meshCode] ?? 0;
}
`;

// Ensure data directory exists
const dataDir = path.dirname(outputPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

fs.writeFileSync(outputPath, tsContent, 'utf8');
console.log(`Generated: ${outputPath}`);
console.log(`Total entries: ${entries.length}`);
