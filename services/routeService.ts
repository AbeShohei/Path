import { RouteOption, TransportMode, RouteSegment } from '../types';

interface StopNode {
    id: string;
    name: string;
    lat: number;
    lng: number;
    routes: string[];
}

interface RouteInfo {
    id: string;
    short_name: string;
    long_name: string;
    color: string;
    text_color: string;
    type: 'bus' | 'subway';
}

interface GraphData {
    generated: string;
    stops: Record<string, StopNode>;
    routes: Record<string, RouteInfo>;
}

interface BusRouteShape {
    routeId: string;
    routeName: string;
    routeShortName: string;
    color: string;
    coordinates: [number, number][]; // [lat, lng]
}

interface BusRoutesData {
    routes: BusRouteShape[];
}

interface TimetableStop {
    s: string; // stopId
    t: string; // time "HH:MM"
}

interface TimetableTrip {
    id: string;
    d: string; // directionId
    st: TimetableStop[];
}

interface RouteTimetable {
    weekdays: TimetableTrip[];
    saturdays: TimetableTrip[];
    sundays: TimetableTrip[];
}

class RouteService {
    private graphData: GraphData | null = null;
    private busShapes: Map<string, BusRouteShape> = new Map();
    private timetableCache: Map<string, RouteTimetable> = new Map();
    private walkingPathCache: Map<string, { lat: number; lng: number }[]> = new Map();
    private isInitialized = false;
    private initializationPromise: Promise<void> | null = null;

    constructor() { }

    public async init(): Promise<void> {
        if (this.isInitialized) return;
        if (this.initializationPromise) return this.initializationPromise;

        this.initializationPromise = (async () => {
            try {
                // Load stops graph
                const graphResponse = await fetch('/data/kyoto-stops-graph.json');
                if (!graphResponse.ok) {
                    throw new Error(`Failed to load routing data: ${graphResponse.statusText}`);
                }
                this.graphData = await graphResponse.json();

                // Load bus route shapes for drawing
                const shapesResponse = await fetch('/data/kyoto-bus-routes.json');
                if (shapesResponse.ok) {
                    const shapesData: BusRoutesData = await shapesResponse.json();
                    for (const route of shapesData.routes) {
                        // Map by multiple possible keys (original ID and normalized versions)
                        this.busShapes.set(route.routeId, route);
                        // Also map by short name for fallback matching
                        const shortName = route.routeShortName;
                        if (shortName) {
                            this.busShapes.set(`name:${shortName}`, route);
                        }
                    }
                }

                this.isInitialized = true;
            } catch (error) {
                console.error('RouteService initialization error:', error);
                this.isInitialized = false;
            }
        })();

        return this.initializationPromise;
    }

    private getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c * 1000;
    }

    // Get walking path using OSRM with caching
    private async getWalkingPath(
        startLat: number, startLng: number,
        endLat: number, endLng: number
    ): Promise<{ lat: number; lng: number }[]> {
        // Round coordinates to reduce cache misses (10m precision)
        const roundCoord = (n: number) => Math.round(n * 10000) / 10000;
        const key = `${roundCoord(startLat)},${roundCoord(startLng)}-${roundCoord(endLat)},${roundCoord(endLng)}`;

        // Check cache first
        if (this.walkingPathCache.has(key)) {
            return this.walkingPathCache.get(key)!;
        }

        try {
            const url = `https://router.project-osrm.org/route/v1/foot/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

            // Add timeout to avoid hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('OSRM failed');

            const data = await response.json();
            if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
                const path = data.routes[0].geometry.coordinates.map((c: [number, number]) => ({
                    lat: c[1], lng: c[0]
                }));
                this.walkingPathCache.set(key, path);
                return path;
            }
        } catch {
            // Silent fail - use straight line
        }

        // Fallback: straight line
        const fallback = [{ lat: startLat, lng: startLng }, { lat: endLat, lng: endLng }];
        this.walkingPathCache.set(key, fallback);
        return fallback;
    }

    private findNearbyStops(lat: number, lng: number, radiusMeters: number = 5000): StopNode[] {
        if (!this.graphData) return [];
        const stops: StopNode[] = [];
        for (const stop of Object.values(this.graphData.stops)) {
            const dist = this.getDistance(lat, lng, stop.lat, stop.lng);
            if (dist <= radiusMeters) {
                stops.push(stop);
            }
        }
        return stops.sort((a, b) =>
            this.getDistance(lat, lng, a.lat, a.lng) - this.getDistance(lat, lng, b.lat, b.lng)
        );
    }

    // Find bus shape by routeId or name, trimmed to segment between stops
    private getBusPath(routeId: string, routeInfo: RouteInfo, startStop: StopNode, endStop: StopNode): { lat: number; lng: number }[] {
        // Try multiple lookup strategies
        let shape = this.busShapes.get(routeId);

        if (!shape) {
            // Strategy 2: Strip "bus_" prefix (bus_20500 -> 20500)
            const numericId = routeId.replace(/^bus_/, '');
            shape = this.busShapes.get(numericId);
        }

        if (!shape) {
            // Strategy 3: By short name
            shape = this.busShapes.get(`name:${routeInfo.short_name}`);
        }


        if (shape && shape.coordinates.length > 0) {
            const fullPath = shape.coordinates.map(coord => ({ lat: coord[0], lng: coord[1] }));

            // Find indices closest to start and end stops
            let startIdx = 0;
            let endIdx = fullPath.length - 1;
            let minStartDist = Infinity;
            let minEndDist = Infinity;

            for (let i = 0; i < fullPath.length; i++) {
                const distToStart = this.getDistance(startStop.lat, startStop.lng, fullPath[i].lat, fullPath[i].lng);
                const distToEnd = this.getDistance(endStop.lat, endStop.lng, fullPath[i].lat, fullPath[i].lng);

                if (distToStart < minStartDist) {
                    minStartDist = distToStart;
                    startIdx = i;
                }
                if (distToEnd < minEndDist) {
                    minEndDist = distToEnd;
                    endIdx = i;
                }
            }

            // Ensure startIdx < endIdx (route goes in correct direction)
            if (startIdx > endIdx) {
                [startIdx, endIdx] = [endIdx, startIdx];
            }

            // Extract the segment (no extra stop points - walking segments handle connection)
            const trimmedPath = fullPath.slice(startIdx, endIdx + 1);

            return trimmedPath;
        }

        // Fallback: straight line between stops
        return [
            { lat: startStop.lat, lng: startStop.lng },
            { lat: endStop.lat, lng: endStop.lng }
        ];
    }

    private async getTimetable(routeId: string): Promise<RouteTimetable | null> {
        if (this.timetableCache.has(routeId)) {
            return this.timetableCache.get(routeId)!;
        }
        try {
            const res = await fetch(`/data/timetables/${routeId}.json`);
            if (res.ok) {
                const data = await res.json();
                this.timetableCache.set(routeId, data);
                return data;
            }
        } catch (e) {
            // Silent fail - timetable not available
        }
        return null;
    }

    private getServiceType(date: Date): 'weekdays' | 'saturdays' | 'sundays' {
        const day = date.getDay();
        if (day === 0) return 'sundays';
        if (day === 6) return 'saturdays';
        // TODO: Handle holidays
        return 'weekdays';
    }

    private findNextBus(
        timetable: RouteTimetable,
        startStopId: string,
        endStopId: string,
        walkMinutes: number
    ): { departureTime: string; arrivalTime: string; waitMinutes: number; tripId: string; intermediateStops: { name: string; time: string }[] } | null {
        const now = new Date();
        const departureThreshold = new Date(now.getTime() + walkMinutes * 60000);
        const thresholdH = departureThreshold.getHours();
        const thresholdM = departureThreshold.getMinutes();
        const thresholdTimeVal = thresholdH * 60 + thresholdM;

        const serviceType = this.getServiceType(now);
        const trips = timetable[serviceType];

        if (!trips) return null;

        for (const trip of trips) {
            // Find start and end stop indices in this trip
            let startIdx = -1;
            let endIdx = -1;

            for (let i = 0; i < trip.st.length; i++) {
                if (trip.st[i].s === startStopId) startIdx = i;
                if (trip.st[i].s === endStopId) endIdx = i;
            }

            // Check if valid sequence (start comes before end)
            if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
                const startStop = trip.st[startIdx];
                const endStop = trip.st[endIdx];

                // Check time
                const [h, m] = startStop.t.split(':').map(Number);
                const timeVal = h * 60 + m;

                if (timeVal >= thresholdTimeVal) {
                    const waitFromArrival = timeVal - thresholdTimeVal;

                    // Extract intermediate stops (between start and end, exclusive)
                    const intermediateStops: { name: string; time: string }[] = [];
                    for (let i = startIdx + 1; i < endIdx; i++) {
                        const stopId = trip.st[i].s;
                        const stopNode = this.graphData?.stops[stopId];
                        intermediateStops.push({
                            name: stopNode?.name || stopId,
                            time: trip.st[i].t
                        });
                    }

                    return {
                        departureTime: startStop.t,
                        arrivalTime: endStop.t,
                        waitMinutes: Math.max(0, waitFromArrival),
                        tripId: trip.id,
                        intermediateStops
                    };
                }
            }
        }
        return null;
    }

    public async searchRoutes(
        origin: { latitude: number; longitude: number },
        destination: { latitude: number; longitude: number },
        options: { includeSubway?: boolean } = {},
        onRouteFound?: (route: RouteOption) => void
    ): Promise<RouteOption[]> {
        const { includeSubway = false } = options;
        await this.init();
        if (!this.graphData) return [];

        const startStops = this.findNearbyStops(origin.latitude, origin.longitude);
        const endStops = this.findNearbyStops(destination.latitude, destination.longitude);

        if (startStops.length === 0 || endStops.length === 0) {
            return [];
        }

        // Phase 1: Identify all potential routes and calculate "Straight Line" score
        const potentialRoutes: {
            routeId: string;
            startStop: StopNode;
            endStop: StopNode;
            routeInfo: RouteInfo;
            estimatedDuration: number;
        }[] = [];

        const seenRouteIds = new Set<string>();

        for (const startStop of startStops) {
            for (const endStop of endStops) {
                const commonRoutes = startStop.routes.filter(r => endStop.routes.includes(r));

                for (const routeId of commonRoutes) {
                    const uniqueId = `${routeId}-${startStop.id}-${endStop.id}`;
                    if (seenRouteIds.has(uniqueId)) continue;
                    seenRouteIds.add(uniqueId);

                    const routeInfo = this.graphData.routes[routeId];
                    if (!routeInfo) continue;
                    if (routeInfo.type === 'subway' && !includeSubway) continue;

                    const distToStop = this.getDistance(origin.latitude, origin.longitude, startStop.lat, startStop.lng);
                    const distFromStop = this.getDistance(endStop.lat, endStop.lng, destination.latitude, destination.longitude);
                    const rideDist = this.getDistance(startStop.lat, startStop.lng, endStop.lat, endStop.lng);

                    const estimatedWalkMins = (distToStop + distFromStop) / 80;
                    const estimatedRideMins = rideDist / 300 + 5;

                    potentialRoutes.push({
                        routeId,
                        startStop,
                        endStop,
                        routeInfo,
                        estimatedDuration: estimatedWalkMins + estimatedRideMins
                    });
                }
            }
        }

        potentialRoutes.sort((a, b) => a.estimatedDuration - b.estimatedDuration);

        // Phase 2: Fetch detailed OSRM paths only for top candidates
        // Increased from 5 to 8 to ensure we have enough valid routes after filtering, but kept low to avoid OSRM rate limits (429)
        const topCandidates = potentialRoutes.slice(0, 8);

        // Streaming Deduplication State
        const streamedTitles = new Set<string>();
        let streamedCount = 0;

        const results = await Promise.all(topCandidates.map(async (candidate) => {
            const { routeId, startStop, endStop, routeInfo } = candidate;
            const isSubway = routeInfo.type === 'subway';

            // 1. Get walking paths first (needed for accurate timing)
            const [walkToStopPath, walkFromStopPath] = await Promise.all([
                this.getWalkingPath(origin.latitude, origin.longitude, startStop.lat, startStop.lng),
                this.getWalkingPath(endStop.lat, endStop.lng, destination.latitude, destination.longitude)
            ]);

            const walkToStopDist = this.getPathLength(walkToStopPath);
            const walkFromStopDist = this.getPathLength(walkFromStopPath);

            const walkToMinutes = Math.ceil(walkToStopDist / 80);
            const walkFromMinutes = Math.ceil(walkFromStopDist / 80);

            // 2 & 3 & 4. Real Time Calculation
            let estimatedWaitMinutes = 0;
            let rideMinutes = 0;
            let busDepartureTimeStr = "";
            let busArrivalTimeStr = "";

            // Try to get real schedule
            const timetable = await this.getTimetable(routeId);
            const realSchedule = timetable ? this.findNextBus(timetable, startStop.id, endStop.id, walkToMinutes) : null;

            if (realSchedule) {
                busDepartureTimeStr = realSchedule.departureTime;
                busArrivalTimeStr = realSchedule.arrivalTime;
                estimatedWaitMinutes = realSchedule.waitMinutes;

                // Calculate ride minutes from schedule
                const [depH, depM] = busDepartureTimeStr.split(':').map(Number);
                const [arrH, arrM] = busArrivalTimeStr.split(':').map(Number);
                rideMinutes = (arrH * 60 + arrM) - (depH * 60 + depM);
                if (rideMinutes < 0) rideMinutes += 24 * 60; // Handle midnight crossover?
            } else if (timetable) {
                // Timetable exists but no bus found (e.g. End of Service or Stop Mismatch).
                // Do NOT fallback to simulated time for valid timetable routes.
                return null;
            } else {
                // FALLBACK: Simulated Logic (Only for routes without timetable, e.g. Subway or Missing Data)
                const currentHour = new Date().getHours();
                if (currentHour >= 7 && currentHour <= 9) {
                    estimatedWaitMinutes = Math.floor(Math.random() * 6) + 3;
                } else if (currentHour >= 17 && currentHour <= 19) {
                    estimatedWaitMinutes = Math.floor(Math.random() * 6) + 3;
                } else if (currentHour >= 10 && currentHour <= 16) {
                    estimatedWaitMinutes = Math.floor(Math.random() * 8) + 8;
                } else {
                    estimatedWaitMinutes = Math.floor(Math.random() * 10) + 15;
                }
                const routeHash = routeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                estimatedWaitMinutes = Math.max(2, (estimatedWaitMinutes + (routeHash % 5)) % 20);

                // Ride Duration
                const rideDist = this.getDistance(startStop.lat, startStop.lng, endStop.lat, endStop.lng);
                const speedMeterPerMin = isSubway ? 500 : 250;
                const stopPenalty = 2;
                rideMinutes = Math.ceil(rideDist / speedMeterPerMin) + stopPenalty;

                // Calculate simulated departure string
                const now = new Date();
                const departureMins = now.getHours() * 60 + now.getMinutes() + walkToMinutes + estimatedWaitMinutes;
                const depH = Math.floor(departureMins / 60) % 24;
                const depM = departureMins % 60;
                busDepartureTimeStr = `${depH}:${depM.toString().padStart(2, '0')}`;
            }

            // 4. Final Timing Calculation
            const now = new Date();
            let startTimestamp = now.getTime();

            // Just-In-Time Departure Logic (User Request: Calculate backwards from bus stop)
            if (realSchedule && estimatedWaitMinutes > 0) {
                // Shift start time so that user arrives just in time (wait = 0)
                // estimatedWaitMinutes was calculated as (BusDeparture - (Now + Walk))
                startTimestamp += estimatedWaitMinutes * 60000;
                estimatedWaitMinutes = 0; // Reduce wait time in UI since we shifted start
            }

            const totalDurationMinutes = walkToMinutes + estimatedWaitMinutes + rideMinutes + walkFromMinutes;
            const endTimestamp = startTimestamp + totalDurationMinutes * 60000;

            const startDate = new Date(startTimestamp);
            const endDate = new Date(endTimestamp);

            const formatTime = (d: Date) => `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            const startTimeStr = formatTime(startDate);
            const endTimeStr = formatTime(endDate);

            const direction = "方面";
            const busPath = this.getBusPath(routeId, routeInfo, startStop, endStop);

            // Get intermediate stops from GTFS timetable (real data)
            const intermediateStops = realSchedule?.intermediateStops || [];

            const option: RouteOption = {
                id: `route-${routeId}-${startStop.id}-${endStop.id}`,
                title: routeInfo.long_name || routeInfo.short_name,
                duration: `${totalDurationMinutes}分`,
                startTime: startTimeStr,
                endTime: endTimeStr,
                cost: isSubway ? "260円" : "230円",
                steps: [`${startStop.name}から乗車`, `${endStop.name}で降車`],
                transportMode: TransportMode.TRANSIT,
                segments: [
                    {
                        type: 'WALK',
                        text: `${walkToMinutes}分 (${Math.round(walkToStopDist)}m)`,
                        duration: `${walkToMinutes}分`,
                        path: walkToStopPath
                    },
                    {
                        type: isSubway ? 'SUBWAY' : 'BUS',
                        text: routeInfo.short_name,
                        duration: `${rideMinutes}分`,
                        departureTime: busDepartureTimeStr,
                        arrivalTime: busArrivalTimeStr,
                        direction: direction,
                        companyName: isSubway ? '京都市営地下鉄' : '京都市営バス',
                        lineName: routeInfo.short_name,
                        routeId: routeId,
                        path: isSubway ? [] : busPath,
                        waitMinutes: estimatedWaitMinutes,
                        intermediateStops: intermediateStops
                    },
                    {
                        type: 'WALK',
                        text: `${walkFromMinutes}分 (${Math.round(walkFromStopDist)}m)`,
                        duration: `${walkFromMinutes}分`,
                        path: walkFromStopPath
                    }
                ]
            };

            // STREAMING: Emit result if unique and within limit
            if (onRouteFound && !streamedTitles.has(option.title) && streamedCount < 5) {
                streamedTitles.add(option.title);
                streamedCount++;
                onRouteFound(option);
            }

            return option;
        }));

        // Filter out nulls (routes where timetable existed but no bus found)
        const validResults = results.filter(r => r !== null) as RouteOption[];

        // Deduplicate
        const uniqueRoutes = new Map<string, RouteOption>();
        validResults.forEach(r => {
            // Include departure time in deduplication key
            const depTime = r.segments.find(s => s.type === 'BUS' || s.type === 'SUBWAY')?.departureTime || r.startTime;
            const key = `${r.title}-${depTime}`;
            // User requested "Earliest Departure Order". Usually apps show:
            // Route 205 (10:00), Route 4 (10:05), Route 205 (10:15)...
            // But my logic only returns ONE trip per route ID.
            // So deduplication key should be fine as RouteId.
            // Let's keep it simple: One option per Route ID (best connection).

            // Actually, if we use just title, we merge direction? No, routeId includes direction usually? 
            // In my potentialRoutes logic, routeId is unique per line.

            if (!uniqueRoutes.has(r.title)) {
                uniqueRoutes.set(r.title, r);
            } else {
                // If existing route has LATER departure, replace with EARLIER?
                // Or if existing has longer duration?
                // Let's keep the one arriving EARLIER?
                // Or departing EARLIER?

                const existing = uniqueRoutes.get(r.title)!;
                // Compare departure times
                // We need timestamps or values.
                // Re-calculating val roughly
                const getMinutesIds = (t: string) => {
                    const [h, m] = t.split(':').map(Number);
                    return h * 60 + m;
                }
                const existingTime = getMinutesIds(existing.segments[1].departureTime || "24:00");
                const newTime = getMinutesIds(r.segments[1].departureTime || "24:00");

                if (newTime < existingTime) {
                    uniqueRoutes.set(r.title, r);
                }
            }
        });

        const finalResults = Array.from(uniqueRoutes.values());

        // Sort by Departure Time (Earliest First)
        finalResults.sort((a, b) => {
            const getDepTime = (opt: RouteOption) => {
                const seg = opt.segments.find(s => s.type === 'BUS' || s.type === 'SUBWAY');
                if (seg && seg.departureTime) {
                    const [h, m] = seg.departureTime.split(':').map(Number);
                    return h * 60 + m;
                }
                return 9999;
            };
            return getDepTime(a) - getDepTime(b);
        });

        return finalResults.slice(0, 5);
    }

    private getPathLength(path: { lat: number; lng: number }[]): number {
        let dist = 0;
        for (let i = 0; i < path.length - 1; i++) {
            dist += this.getDistance(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
        }
        return dist;
    }

    private parseWalkTime(durationStr: string): number {
        return parseInt(durationStr.replace('分', '')) || 0;
    }


    // Public method to check if a location has nearby bus stops
    public async hasNearbyBusStops(lat: number, lng: number, radiusMeters: number = 3000): Promise<boolean> {
        await this.init();
        const stops = this.findNearbyStops(lat, lng, radiusMeters);
        // Only count bus stops, not subway stops
        const busStops = stops.filter(stop =>
            stop.routes.some(routeId => routeId.startsWith('bus_'))
        );
        return busStops.length > 0;
    }

    // Helper: Get distance and "Left Side" status relative to path direction
    private getStopPathInfo(lat: number, lng: number, path: { lat: number; lng: number }[]): { dist: number, isLeft: boolean } {
        let minDist = Infinity;
        let isLeft = false;

        // Check each segment
        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i + 1];

            // Distance to segment
            const d = this.distanceToSegment(lat, lng, p1.lat, p1.lng, p2.lat, p2.lng);

            if (d < minDist) {
                minDist = d;
                // Calculate side using Cross Product
                // Vector P1->P2: (dx, dy)
                // Vector P1->Stop: (sx, sy)
                // Cross = dx*sy - dy*sx
                const dx = p2.lng - p1.lng;
                const dy = p2.lat - p1.lat;
                const sx = lng - p1.lng;
                const sy = lat - p1.lat;
                const cross = dx * sy - dy * sx;

                // > 0 is Left, < 0 is Right (Standard Cartesian if Y is Up/North)
                isLeft = cross > 0;
            }
        }
        return { dist: minDist, isLeft };
    }

    // Point to Segment distance (Meters)
    private distanceToSegment(lat: number, lng: number, lat1: number, lng1: number, lat2: number, lng2: number): number {
        const d_lat = lat2 - lat1;
        const d_lng = lng2 - lng1;

        if (d_lat === 0 && d_lng === 0) return this.getDistance(lat, lng, lat1, lng1);

        // Project point onto line (parameter t)
        const t = ((lng - lng1) * d_lng + (lat - lat1) * d_lat) / (d_lng * d_lng + d_lat * d_lat);

        let closeLat, closeLng;
        if (t < 0) { closeLat = lat1; closeLng = lng1; }
        else if (t > 1) { closeLat = lat2; closeLng = lng2; }
        else {
            closeLat = lat1 + t * d_lat;
            closeLng = lng1 + t * d_lng;
        }

        return this.getDistance(lat, lng, closeLat, closeLng);
    }

    private getMinDistanceToPath(lat: number, lng: number, path: { lat: number; lng: number }[]): number {
        let minDist = Infinity;
        // Optimization: skip points to speed up (check every 3rd point)
        for (let i = 0; i < path.length; i += 3) {
            const d = this.getDistance(lat, lng, path[i].lat, path[i].lng);
            if (d < minDist) minDist = d;
        }
        return minDist;
    }
}

export const routeService = new RouteService();
