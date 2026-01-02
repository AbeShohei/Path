const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Paths
const CSV_PATH = path.join(__dirname, '../opendata/260002kankoushisetsu.csv');
const TARGET_FILE = path.join(__dirname, '../services/spotService.ts');

async function main() {
    console.log('Starting sync...');

    // 1. Read CSV
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const rows = parseCSV(csvContent);
    console.log(`Parsed ${rows.length} rows from CSV.`);

    // Create a map of Name -> Description
    const descMap = new Map();
    rows.forEach(row => {
        const name = row['名称'];
        const desc = row['説明'];
        if (name && desc) {
            descMap.set(name, desc);
        }
    });

    // 2. Read Target File
    let tsContent = fs.readFileSync(TARGET_FILE, 'utf-8');

    // 3. Update Descriptions in TS Content
    // Regex to find: "name": "XXX",\n    "description": "YYY"
    // We need to be careful about matching.

    // Strategy: We will iterate through the lines of the file.
    // When we find "name": "FOO", we assume the NEXT line (or close to it) is "description": "BAR",
    // and we replace "BAR" with the value from our Map.

    const lines = tsContent.split('\n');
    let updatedLines = [];
    let currentSpotName = null;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // check for name
        const nameMatch = line.match(/"name":\s*"(.*)"/);
        if (nameMatch) {
            currentSpotName = nameMatch[1];
            updatedLines.push(line);
            continue;
        }

        // check for description
        if (line.trim().startsWith('"description":') && currentSpotName) {
            if (descMap.has(currentSpotName)) {
                const newDesc = descMap.get(currentSpotName);
                // Escape quotes in description
                const escapedDesc = newDesc.replace(/"/g, '\\"').replace(/\n/g, '\\n');
                const indent = line.substring(0, line.indexOf('"'));
                updatedLines.push(`${indent}"description": "${escapedDesc}",`);
                console.log(`Updated description for: ${currentSpotName}`);
            } else {
                // Keep original if not found in CSV (or log warning)
                // console.warn(`No CSV match for: ${currentSpotName}`);
                updatedLines.push(line);
            }
            currentSpotName = null; // Reset
        } else {
            updatedLines.push(line);
        }
    }

    // 4. Write back
    fs.writeFileSync(TARGET_FILE, updatedLines.join('\n'), 'utf-8');
    console.log('Finished updating spotService.ts');
}

// Simple CSV Parser (handles quoted fields)
function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const row = {};
        const matches = lines[i].matchAll(/(?<=^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g);

        let colIndex = 0;
        for (const match of matches) {
            if (colIndex >= headers.length) break;

            let val = match[1] || match[2] || '';
            val = val.replace(/""/g, '"'); // unescape double quotes
            row[headers[colIndex]] = val;
            colIndex++;
        }
        result.push(row);
    }
    return result;
}

main();
