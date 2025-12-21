/**
 * Convert GTFS shapes.txt to JSON format for map display
 * 
 * This script:
 * 1. Reads shapes.txt to get polyline coordinates grouped by shape_id
 * 2. Reads routes.txt to get route names and colors
 * 3. Reads trips.txt to map shape_id to route_id
 * 4. Outputs kyoto-bus-routes.json with all routes
 */

const fs = require('fs');
const path = require('path');

const GTFS_DIR = path.join(__dirname, '../opendata/kyoto_bus_gtfs');
const OUTPUT_FILE = path.join(__dirname, '../public/data/kyoto-bus-routes.json');

// Parse CSV file to array of objects
function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

    return lines.slice(1).map(line => {
        // Handle quoted fields with commas
        const values = [];
        let current = '';
        let inQuotes = false;

        for (const char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = values[i]?.replace(/"/g, '') || '';
        });
        return obj;
    });
}

// Main conversion function
function convertGTFStoJSON() {
    console.log('Reading GTFS files...');

    // 1. Parse routes.txt
    const routes = parseCSV(path.join(GTFS_DIR, 'routes.txt'));
    const routeMap = new Map();
    routes.forEach(r => {
        routeMap.set(r.route_id, {
            routeId: r.route_id,
            routeShortName: r.route_short_name,
            routeName: r.route_long_name,
            color: r.route_color ? `#${r.route_color}` : '#0000FF',
            textColor: r.route_text_color ? `#${r.route_text_color}` : '#FFFFFF'
        });
    });
    console.log(`Loaded ${routeMap.size} routes`);

    // 2. Parse trips.txt to map shape_id -> route_id
    const trips = parseCSV(path.join(GTFS_DIR, 'trips.txt'));
    const shapeToRoute = new Map();
    trips.forEach(t => {
        if (t.shape_id && !shapeToRoute.has(t.shape_id)) {
            shapeToRoute.set(t.shape_id, t.route_id);
        }
    });
    console.log(`Loaded ${shapeToRoute.size} shape-to-route mappings`);

    // 3. Parse shapes.txt and group by shape_id
    console.log('Parsing shapes.txt (this may take a moment)...');
    const shapesContent = fs.readFileSync(path.join(GTFS_DIR, 'shapes.txt'), 'utf-8');
    const shapeLines = shapesContent.trim().split(/\r?\n/).slice(1);

    const shapeCoords = new Map();

    shapeLines.forEach(line => {
        const [shape_id, lat, lon, seq] = line.split(',');
        const cleanShapeId = shape_id.replace(/"/g, '');

        if (!shapeCoords.has(cleanShapeId)) {
            shapeCoords.set(cleanShapeId, []);
        }

        shapeCoords.get(cleanShapeId).push({
            seq: parseInt(seq),
            lat: parseFloat(lat),
            lon: parseFloat(lon)
        });
    });
    console.log(`Loaded ${shapeCoords.size} unique shapes`);

    // 4. Build final route data
    const routeData = [];
    const processedRoutes = new Set();

    shapeCoords.forEach((coords, shapeId) => {
        const routeId = shapeToRoute.get(shapeId);
        if (!routeId) return;

        const routeInfo = routeMap.get(routeId);
        if (!routeInfo) return;

        // Skip if we already have this route (use first shape only to reduce data)
        if (processedRoutes.has(routeId)) return;
        processedRoutes.add(routeId);

        // Sort by sequence and extract coordinates
        coords.sort((a, b) => a.seq - b.seq);
        const coordinates = coords.map(c => [c.lat, c.lon]);

        // Simplify: only keep every Nth point to reduce file size
        const SIMPLIFY_FACTOR = 3;
        const simplifiedCoords = coordinates.filter((_, i) => i % SIMPLIFY_FACTOR === 0 || i === coordinates.length - 1);

        routeData.push({
            routeId: routeInfo.routeId,
            routeName: routeInfo.routeName,
            routeShortName: routeInfo.routeShortName,
            color: routeInfo.color,
            description: routeInfo.routeName,
            coordinates: simplifiedCoords
        });
    });

    // Sort by route short name for better organization
    routeData.sort((a, b) => a.routeShortName.localeCompare(b.routeShortName, 'ja'));

    console.log(`Generated ${routeData.length} unique routes`);

    // 5. Write output file
    const output = {
        generatedAt: new Date().toISOString(),
        source: 'ODPT Kyoto City Bus GTFS',
        routeCount: routeData.length,
        routes: routeData
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`Output written to ${OUTPUT_FILE}`);

    // Print statistics
    const totalPoints = routeData.reduce((sum, r) => sum + r.coordinates.length, 0);
    console.log(`Total coordinate points: ${totalPoints}`);
}

// Run
convertGTFStoJSON();
