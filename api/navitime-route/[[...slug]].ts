import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Extract path after /api/navitime-route/
    const { slug } = req.query;
    const targetPath = Array.isArray(slug) ? slug.join('/') : slug || '';

    // Build query string from request (exclude slug)
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
        if (key !== 'slug' && value) {
            queryParams.append(key, Array.isArray(value) ? value[0] : value);
        }
    }

    const queryString = queryParams.toString();
    const url = `https://navitime-route-totalnavi.p.rapidapi.com/${targetPath}${queryString ? '?' + queryString : ''}`;

    console.log('Proxying to:', url);

    try {
        const response = await fetch(url, {
            method: req.method || 'GET',
            headers: {
                'x-rapidapi-key': process.env.X_RAPIDAPI_KEY || '',
                'x-rapidapi-host': 'navitime-route-totalnavi.p.rapidapi.com',
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
        console.error('Navitime Route API error:', error);
        res.status(500).json({ error: 'Failed to fetch from Navitime Route API' });
    }
}
