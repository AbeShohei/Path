import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { host } = req.query;
    const url = `https://navitime-maps.p.rapidapi.com/map_script?host=localhost`;

    try {
        const response = await fetch(url, {
            headers: {
                'X-RapidAPI-Key': process.env.VITE_NAVITIME_API_KEY || '',
                'X-RapidAPI-Host': 'navitime-maps.p.rapidapi.com'
            }
        });
        const data = await response.text();
        res.setHeader('Content-Type', 'application/javascript');
        res.status(200).send(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch map script' });
    }
}
