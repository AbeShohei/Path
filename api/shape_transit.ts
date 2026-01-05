import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const queryString = new URLSearchParams(req.query as any).toString();
    const url = `https://navitime-route-totalnavi.p.rapidapi.com/shape_transit${queryString ? '?' + queryString : ''}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'X-RapidAPI-Key': process.env.VITE_NAVITIME_API_KEY || '',
                'X-RapidAPI-Host': 'navitime-route-totalnavi.p.rapidapi.com'
            }
        });
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch shape' });
    }
}
