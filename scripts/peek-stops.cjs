const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/kyoto-stops-graph.json', 'utf8'));
console.log("Stops Example:");
console.log(JSON.stringify(data.stops.slice(0, 3), null, 2));
