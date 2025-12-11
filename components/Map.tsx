import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Spot, Coordinates, RouteOption } from '../types';

// Fix Leaflet default icon path issues with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapProps {
    center: Coordinates;
    spots: Spot[];
    onSelectSpot: (spot: Spot) => void;
    onPinClick?: () => void;  // Called when any pin is clicked
    selectedSpotId?: string;
    focusedSpotId?: string;  // Separate prop for list click pan+popup
    selectedRoute?: RouteOption | null;
    routeOptions?: RouteOption[];
}

// Create custom marker icon
const createCustomIcon = (color: string) => {
    const svg = `
        <svg width="28" height="36" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 24 16 24s16-15.163 16-24C32 7.163 24.837 0 16 0z" fill="${color}"/>
            <circle cx="16" cy="16" r="5" fill="white"/>
        </svg>
    `;
    return L.divIcon({
        html: svg,
        className: 'custom-marker',
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        popupAnchor: [0, -36]
    });
};

const Map: React.FC<MapProps> = ({ center, spots, onSelectSpot, onPinClick, selectedSpotId, focusedSpotId, selectedRoute, routeOptions = [] }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const polylinesRef = useRef<L.Polyline[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Initialize Leaflet Map
    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        // Create map
        const map = L.map(mapContainerRef.current, {
            center: [center.latitude, center.longitude],
            zoom: 15,
            zoomControl: true
        });

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        mapInstanceRef.current = map;
        setIsLoaded(true);


        // Add custom styles for markers
        const style = document.createElement('style');
        style.textContent = `
            .custom-marker {
                background: transparent;
                border: none;
            }
            .custom-marker svg {
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
            }
            .leaflet-popup-content-wrapper {
                border-radius: 12px;
                padding: 0;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            }
            .leaflet-popup-content {
                margin: 0;
                padding: 14px;
                font-family: 'Zen Kaku Gothic New', sans-serif;
            }
            .leaflet-popup-tip {
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            }
        `;
        document.head.appendChild(style);

        return () => {
            map.remove();
            mapInstanceRef.current = null;
            style.remove();
        };
    }, []);

    // Update center
    useEffect(() => {
        if (!mapInstanceRef.current || !isLoaded) return;
        mapInstanceRef.current.setView([center.latitude, center.longitude], mapInstanceRef.current.getZoom());
    }, [center, isLoaded]);

    // Store markers by spot ID for lookup
    const markerMapRef = useRef<{ [key: string]: L.Marker }>({});

    // Render spot markers
    useEffect(() => {
        if (!mapInstanceRef.current || !isLoaded) return;
        const map = mapInstanceRef.current;

        // Clear existing markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];
        markerMapRef.current = {};

        spots.forEach(spot => {
            // Determine color based on congestion
            let color = '#3b82f6';
            if (spot.congestionLevel === 5) color = '#ef4444';
            else if (spot.congestionLevel === 4) color = '#eab308';
            else if (spot.congestionLevel === 3) color = '#22c55e';
            else if (spot.congestionLevel === 2) color = '#06b6d4';

            const icon = createCustomIcon(color);
            const marker = L.marker([spot.location.latitude, spot.location.longitude], { icon });

            // Create popup content with description and consistent SVG icons
            const congestionText = ['快適', 'やや快適', '通常', 'やや混雑', '混雑'][spot.congestionLevel - 1];
            const popupContent = document.createElement('div');
            popupContent.innerHTML = `
                <div style="min-width: 220px; max-width: 280px; font-family: system-ui, -apple-system, sans-serif;">
                    <div style="font-weight: 700; font-size: 15px; margin-bottom: 6px; color: #1f2937; line-height: 1.3;">${spot.name}</div>
                    <div style="display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; color: white; background: ${color}; margin-bottom: 10px;">${congestionText}</div>
                    ${spot.description ? `<div style="font-size: 12px; color: #4b5563; margin-bottom: 10px; line-height: 1.5;">${spot.description}</div>` : ''}
                    ${spot.openingHours ? `
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #4b5563; margin-bottom: 6px;">
                            <svg style="width: 16px; height: 16px; min-width: 16px; min-height: 16px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            <span>${spot.openingHours}</span>
                        </div>
                    ` : ''}
                    ${spot.price ? `
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #4b5563; margin-bottom: 6px;">
                            <svg style="width: 16px; height: 16px; min-width: 16px; min-height: 16px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                                <line x1="12" y1="1" x2="12" y2="23"/>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                            <span>${spot.price}</span>
                        </div>
                    ` : ''}
                    <button id="route-btn-${spot.id}" style="
                        margin-top: 10px;
                        width: 100%;
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        color: white;
                        border: none;
                        padding: 10px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 700;
                        font-size: 12px;
                        box-shadow: 0 2px 8px rgba(102,126,234,0.4);
                    ">ルートを見る</button>
                </div>
            `;

            marker.bindPopup(popupContent, { closeButton: true, maxWidth: 250 });

            // Handle marker click - pan to position marker lower on screen
            marker.on('click', () => {
                const map = mapInstanceRef.current;
                if (map) {
                    const latLng = marker.getLatLng();
                    // Calculate offset to position marker at ~35% from top (instead of center)
                    const mapHeight = map.getSize().y;
                    const offsetY = mapHeight * 0.30; // Move view up so marker appears lower
                    const point = map.latLngToContainerPoint(latLng);
                    const newPoint = L.point(point.x, point.y - offsetY);
                    const newLatLng = map.containerPointToLatLng(newPoint);
                    map.setView(newLatLng, map.getZoom(), { animate: true });
                }
            });

            // Handle popup open to add button listener
            marker.on('popupopen', () => {
                // Notify parent that a pin was clicked
                if (onPinClick) onPinClick();

                setTimeout(() => {
                    const btn = document.getElementById(`route-btn-${spot.id}`);
                    if (btn) {
                        btn.onclick = () => {
                            marker.closePopup();
                            onSelectSpot(spot);
                        };
                    }
                }, 50);
            });

            marker.addTo(map);
            markersRef.current.push(marker);
            markerMapRef.current[spot.id] = marker;
        });
    }, [isLoaded, spots, onSelectSpot, onPinClick]);

    // Pan to focused spot (from list click) and open popup
    useEffect(() => {
        if (!mapInstanceRef.current || !isLoaded || !focusedSpotId) return;
        const map = mapInstanceRef.current;

        // Extract actual spot ID (remove timestamp suffix - last part after last hyphen)
        const lastHyphenIndex = focusedSpotId.lastIndexOf('-');
        const actualSpotId = lastHyphenIndex > 0 ? focusedSpotId.substring(0, lastHyphenIndex) : focusedSpotId;
        const marker = markerMapRef.current[actualSpotId];

        if (marker) {
            const latLng = marker.getLatLng();
            // Position marker lower on screen (same as pin click)
            const mapHeight = map.getSize().y;
            const offsetY = mapHeight * 0.30;
            const point = map.latLngToContainerPoint(latLng);
            const newPoint = L.point(point.x, point.y - offsetY);
            const newLatLng = map.containerPointToLatLng(newPoint);
            map.setView(newLatLng, map.getZoom(), { animate: true });
            setTimeout(() => {
                marker.openPopup();
            }, 300);
        }
    }, [focusedSpotId, isLoaded]);

    // Render Routes (Polylines) - Only show when a route is selected
    useEffect(() => {
        if (!mapInstanceRef.current || !isLoaded) return;
        const map = mapInstanceRef.current;

        // Clear existing lines
        polylinesRef.current.forEach(line => line.remove());
        polylinesRef.current = [];

        // Only show routes when a route is actually selected (not just browsing options)
        if (!selectedRoute) return;

        let allPoints: L.LatLng[] = [];

        if (selectedRoute.segments && selectedRoute.segments.length > 0) {
            selectedRoute.segments.forEach(segment => {
                if (!segment.path || segment.path.length === 0) return;

                // Cyan for transit, orange dashed for walking
                const isWalk = segment.type === 'WALK';
                const segmentColor = isWalk ? '#f97316' : '#00bcd4'; // Orange for walk, Cyan for transit
                const points: L.LatLngExpression[] = segment.path.map((p: any) => [p.lat, p.lng]);

                const polyline = L.polyline(points, {
                    color: segmentColor,
                    weight: isWalk ? 5 : 7, // Thicker for transit
                    opacity: 0.9,
                    dashArray: isWalk ? '10, 10' : undefined, // Dashed for walking
                    lineCap: 'round',
                    lineJoin: 'round'
                }).addTo(map);
                polylinesRef.current.push(polyline);

                allPoints = allPoints.concat(segment.path.map((p: any) => L.latLng(p.lat, p.lng)));
            });
        } else if (selectedRoute.path && selectedRoute.path.length > 0) {
            const points: L.LatLngExpression[] = selectedRoute.path.map((p: any) => [p.lat, p.lng]);
            const polyline = L.polyline(points, {
                color: '#00bcd4', // Cyan
                weight: 7,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(map);
            polylinesRef.current.push(polyline);

            allPoints = selectedRoute.path.map((p: any) => L.latLng(p.lat, p.lng));
        }

        // Fit bounds to show full route
        if (allPoints.length > 0) {
            const bounds = L.latLngBounds(allPoints);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [isLoaded, selectedRoute]);

    // Current Location Marker
    const currentLocationMarkerRef = useRef<L.Marker | null>(null);

    useEffect(() => {
        if (!mapInstanceRef.current || !isLoaded) return;
        const map = mapInstanceRef.current;

        // Custom pulsing dot icon for current location
        const currentLocationIcon = L.divIcon({
            className: 'current-location-marker',
            html: `
                <div class="pulse-ring"></div>
                <div class="pulse-core"></div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        // Add CSS for current location marker
        const styleId = 'current-location-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .current-location-marker {
                    background: transparent;
                    border: none;
                }
                .pulse-core {
                    width: 14px;
                    height: 14px;
                    background-color: #2563eb;
                    border: 2px solid white;
                    border-radius: 50%;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 2;
                }
                .pulse-ring {
                    width: 24px;
                    height: 24px;
                    background-color: rgba(37, 99, 235, 0.4);
                    border-radius: 50%;
                    position: absolute;
                    top: 0;
                    left: 0;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% {
                        transform: scale(0.8);
                        opacity: 0.8;
                    }
                    70% {
                        transform: scale(2);
                        opacity: 0;
                    }
                    100% {
                        transform: scale(0.8);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Remove existing marker if any
        if (currentLocationMarkerRef.current) {
            currentLocationMarkerRef.current.remove();
        }

        // Add new marker
        const marker = L.marker([center.latitude, center.longitude], {
            icon: currentLocationIcon,
            zIndexOffset: 1000 // Ensure it sits on top of other markers
        }).addTo(map);

        marker.bindPopup(`
            <div style="font-family: system-ui, sans-serif; font-size: 13px; font-weight: bold; padding: 4px 8px;">
                現在地 (京都駅)
            </div>
        `, { closeButton: false, offset: [0, -10] });

        currentLocationMarkerRef.current = marker;

        return () => {
            // Cleanup logic is handled by re-running effect, but styling persists which is fine
        };
    }, [center, isLoaded]);

    return (
        <div
            ref={mapContainerRef}
            style={{
                width: '100%',
                height: '100%',
                background: '#e5e7eb'
            }}
        />
    );
};

export default Map;