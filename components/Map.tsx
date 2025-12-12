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
    spotPhotos?: Map<string, string>; // Google Places API photos
    spotDetails?: Map<string, { types?: string[] }>;
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

const Map: React.FC<MapProps> = ({ center, spots, onSelectSpot, onPinClick, selectedSpotId, focusedSpotId, selectedRoute, routeOptions = [], spotPhotos, spotDetails, isNavigating }) => {
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
    // State-controlled map center (to avoid GoogleMap center prop resetting setCenter)
    const [mapCenter, setMapCenter] = useState<{ lat: number, lng: number }>({ lat: center.latitude, lng: center.longitude });

    // Close InfoWindow when navigation starts
    useEffect(() => {
        if (isNavigating) {
            setActiveMarkerId(null);
        }
    }, [isNavigating]);

    // Ref to track if initial pan to center has been performed
    const hasPannedToInitialCenter = useRef(false);

    // Initial Pan Logic: Pan to center ONLY once when map is loaded and center is available
    useEffect(() => {
        if (map && center && !hasPannedToInitialCenter.current) {
            setMapCenter({ lat: center.latitude, lng: center.longitude });
            map.setCenter({ lat: center.latitude, lng: center.longitude });
            hasPannedToInitialCenter.current = true;
        }
    }, [center, map]);

    // NOTE: Removed logic that auto-pans on center update to prevent hindering user navigation.
    // Map will now ONLY move when:
    // 1. Initial load
    // 2. User clicks "Recenter" button
    // 3. User selects a spot (focusedSpotId changes)

    // Helper for Smart Panning (Instant Jump with Offset)
    // Places the pin at center-bottom of the screen (so popup is visible above)
    // Uses zoom-level based calculation (doesn't depend on getBounds which can be null)
    const handleSmartPan = useCallback((location: Coordinates) => {
        if (!map) return;

        const zoom = map.getZoom() || 15;

        // Calculate latitude offset based on zoom level
        // Formula: At zoom Z, 1 pixel ≈ 360 / (256 * 2^Z) degrees at equator
        // Adjusted for latitude using cosine correction
        const pixelOffset = 120; // pixels to offset (move pin toward bottom)
        const worldPxPerDegree = (256 * Math.pow(2, zoom)) / 360;
        const latRadians = location.latitude * Math.PI / 180;
        const latOffsetDegrees = pixelOffset / worldPxPerDegree / Math.cos(latRadians);

        // Shift center north to move spot south (toward bottom of screen)
        const newCenterLat = location.latitude + latOffsetDegrees;
        const newCenter = { lat: newCenterLat, lng: location.longitude };

        // Update both the state (for GoogleMap prop) and direct API call
        setMapCenter(newCenter);
        map.setCenter(newCenter);
    }, [map]);

    // Handle focused spot (panning and opening popup) - from list selection
    useEffect(() => {
        if (map && focusedSpotId) {
            // Extract actual ID (format: "spotId-timestamp")
            const lastHyphenIndex = focusedSpotId.lastIndexOf('-');
            const actualId = lastHyphenIndex > 0 ? focusedSpotId.substring(0, lastHyphenIndex) : focusedSpotId;

            const spot = spots.find(s => s.id === actualId);
            if (spot) {
                // Pan with offset (instant jump) using smart logic
                handleSmartPan(spot.location);
                setActiveMarkerId(actualId);
            }
        }
    }, [focusedSpotId, map, spots, handleSmartPan]);

    const onLoad = useCallback((mapInstance: google.maps.Map) => {
        setMap(mapInstance);
    }, []);

    const onUnmount = useCallback(() => {
        setMap(null);
    }, []);

    // Helper to create SVG icon
    const getMarkerIcon = (spot: Spot, isSelected: boolean) => {
        const congestionColors = ['#3b82f6', '#06b6d4', '#22c55e', '#eab308', '#ef4444'];
        const baseColor = congestionColors[spot.congestionLevel - 1] || '#3b82f6';
        const color = isSelected ? '#4f46e5' : baseColor;
        const scale = isSelected ? 1.4 : 1.0;

        // Determine icon path based on genre
        let iconPath = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"; // Default Pin
        let innerIcon = ""; // Optional inner symbol

        if (spotDetails && spotDetails.get(spot.name)?.types) {
            const types = spotDetails.get(spot.name)!.types!;

            if (types.includes('place_of_worship') || types.includes('shrine') || types.includes('hindu_temple') || types.includes('church')) {
                // Torii-like or Temple capability (using a simplified building icon here as placeholder for Shrine)
                // Using a generic "Temple/Shrine" icon
                innerIcon = "M12 7l-5 3v6h3v-4h4v4h3v-6z"; // Simple House/Temple shape inside
            } else if (types.includes('park') || types.includes('garden')) {
                // Tree/Nature
                innerIcon = "M12 6c-2.5 0-4.5 2-4.5 4.5S9.5 15 12 15s4.5-2 4.5-4.5S14.5 6 12 6z M12 15v5"; // Tree-ish
            } else if (types.includes('museum') || types.includes('art_gallery')) {
                // Museum/Bank style
                innerIcon = "M4 8l8-5 8 5v11H4z";
            } else if (types.includes('restaurant') || types.includes('cafe') || types.includes('food')) {
                // Cutlery
                innerIcon = "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7z"; // Fork-ish
            } else if (types.includes('tourist_attraction') || types.includes('point_of_interest')) {
                // Camera for generic tourist spots
                innerIcon = "M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2-2-.9-2-2 2zm8-6h-2.17l-1-1.29C16.69 6.29 16.35 6 16 6h-8c-.35 0-.69.29-.83.71L6.17 8H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z";
            }
        }

        // Generate SVG string
        // We use a pin shape with an optional inner icon or a simple circle
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${36 * scale}" height="${36 * scale}">
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.4)" />
          </filter>
          <g filter="url(#shadow)">
            <path d="${iconPath}" fill="${color}" stroke="white" stroke-width="1.5" />
            ${innerIcon ? `<path d="${innerIcon}" fill="white" transform="translate(6.6, 3.6) scale(0.45)" />` : `<circle cx="12" cy="9" r="3" fill="white" />`}
          </g>
        </svg>
        `;

        return {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
            scaledSize: new google.maps.Size(36 * scale, 36 * scale),
            anchor: new google.maps.Point(18 * scale, 36 * scale), // Bottom center
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
            center={mapCenter}
            zoom={15}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={mapOptions}
            onClick={() => setActiveMarkerId(null)} // Close info window when clicking map
        >
            {/* Recenter Button - Always visible */}
            <button
                onClick={() => {
                    // Pan to current location
                    const newCenter = { lat: center.latitude, lng: center.longitude };
                    setMapCenter(newCenter);
                    map?.setCenter(newCenter);
                }}
                className="absolute top-24 right-4 z-40 bg-white p-3 rounded-full shadow-lg text-gray-600 hover:text-indigo-600 transition-colors border border-gray-100"
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
                    icon={getMarkerIcon(spot, activeMarkerId === spot.id)}
                    onClick={() => {
                        setActiveMarkerId(spot.id);
                        if (onPinClick) onPinClick();
                        handleSmartPan(spot.location);
                    }}
                />
            ))}

            {/* Single InfoWindow - Rendered OUTSIDE of MarkerF to prevent duplicates */}
            {activeMarkerId && (() => {
                const spot = spots.find(s => s.id === activeMarkerId);
                if (!spot) return null;
                return (
                    <InfoWindowF
                        position={{ lat: spot.location.latitude, lng: spot.location.longitude }}
                        onCloseClick={() => setActiveMarkerId(null)}
                        options={{
                            pixelOffset: new google.maps.Size(0, -40),
                            disableAutoPan: false, // Auto-pan to keep window in view
                            maxWidth: 340 // Allow slightly wider
                        }}
                    >
                        <div style={{
                            width: 'auto',
                            minWidth: '200px',
                            maxWidth: '90vw', // Utilize viewport width to ensure margins
                            fontFamily: 'sans-serif',
                            overflow: 'hidden',
                            borderRadius: '12px',
                            background: 'white'
                        }}>
                            {/* Image with close button overlay */}
                            {(() => {
                                const photoUrl = spot.imageUrl || spotPhotos?.get(spot.name);
                                return (
                                    <div style={{ position: 'relative', width: '100%', height: photoUrl ? '140px' : '0px', overflow: 'hidden' }}>
                                        {photoUrl && (
                                            <img
                                                src={photoUrl}
                                                alt={spot.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        )}
                                        {/* Close button - positioned with padding from edge */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMarkerId(null);
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: '10px',
                                                right: '10px',
                                                width: '30px',
                                                height: '30px',
                                                borderRadius: '50%',
                                                background: 'rgba(255,255,255,0.95)',
                                                backdropFilter: 'blur(8px)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                                                zIndex: 10
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </div>
                                );
                            })()}

                            {/* Content */}
                            <div style={{ padding: '12px' }}>
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
                                {spotDetails?.get(spot.name)?.types && spotDetails.get(spot.name)!.types!.length > 0 && (
                                    <div className="flex gap-1 mb-2 flex-wrap">
                                        {spotDetails.get(spot.name)!.types!.slice(0, 3).map((type, idx) => {
                                            // 簡易的な翻訳マップ
                                            const typeMap: Record<string, string> = {
                                                'place_of_worship': '寺社仏閣', 'shrine': '神社', 'hindu_temple': '寺院', 'church': '教会',
                                                'park': '公園', 'garden': '庭園', 'museum': '博物館', 'art_gallery': '美術館',
                                                'restaurant': '飲食店', 'cafe': 'カフェ', 'food': '飲食店', 'store': 'お店',
                                                'tourist_attraction': '観光名所'
                                                // 'point_of_interest': 'スポット' // Excluded
                                            };
                                            const label = typeMap[type] || null;
                                            return label ? (
                                                <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                                    {label}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                                {spot.description && <div className="text-xs text-gray-600 mb-2 leading-snug line-clamp-2">{spot.description}</div>}

                                {spot.openingHours && (
                                    <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-1">
                                        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <circle cx="12" cy="12" r="10" strokeWidth="2" />
                                            <polyline points="12 6 12 12 16 14" strokeWidth="2" />
                                        </svg>
                                        <span className="leading-snug line-clamp-1">{spot.openingHours}</span>
                                    </div>
                                )}

                                {spot.price && (
                                    <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-2">
                                        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <line x1="12" y1="1" x2="12" y2="23" strokeWidth="2" />
                                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeWidth="2" />
                                        </svg>
                                        <span className="leading-snug line-clamp-1">{spot.price}</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => onSelectSpot(spot)}
                                    className="w-full mt-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 py-2 rounded shadow text-xs font-bold cursor-pointer transition-transform active:scale-95"
                                >
                                    ルートを見る
                                </button>
                            </div>
                        </div>
                    </InfoWindowF>
                );
            })()}

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