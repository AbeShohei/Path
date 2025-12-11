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
  imageUrl?: string; // 画像URL（CSVから取得）
  openingHours?: string; // 営業時間
  price?: string; // 料金
}

export interface RouteSegment {
  type: 'WALK' | 'BUS' | 'TRAIN' | 'SUBWAY';
  text: string;     // e.g. "Walk to station", "Bus 205"
  duration: string; // e.g. "5 min"
  departureTime?: string; // e.g. "14:35", "Every 10 mins"
  path?: { lat: number; lng: number }[]; // Segment-specific path for rendering
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