import { RouteOption, TransportMode, RouteSegment } from '../types';

// API Endpoints (via Vite proxy in dev, via Vercel serverless in prod)
const ROUTE_SEARCH_URL = '/api/route_transit';
const ROUTE_SHAPE_URL = '/api/shape_transit';

// Format date for API (YYYY-MM-DDThh:mm:ss)
const formatDateTime = (date: Date): string => {
    return date.toISOString().slice(0, 19);
};

// Parse GeoJSON coordinates [lon, lat] to {lat, lng}
const parseGeoJSONCoordinates = (coordinates: number[][]): { lat: number; lng: number }[] => {
    return coordinates.map(coord => ({
        lat: coord[1],  // GeoJSON is [lon, lat], we need {lat, lng}
        lng: coord[0]
    }));
};

/**
 * Get Route Options using NAVITIME Route Search API
 * Uses Vite proxy to handle CORS and authentication headers
 */
export const getNavitimeRoutes = async (
    originName: string,
    destinationName: string,
    originCoords?: { latitude: number; longitude: number },
    destCoords?: { latitude: number; longitude: number }
): Promise<RouteOption[]> => {
    // Default to Kyoto Station
    const kyotoStation = { latitude: 34.9858, longitude: 135.7588 };
    const origin = originCoords || kyotoStation;
    const destination = destCoords;

    if (!destination) {
        console.warn('Destination coordinates not provided');
        return [];
    }

    try {
        // Format coordinates as "lat,lng" for API
        const start = `${origin.latitude},${origin.longitude}`;
        const goal = `${destination.latitude},${destination.longitude}`;
        const startTime = formatDateTime(new Date());

        // 1. Call Route Search API
        const searchParams = new URLSearchParams({
            start,
            goal,
            start_time: startTime
        });

        const searchResponse = await fetch(`${ROUTE_SEARCH_URL}?${searchParams}`);

        if (!searchResponse.ok) {
            throw new Error(`Route Search API error: ${searchResponse.status} ${searchResponse.statusText}`);
        }

        const searchData = await searchResponse.json();

        if (!searchData.items || searchData.items.length === 0) {
            console.warn('No routes found from NAVITIME');
            return [];
        }

        // 2. Process each route - Fetch Shape data in parallel
        const routePromises = searchData.items.map(async (item: any, index: number) => {
            let shapeData: any = null;

            try {
                // Fetch Shape for this specific route (no = index + 1)
                // Request GeoJSON format with transport_shape option for detailed path
                const shapeParams = new URLSearchParams({
                    start,
                    goal,
                    start_time: startTime,
                    no: (index + 1).toString(),
                    format: 'geojson',
                    options: 'transport_shape'
                });

                const shapeResponse = await fetch(`${ROUTE_SHAPE_URL}?${shapeParams}`);

                if (shapeResponse.ok) {
                    shapeData = await shapeResponse.json();
                }
            } catch (err) {
                console.warn(`Failed to fetch shape for route ${index + 1}`, err);
            }

            // Extract route summary from route_transit response
            const summary = item.summary;
            const moveInfo = summary?.move;
            const durationMinutes = moveInfo?.time || 0;
            const totalFare = moveInfo?.fare?.unit_0 || 0;
            let title = `ルート${index + 1}`;

            const segments: RouteSegment[] = [];
            const steps: string[] = [];
            const fullPath: { lat: number; lng: number }[] = [];

            // Get all shape features and aggregate their paths
            const shapeFeatures = shapeData?.features || [];

            // Process shape features directly - they are already in order
            let currentSegmentType: 'WALK' | 'TRAIN' | 'BUS' | 'SUBWAY' | null = null;
            let currentPath: { lat: number; lng: number }[] = [];

            shapeFeatures.forEach((feature: any, featureIdx: number) => {
                const props = feature.properties || {};
                const coords = feature.geometry?.coordinates || [];
                const ways = props.ways; // 'walk' or 'transport'

                if (coords.length === 0) return;

                const featurePath = parseGeoJSONCoordinates(coords);

                // Determine segment type
                let segmentType: 'WALK' | 'TRAIN' | 'BUS' | 'SUBWAY';
                if (ways === 'walk') {
                    segmentType = 'WALK';
                } else {
                    // Transport - check transport_type
                    const transportType = props.transport_type || '';
                    if (transportType === 'bus' || transportType === 'local_bus') {
                        segmentType = 'BUS';
                    } else if (transportType === 'subway' || transportType === 'metro') {
                        segmentType = 'SUBWAY';
                    } else {
                        segmentType = 'TRAIN';
                    }
                }

                // Check if we need to start a new segment
                if (currentSegmentType === null) {
                    currentSegmentType = segmentType;
                    currentPath = [...featurePath];
                } else if (segmentType === currentSegmentType) {
                    // Same type - extend current path
                    currentPath = currentPath.concat(featurePath);
                } else {
                    // Different type - save current segment and start new one
                    if (currentPath.length > 0) {
                        segments.push({
                            type: currentSegmentType,
                            text: currentSegmentType === 'WALK' ? '徒歩' :
                                currentSegmentType === 'BUS' ? 'バス' :
                                    currentSegmentType === 'SUBWAY' ? '地下鉄' : '電車',
                            duration: '',
                            path: currentPath
                        });
                        fullPath.push(...currentPath);
                    }
                    currentSegmentType = segmentType;
                    currentPath = [...featurePath];
                }
            });

            // Don't forget the last segment
            if (currentPath.length > 0 && currentSegmentType) {
                segments.push({
                    type: currentSegmentType,
                    text: currentSegmentType === 'WALK' ? '徒歩' :
                        currentSegmentType === 'BUS' ? 'バス' :
                            currentSegmentType === 'SUBWAY' ? '地下鉄' : '電車',
                    duration: '',
                    path: currentPath
                });
                fullPath.push(...currentPath);
            }

            // Extract metadata from route_transit sections and match to segments
            const sections = item.sections || [];
            let walkIdx = 0;
            let transportIdx = 0;

            sections.forEach((section: any) => {
                if (section.type === 'move') {
                    const duration = section.time || 0;
                    const moveType = section.move;
                    const lineName = section.line_name || '';
                    const transportName = section.transport?.name || lineName || '';

                    if (moveType === 'walk') {
                        // Find the corresponding walk segment and update its duration
                        let foundWalkIdx = 0;
                        for (let i = 0; i < segments.length; i++) {
                            if (segments[i].type === 'WALK') {
                                if (foundWalkIdx === walkIdx) {
                                    segments[i].duration = `${duration}分`;
                                    break;
                                }
                                foundWalkIdx++;
                            }
                        }
                        walkIdx++;
                        if (duration > 0) steps.push(`徒歩${duration}分`);
                    } else {
                        // Find the corresponding transport segment and update its duration & name
                        let foundTransportIdx = 0;
                        for (let i = 0; i < segments.length; i++) {
                            if (segments[i].type !== 'WALK') {
                                if (foundTransportIdx === transportIdx) {
                                    segments[i].duration = `${duration}分`;
                                    if (transportName) {
                                        segments[i].text = transportName;
                                    }
                                    break;
                                }
                                foundTransportIdx++;
                            }
                        }
                        transportIdx++;

                        // Set route title to first transport name
                        if (title === `ルート${index + 1}` && transportName) {
                            title = transportName;
                        }
                        if (transportName) {
                            steps.push(`${transportName}に乗車（${duration}分）`);
                        }
                    }
                }
            });

            // If no steps were created, add basic info
            if (steps.length === 0) {
                steps.push(`${originName}から出発`, `${destinationName}へ到着`);
            }

            return {
                id: `route-${index + 1}`,
                title,
                duration: `${durationMinutes}分`,
                cost: totalFare > 0 ? `${totalFare}円` : '無料',
                steps,
                transportMode: TransportMode.TRANSIT,
                segments,
                path: fullPath
            };
        });

        const routes = await Promise.all(routePromises);
        console.log('Processed routes:', routes);
        return routes;

    } catch (e) {
        console.error('NAVITIME API Error:', e);
        return [];
    }
};
