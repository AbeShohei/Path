import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { renderToString } from 'react-dom/server';
import { MapPinIcon } from '../icons';
import { Spot } from '../../types';

interface MapMarkersProps {
    spots: Spot[];
    selectedSpotId?: string;
    highlightedGuideSpotId?: string;
    isNavigating?: boolean;
    onSelectSpot: (spot: Spot) => Promise<void>;
    onViewRoute: (spot: Spot) => Promise<void>;
}

const CongestionLevelIcon = ({ level, className = "" }: { level: number, className?: string }) => {
    const commonClasses = `flex items-center justify-center text-white text-[10px] shadow-sm rounded ${className}`;
    const PersonIcon = () => (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
        </svg>
    );
    if (level === 5) return <div className={`${commonClasses} bg-red-500 w-6 h-6`}><div className="flex -space-x-2"><PersonIcon /><PersonIcon /><PersonIcon /><PersonIcon /></div></div>;
    if (level === 4) return <div className={`${commonClasses} bg-yellow-500 w-6 h-6`}><div className="flex -space-x-2"><PersonIcon /><PersonIcon /><PersonIcon /></div></div>;
    if (level === 3) return <div className={`${commonClasses} bg-green-500 w-6 h-6`}><div className="flex -space-x-2"><PersonIcon /><PersonIcon /></div></div>;
    if (level === 2) return <div className={`${commonClasses} bg-cyan-500 w-6 h-6`}><div className="flex -space-x-1"><PersonIcon /></div></div>;
    return <div className={`${commonClasses} bg-blue-500 w-6 h-6`}><PersonIcon /></div>;
};

export const MapMarkers: React.FC<MapMarkersProps> = ({
    spots,
    selectedSpotId,
    highlightedGuideSpotId,
    isNavigating,
    onSelectSpot,
    onViewRoute
}) => {

    // Helper to create custom icon
    const createCustomIcon = (spot: Spot, isSelected: boolean) => {
        const isHighlighted = spot.id === highlightedGuideSpotId;

        let colorClass = '#EF4444'; // Red (High)
        if (spot.congestionLevel <= 2) colorClass = '#3B82F6'; // Blue (Low)
        else if (spot.congestionLevel <= 3) colorClass = '#F59E0B'; // Yellow (Medium)

        if (isSelected) colorClass = '#10B981'; // Green (Selected)

        let scale = isSelected ? 1.2 : 1;
        let opacity = 1;

        if (isNavigating) {
            if (isHighlighted) {
                scale = 1.3;
                colorClass = '#F59E0B'; // Highlight color
            } else {
                colorClass = '#9CA3AF'; // Gray
                scale = 0.8;
                opacity = 0.7;
            }
        }

        // const IconComponent = isSelected ? MapPinCheck : MapPin; // MapPinCheck not available
        const iconSizeClass = isSelected || isHighlighted ? "w-10 h-10" : "w-8 h-8";

        const iconHtml = renderToString(
            <div style={{
                color: colorClass,
                opacity: opacity,
                filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))',
                transform: `scale(${scale})`,
                transition: 'all 0.3s ease'
            }}>
                <MapPinIcon className={iconSizeClass} />
            </div>
        );

        return divIcon({
            html: iconHtml,
            className: 'custom-marker-icon',
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });
    };

    return (
        <>
            {spots.map((spot) => {
                const isSelected = selectedSpotId === spot.id;
                // Highlighting logic (zIndex)
                const isHighlighted = highlightedGuideSpotId === spot.id;

                return (
                    <Marker
                        key={spot.id}
                        position={[spot.location.latitude, spot.location.longitude]}
                        icon={createCustomIcon(spot, isSelected)}
                        zIndexOffset={isHighlighted ? 1000 : 0}
                        eventHandlers={{
                            click: () => onSelectSpot(spot),
                        }}
                    >
                        <Popup closeButton={false} className="custom-popup" maxWidth={280} minWidth={180}>
                            <div className="w-full relative bg-white rounded-xl overflow-hidden font-sans">
                                {/* Close button handled by Popup itself usually, but Map.tsx had custom close button? 
                                    Map.tsx Popup closeButton={false}. And custom button.
                                    We rely on default close behavior or click out for now to simplify, 
                                    OR we can implement closeLogic if passed from parent? 
                                    But onSelectSpot(null) closes it? No, explicit close call was used.
                                    React-Leaflet Popup has internal state. 
                                    Let's keep it simple for now (no custom close button inside popup) 
                                    or standard closeButton={true}. */}

                                <div className="p-3 font-sans bg-white">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="shrink-0"><CongestionLevelIcon level={spot.congestionLevel} /></div>
                                        <h3 className="font-bold text-gray-900 leading-tight text-[16px] truncate flex-1">{spot.name}</h3>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed mb-2 line-clamp-3">{spot.description}</p>

                                    <div className="flex flex-col gap-1.5">
                                        {spot.openingHours && (
                                            <div className="flex items-center gap-2 text-xs text-gray-500 overflow-hidden">
                                                <span className="font-semibold">🕒</span>
                                                <span className="truncate">{spot.openingHours}</span>
                                            </div>
                                        )}
                                        {spot.price && (
                                            <div className="flex items-center gap-2 text-xs text-gray-500 overflow-hidden">
                                                <div className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-indigo-400 font-bold text-[10px] border border-indigo-200 rounded-full">¥</div>
                                                <span className="truncate">{spot.price}</span>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewRoute(spot);
                                        }}
                                        className="w-full mt-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2 rounded shadow text-xs font-bold hover:opacity-90 transition-opacity"
                                    >
                                        ルートを見る
                                    </button>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
        </>
    );
};
