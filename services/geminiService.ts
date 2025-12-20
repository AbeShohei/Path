import { RouteOption, TransportMode, TransitUpdate, RouteSegment, Spot } from "../types";

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
// 3. Generate Guide Text (Walking or On-Board) - Migrated to Dify
// Stage: TO_STOP, ON_BUS, ALIGHTING, TO_DEST
// Migrated to Dify with Flattened Payload
import { GuideContext, DifyGuidePayload, TriggerType } from './guideService';

export const generateGuideContent = async (context: string, stage?: string, durationSeconds: number = 30, nearbySpots: Spot[] = []): Promise<string> => {
    const API_KEY = import.meta.env.VITE_DIFY_API_KEY;
    const API_URL = import.meta.env.VITE_DIFY_API_URL || 'https://api.dify.ai/v1';

    // Fallback logic
    const useFallback = (msg: string) => {
        console.warn(`Dify API Fallback: ${msg}`);
        if (stage === 'ON_BUS') return "現在、バスは定刻通り運行しております。車窓からの景色をお楽しみください。";
        if (stage === 'TO_STOP') return "バス停へ向かっています。足元に注意して移動してください。";
        if (stage === 'ALIGHTING') return "まもなく降車です。お忘れ物にご注意ください。";
        return "目的地へ向かって案内を継続します。";
    };

    if (!API_KEY) return useFallback("No API Key");

    // --- 1. Determine Trigger Type & Basic Info ---
    let triggerType: TriggerType = 'TRANSIT_RIDING'; // Default
    let navMode: DifyGuidePayload['user_mode'] = 'TRANSIT';

    if (stage === 'ON_BUS') {
        triggerType = 'TRANSIT_RIDING';
        navMode = 'TRANSIT';
    } else if (stage === 'ALIGHTING') {
        triggerType = 'TRANSIT_ALIGHTING';
        navMode = 'TRANSIT';
    } else if (stage === 'TO_STOP' || stage === 'TO_DEST') {
        triggerType = 'WALK_GUIDE';
        navMode = 'WALK';
    }

    // --- 2. Parse Legacy Context String ---
    // Context is often like "目的地: 毘沙門堂。ルート: ＪＲ琵琶湖線。" or "次は、京都駅。"
    let cleanTargetName = context;
    let cleanLineName = "公共交通機関";
    let cleanDestination = "目的地";

    // Simple heuristic parser
    if (context.includes("目的地:")) {
        const parts = context.split("。");
        const destPart = parts.find(p => p.includes("目的地:")) || "";
        cleanTargetName = destPart.replace("目的地:", "").trim();
        cleanDestination = cleanTargetName;
        // Try to extract route name if available
        const routePart = parts.find(p => p.includes("ルート:"));
        if (routePart) cleanLineName = routePart.replace("ルート:", "").trim();
    } else if (context.includes("次は、")) {
        const parts = context.split("。");
        cleanTargetName = parts[0].replace("次は、", "").replace("です", "").trim();
    }

    // Fallback
    if (!cleanTargetName || cleanTargetName.length > 20) {
        cleanTargetName = "周辺スポット";
    }

    // Format nearby spots for Dify (Simplified JSON string)
    // Only send essential data to save tokens and avoid complexity
    const nearbySpotsData = nearbySpots.slice(0, 3).map(s => ({
        name: s.name,
        description: s.description ? s.description.substring(0, 50) : "", // Truncate description even more
    }));

    // --- 3. Construct Flattened Payload ---
    const payloadData: DifyGuidePayload = {
        trigger_type: triggerType,
        user_mode: navMode,
        // Functional Info
        nav_line_name: navMode === 'TRANSIT' ? cleanLineName : undefined,
        nav_bound_for: navMode === 'TRANSIT' ? cleanDestination : undefined,
        nav_destination: cleanDestination,
        nav_gateway: stage === 'ALIGHTING' ? '改札/出口' : undefined, // Placeholder if not real data
        nav_getoff_door: stage === 'ALIGHTING' ? 'ドア' : undefined,

        // Tourism Info
        spot_name: cleanTargetName !== "周辺スポット" ? cleanTargetName : undefined,
        spot_search_query: triggerType === 'TRANSIT_RIDING'
            ? `${cleanLineName} 車窓 景色`
            : `${cleanTargetName} 歴史 観光`,

        nearby_spots_data: JSON.stringify(nearbySpotsData), // Send as string

        // Error info (mock)
        error_message: undefined
    };

    try {
        console.log("Sending Dify Payload (Discrete):", payloadData); // Debug log

        // Convert Payload to Discrete Inputs (All strings/numbers)
        // Dify expects flat key-value pairs in 'inputs'
        const inputs = {
            trigger_type: payloadData.trigger_type,
            user_mode: payloadData.user_mode || 'TRANSIT',

            nav_line_name: payloadData.nav_line_name || "",
            nav_bound_for: payloadData.nav_bound_for || "",
            nav_destination: payloadData.nav_destination || "",
            nav_gateway: payloadData.nav_gateway || "",
            nav_getoff_door: payloadData.nav_getoff_door || "",

            spot_name: payloadData.spot_name || "",
            spot_search_query: payloadData.spot_search_query || "",

            nearby_spots_data: payloadData.nearby_spots_data || "[]", // New Input

            error_message: payloadData.error_message || "",

            // Control Output Length
            // Speak until the next guide trigger (leaving small 15s buffer)
            target_speaking_duration: String(Math.max(30, durationSeconds - 15))
        };

        const payload = {
            inputs: inputs,
            response_mode: "blocking",
            user: "kyoto-guide-user-legacy"
        };

        const response = await fetch(`${API_URL}/workflows/run`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Dify Response Raw:", data); // Debug log

        if (data.data.status !== 'succeeded') {
            console.warn("Dify Workflow Status:", data.data.status, data.data.error);
        }

        const guideText = data.data.outputs?.text;

        if (!guideText) return useFallback("Empty response from Dify");

        // Remove markdown artifacts if any
        return guideText.replace(/\*\*/g, "");

    } catch (e) {
        console.error("Dify Error:", e);
        return useFallback(e instanceof Error ? e.message : 'Unknown error');
    }
}


// 4. Text-to-Speech (Browser Native)
// Keep reference to active utterance to prevent garbage collection on mobile/Chrome
// --- DIFY INTEGRATION (SIMULATION) ---

export interface DifyTriggerContext {
    trigger: 'GUIDE_DEPARTURE' | 'GUIDE_TRANSIT_HUB' | 'GUIDE_ON_BOARD' | 'GUIDE_ARRIVAL' | 'GUIDE_FINAL_LEG' | 'GUIDE_EXCEPTION';
    expected_output_structure: {
        traffic_content: string;
        tourism_content: string;
    };
    user_state: {
        current_location: { lat: number; lng: number };
        transport_mode: TransportMode;
        is_off_route?: boolean;
    };
    transit_context: {
        line_name?: string;
        bound_for?: string;
        next_stop?: string;
        stops_remaining?: number;
        departure_time?: string;
        platform_info?: string;
        delay_status?: string;
    };
    tourism_context?: {
        nearby_landmarks?: string[];
        current_area_name?: string;
    };
}

/**
 * Simulates a Dify RAG trigger by logging the payload and returning split content.
 */
export const simulateDifyTrigger = async (context: DifyTriggerContext): Promise<{
    traffic: string;
    tourism: string;
}> => {
    console.group('🚀 [Dify RAG Simulation] Trigger Fired');
    console.log(`Trigger Type: ${context.trigger}`);
    console.log('📦 Context Payload:', JSON.stringify(context, null, 2));

    console.log('🤖 [Dify] Simulating separated content generation...');
    console.groupEnd();

    // Mock response logic based on trigger type for testing UI
    let traffic = "";
    let tourism = "";

    switch (context.trigger) {
        case 'GUIDE_DEPARTURE':
            traffic = `これより${context.transit_context.next_stop || '目的地'}まで徒歩移動します。`;
            tourism = `このルートの途中には、${context.tourism_context?.nearby_landmarks?.[0] || '歴史的なスポット'}があります。`;
            break;
        case 'GUIDE_TRANSIT_HUB':
            traffic = `${context.transit_context.line_name}、${context.transit_context.bound_for}行きは、${context.transit_context.platform_info}から発車します。`;
            tourism = ""; // Usually empty for transit hubs as per design
            break;
        case 'GUIDE_ON_BOARD':
            traffic = `次は${context.transit_context.next_stop}です。`;
            tourism = `${context.transit_context.line_name}は、歴史ある路線です。車窓からの景色をご覧ください。`;
            break;
        case 'GUIDE_ARRIVAL':
            traffic = `まもなく${context.transit_context.next_stop}です。降車準備をお願いします。`;
            tourism = "";
            break;
        case 'GUIDE_FINAL_LEG':
            traffic = `ここから目的地まで徒歩で向かいます。`;
            tourism = `この参道は古くからの景観を残しています。石畳にご注目ください。`;
            break;
    }

    return { traffic, tourism };
};

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

// Update Mock Data to export functions if needed
export { MOCK_ROUTES };