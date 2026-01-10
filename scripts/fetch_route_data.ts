
import { routeService } from '../services/routeService';
import { Coordinates } from '../types';

const start: Coordinates = { latitude: 34.985849, longitude: 135.758767 };
const end: Coordinates = { latitude: 35.056189, longitude: 135.801649 };

async function fetchRoute() {
    try {
        console.log("Fetching route...");
        const routes = await routeService.searchRoutes(start, end);
        console.log(JSON.stringify(routes, null, 2));
    } catch (error) {
        console.error("Error fetching route:", error);
    }
}

fetchRoute();
