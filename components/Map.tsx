import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, PolylineF } from '@react-google-maps/api';
import { Spot, Coordinates, RouteOption } from '../types';

interface MapProps {
    center: Coordinates;
    spots: Spot[];
    onSelectSpot: (spot: Spot) => void;
    onPinClick?: () => void;
    selectedSpotId?: string;
    focusedSpotId?: string;
    selectedRoute?: RouteOption | null;
    isNavigating?: boolean;
    routeOptions?: RouteOption[];
}

// Map container style
const containerStyle = {
    width: '100%',
    height: '100%'
};

// Default center (Kyoto Station)
const defaultCenter = {
    lat: 34.9858,
    lng: 135.7588
};

// Map options
const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'greedy',
    styles: [
        {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
        }
    ]
};

const Map: React.FC<MapProps> = ({ center, spots, onSelectSpot, onPinClick, selectedSpotId, focusedSpotId, selectedRoute, routeOptions = [] }) => {
    // Determine API Key from environment
    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
        (import.meta as any).env?.GOOGLE_MAPS_API_KEY ||
        (typeof process !== 'undefined' && process.env ? process.env.GOOGLE_MAPS_API_KEY : '') || '';

    if (!apiKey) {
        console.error("Google Maps API Key is missing!");
    }

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: apiKey || '',
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);

    // Ref to track if initial pan to center has been performed
    const hasPannedToInitialCenter = useRef(false);

    // Initial Pan Logic: Pan to center ONLY once when map is loaded and center is available
    useEffect(() => {
        if (map && center && !hasPannedToInitialCenter.current) {
            map.panTo({ lat: center.latitude, lng: center.longitude });
            hasPannedToInitialCenter.current = true;
        }
    }, [center, map]);

    // NOTE: Removed logic that auto-pans on center update to prevent hindering user navigation.
    // Map will now ONLY move when:
    // 1. Initial load
    // 2. User clicks "Recenter" button
    // 3. User selects a spot (focusedSpotId changes)

    // Handle focused spot (panning and opening popup)
    useEffect(() => {
        if (map && focusedSpotId) {
            // Extract actual ID
            const lastHyphenIndex = focusedSpotId.lastIndexOf('-');
            const actualId = lastHyphenIndex > 0 ? focusedSpotId.substring(0, lastHyphenIndex) : focusedSpotId;

            const spot = spots.find(s => s.id === actualId);
            if (spot) {
                // Pan with offset (similar to Leaflet implementation)
                // In Google Maps, we can just panTo center for now, or calculate projection
                // For simplicity, let's just pan to spot
                map.panTo({ lat: spot.location.latitude, lng: spot.location.longitude });
                map.setZoom(16);
                setActiveMarkerId(actualId);
            }
        }
    }, [focusedSpotId, map, spots]);

    const onLoad = useCallback((mapInstance: google.maps.Map) => {
        setMap(mapInstance);
    }, []);

    const onUnmount = useCallback(() => {
        setMap(null);
    }, []);

    // Helper to create SVG icon
    const getMarkerIcon = (spot: Spot) => {
        let color = '#3b82f6';
        if (spot.congestionLevel === 5) color = '#ef4444';
        else if (spot.congestionLevel === 4) color = '#eab308';
        else if (spot.congestionLevel === 3) color = '#22c55e';
        else if (spot.congestionLevel === 2) color = '#06b6d4';

        const svg = `
            <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 24 16 24s16-15.163 16-24C32 7.163 24.837 0 16 0z" fill="${color}"/>
                <circle cx="16" cy="16" r="5" fill="white"/>
            </svg>
        `.trim();

        return {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
            scaledSize: new google.maps.Size(32, 40),
            anchor: new google.maps.Point(16, 40)
        };
    };

    if (!isLoaded) {
        return <div className="w-full h-full bg-gray-200 flex items-center justify-center">Loading Maps...</div>;
    }

    // Current Location Icon
    const currentLocationIcon = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#2563eb",
        fillOpacity: 1,
        strokeColor: "white",
        strokeWeight: 2,
    };

    return (
        <GoogleMap
            mapContainerStyle={containerStyle}
            center={{ lat: center.latitude, lng: center.longitude }}
            zoom={15}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={mapOptions}
            onClick={() => setActiveMarkerId(null)} // Close info window when clicking map
        >
            {/* Recenter Button - Visible when auto-pan is disabled */}
            {/* Recenter Button - Always visible */}
            <button
                onClick={() => {
                    // Just pan once, do not enable auto-pan to allow free movement
                    map?.panTo({ lat: center.latitude, lng: center.longitude });
                }}
                className="absolute top-20 left-4 z-40 bg-white p-3 rounded-full shadow-lg text-gray-600 hover:text-indigo-600 transition-colors border border-gray-100"
                title="現在地に戻る"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                </svg>
            </button>
            {/* Current Location Marker (Approximate visual) */}
            <MarkerF
                position={{ lat: center.latitude, lng: center.longitude }}
                icon={currentLocationIcon}
                zIndex={100}
                title="現在地"
            />

            {/* Spot Markers */}
            {spots.map(spot => (
                <MarkerF
                    key={spot.id}
                    position={{ lat: spot.location.latitude, lng: spot.location.longitude }}
                    icon={getMarkerIcon(spot)}
                    onClick={() => {
                        setActiveMarkerId(spot.id);
                        if (onPinClick) onPinClick();
                    }}
                >
                    {activeMarkerId === spot.id && (
                        <InfoWindowF
                            position={{ lat: spot.location.latitude, lng: spot.location.longitude }}
                            onCloseClick={() => setActiveMarkerId(null)}
                            options={{ pixelOffset: new google.maps.Size(0, -40) }}
                        >
                            <div style={{ minWidth: '220px', maxWidth: '250px', fontFamily: 'sans-serif' }}>
                                <div className="font-bold text-base mb-1 text-gray-800">{spot.name}</div>
                                <div className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white mb-2`}
                                    style={{
                                        backgroundColor: spot.congestionLevel === 5 ? '#ef4444' :
                                            spot.congestionLevel === 4 ? '#eab308' :
                                                spot.congestionLevel === 3 ? '#22c55e' :
                                                    spot.congestionLevel === 2 ? '#06b6d4' : '#3b82f6'
                                    }}>
                                    {['快適', 'やや快適', '通常', 'やや混雑', '混雑'][spot.congestionLevel - 1]}
                                </div>
                                {spot.description && <div className="text-xs text-gray-600 mb-2 leading-snug">{spot.description}</div>}
                                <button
                                    onClick={() => onSelectSpot(spot)}
                                    className="w-full mt-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 py-2 rounded shadow text-xs font-bold cursor-pointer"
                                >
                                    ルートを見る
                                </button>
                            </div>
                        </InfoWindowF>
                    )}
                </MarkerF>
            ))}

            {/* Route Polylines */}
            {selectedRoute && (selectedRoute.segments ? (
                selectedRoute.segments.map((seg, i) => {
                    if (!seg.path || seg.path.length === 0) return null;
                    const path = seg.path.map((p: any) => ({ lat: p.lat, lng: p.lng }));

                    const isWalk = seg.type === 'WALK';

                    return (
                        <PolylineF
                            key={i}
                            path={path}
                            options={{
                                strokeColor: isWalk ? '#ea580c' : '#0097a7', // Darker Orange (600) or Darker Cyan (700)
                                strokeOpacity: 1.0,
                                strokeWeight: isWalk ? 6 : 8,
                                icons: isWalk ? [{
                                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 2, fillOpacity: 1, fillColor: '#ea580c' },
                                    offset: '0',
                                    repeat: '10px'
                                }] : undefined
                            }}
                        />
                    );
                })
            ) : selectedRoute.path ? (
                <PolylineF
                    path={selectedRoute.path.map((p: any) => ({ lat: p.lat, lng: p.lng }))}
                    options={{
                        strokeColor: '#0097a7', // Darker Cyan (700)
                        strokeOpacity: 1.0,
                        strokeWeight: 8
                    }}
                />
            ) : null)}

        </GoogleMap>
    );
};

export default Map;