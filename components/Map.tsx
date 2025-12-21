import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Spot, Coordinates, RouteOption } from '../types';

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
}

const MapController = ({ center, selectedSpotId, focusedSpotId, spots, isNavigating, lastFocusedSpotId, disableSmartPan, selectedRoute }: {
    center: Coordinates,
    selectedSpotId?: string,
    focusedSpotId?: string,
    spots: Spot[],
    isNavigating?: boolean,
    lastFocusedSpotId: React.MutableRefObject<string | undefined>,
    disableSmartPan?: boolean,
    selectedRoute?: RouteOption | null
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

    return null;
};

const Map: React.FC<MapProps> = ({ center, spots, onSelectSpot, onViewRoute, onPinClick, onMapClick, selectedSpotId, focusedSpotId, selectedRoute, routeOptions = [], isNavigating, isSheetDragging = false, disableSmartPan = false, showBusRoutes = false, busRoutes = [], subwayRoutes = [], highlightedRouteIds = [] }) => {
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

    const RecenterButton = () => {
        const map = useMap();
        return (
            <button
                onClick={() => {
                    map.flyTo([center.latitude, center.longitude], 15);
                }}
                className="absolute top-[80px] right-4 z-[400] bg-white p-3 rounded-full shadow-lg text-gray-600 hover:text-indigo-600 transition-colors border border-gray-100"
                title="現在地に戻る"
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                </svg>
            </button>
        );
    };

    const CongestionLevelIcon = ({ level, className = "" }: { level: number, className?: string }) => {
        const commonClasses = `flex items-center justify-center text-white text-[10px] shadow-sm rounded ${className}`;
        const PersonIcon = () => <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>;
        if (level === 5) return <div className={`${commonClasses} bg-red-500 w-6 h-6`}><div className="flex -space-x-2"><PersonIcon /><PersonIcon /><PersonIcon /><PersonIcon /></div></div>;
        if (level === 4) return <div className={`${commonClasses} bg-yellow-500 w-6 h-6`}><div className="flex -space-x-2"><PersonIcon /><PersonIcon /><PersonIcon /></div></div>;
        if (level === 3) return <div className={`${commonClasses} bg-green-500 w-6 h-6`}><div className="flex -space-x-2"><PersonIcon /><PersonIcon /></div></div>;
        if (level === 2) return <div className={`${commonClasses} bg-cyan-500 w-6 h-6`}><div className="flex -space-x-1"><PersonIcon /></div></div>;
        return <div className={`${commonClasses} bg-blue-500 w-6 h-6`}><PersonIcon /></div>;
    };

    const createCustomIcon = (spot: Spot, isSelected: boolean) => {
        const congestionColors = ['#3b82f6', '#06b6d4', '#22c55e', '#eab308', '#ef4444'];
        const baseColor = congestionColors[spot.congestionLevel - 1] || '#3b82f6';
        const color = baseColor;
        const scale = isSelected ? 1.4 : 1.0;
        const size = 44 * scale;
        const iconPath = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z";
        const svgHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));"><path d="${iconPath}" fill="${color}" stroke="white" stroke-width="1.5" /><circle cx="12" cy="9" r="3" fill="white" /></svg>`;
        return L.divIcon({ html: svgHtml, className: 'custom-marker-icon', iconSize: [size, size], iconAnchor: [size / 2, size], popupAnchor: [0, -size] });
    };

    const currentLocationIcon = L.divIcon({
        html: `<div style="width: 16px; height: 16px; background-color: #2563eb; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);"></div>`,
        className: 'current-location-icon',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

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
            <MapController center={center} selectedSpotId={selectedSpotId} focusedSpotId={focusedSpotId} spots={spots} isNavigating={isNavigating} lastFocusedSpotId={lastFocusedSpotId} disableSmartPan={disableSmartPan} selectedRoute={selectedRoute} />
            <RecenterButton />

            {/* Subway Routes Layer */}
            {subwayRoutes && subwayRoutes.map((route) => {
                const isHighlighted = highlightedRouteIds.length > 0 && highlightedRouteIds.includes(route.routeId);

                // If showBusRoutes is FALSE, ONLY show highlighted routes
                if (!showBusRoutes && !isHighlighted) return null;

                const isDimmed = highlightedRouteIds.length > 0 && !isHighlighted;
                const opacity = isDimmed ? 0.1 : 0.9;
                const weight = isHighlighted ? 8 : (isDimmed ? 3 : 5);

                return (
                    <React.Fragment key={`subway-${route.routeId}`}>
                        <Polyline positions={route.coordinates} pathOptions={{ color: 'white', weight: weight + 3, opacity: opacity }} />
                        <Polyline positions={route.coordinates} pathOptions={{ color: route.routeId === '2' ? '#f39c12' : '#2ecc71', weight: weight, opacity: opacity, dashArray: '10, 10' }}>
                            <Popup>
                                <div className="p-2 min-w-[150px]">
                                    <h3 className="font-bold text-lg mb-1" style={{ color: route.color }}>{route.routeName}</h3>
                                    <p className="text-gray-600 text-sm">{route.description}</p>
                                </div>
                            </Popup>
                        </Polyline>
                    </React.Fragment>
                );
            })}

            {/* Bus Routes Layer */}
            {busRoutes.map((route) => {
                const isHighlighted = highlightedRouteIds.length > 0 && highlightedRouteIds.includes(route.routeId);

                // If showBusRoutes is FALSE, ONLY show highlighted routes
                if (!showBusRoutes && !isHighlighted) return null;

                const isDimmed = highlightedRouteIds.length > 0 && !isHighlighted;
                const opacity = isDimmed ? 0.1 : 0.6;
                const weight = isHighlighted ? 6 : (isDimmed ? 2 : 3);
                const color = isHighlighted ? '#ef4444' : route.color;

                // Ensure highlighted routes are on top
                const zIndex = isHighlighted ? 1000 : 1;
                // React-leaflet Polyline doesn't support zIndex directly in typical Leaflet fashion without pane, 
                // but order of rendering matters. Highlighted ones should be rendered last or we rely on map.fitBounds to show them.

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

            <Marker position={[center.latitude, center.longitude]} icon={currentLocationIcon} />

            {/* Spots */}
            {spots.map(spot => (
                <Marker key={spot.id} position={[spot.location.latitude, spot.location.longitude]} icon={createCustomIcon(spot, activeSpot?.id === spot.id)} ref={(ref) => { if (ref) markerRefs.current[spot.id] = ref; else delete markerRefs.current[spot.id]; }} eventHandlers={{ click: () => { setActiveSpot(spot); onSelectSpot(spot); if (onPinClick) onPinClick(); } }}>
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
                                <button onClick={(e) => { e.stopPropagation(); if (onViewRoute) onViewRoute(spot); }} className="w-full mt-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2 rounded shadow text-xs font-bold hover:opacity-90 transition-opacity">ルートを見る</button>
                            </div>
                        </div>
                    </Popup>
                </Marker>
            ))}

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
        </MapContainer>
    );
};

export default Map;