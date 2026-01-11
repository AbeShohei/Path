import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Spot, Coordinates, RouteOption } from '../types';
import { Canvas } from '@react-three/fiber';
import { PersonMarker } from './map/PersonMarker';
import { BusModel } from './map/BusModel';

// Bus route data type
interface BusRoute {
    routeId: string;
    routeName: string;
    routeShortName: string;
    color: string;
    description: string;
    coordinates: [number, number][];
}

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
    center: Coordinates;
    spots: Spot[];
    onSelectSpot: (spot: Spot | null) => void;
    onViewRoute?: (spot: Spot) => void;
    onPinClick?: () => void;
    onMapClick?: () => void;
    selectedSpotId?: string;
    focusedSpotId?: string;
    selectedRoute?: RouteOption | null;
    isNavigating?: boolean;
    routeOptions?: RouteOption[];
    isNavWidgetMinimized?: boolean;
    isSheetDragging?: boolean;
    disableSmartPan?: boolean;
    showBusRoutes?: boolean;
    busRoutes?: BusRoute[];
    subwayRoutes?: BusRoute[];
    highlightedRouteIds?: string[];
    highlightedGuideSpotId?: string | null;
    recenterTrigger?: number;
    transportMode?: string;
    bearing?: number;
    // Favorites
    onToggleFavorite?: (spot: Spot) => void;
    isFavorite?: (spotId: string) => boolean;
}

const LocationMarker3D = ({ position, mode, isMoving, bearing = 0 }: { position: Coordinates, mode: string, isMoving: boolean, bearing?: number }) => {
    const map = useMap();
    const posRef = useRef<HTMLDivElement>(null);

    // Convert bearing (0=North on map) to 3D rotation (radians)
    // Add PI to flip the model so it faces the correct direction
    const modelRotationY = (-bearing * Math.PI / 180) + Math.PI;

    // Efficiently update position without React re-renders
    useEffect(() => {
        const updatePos = () => {
            if (posRef.current) {
                const p = map.latLngToContainerPoint([position.latitude, position.longitude]);
                posRef.current.style.transform = `translate(${p.x}px, ${p.y}px)`;
            }
        };

        updatePos();

        map.on('move', updatePos);
        map.on('zoom', updatePos);
        map.on('viewreset', updatePos);

        return () => {
            map.off('move', updatePos);
            map.off('zoom', updatePos);
            map.off('viewreset', updatePos);
        };
    }, [map, position]);

    return (
        <div
            ref={posRef}
            className="pointer-events-none absolute z-[1000]"
            style={{
                left: 0, top: 0,
                willChange: 'transform'
            }}
        >
            <div style={{ width: '120px', height: '120px', transform: 'translate(-50%, -50%)' }}>
                {/* 3D Canvas - camera fixed, model rotates based on bearing */}
                <Canvas shadows camera={{ position: [0, 8, 6], fov: 35 }} gl={{ alpha: true }}>
                    <ambientLight intensity={1.2} />
                    <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />

                    {/* Model rotates on Y axis based on bearing */}
                    {mode === 'BUS' ? (
                        <BusModel scale={0.65} isMoving={isMoving} rotation={[0, modelRotationY, 0]} />
                    ) : (
                        <PersonMarker scale={1.3} isMoving={isMoving} rotation={[0, modelRotationY, 0]} />
                    )}
                </Canvas>
            </div>
        </div>
    );
};

const MapController = ({ center, selectedSpotId, focusedSpotId, spots, isNavigating, lastFocusedSpotId, disableSmartPan, selectedRoute, recenterTrigger }: {
    center: Coordinates,
    selectedSpotId?: string,
    focusedSpotId?: string,
    spots: Spot[],
    isNavigating?: boolean,
    lastFocusedSpotId: React.MutableRefObject<string | undefined>,
    disableSmartPan?: boolean,
    selectedRoute?: RouteOption | null,
    recenterTrigger?: number
}) => {
    const map = useMap();
    const isNavigatingRef = useRef(isNavigating);

    useEffect(() => {
        isNavigatingRef.current = isNavigating;
    }, [isNavigating]);

    // Handle Focus (Smart Pan)
    useEffect(() => {
        if (focusedSpotId && focusedSpotId !== lastFocusedSpotId.current && !disableSmartPan) {
            lastFocusedSpotId.current = focusedSpotId;
            const lastHyphenIndex = focusedSpotId.lastIndexOf('-');
            const actualId = lastHyphenIndex > 0 ? focusedSpotId.substring(0, lastHyphenIndex) : focusedSpotId;
            const spot = spots.find(s => s.id === actualId);

            if (spot) {
                const targetZoom = 16;
                const mapSize = map.getSize();
                const targetLat = spot.location.latitude;
                const targetLng = spot.location.longitude;
                const point = map.project([targetLat, targetLng], targetZoom);
                const newCenterPoint = L.point(point.x, point.y - mapSize.y * 0.25);
                const newCenterLatLng = map.unproject(newCenterPoint, targetZoom);
                map.flyTo(newCenterLatLng, targetZoom, { duration: 1.0 });
            }
        }
    }, [focusedSpotId, map, spots, lastFocusedSpotId, disableSmartPan]);



    // Handle Route Selection - Fit bounds
    const lastRouteIdRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (selectedRoute && selectedRoute.id !== lastRouteIdRef.current) {
            lastRouteIdRef.current = selectedRoute.id;
            const allPoints: [number, number][] = [];
            if (selectedRoute.segments) {
                selectedRoute.segments.forEach(seg => {
                    if (seg.path) {
                        seg.path.forEach(p => allPoints.push([p.lat, p.lng]));
                    }
                });
            } else if (selectedRoute.path) {
                selectedRoute.path.forEach((p: any) => allPoints.push([p.lat, p.lng]));
            }

            if (allPoints.length > 1) {
                const bounds = L.latLngBounds(allPoints);
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
            }
        }
    }, [selectedRoute, map]);

    // Handle Recenter Trigger (One-time move to Upper Half)
    const lastRecenterTrigger = useRef(recenterTrigger);
    useEffect(() => {
        if (recenterTrigger && recenterTrigger !== lastRecenterTrigger.current) {
            lastRecenterTrigger.current = recenterTrigger;

            // Calculate Upper Half Offset
            const zoom = 15; // Standard recenter zoom
            const centerPoint = map.project([center.latitude, center.longitude], zoom);
            const mapSize = map.getSize();
            const offsetY = mapSize.y * 0.25; // Shift down by 25% of height (User at ~25% from top)

            const targetPoint = L.point(centerPoint.x, centerPoint.y + offsetY);
            const targetLatLng = map.unproject(targetPoint, zoom);

            map.flyTo(targetLatLng, zoom, { duration: 0.8 });
        }
    }, [recenterTrigger, map, center]);

    return null;
};

const Map: React.FC<MapProps> = ({ center, spots, onSelectSpot, onViewRoute, onPinClick, onMapClick, selectedSpotId, focusedSpotId, selectedRoute, routeOptions = [], isNavigating, isSheetDragging = false, disableSmartPan = false, showBusRoutes = false, busRoutes = [], subwayRoutes = [], highlightedRouteIds = [], highlightedGuideSpotId, recenterTrigger, transportMode = 'WALK', bearing = 0, onToggleFavorite, isFavorite }) => {
    const [activeSpot, setActiveSpot] = useState<Spot | null>(null);
    const markerRefs = useRef<{ [key: string]: L.Marker | null }>({});
    const lastFocusedSpotId = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (selectedSpotId) {
            const spot = spots.find(s => s.id === selectedSpotId);
            setActiveSpot(prev => (prev?.id === spot?.id ? prev : (spot || null)));
        } else {
            setActiveSpot(null);
        }
    }, [selectedSpotId, spots]);

    useEffect(() => {
        if (activeSpot && markerRefs.current[activeSpot.id]) {
            markerRefs.current[activeSpot.id]?.openPopup();
        }
    }, [activeSpot]);

    useEffect(() => {
        if (isNavigating) {
            setActiveSpot(null);
            Object.values(markerRefs.current).forEach(marker => marker?.closePopup());
        }
    }, [isNavigating]);

    // Clear popup selections when route changes
    useEffect(() => {
        if (selectedRoute) {
            setActiveSpot(null);
            Object.values(markerRefs.current).forEach(marker => marker?.closePopup());
        }
    }, [selectedRoute?.id]);

    const CongestionLevelIcon = ({ level, className = "" }: { level: number, className?: string }) => {
        const commonClasses = `flex items-center justify-center text-white text-[10px] shadow-sm rounded ${className}`;
        const PersonIcon = () => <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>;
        if (level === 5) return <div className={`${commonClasses} bg-red-500 w-6 h-6`}><div className="flex -space-x-2"><PersonIcon /><PersonIcon /><PersonIcon /><PersonIcon /></div></div>;
        if (level === 4) return <div className={`${commonClasses} bg-yellow-500 w-6 h-6`}><div className="flex -space-x-2"><PersonIcon /><PersonIcon /><PersonIcon /></div></div>;
        if (level === 3) return <div className={`${commonClasses} bg-green-500 w-6 h-6`}><div className="flex -space-x-2"><PersonIcon /><PersonIcon /></div></div>;
        if (level === 2) return <div className={`${commonClasses} bg-cyan-500 w-6 h-6`}><div className="flex -space-x-1"><PersonIcon /></div></div>;
        return <div className={`${commonClasses} bg-blue-500 w-6 h-6`}><PersonIcon /></div>;
    };

    const createCustomIcon = (spot: Spot, isSelected: boolean, isHighlighted: boolean = false, isInNavMode: boolean = false) => {
        const congestionColors = ['#3b82f6', '#06b6d4', '#22c55e', '#eab308', '#ef4444'];
        const baseColor = congestionColors[spot.congestionLevel - 1] || '#3b82f6';

        // During navigation: white for all except highlighted (which gets original color)
        // Not navigating: use base color, orange for highlighted
        let color: string;
        let scale: number;

        if (isInNavMode) {
            // Navigation mode: highlighted = original color + large, others = white + small
            if (isHighlighted) {
                color = baseColor;
                scale = 1.1;
            } else {
                color = '#d1d5db'; // Gray-300 (light gray/white-ish)
                scale = 0.8;
            }
        } else {
            // Normal mode
            color = baseColor;
            scale = isSelected ? 1.4 : 1.0;
        }

        const size = 44 * scale;
        const iconPath = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z";

        const svgHtml = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                    <path d="${iconPath}" fill="${color}" stroke="${isInNavMode && !isHighlighted ? '#9ca3af' : 'white'}" stroke-width="1.5" />
                    <circle cx="12" cy="9" r="3" fill="${isInNavMode && !isHighlighted ? '#9ca3af' : 'white'}" />
                </svg>`;
        return L.divIcon({ html: svgHtml, className: 'custom-marker-icon', iconSize: [size, size], iconAnchor: [size / 2, size], popupAnchor: [0, -size] });
    };

    // (Previously currentLocationIcon was here, now replaced by LocationMarker3D)

    const MapClickHandler = () => {
        useMapEvents({
            click: (e) => {
                setActiveSpot(null);
                Object.values(markerRefs.current).forEach(marker => marker?.closePopup());
                if (onMapClick) onMapClick();
                onSelectSpot(null);
            }
        });
        return null;
    };

    return (
        <MapContainer center={[center.latitude, center.longitude]} zoom={15} style={{ width: '100%', height: '100%', pointerEvents: isSheetDragging ? 'none' : 'auto' }} zoomControl={false}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapClickHandler />
            <MapController center={center} selectedSpotId={selectedSpotId} focusedSpotId={focusedSpotId} spots={spots} isNavigating={isNavigating} lastFocusedSpotId={lastFocusedSpotId} disableSmartPan={disableSmartPan} selectedRoute={selectedRoute} recenterTrigger={recenterTrigger} />


            {/* Bus Routes Layer */}
            {busRoutes.map((route) => {
                const isHighlighted = highlightedRouteIds.length > 0 && highlightedRouteIds.includes(route.routeId);

                // If showBusRoutes is FALSE, ONLY show highlighted routes
                if (!showBusRoutes && !isHighlighted) return null;

                const isDimmed = highlightedRouteIds.length > 0 && !isHighlighted;
                const opacity = isDimmed ? 0.1 : 0.6;
                const weight = isHighlighted ? 6 : (isDimmed ? 2 : 3);
                const color = isHighlighted ? '#ef4444' : route.color;

                return (
                    <Polyline key={`bus-${route.routeId}`} positions={route.coordinates} pathOptions={{ color: color, weight: weight, opacity: opacity }}>
                        <Popup>
                            <div className="p-2 min-w-[150px]">
                                <h3 className="font-bold text-lg mb-1" style={{ color: route.color }}>{route.routeName}</h3>
                                <p className="text-sm font-semibold text-gray-700">{route.routeShortName}系統</p>
                                <p className="text-gray-600 text-sm">{route.description}</p>
                            </div>
                        </Popup>
                    </Polyline>
                )
            })}

            {/* Current Location: Replaced static Marker with 3D Component */}
            <LocationMarker3D position={center} mode={transportMode} isMoving={!!isNavigating} bearing={bearing} />

            {/* Spots */}
            {spots.map(spot => {
                const isSelected = activeSpot?.id === spot.id;
                const isHighlighted = highlightedGuideSpotId === spot.id;
                return (
                    <Marker
                        key={spot.id}
                        position={[spot.location.latitude, spot.location.longitude]}
                        icon={createCustomIcon(spot, isSelected, isHighlighted, isNavigating)}
                        ref={(ref) => { if (ref) markerRefs.current[spot.id] = ref; else delete markerRefs.current[spot.id]; }}
                        eventHandlers={{ click: () => { setActiveSpot(spot); onSelectSpot(spot); if (onPinClick) onPinClick(); } }}
                        zIndexOffset={isHighlighted ? 1000 : 0}
                    >
                        <Popup closeButton={false} className="custom-popup" maxWidth={280} minWidth={180} autoPan={false}>
                            <div className="w-full relative bg-white rounded-xl overflow-hidden font-sans">
                                <button onClick={(e) => { e.stopPropagation(); setActiveSpot(null); onSelectSpot(null); markerRefs.current[spot.id]?.closePopup(); }} className="absolute top-1 right-1 z-20 w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm border-0 shadow-sm flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors" type="button"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
                                <div className="p-3 font-sans bg-white">
                                    <div className="flex items-center gap-2 mb-1.5"><div className="shrink-0"><CongestionLevelIcon level={spot.congestionLevel} /></div><h3 className="font-bold text-gray-900 leading-tight text-[16px] truncate flex-1">{spot.name}</h3></div>
                                    <p className="text-xs text-gray-600 leading-relaxed mb-2" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden' }}>{spot.description}</p>
                                    <div className="flex flex-col gap-1.5">
                                        {spot.openingHours && (<div className="flex items-center gap-2 text-xs text-gray-500 overflow-hidden"><svg className="shrink-0 w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span className="truncate">{spot.openingHours}</span></div>)}
                                        {spot.price && (<div className="flex items-center gap-2 text-xs text-gray-500 overflow-hidden"><div className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-indigo-400 font-bold text-[10px] border border-indigo-200 rounded-full">¥</div><span className="truncate">{spot.price}</span></div>)}
                                    </div>
                                    {/* Action Buttons */}
                                    <div className="flex gap-2 mt-3">
                                        {/* Favorite Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onToggleFavorite) onToggleFavorite(spot);
                                            }}
                                            className={`p-2 rounded shadow transition-all ${
                                                isFavorite && isFavorite(spot.id)
                                                    ? 'bg-red-500 text-white'
                                                    : 'bg-white text-gray-400 hover:text-red-500 border border-gray-200'
                                            }`}
                                        >
                                            <svg className="w-4 h-4" fill={isFavorite && isFavorite(spot.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                        </button>
                                        {/* View Route Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onViewRoute) onViewRoute(spot);
                                            }}
                                            className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2 rounded shadow text-xs font-bold hover:opacity-90 transition-opacity"
                                        >
                                            ルートを見る
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}

            {/* Selected Route - render from segments only, ignore top-level path */}
            {selectedRoute && selectedRoute.segments && (
                selectedRoute.segments.map((seg, i) => {
                    if (!seg.path || seg.path.length === 0) return null;
                    const path = seg.path.map((p: any) => [p.lat, p.lng] as [number, number]);
                    const isWalk = seg.type === 'WALK';
                    if (isWalk) {
                        return <Polyline key={i} positions={path} pathOptions={{ color: '#4285F4', weight: 5, dashArray: '1, 10', lineCap: 'round', opacity: 0.8 }} />;
                    } else {
                        return (
                            <React.Fragment key={i}>
                                <Polyline positions={path} pathOptions={{ color: 'white', weight: 11, opacity: 1.0 }} />
                                <Polyline positions={path} pathOptions={{ color: '#4285F4', weight: 8, opacity: 1.0 }} />

                            </React.Fragment>
                        );
                    }
                })
            )}


            {/* Intermediate Stops removed per user request */}
        </MapContainer>
    );
};

export default Map;