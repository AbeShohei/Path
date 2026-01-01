import { Spot, TransitUpdate } from "../types";

// Google Gemini API Configuration (Direct Free Tier)
// Uses VITE_GOOGLE_API_KEY or VITE_GEMINI_API_KEY
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
// Using Gemini 2.0 Flash Exp (Free Preview) or 1.5 Flash
const MODEL_NAME = 'gemini-2.0-flash-exp';
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

// --- SERVICE INTERFACES ---

export interface GuideContent {
    id: string;
    text: string;
    spotId?: string;
    spotName?: string;
    direction?: 'LEFT' | 'RIGHT' | 'FRONT' | 'BACK';
    imageUrl?: string;
}

// --- API CALLER ---

async function callGoogleGenAI(prompt: string): Promise<any> {
    try {
        if (!GOOGLE_API_KEY) throw new Error('API Key not configured (VITE_GOOGLE_API_KEY)');

        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                response_mime_type: "application/json"
            }
        };

        const response = await fetch(`${BASE_URL}?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Google API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        // Extract JSON text from response
        const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return JSON.parse(contentText);
    } catch (error) {
        console.error('Google API Error:', error);
        throw error;
    }
}

// --- GUIDE GENERATION ---

export const generateGuideContent = async (
    spot: Spot,
    relativeDirection?: 'LEFT' | 'RIGHT' | 'FRONT' | 'BACK'
): Promise<GuideContent> => {

    // MOCK MODE: Bypass AI API for speed and robustness
    const directionText = relativeDirection === 'LEFT' ? '左手' :
        relativeDirection === 'RIGHT' ? '右手' :
            relativeDirection === 'FRONT' ? '正面' : '近く';

    // Simple template-based mock generation
    const mockText = `${directionText}をご覧ください。こちらは${spot.name}です。${spot.description}`;

    // Return immediate result
    return Promise.resolve({
        id: `guide-${spot.id}-${Date.now()}`,
        text: mockText.substring(0, 150), // Truncate if too long
        spotId: spot.id,
        spotName: spot.name,
        direction: relativeDirection
    });

    /* 
    // OLD AI LOGIC (Disabled)
    const directionTextFull = relativeDirection === 'LEFT' ? '進行方向左手' : ...
    const prompt = ...
    try {
        const result = await callGoogleGenAI(prompt);
        return ...
    } catch (e) { ... }
    */
}

// --- TRANSIT INFO (Legacy Support) ---
export const getTransitInfo = async (query: string): Promise<TransitUpdate | null> => {
    // ... (Keep existing if needed, or simplify)
    return {
        status: 'ON_TIME',
        stopsAway: -1,
        currentLocation: '不明',
        nextBusTime: '不明',
        message: '運行情報取得不可'
    };
}

// --- TEXT TO SPEECH ---
export const playTextToSpeech = async (text: string): Promise<{ stop: () => void, duration: number }> => {
    return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) {
            console.warn('Text-to-speech not supported');
            resolve({ stop: () => { }, duration: 0 });
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Estimate duration (rough approx: 5 chars per sec?)
        const estimatedDuration = text.length / 5;

        // Cleanup function
        const stop = () => {
            window.speechSynthesis.cancel();
        };

        window.speechSynthesis.cancel(); // Stop previous
        window.speechSynthesis.speak(utterance);

        resolve({ stop, duration: estimatedDuration });
    });
};