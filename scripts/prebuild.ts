
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// --- Configuration ---
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'data');
const IMAGES_FILE = path.join(OUTPUT_DIR, 'spot_images.json');
const ROUTES_FILE = path.join(OUTPUT_DIR, 'static_routes.json');
const SPOT_SERVICE_PATH = path.join(process.cwd(), 'services', 'spotService.ts');

// --- Helper: Extract Spots from Source Code ---
function extractSpotNames(): string[] {
    try {
        console.log(`Reading spots from ${SPOT_SERVICE_PATH}...`);
        const content = fs.readFileSync(SPOT_SERVICE_PATH, 'utf-8');
        const regex = /"name":\s*"([^"]+)"/g;
        const matches = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push(match[1]);
        }
        // Deduplicate
        return Array.from(new Set(matches));
    } catch (e) {
        console.error('Failed to read spotService.ts:', e);
        return [];
    }
}

// --- Wikimedia Fetcher ---
async function fetchWikiImage(spotName: string): Promise<string | null> {
    try {
        const headers = { 'User-Agent': 'KyotoGuideApp/1.0 (bot; contact@example.com)' };
        const searchUrl = `https://ja.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(spotName)}&utf8=1&srlimit=1`;
        const searchRes = await fetch(searchUrl, { headers }).then(r => r.json());

        if (!searchRes.query?.search?.[0]) return null;
        const pageId = searchRes.query.search[0].pageid;

        // Get higher quality image (1000px)
        const imgUrl = `https://ja.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&pageids=${pageId}&pithumbsize=1000`;
        const imgRes = await fetch(imgUrl, { headers }).then(r => r.json());

        const page = imgRes.query?.pages?.[pageId];
        return page?.thumbnail?.source || null;
    } catch (e) {
        console.error(`Error fetching image for ${spotName}:`, e);
        return null; // Continue even if error
    }
}

// --- OSRM Fetcher ---
async function fetchWalkingRoute(start: { lat: number, lng: number }, end: { lat: number, lng: number }) {
    const round = (n: number) => Math.round(n * 10000) / 10000;
    const url = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OSRM status: ${res.status}`);
        const data = await res.json();
        if (data.code === 'Ok' && data.routes?.[0]) {
            const path = data.routes[0].geometry.coordinates.map((c: any) => ({
                lat: c[1], lng: c[0]
            }));
            const key = `foot_${round(start.lat)},${round(start.lng)}-${round(end.lat)},${round(end.lng)}`;
            return { key, path };
        }
    } catch (e) {
        console.error('OSRM Fetch Error:', e);
    }
    return null;
}

// --- Main ---
async function main() {
    console.log('Starting Prebuild...');

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // 0. Extract Spots
    const spotNames = extractSpotNames();
    console.log(`Found ${spotNames.length} unique spots.`);

    // 1. Images
    console.log('Fetching Images...');
    const imageCache: Record<string, string> = {};

    // Load existing cache to avoid re-fetching
    if (fs.existsSync(IMAGES_FILE)) {
        try {
            const existing = JSON.parse(fs.readFileSync(IMAGES_FILE, 'utf-8'));
            Object.assign(imageCache, existing);
            console.log(`Loaded ${Object.keys(existing).length} existing images from cache.`);
        } catch (e) {
            console.error('Error reading existing image cache, starting fresh.');
        }
    }

    let fetchedCount = 0;
    for (const name of spotNames) {
        if (imageCache[name]) {
            // Already cached
            continue;
        }

        console.log(`[${fetchedCount + 1}/${spotNames.length}] Fetching image for ${name}...`);
        const url = await fetchWikiImage(name);
        if (url) {
            imageCache[name] = url;
        } else {
            console.log(`  No image found for ${name}`);
        }
        fetchedCount++;

        // Periodic save to avoid losing data if efficient
        if (fetchedCount % 10 === 0) {
            fs.writeFileSync(IMAGES_FILE, JSON.stringify(imageCache, null, 2));
        }

        // Polite delay
        await new Promise(r => setTimeout(r, 200));
    }

    // Final Save
    fs.writeFileSync(IMAGES_FILE, JSON.stringify(imageCache, null, 2));
    console.log(`Total images cached: ${Object.keys(imageCache).length}`);
    console.log(`Saved to ${IMAGES_FILE}`);

    // 2. Routes (Keep existing Sekizan logic lightly)
    console.log('Fetching Key Routes...');
    const routeCache: Record<string, any> = {};
    if (fs.existsSync(ROUTES_FILE)) {
        try {
            Object.assign(routeCache, JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf-8')));
        } catch { }
    }

    // Sekizan Zenin special case (always nice to have)
    const sekizanName = "赤山禅院";
    if (spotNames.includes(sekizanName)) {
        // Eizan Electric Railway Shugakuin Station to Sekizan Zenin
        const start = { lat: 35.05270209, lng: 135.79254638 };
        const end = { lat: 35.056189, lng: 135.801649 };

        const result = await fetchWalkingRoute(start, end);
        if (result) {
            routeCache[result.key] = result.path;
            console.log('Refreshed/Fetched Sekizan Zenin Route');
        }
    }

    fs.writeFileSync(ROUTES_FILE, JSON.stringify(routeCache, null, 2));
    console.log('Prebuild Complete.');
}

main().catch(console.error);
