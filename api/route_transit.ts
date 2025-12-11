import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Build query string from request
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
        if (value) {
            queryParams.append(key, Array.isArray(value) ? value[0] : value);
        }
    }

    const queryString = queryParams.toString();
    const url = `https://navitime-route-totalnavi.p.rapidapi.com/route_transit${queryString ? '?' + queryString : ''}`;



    try {
        const response = await fetch(url, {
            method: req.method || 'GET',
            headers: {
                'x-rapidapi-key': process.env.X_RAPIDAPI_KEY || '',
                'x-rapidapi-host': 'navitime-route-totalnavi.p.rapidapi.com',
            },
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Navitime Route API error:', error);
        res.status(500).json({ error: 'Failed to fetch from Navitime Route API' });
    }
}
