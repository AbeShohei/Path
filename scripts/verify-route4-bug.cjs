const fs = require('fs');
const path = require('path');

// MOCK CONSTANTS for Route 4
const routeId = 'bus_00400'; // Assuming 4 is 00400 (or 403/404?)
// Let's load 00400 first.
// Need to find valid stop IDs for Kyoto Station -> Kamigamo.
// Kyoto Station: bus_074095 (approx)
// Kamigamo: bus_376045 ?
// I will blindly grab the first and last stop from a trip to test connectivity first.

const filePath = path.join(__dirname, '../public/data/timetables', `${routeId}.json`);
if (!fs.existsSync(filePath)) {
    console.error("File not found");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
// Weekdays
const trips = data.weekdays;
if (!trips.length) { console.error("No trips"); process.exit(1); }

// Find a trip that looks like it goes from Kyoto Station.
// I'll search for a trip that contains "bus_061216" (Kyoto Station generic?) or just use the first trip's start/end.
const sampleTrip = trips[0];
const startStopId = sampleTrip.st[0].s;  // First stop
const endStopId = sampleTrip.st[sampleTrip.st.length - 1].s; // Last stop
const startStopName = "Start";
const endStopName = "End";

console.log(`Testing Route 4 (${routeId}) from ${startStopId} to ${endStopId}`);
console.log(`Timetable has ${trips.length} trips.`);
console.log(`First Trip: ${sampleTrip.st[0].t} -> ${sampleTrip.st[sampleTrip.st.length - 1].t}`);

// Test Time: 04:30
const testTime = "04:30";
const walkMinutes = 10;

function findNextBus(timetable, startStopId, endStopId, walkMinutes, nowTimeStr) {
    const [h, m] = nowTimeStr.split(':').map(Number);
    const nowMinutes = h * 60 + m;
    const departureThresholdMinutes = nowMinutes + walkMinutes;

    console.log(`Current Time: ${nowTimeStr}, Threshold: ${Math.floor(departureThresholdMinutes / 60)}:${departureThresholdMinutes % 60} (${departureThresholdMinutes} mins)`);

    for (const trip of timetable) {
        let startIdx = -1;
        let endIdx = -1;

        for (let i = 0; i < trip.st.length; i++) {
            if (trip.st[i].s === startStopId) startIdx = i;
            if (trip.st[i].s === endStopId) endIdx = i;
        }

        if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
            const sStop = trip.st[startIdx];
            const eStop = trip.st[endIdx];

            const [th, tm] = sStop.t.split(':').map(Number);
            const tripTimeVal = th * 60 + tm;

            // Debug first few checks
            // console.log(`Checking trip ${trip.id}: Departs ${sStop.t} (${tripTimeVal})`);

            if (tripTimeVal >= departureThresholdMinutes) {
                return {
                    tripId: trip.id,
                    departure: sStop.t,
                    arrival: eStop.t,
                    wait: tripTimeVal - departureThresholdMinutes
                };
            }
        }
    }
    return null;
}

const result = findNextBus(trips, startStopId, endStopId, walkMinutes, testTime);

if (result) {
    console.log("✅ SUCCESS: Found Next Bus");
    console.log(`   Trip ID: ${result.tripId}`);
    console.log(`   Departure: ${result.departure}`);
    console.log(`   Arrival: ${result.arrival}`);
} else {
    console.error("❌ FAILURE: No bus found. This will trigger Simulated Fallback in the app.");
}
