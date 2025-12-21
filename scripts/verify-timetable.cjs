const fs = require('fs');
const path = require('path');

// MOCK CONSTANTS
const routeId = 'bus_20500'; // 205 Clockwise
const testTime = "10:00"; // 10:00 AM
const walkMinutes = 10;
const startStopId = "bus_074095"; // Kyoto Station (approx)
const endStopId = "bus_074092"; // Next one? Let's check IDs in map if needed. 
// Actually I don't know the exact IDs from memory.
// I'll grab a trip from the file first to find valid IDs.

const filePath = path.join(__dirname, '../public/data/timetables', `${routeId}.json`);

if (!fs.existsSync(filePath)) {
    console.error("Timetable not found:", filePath);
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// 1. Pick a Service Type (Weekdays)
const trips = data.weekdays;
console.log(`Loaded ${trips.length} trips for weekdays.`);

if (trips.length === 0) process.exit(0);

// 2. Pick Valid Stops from First Trip
const sampleTrip = trips[0];
const startStop = sampleTrip.st[0];
const endStop = sampleTrip.st[sampleTrip.st.length - 1];

console.log(`Testing Route from ${startStop.s} (${startStop.t}) to ${endStop.s} (${endStop.t})`);

// 3. Simulate "findNextBus" Logic
function findNextBus(timetable, startStopId, endStopId, walkMinutes, nowTimeStr) {
    const [h, m] = nowTimeStr.split(':').map(Number);
    const nowMinutes = h * 60 + m;
    const departureThresholdMinutes = nowMinutes + walkMinutes;

    console.log(`Current Time: ${nowTimeStr}, Walk: ${walkMinutes}m, Threshold: ${Math.floor(departureThresholdMinutes / 60)}:${departureThresholdMinutes % 60}`);

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

const result = findNextBus(trips, startStop.s, endStop.s, walkMinutes, testTime);

if (result) {
    console.log("✅ SUCCESS: Found Next Bus");
    console.log(`   Trip ID: ${result.tripId}`);
    console.log(`   Departure: ${result.departure}`);
    console.log(`   Arrival: ${result.arrival}`);
    console.log(`   Wait after walking: ${result.wait} mins`);
} else {
    console.error("❌ FAILURE: No bus found.");
}
