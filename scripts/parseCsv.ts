import { Spot } from '../types';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CSVファイルを読み込む
const csvPath = path.join(__dirname, '..', 'opendata', '260002kankoushisetsu.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// 簡易CSVパーサー（カンマとダブルクォートを考慮）
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

const lines = csvContent.split(/\r?\n/);
const headers = parseCSVLine(lines[0]);

console.log('Total lines:', lines.length);
console.log('Headers:', headers.slice(0, 10));

// ヘッダーのインデックスを取得
const nameIndex = 4; // 名称
const latIndex = 10; // 緯度
const lonIndex = 11; // 経度
const descIndex = 18; // 説明

const spots: Spot[] = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  try {
    const cols = parseCSVLine(line);
    const name = cols[nameIndex]?.trim();
    const latStr = cols[latIndex]?.trim();
    const lonStr = cols[lonIndex]?.trim();
    const description = cols[descIndex]?.trim().replace(/"/g, '').substring(0, 150);

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    // 有効なデータのみ追加
    if (name && !isNaN(lat) && !isNaN(lon) && lat > 0 && lon > 0) {
      // ランダムな混雑度を割り当て（1-5）
      const congestionLevel = Math.floor(Math.random() * 5) + 1;

      spots.push({
        id: `spot-${i}`,
        name,
        description: description || `${name}の観光スポット`,
        congestionLevel: congestionLevel as 1 | 2 | 3 | 4 | 5,
        location: { latitude: lat, longitude: lon }
      });
    }
  } catch (e) {
    // パースエラーは無視
    continue;
  }
}

console.log(`Total spots parsed: ${spots.length}`);

// TypeScriptファイルとして出力
const tsContent = `import { Spot } from '../types';

// 京都府観光施設データ（260002kankoushisetsu.csvより生成）
// 総数: ${spots.length}件
// 混雑度: 1(空いている) ~ 5(非常に混雑) をランダムに割り当て
export const KYOTO_SPOTS: Spot[] = ${JSON.stringify(spots, null, 2)};

// 距離計算（Haversine公式）
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export const findNearbySpots = (currentLoc: { latitude: number; longitude: number }, radiusKm: number = 5): Spot[] => {
  const filteredSpots = KYOTO_SPOTS.filter(spot => {
    const dist = getDistanceFromLatLonInKm(
      currentLoc.latitude,
      currentLoc.longitude,
      spot.location.latitude,
      spot.location.longitude
    );
    return dist <= radiusKm;
  });

  // 混雑度でソート: 1 (空いている) -> 5 (混雑)
  return filteredSpots.sort((a, b) => a.congestionLevel - b.congestionLevel);
};
`;

const outputPath = path.join(__dirname, '..', 'services', 'spotService.ts');
fs.writeFileSync(outputPath, tsContent, 'utf-8');

console.log(`Generated ${outputPath} with ${spots.length} spots`);
