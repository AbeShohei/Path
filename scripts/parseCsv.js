const fs = require('fs');
const path = require('path');

// CSVファイルを読み込む
const csvPath = path.join(__dirname, 'opendata', '260002kankoushisetsu.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// CSVをパース（簡易版）
const lines = csvContent.split('\n');
const headers = lines[0].split(',');

// ヘッダーのインデックスを取得
const nameIndex = headers.findIndex(h => h.includes('名称') && !h.includes('カナ') && !h.includes('英語'));
const latIndex = headers.findIndex(h => h.includes('緯度'));
const lonIndex = headers.findIndex(h => h.includes('経度'));
const descIndex = headers.findIndex(h => h.includes('説明') && !h.includes('英語'));

console.log('Headers found:', { nameIndex, latIndex, lonIndex, descIndex });

const spots = [];
let id = 1;

for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',');
    const name = cols[nameIndex]?.trim();
    const lat = parseFloat(cols[latIndex]?.trim());
    const lon = parseFloat(cols[lonIndex]?.trim());
    const description = cols[descIndex]?.trim().substring(0, 100); // 最初の100文字

    // 有効なデータのみ追加
    if (name && !isNaN(lat) && !isNaN(lon) && lat && lon) {
        // ランダムな混雑度を割り当て（1-5）
        const congestionLevel = Math.floor(Math.random() * 5) + 1;

        spots.push({
            id: `spot-${id}`,
            name,
            description: description || `${name}の観光スポット`,
            congestionLevel,
            location: { latitude: lat, longitude: lon }
        });
        id++;
    }
}

console.log(`Total spots parsed: ${spots.length}`);
console.log('Sample spots:', spots.slice(0, 3));

// TypeScriptファイルとして出力
const tsContent = `import { Spot } from '../types';

// 京都府観光施設データ（260002kankoushisetsu.csvより生成）
// 総数: ${spots.length}件
export const KYOTO_SPOTS: Spot[] = ${JSON.stringify(spots, null, 2)};
`;

const outputPath = path.join(__dirname, 'services', 'spotsData.ts');
fs.writeFileSync(outputPath, tsContent, 'utf-8');

console.log(`Generated ${outputPath} with ${spots.length} spots`);
