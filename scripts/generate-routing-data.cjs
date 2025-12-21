const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUS_GTFS_DIR = path.join(PROJECT_ROOT, 'opendata', 'kyoto_bus_gtfs');
const SUBWAY_GTFS_DIR = path.join(PROJECT_ROOT, 'opendata', 'kyoto_subway_gtfs');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'public', 'data', 'kyoto-stops-graph.json');

// Simple CSV Parser for small files
function parseCsvSimple(content) {
    const lines = content.split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',');
        const obj = {};
        headers.forEach((h, index) => {
            let val = values[index] || '';
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
            }
            obj[h] = val;
        });
        result.push(obj);
    }
    return result;
}

// Helper to read CSV (sync)
function readCsv(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    return parseCsvSimple(content);
}

// Data storage
const stopsMap = new Map(); // id -> { name, lat, lon, routes: Set<routeId> }
const routesMap = new Map(); // id -> { name, color, type }

async function processFeed(gtfsDir, typePrefix) {
    console.log(`Processing ${typePrefix} from ${gtfsDir}...`);

    // 1. Process Routes
    const routesData = readCsv(path.join(gtfsDir, 'routes.txt'));
    const feedRouteids = new Set();

    routesData.forEach(r => {
        const routeId = `${typePrefix}_${r.route_id}`;
        feedRouteids.add(r.route_id);
        routesMap.set(routeId, {
            id: routeId,
            short_name: r.route_short_name || '',
            long_name: r.route_long_name || '',
            color: r.route_color ? `#${r.route_color}` : '#000000',
            text_color: r.route_text_color ? `#${r.route_text_color}` : '#ffffff',
            type: typePrefix
        });
    });
    console.log(`- Loaded ${routesData.length} routes.`);

    // 2. Process Stops
    const stopsData = readCsv(path.join(gtfsDir, 'stops.txt'));
    stopsData.forEach(s => {
        const stopId = `${typePrefix}_${s.stop_id}`;
        if (!stopsMap.has(stopId)) {
            stopsMap.set(stopId, {
                id: stopId,
                name: s.stop_name || '',
                lat: parseFloat(s.stop_lat),
                lng: parseFloat(s.stop_lon),
                routes: new Set()
            });
        }
    });
    console.log(`- Loaded ${stopsData.length} stops.`);

    // 3. Process Trips (Map trip_id -> route_id)
    // trips.txt can be large but likely fits in memory. If this fails, use stream too.
    const tripsData = readCsv(path.join(gtfsDir, 'trips.txt'));
    const tripToRoute = new Map();
    tripsData.forEach(t => {
        if (feedRouteids.has(t.route_id)) {
            tripToRoute.set(t.trip_id, `${typePrefix}_${t.route_id}`);
        }
    });
    console.log(`- Mapped ${tripsData.length} trips.`);

    // 4. Process Stop Times (Link Stop -> Route) - STREAMING
    const stopTimesPath = path.join(gtfsDir, 'stop_times.txt');
    if (fs.existsSync(stopTimesPath)) {
        console.log(`- Reading stop_times.txt (streaming)...`);

        // Check header first
        const headerStream = fs.createReadStream(stopTimesPath, { start: 0, end: 1000 }); // Read first chunk for header
        // Actually simpler to just stream line by line and track first line.

        const fileStream = fs.createReadStream(stopTimesPath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let header = null;
        let tripIdIdx = -1;
        let stopIdIdx = -1;
        let count = 0;

        for await (const line of rl) {
            if (!line.trim()) continue;

            if (!header) {
                header = line.split(',').map(h => h.trim());
                tripIdIdx = header.indexOf('trip_id');
                stopIdIdx = header.indexOf('stop_id');
                if (tripIdIdx === -1 || stopIdIdx === -1) {
                    console.error('Error: trip_id or stop_id column not found in stop_times.txt');
                    return;
                }
                continue;
            }

            const parts = line.split(',');
            const tripId = parts[tripIdIdx];
            const stopIdRaw = parts[stopIdIdx];
            const stopId = `${typePrefix}_${stopIdRaw}`;

            const routeId = tripToRoute.get(tripId);
            if (routeId && stopsMap.has(stopId)) {
                stopsMap.get(stopId).routes.add(routeId);
            }
            count++;
            if (count % 100000 === 0) process.stdout.write(`.`);
        }
        console.log(`\n- Processed ${count} stop_times entries.`);
    }
}

async function main() {
    await processFeed(BUS_GTFS_DIR, 'bus');
    await processFeed(SUBWAY_GTFS_DIR, 'subway');

    // Convert Sets to Arrays for JSON serialization
    const stopsOutput = {};
    stopsMap.forEach((val, key) => {
        if (val.routes.size > 0) {
            stopsOutput[key] = {
                ...val,
                routes: Array.from(val.routes)
            };
        }
    });

    const routesOutput = {};
    routesMap.forEach((val, key) => {
        routesOutput[key] = val;
    });

    const finalJson = {
        generated: new Date().toISOString(),
        stops: stopsOutput,
        routes: routesOutput
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalJson, null, 2));
    console.log(`\nSuccess! Graph data written to ${OUTPUT_FILE}`);
    console.log(`Total Stops (served): ${Object.keys(stopsOutput).length}`);
    console.log(`Total Routes: ${Object.keys(routesOutput).length}`);
}

main().catch(console.error);
