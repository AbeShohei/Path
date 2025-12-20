/**
 * Fetch NAVITIME route data and save as mock files
 * Run: node fetch-navitime-mock.cjs
 */

const fs = require('fs');
const path = require('path');

// RapidAPI credentials from .env.local
require('dotenv').config({ path: '.env.local' });

const RAPIDAPI_KEY = process.env.X_RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'navitime-route-totalnavi.p.rapidapi.com';

const ROUTE_SEARCH_URL = 'https://navitime-route-totalnavi.p.rapidapi.com/route_transit';
const ROUTE_SHAPE_URL = 'https://navitime-route-totalnavi.p.rapidapi.com/shape_transit';

// Default test route: Kyoto Station to Bishamondo Temple
const DEFAULT_START = '34.9858,135.7588';
const DEFAULT_GOAL = '35.001311,135.818806';

function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function fetchAndSaveMockData(start = DEFAULT_START, goal = DEFAULT_GOAL) {
    if (!RAPIDAPI_KEY) {
        console.error('❌ VITE_RAPIDAPI_KEY not found in .env.local');
        process.exit(1);
    }

    const startTime = formatDateTime(new Date());
    console.log(`\n🚃 Fetching NAVITIME routes from ${start} to ${goal}`);
    console.log(`📅 Start time: ${startTime}\n`);

    const headers = {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
    };

    try {
        // 1. Fetch route_transit data
        const searchParams = new URLSearchParams({ start, goal, start_time: startTime });
        const searchUrl = `${ROUTE_SEARCH_URL}?${searchParams}`;

        console.log('📡 Fetching route_transit...');
        const searchResponse = await fetch(searchUrl, { headers });

        if (!searchResponse.ok) {
            throw new Error(`Route Search API error: ${searchResponse.status} ${searchResponse.statusText}`);
        }

        const searchData = await searchResponse.json();

        // Save route_transit.json
        const routeFile = path.join(__dirname, 'public/mocks/route_transit.json');
        fs.writeFileSync(routeFile, JSON.stringify(searchData, null, 2));
        console.log(`✅ Saved: ${routeFile}`);
        console.log(`   Found ${searchData.items?.length || 0} routes\n`);

        // 2. Fetch shape_transit for each route
        const routeCount = searchData.items?.length || 0;

        for (let i = 0; i < routeCount; i++) {
            const routeNo = i + 1;
            console.log(`📡 Fetching shape_transit for route ${routeNo}...`);

            const shapeParams = new URLSearchParams({
                start,
                goal,
                start_time: startTime,
                no: routeNo.toString(),
                format: 'geojson',
                options: 'transport_shape'
            });

            const shapeUrl = `${ROUTE_SHAPE_URL}?${shapeParams}`;
            const shapeResponse = await fetch(shapeUrl, { headers });

            if (shapeResponse.ok) {
                const shapeData = await shapeResponse.json();
                const shapeFile = path.join(__dirname, `public/mocks/shape_transit_${routeNo}.json`);
                fs.writeFileSync(shapeFile, JSON.stringify(shapeData, null, 2));
                console.log(`✅ Saved: ${shapeFile}`);
            } else {
                console.warn(`⚠️ Failed to fetch shape for route ${routeNo}: ${shapeResponse.status}`);
            }
        }

        console.log('\n🎉 Mock data saved successfully!');
        console.log('📁 Files saved to: public/mocks/');
        console.log('\n💡 To use mock data, set USE_MOCK_DATA = true in navitimeService.ts');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the script
fetchAndSaveMockData();
