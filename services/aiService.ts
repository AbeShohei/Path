import { Spot, TransitUpdate } from "../types";

// OpenRouter Configuration (Free Tier)
// Prioritizes OpenRouter Key, then Google/Gemini keys as fallback
const API_KEY = ((import.meta as any).env?.VITE_OPENROUTER_API_KEY ||
    (import.meta as any).env?.VITE_GOOGLE_API_KEY ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (typeof process !== 'undefined' ? (process as any).env?.OPENROUTER_API_KEY || (process as any).env?.GEMINI_API_KEY || (process as any).env?.API_KEY : ''));

// Priority List of Free Models to try in order
const FREE_MODELS = [
    'xiaomi/mimo-v2-flash:free',       // User Request (Primary)
    'z-ai/glm-4.5-air:free',           // User Request (Fallback)
];

const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Export function to check if API key is configured (for early detection)
export const isAIAvailable = (): boolean => !!API_KEY;

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

async function callAI(prompt: string): Promise<any> {
    if (!API_KEY) throw new Error('API Key not configured (VITE_OPENROUTER_API_KEY or compatible)');

    let lastError: any;

    for (const model of FREE_MODELS) {
        try {


            const requestBody = {
                model: model,
                messages: [
                    { role: 'user', content: prompt }
                ],
                // temperature: 0.7 
            };

            const response = await fetch(BASE_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Kyoto Guide App'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                // If 429 (Rate Limit) or 5xx (Server Error), try next model
                if (response.status === 429 || response.status >= 500) {
                    const errText = await response.text();
                    console.warn(`Model ${model} failed (${response.status}): ${errText}. Switching to next model in 5s...`);
                    lastError = new Error(`OpenRouter API error (${model}): ${response.status} - ${errText}`);
                    // Wait 5 seconds before trying the next model to avoid burst rate limits
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue; // Try next model
                }
                // For other errors (e.g. 400 Bad Request), throw immediately
                const errText = await response.text();
                throw new Error(`OpenRouter API error: ${response.status} - ${errText}`);
            }

            const data = await response.json();

            // Extract content from OpenAI-compatible response
            let contentText = data.choices?.[0]?.message?.content || '{}';

            // Robust JSON extraction: Find the first '{' and the last '}'
            const jsonMatch = contentText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                contentText = jsonMatch[0];
            } else {
                // If no JSON object found, wrap it manually if it looks like plain text
                console.warn(`Model ${model} returned non-JSON. Attempting manual wrap.`);
                // Escape quotes if needed and wrap
                contentText = JSON.stringify({ text: contentText });
            }

            try {
                const parsed = JSON.parse(contentText);

                return parsed;
            } catch (e) {
                console.error(`JSON Parse Error for model ${model}:`, e);
                console.error('Raw content:', contentText);
                throw new Error(`Invalid JSON from model ${model}`);
            }

        } catch (error) {
            console.warn(`Error with model ${model}:`, error);
            lastError = error;
            // Wait 5 seconds before trying the next model
            await new Promise(resolve => setTimeout(resolve, 5000));
            // Continue to next model loop
        }
    }

    // If loop finishes without success
    console.error('All free models failed.');
    throw lastError || new Error('All free models failed to generate content.');
}

// --- GUIDE GENERATION ---

export const generateGuideContent = async (
    spot: Spot,
    relativeDirection?: 'LEFT' | 'RIGHT' | 'FRONT' | 'BACK'
): Promise<GuideContent> => {

    // Early check: If API key is not configured, immediately return basic info
    if (!API_KEY) {

        return {
            id: `guide-${spot.id}-${Date.now()}`,
            text: spot.description,
            spotId: spot.id,
            spotName: spot.name,
            direction: relativeDirection
        };
    }

    const directionTextFull = relativeDirection === 'LEFT' ? '左手' :
        relativeDirection === 'RIGHT' ? '右手' : '近く';



    const prompt = `あなたは京都の歴史と文化を知り尽くしたベテラン観光ガイドです。
現在、ユーザーはバスや徒歩で移動中です。${directionTextFull}に見える「${spot.name}」について、移動中の風景がより輝いて見えるような、魅力的な語りをお願いします。

【スポット情報】
名称: ${spot.name}
元の説明: ${spot.description}

【執筆のルール】
1. 200文字程度の日本語で、情緒豊かに語ってください。
2. 「左手をご覧ください」といった定型句から始める必要はありません。自然な語り口で始めてください。
3. 土地の歴史的背景、地名の由来、または季節の情景など、ガイドブックにはない「生きた情報」を一味加えてください。
4. 親しみやすく、丁寧な言葉遣い（です・ます調）で。歴史用語などの専門用語は避け、初めて京都に来た人でも直感的に分かるような平易な表現を使ってください。
5. 出力は以下のJSON形式のみとし、Markdownの装飾は一切含めないでください。
{"text": "ガイドの語り内容"}
`;



    try {
        const result = await callAI(prompt);

        return {
            id: `guide-${spot.id}-${Date.now()}`,
            text: result.text || result.content || 'ガイド情報を生成できませんでした。',
            spotId: spot.id,
            spotName: spot.name,
            direction: relativeDirection
        };
    } catch (error) {
        console.error('Gemini API Error:', error);
        // Fallback: Use static spot description with a polite prefix
        return {
            id: `guide-${spot.id}-${Date.now()}`,
            text: spot.description,
            spotId: spot.id,
            spotName: spot.name,
            direction: relativeDirection
        };
    }
}

// --- TRANSIT INFO (Legacy Support) ---
export const getTransitInfo = async (query: string): Promise<TransitUpdate | null> => {
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