import { RouteOption, TransportMode, TransitUpdate, RouteSegment } from "../types";

// OpenRouter API Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MODEL_NAME = 'tngtech/deepseek-r1t2-chimera:free';

// --- MOCK DATA DEFINITIONS ---

const MOCK_ROUTES: RouteOption[] = [
    {
        id: "mock-1",
        title: "市営バス205系統 (推奨)",
        duration: "約25分",
        cost: "230円",
        steps: ["京都駅前(バス)に乗車", "目的地付近で降車"],
        transportMode: TransportMode.TRANSIT,
        segments: [
            { type: 'WALK', text: 'バス停へ', duration: '5分' },
            { type: 'BUS', text: '市営205系統', duration: '17分', departureTime: '5分後' },
            { type: 'WALK', text: '目的地へ', duration: '3分' }
        ]
    },
    {
        id: "mock-2",
        title: "地下鉄烏丸線 + 徒歩",
        duration: "約20分",
        cost: "260円",
        steps: ["京都駅(地下鉄)に乗車", "四条駅で降車", "目的地まで徒歩"],
        transportMode: TransportMode.TRANSIT,
        segments: [
            { type: 'WALK', text: '地下鉄改札へ', duration: '3分' },
            { type: 'SUBWAY', text: '烏丸線 国際会館行', duration: '7分', departureTime: '3分後' },
            { type: 'WALK', text: '目的地へ', duration: '10分' }
        ]
    },
    {
        id: "mock-3",
        title: "徒歩ルート",
        duration: "約45分",
        cost: "0円",
        steps: ["目的地まで徒歩"],
        transportMode: TransportMode.WALKING,
        segments: [
            { type: 'WALK', text: '目的地まで直行', duration: '45分' }
        ]
    }
];

const MOCK_TRANSIT_UPDATE: TransitUpdate = {
    status: 'ON_TIME',
    stopsAway: 2,
    currentLocation: '七条堀川',
    nextBusTime: '約8分後',
    message: '定刻通り運行中 (API制限中のため推定)'
};

// Helper function to call OpenRouter API (OpenAI-compatible)
async function callOpenRouter(messages: Array<{ role: string, content: string }>, systemInstruction?: string): Promise<string> {
    try {
        const requestBody: any = {
            model: MODEL_NAME,
            messages: systemInstruction
                ? [{ role: 'system', content: systemInstruction }, ...messages]
                : messages,
        };

        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Path - Smart Tourism Kyoto Guide'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    } catch (error) {
        console.error('OpenRouter API Error:', error);
        throw error;
    }
}

import { getNavitimeRoutes } from './navitimeService';

// 1. Get Route Options using NAVITIME Route Search API
export const getRouteOptions = async (
    originName: string,
    destinationName: string,
    originCoords?: { latitude: number; longitude: number },
    destCoords?: { latitude: number; longitude: number }
): Promise<RouteOption[]> => {
    // NAVITIMEサービスを使用
    return getNavitimeRoutes(originName, destinationName, originCoords, destCoords);
};

// 2. Get Real-time Transit/Traffic Info
export const getTransitInfo = async (query: string): Promise<TransitUpdate | null> => {
    try {
        const prompt = `
            京都の交通情報について: ${query}。
            最新のウェブ検索結果に基づいて、以下のJSON形式で回答してください。
            バスが何駅前(何個前の停留所)にいるか、もし乗り遅れた場合の次のバスの時間はいつかを推定してください。
            情報が見つからない場合は推定で構いません。

            {
                "status": "ON_TIME" | "DELAYED" | "UNKNOWN",
                "stopsAway": number (例: 3, 不明なら -1),
                "currentLocation": string (例: "四条河原町付近", 不明なら"不明"),
                "nextBusTime": string (例: "14:55"),
                "message": string (短い要約メッセージ)
            }
            JSONのみを出力してください。
        `;

        const responseText = await callOpenRouter([{ role: 'user', content: prompt }]);

        let jsonStr = responseText;
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        const start = jsonStr.indexOf('{');
        const end = jsonStr.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            jsonStr = jsonStr.substring(start, end + 1);
            return JSON.parse(jsonStr) as TransitUpdate;
        }
        return MOCK_TRANSIT_UPDATE;
    } catch (e) {
        console.warn("OpenRouter API Error (Transit Info): Returning Mock Data.", e);
        return MOCK_TRANSIT_UPDATE;
    }
}

// 3. Generate Guide Text (Walking or On-Board)
// Stage: TO_STOP, ON_BUS, ALIGHTING, TO_DEST
export const generateGuideContent = async (context: string, stage?: string, durationSeconds: number = 30): Promise<string> => {
    try {
        // Calculate target character count dynamically
        // - Short (<30s): ~100 chars (Brief)
        // - Medium (30-120s): ~300 chars (Standard)
        // - Long (>120s): ~600+ chars (Detailed storytelling)
        const charsPerSecond = 4;
        const targetLength = Math.max(50, Math.min(durationSeconds * charsPerSecond, 800));

        // Refined System Instruction: Tourist Guide Persona
        let systemInstruction = "あなたは京都に精通した「AI観光ガイド」です。ユーザーの移動中に、その場所の歴史、文化、風景の魅力を語ってください。車内アナウンスのような事務的な内容は最小限にし、車窓から見える景色や、その地域の知られざるエピソードを情緒豊かに解説してください。文章中にマークダウン記号(**等)は含めないでください。";
        let prompt = "";

        const timeInstruction = `この案内は${durationSeconds}秒程度の尺で読み上げられます。約${Math.floor(targetLength)}文字で構成してください。時間はたっぷりあるので、焦らず詳しく語ってください。`;
        const shortTimeInstruction = `この案内は${durationSeconds}秒程度の尺です。約${Math.floor(targetLength)}文字で簡潔に要点を伝えてください。`;

        if (stage === 'TO_STOP') {
            prompt = `状況: ユーザーはバス停へ徒歩移動中。${context}。\nタスク: これから始まる旅への期待を高めるような、京都の街歩きの楽しみ方を軽く語ってください。\n制約: ${shortTimeInstruction}`;
        } else if (stage === 'ON_BUS') {
            // Focus on sightseeing history instead of transit info
            prompt = `状況: 京都のバス/電車で移動中。所要時間は約${Math.floor(durationSeconds / 60)}分です。${context}。\nタスク: この路線の沿線にある寺社仏閣、通りの歴史、または京都の季節の風物詩について語ってください。単なる移動時間を「観光の時間」に変えるような、深みのある解説をお願いします。\n必須: 事務的な運行情報は含めないでください。専ら観光ガイドに徹してください。\n制約: ${timeInstruction}`;
        } else if (stage === 'ALIGHTING') {
            prompt = `状況: まもなく降車。${context}。\nタスク: 降車の準備を促しつつ、目的地エリアの雰囲気を伝えてください。\n制約: ${shortTimeInstruction}`;
        } else if (stage === 'TO_DEST') {
            prompt = `状況: 降車後、目的地へ徒歩移動中。${context}。\nタスク: 目的地の歴史的背景、見どころ、参拝のポイントを詳しく解説してください。到着するまでの間、ユーザーの気分を高揚させてください。\n制約: ${timeInstruction}`;
        } else {
            prompt = `状況: ${context}。\nタスク: 京都の魅力を伝えるガイドを行ってください。\n制約: ${targetLength}文字程度`;
        }

        const responseText = await callOpenRouter([{ role: 'user', content: prompt }], systemInstruction);

        // Remove markdown asterisks for clean text display
        return responseText.replace(/\*\*/g, "");
    } catch (e) {
        console.warn("OpenRouter API Error (Guide Gen): Returning Mock Text.", e);
        // Fallback texts
        if (stage === 'ON_BUS') return "現在、バスは定刻通り運行しております。車内ではつり革や手すりにおつかまりください。次は目的地周辺です。";
        if (stage === 'TO_STOP') return "バス停へ向かっています。足元に注意して移動してください。まもなくバスが到着します。";
        return "現在、詳細なガイド情報を取得できませんが、目的地へ向かって案内を継続します。";
    }
}

// 4. Text-to-Speech (Browser Native)
// Keep reference to active utterance to prevent garbage collection on mobile/Chrome
let activeUtterance: SpeechSynthesisUtterance | null = null;

export const playTextToSpeech = async (text: string): Promise<{ duration: number; stop: () => void }> => {
    const cleanText = text.replace(/\*\*/g, "");

    if ('speechSynthesis' in window) {
        // Cancel any pending speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'ja-JP';
        utterance.rate = 1.0;

        // Retain reference
        activeUtterance = utterance;

        // Cleanup reference when done
        utterance.onend = () => {
            activeUtterance = null;
        };
        utterance.onerror = (e) => {
            console.error("TTS Error", e);
            activeUtterance = null;
        }

        // Estimate duration for UI sync: ~4 chars per second
        const estimatedDuration = Math.max(cleanText.length / 4, 3);

        window.speechSynthesis.speak(utterance);

        return {
            duration: estimatedDuration,
            stop: () => {
                window.speechSynthesis.cancel();
                activeUtterance = null;
            }
        };
    } else {
        console.warn("Web Speech API not supported.");
        const estimatedDuration = Math.max(cleanText.length / 4, 3);
        return {
            duration: estimatedDuration,
            stop: () => { }
        };
    }
};