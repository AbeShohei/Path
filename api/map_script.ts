import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = `https://navitime-maps.p.rapidapi.com/map_script?host=localhost`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': process.env.X_RAPIDAPI_KEY || '',
                'x-rapidapi-host': 'navitime-maps.p.rapidapi.com',
            },
        });

        const text = await response.text();
        res.setHeader('Content-Type', 'application/javascript');
        res.status(response.status).send(text);
    } catch (error) {
        console.error('Navitime Maps API error:', error);
        res.status(500).json({ error: 'Failed to fetch from Navitime Maps API' });
    }
}
