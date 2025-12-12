/**
 * スクリプト: spotServiceにURLを追加
 * CSVの「URL」カラムからスポットの公式サイトURLを追加する
 */

const fs = require('fs');
const path = require('path');

// CSVファイルを読み込み
const csvPath = path.join(__dirname, 'opendata', '260002kankoushisetsu.csv');
const spotServicePath = path.join(__dirname, 'services', 'spotService.ts');

// CSV行をパースする（引用符内のカンマを考慮）
function parseCSVLine(line) {
    const result = [];
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

// CSVを読み込んでURLマッピングを作成
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n');
const header = parseCSVLine(lines[0]);

// カラムインデックスを取得
const nameIndex = header.indexOf('名称');
const urlIndex = header.indexOf('URL');

console.log(`名称カラム: ${nameIndex}, URLカラム: ${urlIndex}`);

// 名前からURLへのマッピングを作成
const urlMap = new Map();
for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const name = row[nameIndex];
    const url = row[urlIndex];

    if (name && url && url.startsWith('http')) {
        urlMap.set(name, url);
    }
}

console.log(`URLを持つスポット数: ${urlMap.size}`);

// spotService.tsを読み込み
let spotServiceContent = fs.readFileSync(spotServicePath, 'utf-8');

// URLを追加するパターンを探す
let updatedCount = 0;
for (const [name, url] of urlMap) {
    // スポット名を検索してURLを追加
    const namePattern = `"name": "${name}"`;
    if (spotServiceContent.includes(namePattern)) {
        // 既にurlがあるかチェック
        const regex = new RegExp(`"name": "${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?(\\}|,\\s*"url":)`, 'g');
        const match = regex.exec(spotServiceContent);

        if (match && !match[0].includes('"url":')) {
            // URLが存在しない場合、追加する
            // 最後のプロパティの後にurlを追加
            const insertPattern = new RegExp(
                `("name": "${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?"location": \\{[^}]+\\})(,?\\s*"openingHours":|,?\\s*"price":|\\s*\\})`,
                'g'
            );

            spotServiceContent = spotServiceContent.replace(insertPattern, (match, before, after) => {
                if (after.includes('"openingHours"') || after.includes('"price"')) {
                    return `${before},\n    "url": "${url}"${after}`;
                } else {
                    return `${before},\n    "url": "${url}"${after}`;
                }
            });

            updatedCount++;
        }
    }
}

console.log(`更新されたスポット数: ${updatedCount}`);

// ファイルを保存
fs.writeFileSync(spotServicePath, spotServiceContent, 'utf-8');
console.log('spotService.ts を更新しました');
