// Debug script to test NAVITIME Shape Transit API - Output full JSON
const fetch = require('node-fetch');
const fs = require('fs');

const API_KEY = 'd37a9b71d9msh7587348f5a10596p1fea69jsn6465defcda59';

async function testShapeTransit() {
    // Kyoto Station to Kinkaku-ji
    const start = '34.9858,135.7588';
    const goal = '35.0394,135.7294';
    const startTime = new Date().toISOString().slice(0, 19);

    console.log('Testing NAVITIME APIs...');

    try {
        // Test shape_transit
        const shapeUrl = `https://navitime-route-totalnavi.p.rapidapi.com/shape_transit?start=${start}&goal=${goal}&start_time=${startTime}&no=1&format=geojson&options=transport_shape`;

        const shapeRes = await fetch(shapeUrl, {
            headers: {
                'x-rapidapi-key': API_KEY,
                'x-rapidapi-host': 'navitime-route-totalnavi.p.rapidapi.com'
            }
        });

        if (!shapeRes.ok) {
            console.log('Shape Transit Error:', shapeRes.status, await shapeRes.text());
            return;
        }

        const shapeData = await shapeRes.json();

        // Save to file for inspection
        fs.writeFileSync('shape_response.json', JSON.stringify(shapeData, null, 2));
        console.log('Shape response saved to shape_response.json');

        // Summary
        console.log('\nFeatures Summary:');
        shapeData.features?.forEach((feat, i) => {
            const props = feat.properties || {};
            const geom = feat.geometry || {};
            console.log(`[${i}] ways: "${props.ways}", coords: ${geom.coordinates?.length || 0}`);
        });

    } catch (e) {
        console.error('Error:', e.message);
    }
}

testShapeTransit();
