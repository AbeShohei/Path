import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Proxy for Navitime API script
app.get('/api/map_script', async (req, res) => {
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
        res.send(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch map script' });
    }
});

// Proxy for Route Transit
app.get('/api/route_transit', async (req, res) => {
    const queryString = new URLSearchParams(req.query as any).toString();
    const url = `https://navitime-route-totalnavi.p.rapidapi.com/route_transit${queryString ? '?' + queryString : ''}`;
    try {
        const response = await fetch(url, {
            headers: {
                'X-RapidAPI-Key': process.env.VITE_NAVITIME_API_KEY || '',
                'X-RapidAPI-Host': 'navitime-route-totalnavi.p.rapidapi.com'
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch route' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
