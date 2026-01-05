/**
 * 地理的な計算を行うユーティリティ関数
 */

interface Coordinates {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
}

/**
 * 2点間の距離をメートルで計算（Haversine formula）
 */
export const getDistance = (
    p1: Coordinates,
    p2: Coordinates
): number => {
    const lat1 = p1.lat ?? p1.latitude ?? 0;
    const lng1 = p1.lng ?? p1.longitude ?? 0;
    const lat2 = p2.lat ?? p2.latitude ?? 0;
    const lng2 = p2.lng ?? p2.longitude ?? 0;

    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * 停車駅数から推定時間を計算
 */
export const descTime = (stops: number): string => {
    return `${stops * 2}分`;
};

/**
 * 日本語の時間文字列（例: "15分", "1時間30分"）を秒数に変換
 */
export const parseDurationStr = (str?: string): number => {
    if (!str) return 30;
    let total = 0;
    const hourMatch = str.match(/(\d+)時間/);
    if (hourMatch) total += parseInt(hourMatch[1]) * 3600;
    const minMatch = str.match(/(\d+)分/);
    if (minMatch) total += parseInt(minMatch[1]) * 60;
    return total > 0 ? total : 30; // Minimum 30s fallback
};

/**
 * 秒数から到着時刻を計算
 */
export const getDynamicArrivalTime = (secondsToAdd: number): string => {
    const now = new Date();
    const arrival = new Date(now.getTime() + secondsToAdd * 1000);
    return `${arrival.getHours()}:${arrival.getMinutes().toString().padStart(2, '0')}`;
};
