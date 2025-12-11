import csv
import json
import random

# CSVファイルを読み込む
csv_path = r'C:\Users\shoko\Documents\program\KyotoGuide\opendata\260002kankoushisetsu.csv'
output_path = r'C:\Users\shoko\Documents\program\KyotoGuide\services\spotService.ts'

spots = []
spot_id = 1

# 除外するキーワードリスト
exclude_keywords = [
    'センター', '駐車場', '駐輪場', 'ホテル', '宿', 'サービス', 
    'イン', '休館中', '交流館', 'インフォメーション', '旅館', 
    'ホール', 'プール', 'タクシー'
]

with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    
    for row in reader:
        try:
            name = row.get('名称', '').strip()
            lat_str = row.get('緯度', '').strip()
            lon_str = row.get('経度', '').strip()
            description = row.get('説明', '').strip()[:150]  # 最初の150文字
            
            # 除外キーワードチェック
            if any(keyword in name for keyword in exclude_keywords):
                continue
            
            # 営業時間情報を取得
            start_time = row.get('開始時間', '').strip()
            end_time = row.get('終了時間', '').strip()
            time_note = row.get('利用可能日時特記事項', '').strip()
            
            # 料金情報を取得
            price_basic = row.get('料金（基本）', '').strip()
            price_detail = row.get('料金（詳細）', '').strip()
            
            if not name or not lat_str or not lon_str:
                continue
            
            lat = float(lat_str)
            lon = float(lon_str)
            
            if lat == 0 or lon == 0:
                continue
            
            # ランダムな混雑度を割り当て（1-5）
            congestion_level = random.randint(1, 5)
            
            spot = {
                'id': f'spot-{spot_id}',
                'name': name,
                'description': description if description else f'{name}の観光スポット',
                'congestionLevel': congestion_level,
                'location': {
                    'latitude': lat,
                    'longitude': lon
                }
            }
            
            # 営業時間を組み立て
            opening_hours = ''
            if start_time and end_time:
                opening_hours = f'{start_time}～{end_time}'
            elif time_note:
                opening_hours = time_note
            
            if opening_hours:
                spot['openingHours'] = opening_hours
            
            # 料金情報を組み立て
            if price_detail:
                spot['price'] = price_detail
            elif price_basic:
                spot['price'] = price_basic
            
            spots.append(spot)
            spot_id += 1
            
        except (ValueError, KeyError) as e:
            continue

print(f'Total spots parsed: {len(spots)}')

# TypeScriptファイルとして出力
ts_content = f'''import {{ Spot, Coordinates }} from '../types';

// 京都府観光施設データ（260002kankoushisetsu.csvより生成）
// 総数: {len(spots)}件
// 混雑度: 1(空いている) ~ 5(非常に混雑) をランダムに割り当て
const KYOTO_SPOTS: Spot[] = {json.dumps(spots, ensure_ascii=False, indent=2)};

// Calculate distance using Haversine formula
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {{
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}}

function deg2rad(deg: number): number {{
  return deg * (Math.PI / 180);
}}

export const findNearbySpots = (currentLoc: Coordinates, radiusKm: number = 5): Spot[] => {{
  const filteredSpots = KYOTO_SPOTS.filter(spot => {{
    const dist = getDistanceFromLatLonInKm(
      currentLoc.latitude,
      currentLoc.longitude,
      spot.location.latitude,
      spot.location.longitude
    );
    return dist <= radiusKm;
  }});

  // Sort by congestion level: 1 (Comfortable) -> 5 (Crowded)
  return filteredSpots.sort((a, b) => {{
    return a.congestionLevel - b.congestionLevel;
  }});
}};
'''

with open(output_path, 'w', encoding='utf-8') as f:
    f.write(ts_content)

print(f'Generated {output_path} with {len(spots)} spots')
