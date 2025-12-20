export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Spot {
  id: string;
  name: string;
  description: string;
  congestionLevel: 1 | 2 | 3 | 4 | 5; // 1: Low (Comfortable) -> 5: High (Crowded)
  mapLink?: string;
  location: Coordinates;
  imageUrl?: string; // 画像URL（Google Places APIまたはCSVから取得）
  url?: string; // 公式ウェブサイトURL
  openingHours?: string; // 営業時間
  price?: string; // 料金
  placeId?: string; // Google Place ID for photos
}

// Turn information for walking navigation
export interface Turn {
  location: { lat: number; lng: number };
  direction: '右' | '左' | '直進' | 'Uターン';
  angle: number;              // Angle in degrees (positive = right, negative = left)
  distanceFromStart: number;  // Distance from segment start in meters
  distanceToNext: number;     // Distance to next turn or end in meters
  instruction?: string;       // e.g. "右に曲がる", "左折して直進"
}

export interface RouteSegment {
  type: 'WALK' | 'BUS' | 'TRAIN' | 'SUBWAY';
  text: string;     // e.g. "Walk to station", "Bus 205"
  duration: string; // e.g. "5 min"
  durationMinutes?: number;  // Duration in minutes for calculations
  departureTime?: string; // e.g. "14:35", "Every 10 mins"
  arrivalTime?: string;   // e.g. "14:50"
  platform?: string;      // e.g. "Platform 3", "Bus Stop A"
  direction?: string;     // e.g. "for Kokusai Kaikan" (bound_for/destination)
  gateway?: string;       // e.g. "中央口" (station gate)
  getoff?: string;        // e.g. "前" (exit position on train: front/back)
  lineColor?: string;     // e.g. "#0072BC" (line color for display)
  companyName?: string;   // e.g. "ＪＲ西日本"
  trainType?: string;     // e.g. "普通", "快速"
  stops?: string[];       // List of passed stations/stops
  stopCount?: number;     // Number of stops
  distance?: number;      // Distance in meters
  path?: { lat: number; lng: number }[]; // Segment-specific path for rendering
  turns?: Turn[];         // Turn-by-turn directions for WALK segments
}

export interface RouteOption {
  id: string;
  title: string;
  duration: string;
  cost: string;
  steps: string[]; // Keep for backward compatibility or summary
  segments: RouteSegment[]; // New structured data
  path?: { lat: number; lng: number }[]; // Google Maps描画用の座標パス
  transportMode: TransportMode;
}

export interface TransitUpdate {
  status: 'ON_TIME' | 'DELAYED' | 'UNKNOWN';
  stopsAway: number; // e.g. 3
  currentLocation: string; // e.g. "Kyoto Eki-mae"
  nextBusTime: string; // e.g. "14:45"
  message: string; // Brief summary
}

export enum AppMode {
  LANDING = 'LANDING',
  PLANNING = 'PLANNING',
  ROUTE_SELECT = 'ROUTE_SELECT',
  NAVIGATING = 'NAVIGATING',
  DESTINATION = 'DESTINATION'
}

export enum TransportMode {
  WALKING = 'WALKING',
  TRANSIT = 'TRANSIT'
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
      reviewSnippets?: {
        content: string;
      }[]
    }
  };
}