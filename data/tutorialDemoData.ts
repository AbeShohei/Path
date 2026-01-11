/**
 * Tutorial Demo Data
 * チュートリアル用のデモデータ（赤山禅院へのルート）
 */

import { Spot, RouteOption, RouteSegment, AppMode, TransportMode, Coordinates } from '../types';

// 京都駅の座標（チュートリアル開始地点）
export const DEMO_START_COORDS: Coordinates = {
    latitude: 34.985849,
    longitude: 135.758767
};

// 赤山禅院のスポットデータ
export const DEMO_SPOT: Spot = {
    id: "spot-930",
    name: "赤山禅院",
    description: "延暦寺の塔頭の一つ。京都の表鬼門にあたるので方除けの神として、また五十払い発祥のいわれより掛けよせの神として商売繁昌の信仰を集めている。紅葉の名所であり、11月中旬から下旬にかけての眺めは見事。",
    congestionLevel: 1,
    location: {
        latitude: 35.056189,
        longitude: 135.801649
    },
    openingHours: "拝観自由（9時～16時30分）",
    price: "無料",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/SekizanZen%27in_Main_Hall.jpg/1000px-SekizanZen%27in_Main_Hall.jpg"
};

// その他のデモスポット（リスト表示用）
export const DEMO_SPOTS_LIST: Spot[] = [
    DEMO_SPOT,
    {
        id: "spot-demo-2",
        name: "清水寺",
        description: "「清水の舞台」で知られる寺院。",
        congestionLevel: 5,
        location: { latitude: 34.994856, longitude: 135.785046 },
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Kiyomizu-dera_in_Kyoto-r.jpg"
    },
    {
        id: "spot-demo-3",
        name: "金閣寺",
        description: "金箔を貼った舎利殿で有名。",
        congestionLevel: 4,
        location: { latitude: 35.03937, longitude: 135.729243 },
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/86/Kinkaku-ji_2016.jpg"
    },
    {
        id: "spot-demo-4",
        name: "伏見稲荷大社",
        description: "千本鳥居で有名な神社。",
        congestionLevel: 5,
        location: { latitude: 34.96714, longitude: 135.772671 },
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Fushimi_Inari_Taisha_Senbon_Torii.jpg"
    },
    {
        id: "spot-demo-5",
        name: "嵐山 渡月橋",
        description: "嵐山のシンボルとなっている橋。",
        congestionLevel: 3,
        location: { latitude: 35.013697, longitude: 135.677685 },
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/06/Togetsukyo_Bridge_Arashiyama_Kyoto.jpg"
    }
];

// デモ用ルートセグメント
// デモ用ルートセグメント
// Helper to get time string (HH:MM) relative to now
const getRelativeTime = (minutesOffset: number): string => {
    const now = new Date();
    const d = new Date(now.getTime() + minutesOffset * 60000);
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
};

// デモ用ルートセグメント (Dynamic)
const demoSegments: RouteSegment[] = [
    {
        type: 'WALK',
        text: '京都駅まで歩く',
        duration: '3分',
        durationMinutes: 3,
        distance: 200,
        path: [
            { lat: 34.985849, lng: 135.758767 },
            { lat: 34.985900, lng: 135.758800 },
            { lat: 34.986000, lng: 135.758900 },
            { lat: 34.985458, lng: 135.758867 }
        ]
    },
    {
        type: 'BUS',
        text: '市バス 5系統',
        duration: '35分',
        durationMinutes: 35,
        departureTime: getRelativeTime(15),     // +15 mins
        arrivalTime: getRelativeTime(15 + 35), // +50 mins
        direction: '岩倉操車場前行き',
        lineColor: '#008000',
        companyName: '京都市交通局',
        boardingStop: '京都駅前',
        alightingStop: '修学院離宮道',
        stopCount: 18,
        intermediateStops: [
            { name: "塩小路", time: getRelativeTime(16), lat: 34.986500, lng: 135.759500 },
            { name: "四条京阪前", time: getRelativeTime(25), lat: 35.003000, lng: 135.768000 },
            { name: "三条京阪前", time: getRelativeTime(28), lat: 35.009000, lng: 135.772000 },
            { name: "東山三条", time: getRelativeTime(30), lat: 35.010000, lng: 135.775000 },
            { name: "岡崎道", time: getRelativeTime(35), lat: 35.015000, lng: 135.782000 },
            { name: "北白川", time: getRelativeTime(40), lat: 35.025000, lng: 135.788000 },
            { name: "修学院", time: getRelativeTime(48), lat: 35.045000, lng: 135.800000 }
        ],
        path: [
            { lat: 34.985458, lng: 135.758867 }, // 京都駅前
            { lat: 34.986500, lng: 135.759500 }, // 塩小路
            { lat: 34.990000, lng: 135.765000 },
            { lat: 35.003000, lng: 135.768000 }, // 四条河原町付近
            { lat: 35.009000, lng: 135.772000 }, // 三条京阪
            { lat: 35.020000, lng: 135.780000 }, // 白川
            { lat: 35.030000, lng: 135.790000 }, // 銀閣寺道付近
            { lat: 35.039196, lng: 135.773007 }, // 北山通 (Checkpoint)
            { lat: 35.045000, lng: 135.800000 }, // 修学院
            { lat: 35.048913, lng: 135.802943 }  // 修学院離宮道
        ]
    },
    {
        type: 'WALK',
        text: '赤山禅院まで歩く',
        duration: '15分',
        durationMinutes: 15,
        distance: 1100,
        path: [
            { lat: 35.048913, lng: 135.802943 },
            { lat: 35.050000, lng: 135.802500 },
            { lat: 35.053000, lng: 135.802000 },
            { lat: 35.056189, lng: 135.801649 }
        ]
    }
];

// デモ用ルートオプション (Dynamic)
export const DEMO_ROUTE_OPTIONS: RouteOption[] = [
    {
        id: 'demo-route-1',
        title: 'バス + 徒歩',
        duration: '約53分',
        startTime: getRelativeTime(12),
        endTime: getRelativeTime(12 + 53),
        cost: '230円',
        steps: ['京都駅から市バス5系統', '修学院離宮道で下車', '徒歩15分'],
        segments: demoSegments,
        transportMode: TransportMode.TRANSIT,
        path: [
            { lat: 34.985849, lng: 135.758767 },
            { lat: 34.985458, lng: 135.758867 },
            { lat: 35.039196, lng: 135.773007 },
            { lat: 35.048913, lng: 135.802943 },
            { lat: 35.056189, lng: 135.801649 }
        ]
    },
    {
        id: 'demo-route-2',
        title: '地下鉄 + バス',
        duration: '約58分',
        startTime: getRelativeTime(15),
        endTime: getRelativeTime(15 + 58),
        cost: '490円',
        steps: ['地下鉄烏丸線で国際会館', 'バス5系統に乗り換え', '徒歩15分'],
        segments: [
            {
                type: 'WALK',
                text: '地下鉄京都駅まで歩く',
                duration: '2分',
                durationMinutes: 2,
                distance: 150
            },
            {
                type: 'SUBWAY',
                text: '地下鉄烏丸線',
                duration: '20分',
                durationMinutes: 20,
                departureTime: getRelativeTime(17),
                arrivalTime: getRelativeTime(17 + 20),
                direction: '国際会館行き',
                lineColor: '#3CB371',
                boardingStop: '京都',
                alightingStop: '国際会館',
                stopCount: 10
            },
            {
                type: 'BUS',
                text: '京都バス',
                duration: '10分',
                durationMinutes: 10,
                departureTime: getRelativeTime(45),
                arrivalTime: getRelativeTime(45 + 10),
                direction: '大原行き',
                lineColor: '#FFD700',
                boardingStop: '国際会館駅前',
                alightingStop: '修学院離宮道'
            },
            {
                type: 'WALK',
                text: '赤山禅院まで歩く',
                duration: '15分',
                durationMinutes: 15,
                distance: 1100
            }
        ],
        transportMode: TransportMode.TRANSIT
    }
];

// シミュレーション状態の型定義（useLocationSimulatorと互換）
export interface DemoSimulationState {
    isRunning: boolean;
    currentPosition: { lat: number; lng: number } | null;
    progress: number;
    currentTransportMode: string;
    speed: number;
    currentSegmentIndex: number;
    bearing: number;
}


// デモモードの状態を定義
export interface DemoState {
    mode: AppMode;
    selectedSpot: Spot | null;
    spots: Spot[]; // スポットリストを追加
    routeOptions: RouteOption[];
    selectedRoute: RouteOption | null;
    coords: Coordinates;
    focusedSpotId?: string;
    simulationState?: DemoSimulationState; // シミュレーション状態を追加
}

// 各チュートリアルステップに対応するデモ状態
export const DEMO_STATES: Record<string, DemoState> = {
    welcome: {
        mode: AppMode.LANDING,
        selectedSpot: null,
        spots: [],
        routeOptions: [],
        selectedRoute: null,
        coords: DEMO_START_COORDS
    },
    spots: {
        mode: AppMode.PLANNING,
        selectedSpot: null,
        spots: DEMO_SPOTS_LIST, // リスト表示用
        routeOptions: [],
        selectedRoute: null,
        coords: DEMO_START_COORDS
    },
    route: {
        mode: AppMode.PLANNING,
        selectedSpot: DEMO_SPOT, // 赤山禅院選択済み
        spots: DEMO_SPOTS_LIST,
        routeOptions: [],
        selectedRoute: null,
        coords: DEMO_START_COORDS,
        focusedSpotId: DEMO_SPOT.id // マップをスポットへ移動
    },
    route_select: {
        mode: AppMode.ROUTE_SELECT,
        selectedSpot: DEMO_SPOT,
        spots: DEMO_SPOTS_LIST,
        routeOptions: DEMO_ROUTE_OPTIONS,
        selectedRoute: null,
        coords: DEMO_START_COORDS
    },
    // Navigation Steps
    nav_start: {
        mode: AppMode.NAVIGATING,
        selectedSpot: DEMO_SPOT,
        spots: DEMO_SPOTS_LIST,
        routeOptions: DEMO_ROUTE_OPTIONS,
        selectedRoute: DEMO_ROUTE_OPTIONS[0],
        coords: DEMO_START_COORDS
        // simulationState removed to allow real simulator to run
    },
    nav_transit: {
        mode: AppMode.NAVIGATING,
        selectedSpot: DEMO_SPOT,
        spots: DEMO_SPOTS_LIST,
        routeOptions: DEMO_ROUTE_OPTIONS,
        selectedRoute: DEMO_ROUTE_OPTIONS[0],
        // バス移動中の座標（北山通付近）
        coords: { latitude: 35.039196, longitude: 135.773007 }
        // simulationState removed to allow real simulator to run
    },
    nav_arrive: {
        mode: AppMode.NAVIGATING,
        selectedSpot: DEMO_SPOT,
        spots: DEMO_SPOTS_LIST,
        routeOptions: DEMO_ROUTE_OPTIONS,
        selectedRoute: DEMO_ROUTE_OPTIONS[0],
        // 修学院離宮道バス停付近（降りて徒歩開始直後）
        coords: { latitude: 35.048913, longitude: 135.802943 }
        // simulationState removed
    },
    nav_arrival_complete: {
        mode: AppMode.NAVIGATING,
        selectedSpot: DEMO_SPOT,
        spots: DEMO_SPOTS_LIST,
        routeOptions: DEMO_ROUTE_OPTIONS,
        selectedRoute: DEMO_ROUTE_OPTIONS[0],
        // 赤山禅院 (Destination)
        coords: { latitude: 35.056189, longitude: 135.801649 }
    },
    nav_guide: {
        mode: AppMode.NAVIGATING,
        selectedSpot: DEMO_SPOT,
        spots: DEMO_SPOTS_LIST,
        routeOptions: DEMO_ROUTE_OPTIONS,
        selectedRoute: DEMO_ROUTE_OPTIONS[0],
        // 赤山禅院到着
        coords: { latitude: 35.056189, longitude: 135.801649 },
        focusedSpotId: DEMO_SPOT.id,
        simulationState: {
            isRunning: false,
            currentPosition: { lat: 35.056189, lng: 135.801649 },
            progress: 100,
            currentTransportMode: 'WALK',
            speed: 0,
            currentSegmentIndex: 2,
            bearing: 0
        }
    }
};
