import { RouteOption, TransportMode, RouteSegment } from '../types';
import { detectTurns } from './turnDetectionService';

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

        // 1. Call Route Search API (or Mock)
        const USE_MOCK_DATA = true; // Set to true to use local mock files
        let searchData;

        if (USE_MOCK_DATA) {
            // console.log('⚠️ Using Local Mock Data for Route Search');
            const mockResponse = await fetch('/mocks/route_transit.json');
            if (!mockResponse.ok) throw new Error('Failed to load mock route data');
            searchData = await mockResponse.json();
        } else {
            const searchParams = new URLSearchParams({
                start,
                goal,
                start_time: startTime
            });

            const searchResponse = await fetch(`${ROUTE_SEARCH_URL}?${searchParams}`);

            if (!searchResponse.ok) {
                throw new Error(`Route Search API error: ${searchResponse.status} ${searchResponse.statusText}`);
            }

            searchData = await searchResponse.json();
        }

        if (!searchData.items || searchData.items.length === 0) {
            console.warn('No routes found from NAVITIME');
            return [];
        }

        // 2. Process each route - Fetch Shape data in parallel
        const routePromises = searchData.items.map(async (item: any, index: number) => {
            let shapeData: any = null;

            try {
                // Fetch Shape for this specific route (Real or Mock)
                if (USE_MOCK_DATA) {
                    const shapeResponse = await fetch(`/mocks/shape_transit_${index + 1}.json`);
                    if (shapeResponse.ok) {
                        shapeData = await shapeResponse.json();
                    } else {
                        console.warn(`Mock shape data not found for route ${index + 1}`);
                    }
                } else {
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
                            path: currentPath,
                            // Detect turns for walk segments
                            turns: currentSegmentType === 'WALK' ? detectTurns(currentPath) : undefined
                        });
                        fullPath.push(...currentPath);
                    }
                    currentSegmentType = segmentType;
                    currentPath = [...featurePath];
                }
            });

            if (currentPath.length > 0 && currentSegmentType) {
                segments.push({
                    type: currentSegmentType,
                    text: currentSegmentType === 'WALK' ? '徒歩' :
                        currentSegmentType === 'BUS' ? 'バス' :
                            currentSegmentType === 'SUBWAY' ? '地下鉄' : '電車',
                    duration: '',
                    path: currentPath,
                    // Detect turns for walk segments
                    turns: currentSegmentType === 'WALK' ? detectTurns(currentPath) : undefined
                });
                fullPath.push(...currentPath);
            }

            // Extract metadata from route_transit sections and match to segments
            const sections = item.sections || [];
            let walkIdx = 0;
            let transportIdx = 0;
            let lastGateway: string | undefined = undefined;

            sections.forEach((section: any) => {
                // Track gateway from point sections (stations)
                if (section.type === 'point' && section.gateway) {
                    lastGateway = section.gateway;
                }

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
                                    segments[i].distance = section.distance || 0;
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
                                    segments[i].distance = section.distance || 0;

                                    // Extract AI Guide relevant data
                                    if (transportName) segments[i].text = transportName;
                                    segments[i].durationMinutes = duration;

                                    // 1. Platform / Lane info
                                    const departureNode = section.from;
                                    if (departureNode && departureNode.platform) {
                                        segments[i].platform = departureNode.platform;
                                    }

                                    // 2. Direction / Headsign
                                    if (section.transport && section.transport.links && section.transport.links[0]) {
                                        const firstLink = section.transport.links[0];
                                        if (firstLink.destination?.name) {
                                            segments[i].direction = firstLink.destination.name;
                                        }
                                    }

                                    // 3. Departure / Arrival Times (Formatted)
                                    if (section.from_time) {
                                        segments[i].departureTime = section.from_time.split('T')[1]?.slice(0, 5); // "14:30"
                                    }
                                    if (section.to_time) {
                                        segments[i].arrivalTime = section.to_time.split('T')[1]?.slice(0, 5);
                                    }

                                    // 4. Transport details for Dify context
                                    if (section.transport) {
                                        // Line color
                                        if (section.transport.color) {
                                            segments[i].lineColor = section.transport.color;
                                        }
                                        // Company name
                                        if (section.transport.company?.name) {
                                            segments[i].companyName = section.transport.company.name;
                                        }
                                        // Train type (普通, 快速, etc.)
                                        if (section.transport.type) {
                                            segments[i].trainType = section.transport.type;
                                        }
                                        // Getoff position (前/後ろ)
                                        if (section.transport.getoff) {
                                            segments[i].getoff = section.transport.getoff;
                                        }
                                    }

                                    // Gateway (改札口) from previous station point
                                    if (lastGateway) {
                                        segments[i].gateway = lastGateway;
                                        lastGateway = undefined; // Reset after use
                                    }

                                    // 5. Stops list
                                    if (section.transport?.links) {
                                        segments[i].stops = section.transport.links.map((link: any) => link.to?.name || '不明な駅');
                                        segments[i].stopCount = segments[i].stops?.length || 0;
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
        // console.log('Processed routes:', routes);
        return routes;

    } catch (e) {
        console.error('NAVITIME API Error:', e);
        return [];
    }
};
