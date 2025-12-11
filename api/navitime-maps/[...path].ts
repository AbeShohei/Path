import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { path } = req.query;
    const targetPath = Array.isArray(path) ? path.join('/') : path || '';

    const url = `https://navitime-maps.p.rapidapi.com/${targetPath}`;

    try {
        const response = await fetch(url, {
            method: req.method,
            headers: {
                'x-rapidapi-key': process.env.X_RAPIDAPI_KEY || '',
                'x-rapidapi-host': 'navitime-maps.p.rapidapi.com',
            },
        });

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const data = await response.json();
            res.status(response.status).json(data);
        } else {
            const text = await response.text();
            res.setHeader('Content-Type', contentType);
            res.status(response.status).send(text);
        }
    } catch (error) {
        console.error('Navitime Maps API error:', error);
        res.status(500).json({ error: 'Failed to fetch from Navitime Maps API' });
    }
}
