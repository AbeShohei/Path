const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUS_GTFS_DIR = path.join(PROJECT_ROOT, 'opendata', 'kyoto_bus_gtfs');
const SUBWAY_GTFS_DIR = path.join(PROJECT_ROOT, 'opendata', 'kyoto_subway_gtfs');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public', 'data', 'timetables');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Data structures
// routes[routeId] = { serviceTypes: { 'weekday': [trips...], 'saturday': [], 'sunday': [] } }
// trip object: { id, dir, stops: { stopId: timeStr } } 
// To save space, we might optimize: stops: [ { s: stopId, t: time } ]
// Even better: patterns.

// Service ID mapping
const serviceIdMap = new Map(); // serviceId -> 'weekday' | 'saturday' | 'sunday'

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
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            obj[h] = val;
        });
        result.push(obj);
    }
    return result;
}

function readCsv(filePath) {
    if (!fs.existsSync(filePath)) return [];
    return parseCsvSimple(fs.readFileSync(filePath, 'utf8'));
}

async function processFeed(gtfsDir, typePrefix) {
    console.log(`Processing ${typePrefix} from ${gtfsDir}...`);

    // 1. Calendar (Map Service IDs)
    const calendarData = readCsv(path.join(gtfsDir, 'calendar.txt'));
    calendarData.forEach(c => {
        // Simple heuristic for Kyoto City Bus/Subway
        // monday..friday=1 -> weekday
        // saturday=1 -> saturday
        // sunday=1 -> sunday
        // If multiple, prioritize Weekday > Saturday > Sunday? No, usually distinct.
        // But some service_ids might cover all (e.g. valid all week).
        // Let's create a bitmask or just simple classification.
        let type = 'unknown';
        const isWeekday = c.monday === '1' && c.tuesday === '1' && c.wednesday === '1' && c.thursday === '1' && c.friday === '1';
        const isSaturday = c.saturday === '1';
        const isSunday = c.sunday === '1';

        if (isWeekday && !isSaturday && !isSunday) type = 'weekday';
        else if (!isWeekday && isSaturday && !isSunday) type = 'saturday';
        else if (!isWeekday && !isSaturday && isSunday) type = 'sunday';
        else if (isWeekday && isSaturday && isSunday) type = 'all'; // Rare?

        // Manual override based on ID convention if needed
        // 01001 -> Weekday, 03001 -> Saturday, 02001 -> Sunday from inspection

        serviceIdMap.set(c.service_id, type);
    });

    // 2. Trips
    // Map trip_id -> { routeId, serviceId, directionId }
    const tripsData = readCsv(path.join(gtfsDir, 'trips.txt'));
    const tripInfo = new Map();
    const routeTrips = new Map(); // routeId -> [tripIds]

    tripsData.forEach(t => {
        // Store info
        const routeId = `${typePrefix}_${t.route_id}`;
        const serviceType = serviceIdMap.get(t.service_id) || 'weekday'; // Default to weekday if unknown
        tripInfo.set(t.trip_id, {
            routeId: routeId,
            serviceType: serviceType,
            directionId: t.direction_id || '0',
            stops: [] // Will fill with { s: stopId, t: time, seq: sequence }
        });

        if (!routeTrips.has(routeId)) {
            routeTrips.set(routeId, []);
        }
        routeTrips.get(routeId).push(t.trip_id);
    });

    console.log(`- Mapped ${tripsData.length} trips.`);

    // 3. Stop Times (Stream)
    const stopTimesPath = path.join(gtfsDir, 'stop_times.txt');
    if (fs.existsSync(stopTimesPath)) {
        console.log(`- Reading stop_times.txt...`);
        const fileStream = fs.createReadStream(stopTimesPath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let header = null;
        let idxTrip = -1, idxArr = -1, idxStop = -1, idxSeq = -1;

        for await (const line of rl) {
            if (!line.trim()) continue;
            if (!header) {
                header = line.split(',').map(h => h.trim());
                idxTrip = header.indexOf('trip_id');
                idxArr = header.indexOf('arrival_time'); // or departure_time
                idxStop = header.indexOf('stop_id');
                idxSeq = header.indexOf('stop_sequence');
                continue;
            }

            const p = line.split(',');
            const tripId = p[idxTrip];
            const time = p[idxArr]; // HH:MM:SS
            const stopId = `${typePrefix}_${p[idxStop]}`;
            const seq = parseInt(p[idxSeq]);

            const info = tripInfo.get(tripId);
            if (info) {
                // Filter out seconds to save space? "05:47:00" -> "05:47"
                const shortTime = time.substring(0, 5);
                info.stops.push({ s: stopId, t: shortTime, seq: seq });
            }
        }
    }

    // 4. Group and Save per Route
    console.log(`- Generating JSONs...`);

    for (const [routeId, tripIds] of routeTrips) {
        // Structure: 
        // { 
        //   "weekday": [ { "d": 0, "st": [ { s: id, t: time }...] } ],
        //   "saturday": ...,
        //   "sunday": ...
        // }
        // Optimization: Many trips have same stop sequence. grouping by pattern is complex so just simple array first.
        // Even simpler: Stop-centric?
        // RouteService needs: "At Stop Start, find next Bus".
        // So: StopID -> ServiceType -> [ { time, tripId, endStopTimes... } ]

        // Let's stick to Trip-centric list, client filters by start stop.
        // { "weekday": [ { id: tripId, d: direction, stops: [ {s, t}, {s, t}... ] } ] }

        const output = {
            weekdays: [],
            saturdays: [],
            sundays: []
        };

        for (const tid of tripIds) {
            const t = tripInfo.get(tid);
            // Sort stops by sequence
            t.stops.sort((a, b) => a.seq - b.seq);

            // Minimal trip object
            const tripObj = {
                id: tid,
                d: t.directionId,
                st: t.stops.map(s => ({ s: s.s, t: s.t })) // s: stopId, t: time
            };

            if (t.serviceType === 'weekday') output.weekdays.push(tripObj);
            else if (t.serviceType === 'saturday') output.saturdays.push(tripObj);
            else if (t.serviceType === 'sunday') output.sundays.push(tripObj);
        }

        // Sort trips by first stop time (simplifies search)
        const sorter = (a, b) => {
            if (a.st.length === 0) return 0;
            if (b.st.length === 0) return 0;
            return a.st[0].t.localeCompare(b.st[0].t);
        };
        output.weekdays.sort(sorter);
        output.saturdays.sort(sorter);
        output.sundays.sort(sorter);

        const outPath = path.join(OUTPUT_DIR, `${routeId}.json`);
        fs.writeFileSync(outPath, JSON.stringify(output));
    }
}

async function main() {
    await processFeed(BUS_GTFS_DIR, 'bus');
    await processFeed(SUBWAY_GTFS_DIR, 'subway');
    console.log('Done.');
}

main().catch(console.error);
