const { loadEnv } = require('vite');
const mode = 'development';
const env = loadEnv(mode, '.', '');

console.log('--- Env Debug ---');
console.log(`X-RAPIDAPI-KEY exists: ${!!env['X-RAPIDAPI-KEY']}`);
console.log(`NAVITIME_API_KEY exists: ${!!env['NAVITIME_API_KEY']}`);
if (env['X-RAPIDAPI-KEY']) console.log(`X-RAPIDAPI-KEY length: ${env['X-RAPIDAPI-KEY'].length}`);
if (env['NAVITIME_API_KEY']) console.log(`NAVITIME_API_KEY length: ${env['NAVITIME_API_KEY'].length}`);
console.log('-----------------');
