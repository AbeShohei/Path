import React, { useState, useEffect, useRef } from 'react';
import { Coordinates, AppMode, Spot, TransportMode, GroundingChunk, RouteOption, RouteSegment, TransitUpdate } from './types';
import { getTransitInfo, generateGuideContent, playTextToSpeech, isAIAvailable } from './services/aiService';
import { routeService } from './services/routeService';
import { wikimediaService } from './services/wikimediaService';
import { findNearbySpots, filterSpotsNearRoute, getDistanceFromLatLonInKm } from './services/spotService';
import { getCongestionLevel, getCurrentTimeOfDay, getCurrentMonth, getCurrentDayType, TimeOfDay, Month, DayType, getTimeOfDayLabel, getDayTypeLabel } from './services/humanFlowService';

import { useLocationSimulator } from './hooks/useLocationSimulator';
import { useGuideSystem } from './hooks/useGuideSystem';
import { useTutorial } from './hooks/useTutorial';
import { getDistance, descTime, parseDurationStr, getDynamicArrivalTime } from './utils/geo';
import Map from './components/Map';

import { GuideSlider } from './components/GuideSlider';
import LyricsReader from './components/LyricsReader';
import { Canvas } from '@react-three/fiber';
import { PersonMarker } from './components/map/PersonMarker';

// Icons
import {
    MapPinIcon, WalkIcon, BusIcon, TrainIcon,
    SpeakerIcon, MuteIcon, PlayIcon, RefreshIcon,
    ArrowRightIcon, ChevronLeftIcon, ChevronDownIcon, ChevronUpIcon,
    ClockIcon, CameraIcon, CongestionLevelIcon
} from './components/icons';

// Screens
import { LandingPage } from './components/screens/LandingPage';

// UI Components
import { CongestionLegend, SegmentIcon, AudioPromptModal, TutorialGuide } from './components/ui';

// Navigation Stages
type NavigationStage = 'TO_STOP' | 'ON_BUS' | 'ALIGHTING' | 'TO_DEST';

// Durations in Milliseconds for Simulation (and for Audio generation hint)
const STAGE_DURATIONS = {
    TO_STOP: 40000,   // 40s
    ON_BUS: 45000,    // 45s
    ALIGHTING: 20000, // 20s
    TO_DEST: 30000    // 30s
};

function App() {
    const [mode, setMode] = useState<AppMode>(AppMode.LANDING);
    const [routeSheetState, setRouteSheetState] = useState<'minimized' | 'default' | 'full'>('default');
    const [routeTab, setRouteTab] = useState<'RECOMMENDED' | 'TRANSIT' | 'WALKING'>('RECOMMENDED');
    const [showNavRouteDetail, setShowNavRouteDetail] = useState(false); // Route detail during navigation
    const [isNavWidgetMinimized, setIsNavWidgetMinimized] = useState(false); // Minimize AI guide widget in nav mode
    const [lyricsHeight, setLyricsHeight] = useState(100); // Lyrics area height in pixels
    const [hideOtherPins, setHideOtherPins] = useState(false); // Hide other pins when "View Route" is clicked
    const [isLandingImageLoaded, setIsLandingImageLoaded] = useState(false); // Track if landing image is loaded

    // Interactive tutorial hook
    const tutorialMode = mode === AppMode.LANDING ? 'LANDING' : mode;


    const [coords, setCoords] = useState<Coordinates | null>(null);
    const [spots, setSpots] = useState<Spot[]>([]);
    const [selectedCongestion, setSelectedCongestion] = useState<number[]>([1, 2, 3]); // Default: Comfortable, Somewhat Comfortable, Normal
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [selectedTime, setSelectedTime] = useState<TimeOfDay>(getCurrentTimeOfDay()); // Time of day for congestion
    const [selectedMonth, setSelectedMonth] = useState<Month>(getCurrentMonth()); // Month for congestion (dev mode)
    const [selectedDayType, setSelectedDayType] = useState<DayType>(getCurrentDayType()); // Day type for congestion (dev mode)
    const [devMode, setDevMode] = useState(false); // Developer mode for advanced features
    const [recenterTrigger, setRecenterTrigger] = useState(0); // Trigger to recenter map

    // Selection State
    const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
    const [destinationSpot, setDestinationSpot] = useState<Spot | null>(null); // Track destination separately
    const [focusedSpotId, setFocusedSpotId] = useState<string | null>(null);  // For list click pan+popup

    // Interactive Tutorial (uses mode and selectedSpot state)
    const tutorial = useTutorial(tutorialMode, !!selectedSpot);

    // Route State
    const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
    const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
    const [showRouteDetail, setShowRouteDetail] = useState(false); // Separate state for showing detail view
    const [showAudioPrompt, setShowAudioPrompt] = useState(false);
    const [showArrivalModal, setShowArrivalModal] = useState(false); // Arrival confirmation modal



    // Sheet height in pixels (for free-form dragging)
    const [sheetHeight, setSheetHeight] = useState(Math.floor(window.innerHeight * 0.45));

    // Bus Routes Display State
    const [showBusRoutes, setShowBusRoutes] = useState(false);
    const [busRoutes, setBusRoutes] = useState<{
        routeId: string;
        routeName: string;
        routeShortName: string;
        color: string;
        description: string;
        coordinates: [number, number][];
    }[]>([]);


    const [highlightedRouteIds, setHighlightedRouteIds] = useState<string[]>([]);
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

    // Sheet Drag State
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef(0);
    const sheetStartHeight = useRef(0);
    const sheetRef = useRef<HTMLDivElement>(null);

    // Lyrics Drag State
    const [isLyricsDragging, setIsLyricsDragging] = useState(false);
    const lyricsDragStartY = useRef(0);
    const lyricsStartHeight = useRef(0);

    // Simulator Panel Drag State
    const [simulatorPos, setSimulatorPos] = useState({ x: 16, y: 80 }); // Initial: left-4 top-20
    const [isSimulatorDragging, setIsSimulatorDragging] = useState(false);
    const simulatorDragStart = useRef({ x: 0, y: 0 });
    const simulatorPosStart = useRef({ x: 0, y: 0 });


    // Navigation State
    const [navStage, setNavStage] = useState<NavigationStage>('TO_STOP');
    const [stopsAway, setStopsAway] = useState(5); // Simulation state
    const [remainingSeconds, setRemainingSeconds] = useState(0); // Countdown timer
    const [toastMessage, setToastMessage] = useState<string | null>(null); // Visual notification for stage change

    // Audio State
    const [audioDuration, setAudioDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [guideText, setGuideText] = useState("");
    const [isMuted, setIsMuted] = useState(false);

    // Location Simulator for testing navigation (Moved up for dependencies)
    const locationSimulator = useLocationSimulator();
    const { state: realSimState } = locationSimulator;
    // Fallback object to ensure simState is always valid
    const defaultSimState = {
        isRunning: false,
        currentPosition: null,
        progress: 0,
        currentTransportMode: 'WALK',
        speed: 0,
        currentSegmentIndex: 0,
        bearing: 0
    };

    // Use real sim state directly
    const simState = realSimState || defaultSimState;

    const simulatedPosition = simState?.currentPosition || null;



    // Transit Info State
    const [isArrived, setIsArrived] = useState(false); // Track arrival state for GuideSlider completion
    const [loading, setLoading] = useState(false);
    const [transitInfo, setTransitInfo] = useState<TransitUpdate | null>(null); // Added missing state
    const currentAudioController = useRef<{ stop: () => void } | null>(null);

    // Currently highlighted guide spot (for map pin highlighting)
    const [highlightedGuideSpotId, setHighlightedGuideSpotId] = useState<string | null>(null);

    const congestionOptions = [
        { level: 1, label: '快適', color: 'bg-blue-500' },
        { level: 2, label: 'やや快適', color: 'bg-cyan-500' },
        { level: 3, label: '通常', color: 'bg-green-500' },
        { level: 4, label: 'やや混雑', color: 'bg-yellow-500' },
        { level: 5, label: '混雑', color: 'bg-red-500' }
    ];

    // Recalculate congestion levels when dev mode month/time selection changes
    const displaySpots = React.useMemo(() => {
        if (!devMode) return spots;

        // Recalculate congestion levels with selected month/time/dayType
        return spots.map(spot => ({
            ...spot,
            congestionLevel: getCongestionLevel(spot.location.latitude, spot.location.longitude, selectedTime, selectedMonth, selectedDayType)
        }));
    }, [spots, devMode, selectedMonth, selectedTime, selectedDayType]);

    // Load bus and subway routes data
    useEffect(() => {
        // Load Bus Routes
        fetch(`${import.meta.env.BASE_URL}data/kyoto-bus-routes.json`)
            .then(res => res.json())
            .then(data => {
                if (data.routes) {
                    setBusRoutes(data.routes);
                }
            })
            .catch(err => console.error('Failed to load bus routes:', err));


    }, []);

    // Load spots for tutorial demo (ensure spots are loaded so map pins appear)
    useEffect(() => {
        if (tutorial.isDemoMode && spots.length === 0 && !loading) {
            const demoCoords = { latitude: 34.985849, longitude: 135.758767 };
            // Ensure coords are set for map centering (if not already set)
            if (!coords) setCoords(demoCoords);
            // Fetch real spots around the demo location
            fetchSpots(demoCoords);
        }
    }, [tutorial.isDemoMode, spots.length, loading, coords]);



    const handleShowTutorial = () => {
        tutorial.startTutorial();
    };

    // 1. Get Location
    const requestLocation = () => {
        // Check API key availability at startup
        const aiAvailable = isAIAvailable();


        setLoading(true);
        // Demo: Hardcoded Kyoto Station coordinates
        const kyotoStationCoords = {
            latitude: 34.9858,
            longitude: 135.7588,
        };

        setTimeout(() => {
            setCoords(kyotoStationCoords);
            fetchSpots(kyotoStationCoords);
        }, 800);
    };

    // 2. Fetch Spots (Using predefined data)
    const fetchSpots = async (pos: Coordinates) => {
        try {
            setLoading(true);

            // Fetch all spots
            const nearbySpots = findNearbySpots(pos, 9999);

            // Filter to only show spots near bus stops (within 3km of a bus stop)
            // Use smaller batches or sequential for stability if needed, 
            // but for now just ensure error safety.
            const accessChecks = await Promise.all(nearbySpots.map(async (spot) => {
                try {
                    const hasAccess = await routeService.hasNearbyBusStops(
                        spot.location.latitude,
                        spot.location.longitude,
                        3000 // 3km radius
                    );
                    return hasAccess ? spot : null;
                } catch (e) {
                    console.warn(`Access check failed for ${spot.name}`, e);
                    return spot; // Fallback to including it
                }
            }));

            const accessibleSpots = accessChecks.filter(s => s !== null) as Spot[];

            // Fetch Wikimedia images for spots without images (async, non-blocking)
            const spotsNeedingImages = accessibleSpots.filter(s => !s.imageUrl);
            if (spotsNeedingImages.length > 0) {
                // Fetch in background, update state when done
                (async () => {
                    try {
                        const imageMap = await wikimediaService.getSpotImages(
                            spotsNeedingImages.map(s => s.name)
                        );
                        if (imageMap.size > 0) {
                            setSpots(prev => prev.map(spot => {
                                const wikiImage = imageMap.get(spot.name);
                                if (wikiImage && !spot.imageUrl) {
                                    return { ...spot, imageUrl: wikiImage };
                                }
                                return spot;
                            }));
                        }
                    } catch (e) {
                        console.warn('Background image fetch failed:', e);
                    }
                })();
            }

            setSpots(accessibleSpots);
            setMode(AppMode.PLANNING);
            setSheetHeight(Math.floor(window.innerHeight * 0.45));
        } catch (error) {
            console.error('Fetch spots failed:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- TUTORIAL REAL STATE DRIVER ---
    useEffect(() => {
        if (!tutorial.isActive || !tutorial.currentStep) return;

        const demoState = tutorial.demoState;
        if (!demoState) return;

        // Reset arrival state if restarting
        if (tutorial.currentStep.id === 'welcome') {
            setIsArrived(false);
        }

        // 1. Sync App Mode (Navigating & Destination fallback)
        // We handle PLANNING -> ROUTE_SELECT via handleRouteSearch now.
        // We still need to handle the initial switch to PLANNING or the jump to NAVIGATING
        if (mode !== AppMode.NAVIGATING && demoState.mode === AppMode.NAVIGATING) {
            setMode(AppMode.NAVIGATING);
        }
        if (mode !== AppMode.DESTINATION && demoState.mode === AppMode.DESTINATION) {
            setMode(AppMode.DESTINATION);
        }
        // Ensure starting mode is correct
        if (tutorial.currentStep.id === 'spots' && mode !== AppMode.PLANNING) {
            setMode(AppMode.PLANNING);
        }

        // 2. Sync Spots (safeguard) - DISABLED to keep all spots loaded
        // if (demoState.spots && spots.length !== demoState.spots.length) {
        //     setSpots(demoState.spots);
        // }

        // 3. Step-Specific Actions (Simulating Click Events)

        // Step: "Route" (Check Details) -> Click the Spot Card
        if (tutorial.currentStep.id === 'route') {
            // If we have a demo spot and it's not currently selected (or we want to ensure popup logic runs)
            if (demoState.selectedSpot && selectedSpot?.id !== demoState.selectedSpot.id) {
                // Simulate clicking the spot card
                handleSpotSelect(demoState.selectedSpot);
            }
        }

        // Step: "Route Select" -> Click "View Route"
        if (tutorial.currentStep.id === 'route_select') {
            // Need to ensure we have a spot to route FROM (destination)
            const targetSpot = selectedSpot || demoState.selectedSpot;

            // Only trigger if we aren't already in route select mode (to avoid loops)
            if (mode !== AppMode.ROUTE_SELECT && targetSpot) {
                // Simulate clicking "View Route"
                handleRouteSearch(targetSpot);
            }
        }

        // 4. Navigation Logic
        if (tutorial.currentStep.id === 'nav_start') {
            // Start simulator using the REAL selected route logic
            if (selectedRoute && selectedRoute.segments && !locationSimulator.state.isRunning) {
                setTimeout(() => {
                    locationSimulator.start(selectedRoute.segments!);
                }, 500);
            }
            // One-time centering
            setRecenterTrigger(prev => prev + 1);
        }

        if (tutorial.currentStep.id === 'nav_transit') {
            // Force UI to show Bus stage immediately to ensure "Stops Away" badge is visible
            if (navStage !== 'ON_BUS') {
                changeStage('ON_BUS');
            }
            if (locationSimulator.state.isRunning) {
                locationSimulator.setProgress(50);
                // Delay recenter to allow position state to update first
                // This ensures the map moves to the NEW position, not the old one
                setTimeout(() => {
                    setRecenterTrigger(prev => prev + 1);
                }, 300);
            }
        }

        if (tutorial.currentStep.id === 'nav_arrive') {
            if (locationSimulator.state.isRunning) {
                locationSimulator.setProgress(90);
                // Delay recenter to allow position state to update first
                setTimeout(() => {
                    setRecenterTrigger(prev => prev + 1);
                }, 300);
            }
        }

        if (tutorial.currentStep.id === 'nav_arrival_complete') {
            if (locationSimulator.state.isRunning) {
                // Move to end but don't stop (keep "Navigating") or stop? 
                // To show "Arrived" state we usually rely on `isArrived` prop in GuideSlider which checks distance/progress.
                // Let's set it to 99.9% to be safe, or 100%. 
                locationSimulator.setProgress(99.9);
                // Delay recenter to allow position state to update first
                setTimeout(() => {
                    setRecenterTrigger(prev => prev + 1);
                }, 300);
            }
        }

        if (tutorial.currentStep.id === 'nav_guide') {
            if (locationSimulator.state.isRunning) {
                locationSimulator.stop();
            }
            if (mode !== AppMode.DESTINATION) {
                setMode(AppMode.DESTINATION);
            }
        }

    }, [tutorial.currentStep?.id, tutorial.isActive]);

    // Handle congestion toggle
    const toggleCongestion = (level: number) => {
        setSelectedCongestion(prev => {
            if (prev.includes(level)) {
                return prev.filter(l => l !== level);
            } else {
                return [...prev, level];
            }
        });
    };

    const handleSpotSelect = async (spot: Spot | null) => {
        if (!spot) {
            // Don't clear the destination spot when in ROUTE_SELECT mode
            if (mode === AppMode.ROUTE_SELECT) {
                // Just close popup, keep destination selected
                return;
            }
            setSelectedSpot(null);
            setFocusedSpotId(null);
            setHideOtherPins(false); // Restore pins
            return;
        }
        setSelectedSpot(spot);

        // Only minimize sheet if NOT navigating (keep guide visible)
        if (mode !== AppMode.NAVIGATING) {
            setSheetHeight(88);
        }

        // Use timestamp to ensure re-trigger even for same spot
        setFocusedSpotId(`${spot.id}-${Date.now()}`);
        // List selection does NOT hide other pins
        setHideOtherPins(false);
    };

    // "View Route" button click handler - hides other pins
    const handleViewRouteClick = async (spot: Spot) => {
        setSelectedSpot(spot);
        setSheetHeight(88);
        setFocusedSpotId(`${spot.id}-${Date.now()}`);
        // "View Route" hides other pins
        setHideOtherPins(true);
    };

    // Force sheet open when navigation starts
    // Force sheet open when navigation starts - DISABLED per user request
    // useEffect(() => {
    //     if (mode === AppMode.NAVIGATING) {
    //         setSheetHeight(Math.floor(window.innerHeight * 0.45));
    //     }
    // }, [mode]);



    // useEffect(() => {

    // }, [spotDetails]);



    // Start simulation when navigation begins
    const startLocationSimulation = () => {
        if (selectedRoute?.segments && selectedRoute.segments.length > 0) {
            locationSimulator.start(selectedRoute.segments);
        }
    };

    // --- Guide System Integration ---
    const currentSegIndex = locationSimulator.state.currentSegmentIndex || 0;
    const currentSegment = selectedRoute?.segments ? selectedRoute.segments[currentSegIndex] || null : null;
    const nextSegment = selectedRoute?.segments ? selectedRoute.segments[currentSegIndex + 1] || null : null;



    // Auto-start simulation when entering navigation mode
    const simulationStartedRef = useRef(false);
    useEffect(() => {
        if (mode === AppMode.NAVIGATING && selectedRoute?.segments && selectedRoute.segments.length > 0) {
            // Only start once per navigation session
            if (!simulationStartedRef.current) {
                simulationStartedRef.current = true;
                locationSimulator.start(selectedRoute.segments);
            }
        } else {
            // Reset flag when leaving navigation mode
            if (simulationStartedRef.current) {
                simulationStartedRef.current = false;
                locationSimulator.stop();
            }
        }
    }, [mode, selectedRoute?.segments]);

    // Calculate derived state for visible spots based on selected route AND selected time
    const visibleSpots = React.useMemo(() => {

        // Helper to calculate distance from current location
        const getDistance = (spot: Spot) => {
            if (!coords) return 0;
            const R = 6371; // Earth's radius in km
            const dLat = (spot.location.latitude - coords.latitude) * Math.PI / 180;
            const dLon = (spot.location.longitude - coords.longitude) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(coords.latitude * Math.PI / 180) * Math.cos(spot.location.latitude * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        // Recalculate Congestion based on Selected Time
        const currentSpots = displaySpots;

        // Relaxed condition: If a route is selected, always filter pins (unless explicitly cleared)
        if (selectedRoute) {
            // Build combined path from all segments
            let routePath: { lat: number; lng: number }[] = [];
            if (selectedRoute.segments) {
                for (const seg of selectedRoute.segments) {
                    if (seg.path && seg.path.length > 0) {
                        routePath = routePath.concat(seg.path);
                    }
                }
            }

            // Filter spots near the route (100m radius)
            const nearbySpots = filterSpotsNearRoute(currentSpots, routePath, 0.1); // 100m radius

            // Always include destination spot if it exists
            if (selectedSpot && !nearbySpots.find(s => s.id === selectedSpot.id)) {
                nearbySpots.push(selectedSpot);
            }
            return nearbySpots;
        } else if (selectedSpot && hideOtherPins) {
            // If "View Route" was clicked, hide other spots to focus on destination.
            return [selectedSpot];
        }

        // Filter by congestion level, then sort by congestion (ascending) and distance (ascending)
        // Also filter out spots without category data (types)
        return currentSpots
            .filter(s => selectedCongestion.includes(s.congestionLevel))
            .filter(s => {
                // Exclude spots with "案内" (information/guidance centers) in their name
                return !s.name.includes('案内');
            })
            .filter(s => {
                // Exclude spots without photos
                return !!s.imageUrl;
            })
            .sort((a, b) => {
                // Priority 0: '赤山禅院' always first
                if (a.name === '赤山禅院') return -1;
                if (b.name === '赤山禅院') return 1;

                // Primary: Has photo? (Photo first)
                const aHasPhoto = !!(a.imageUrl);
                const bHasPhoto = !!(b.imageUrl);
                if (aHasPhoto !== bHasPhoto) {
                    return aHasPhoto ? -1 : 1;
                }
                // Secondary: congestion level (lower is better)
                if (a.congestionLevel !== b.congestionLevel) {
                    return a.congestionLevel - b.congestionLevel;
                }
                // Tertiary: distance (closer is better)
                return getDistance(a) - getDistance(b);
            });
    }, [mode, selectedRoute, displaySpots, selectedSpot, selectedCongestion, coords, hideOtherPins]);

    // --- Guide System Integration (Moved after visibleSpots to use filtered list) ---
    const { nearbyGuides, nearbySpots, loading: guideLoading } = useGuideSystem({
        coords: simulatedPosition ? { latitude: simulatedPosition.lat, longitude: simulatedPosition.lng } : coords,
        currentSegment,
        spots: visibleSpots, // Use visibleSpots (filtered by route) instead of all spots
        isNavigating: mode === AppMode.NAVIGATING
    });
    // -------------------------------

    // Update highlighted routes when selectedRoute changes
    useEffect(() => {
        const idsToHighlight: string[] = [];
        if (selectedRoute) {
            // Helper to normalize route names (Full-width -> Half-width, remove prefixes)
            const normalize = (str: string) => {
                if (!str) return '';
                return str.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                    .replace(/市バス/g, '')
                    .replace(/京都バス/g, '')
                    .replace(/号系統/g, '')
                    .replace(/系統/g, '')
                    .replace(/特/g, '')
                    .trim();
            };

            selectedRoute.segments.forEach(seg => {
                if (seg.type === 'BUS') {
                    // Strategy 0: Exact routeId Match (Best - from GTFS)
                    if (seg.routeId) {
                        const found = busRoutes.find(r => r.routeId === seg.routeId);
                        if (found) {
                            idsToHighlight.push(found.routeId);
                            return;
                        }
                    }

                    // Strategy 1: Normalized name match (Fallback)
                    const segName = seg.lineName || seg.text || '';
                    const normalizedSeg = normalize(segName);
                    const found = busRoutes.find(r => {
                        return normalize(r.routeShortName) === normalizedSeg || normalize(r.routeName) === normalizedSeg;
                    });

                    if (found) {
                        idsToHighlight.push(found.routeId);
                        return;
                    }
                }

                if (seg.type === 'SUBWAY') {
                    // Subway route highlighting removed - subway data no longer available
                }
            });
        }
        setHighlightedRouteIds(idsToHighlight);
    }, [selectedRoute, busRoutes]);

    // Auto-close popup when entering NAVIGATING mode
    useEffect(() => {
        if (mode === AppMode.NAVIGATING) {
            setSelectedSpot(null);
            setFocusedSpotId(null);
        }
    }, [mode]);

    // ルート検索を開始（InfoWindowの「ルートを見る」ボタンから呼ばれる）
    // ルート検索を開始（InfoWindowの「ルートを見る」ボタンから呼ばれる）
    const handleRouteSearch = async (spot: Spot) => {
        setHideOtherPins(true); // "View Route" hides other pins
        setMode(AppMode.ROUTE_SELECT);
        setDestinationSpot(spot); // Set destination (persisted even if popup closes)
        // setSelectedSpot(null); // REMOVED: Keep popup open per user request to "restore" behavior
        setFocusedSpotId(null); // Also clear focus
        setLoading(true);
        setRouteSheetState('default');
        setShowRouteDetail(false); // Start on comparison screen, not detail view
        setRouteTab('RECOMMENDED'); // Reset tab

        // Use current location if available, otherwise fallback to Kyoto Station
        const kyotoStation = { latitude: 34.9858, longitude: 135.7588 };
        const originCoords = coords || kyotoStation;

        // Use RouteService for deterministic routing
        // Use RouteService for deterministic routing with Streaming
        setRouteOptions([]); // Clear explicitly before search
        const fetchedRoutes = await routeService.searchRoutes(originCoords, spot.location, {}, (route) => {
            setRouteOptions(prev => {
                const next = [...prev, route];
                // Sort by Earliest Departure
                return next.sort((a, b) => {
                    const getDep = (r: RouteOption) => {
                        const s = r.segments.find(sg => sg.type === 'BUS' || sg.type === 'SUBWAY');
                        return s?.departureTime ? parseInt(s.departureTime.replace(':', '')) : 9999;
                    };
                    return getDep(a) - getDep(b);
                });
            });
        });

        // Apply tutorial-specific sorting: prioritize "市バス五条通５"
        let sortedRoutes = fetchedRoutes;
        if (tutorial.isActive) {
            sortedRoutes = [...fetchedRoutes].sort((a, b) => {
                const hasGojodori5 = (r: RouteOption) => {
                    return r.segments.some(seg =>
                        seg.text?.includes('市バス五条通５') || seg.text?.includes('市バス 五条通５')
                    );
                };
                const aHas = hasGojodori5(a);
                const bHas = hasGojodori5(b);
                if (aHas && !bHas) return -1;
                if (!aHas && bHas) return 1;
                return 0; // Keep original order otherwise
            });
        }

        setRouteOptions(sortedRoutes); // Final consistent state

        // Auto-select first route to show it by default
        if (sortedRoutes.length > 0) {
            setSelectedRoute(sortedRoutes[0]);
        }

        setLoading(false);
    };



    // 4. Start Navigation (Skip audio prompt, directly start)
    const startNavigation = (route: RouteOption) => {
        setSelectedRoute(route);
        setSelectedSpot(null); // Close popup immediately
        // Directly start navigation with audio enabled (skip prompt)
        confirmNavigation(true);
    };

    // 5. End Navigation (Transition to destination tourism guide)
    const handleEndNavigation = () => {
        locationSimulator.stop();
        stopCurrentAudio();

        setIsArrived(false);
        setMode(AppMode.DESTINATION);
        setSelectedSpot(destinationSpot); // Show destination tourism guide
        setSelectedRoute(null);
        setNavStage('TO_STOP');
        setGuideText("");
        setTransitInfo(null);
        setRemainingSeconds(0);
    };

    // Confirm and start
    const confirmNavigation = (enableAudio: boolean) => {
        setShowAudioPrompt(false);
        setIsMuted(!enableAudio);
        stopCurrentAudio();

        // Audio playback removed per user request

        setMode(AppMode.NAVIGATING);
        setNavStage('TO_STOP');
        setFocusedSpotId(null); // Clear focus to help close InfoWindow
        setSelectedSpot(null); // Auto-close popup on start (Feature Request)

        // Initialize stopsAway from GTFS data (+1 for destination stop)
        const busSegment = selectedRoute?.segments?.find(s => s.type === 'BUS' || s.type === 'SUBWAY');
        const realStopCount = (busSegment?.intermediateStops?.length || 0) + 1;
        setStopsAway(realStopCount > 0 ? realStopCount : 5);

        setGuideText("");
        setTransitInfo(null);
        setAudioDuration(0);
        setIsArrived(false); // Reset arrival state for fresh navigation

        // Initialize timer with actual segment duration from route
        const firstSegmentDuration = selectedRoute?.segments?.[0]?.duration;
        const initialSeconds = parseDurationStr(firstSegmentDuration) || STAGE_DURATIONS['TO_STOP'] / 1000;
        setRemainingSeconds(initialSeconds);
        // Reset lyrics widget to readable size
        setLyricsHeight(180);

        // NOTE: setSheetHeight REMOVED per user request ("Don't minimize")
        // Toast notification removed per user request
    };

    // Stop current audio helper
    const stopCurrentAudio = () => {
        // Invalidate any pending play requests
        audioRequestId.current++;

        if (currentAudioController.current) {
            currentAudioController.current.stop();
            currentAudioController.current = null;
        }
        setIsPlaying(false);
    };

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Helper to get segment duration for a stage
    const getSegmentDurationForStage = (stage: NavigationStage): number => {
        if (!selectedRoute?.segments) return STAGE_DURATIONS[stage] / 1000;

        if (stage === 'TO_STOP') {
            // First segment (usually walking to stop)
            return parseDurationStr(selectedRoute.segments[0]?.duration);
        } else if (stage === 'ON_BUS') {
            // Main transit segment
            const transitSeg = selectedRoute.segments.find(s => ['BUS', 'SUBWAY', 'TRAIN'].includes(s.type));
            return parseDurationStr(transitSeg?.duration);
        } else if (stage === 'TO_DEST') {
            // Last segment (walking to destination)
            return parseDurationStr(selectedRoute.segments[selectedRoute.segments.length - 1]?.duration);
        } else {
            // ALIGHTING - short fixed duration
            return STAGE_DURATIONS['ALIGHTING'] / 1000;
        }
    };

    const changeStage = (newStage: NavigationStage) => {
        stopCurrentAudio();
        setNavStage(newStage);
        setAudioDuration(0);
        // Use actual segment duration instead of hardcoded value
        setRemainingSeconds(getSegmentDurationForStage(newStage));

        // Initialize stopsAway when entering bus stage
        if (newStage === 'ON_BUS') {
            const busSegment = selectedRoute?.segments?.find(s => ['BUS', 'SUBWAY', 'TRAIN'].includes(s.type));
            const initialStops = (busSegment?.intermediateStops?.length || 0) + 1;
            setStopsAway(initialStops);
        }
    }

    // --- REF for Simulated Position (Fix for Stale Closure) ---
    const simulatedPositionRef = useRef(simulatedPosition);
    useEffect(() => {
        simulatedPositionRef.current = simulatedPosition;
    }, [simulatedPosition]);

    // --- AUTOMATED JOURNEY SIMULATION (1-second tick) ---
    useEffect(() => {
        if (mode !== AppMode.NAVIGATING || !selectedRoute) return;

        // Use interval for 1s ticks to update UI timer
        const interval = setInterval(() => {
            // Decrease timer
            setRemainingSeconds(prev => {
                // Decrease timer by speed factor to match simulator visual progress
                const speed = locationSimulator.state.speed || 1;
                const next = prev - speed;

                // (Arrival check moved to dedicated useEffect)

                // Check for transition
                if (next <= 0) {
                    // If audio is playing, wait (don't transition yet)
                    // In a real app we might wait, but for simulation let's ensure we wait at least for audioDuration
                    // However, the countdown was initialized with MAX(stageDuration, audioDuration) in logic below?
                    // Actually, let's just transition when timer hits 0, assuming timer was set correctly.

                    // Logic to switch stages
                    if (navStage === 'TO_STOP') {
                        changeStage('ON_BUS');
                        return getSegmentDurationForStage('ON_BUS');
                    } else if (navStage === 'ON_BUS') {
                        changeStage('ALIGHTING');
                        return getSegmentDurationForStage('ALIGHTING');
                    } else if (navStage === 'ALIGHTING') {
                        changeStage('TO_DEST');
                        return getSegmentDurationForStage('TO_DEST');
                    } else if (navStage === 'TO_DEST') {
                        // Stay at 0
                        handleArrive();
                        return 0;
                    }
                }

                // Calculate remaining stops based on GEOGRAPHIC PROGRESS (Syncs with simulation)
                if (navStage === 'ON_BUS') {
                    const busSegment = selectedRoute?.segments?.find(s => s.type === 'BUS' || s.type === 'SUBWAY');
                    const intermediateStops = busSegment?.intermediateStops || [];
                    const arrivalTimeStr = busSegment?.arrivalTime;

                    if (busSegment && busSegment.path && busSegment.path.length > 1) {
                        const currentPos = simulatedPositionRef.current
                            ? { latitude: simulatedPositionRef.current.lat, longitude: simulatedPositionRef.current.lng }
                            : (coords || { latitude: 34.9858, longitude: 135.7588 });

                        // Find destination of this bus segment
                        const destNode = busSegment.path[busSegment.path.length - 1];
                        const startNode = busSegment.path[0];

                        const destCoord = { latitude: destNode.lat, longitude: destNode.lng };
                        const startCoord = { latitude: startNode.lat, longitude: startNode.lng };

                        // Calculate total distance of this segment and remaining distance
                        // Calculate total distance of this segment and remaining distance
                        // const totalDist = busSegment.distance || getDistance(startCoord, destCoord);
                        const distToDest = getDistance(currentPos, destCoord);

                        // NEW LOGIC: Find the last stop we have definitely passed
                        let lastPassedIndex = -1;
                        let hasStopWithCoords = false;

                        for (let i = 0; i < intermediateStops.length; i++) {
                            const stop = intermediateStops[i];
                            if (stop.lat && stop.lng) {
                                hasStopWithCoords = true;
                                const stopCoord = { latitude: stop.lat, longitude: stop.lng };
                                const stopDistToDest = getDistance(stopCoord, destCoord);

                                // If we are closer to dest than the stop is (with 30m buffer), we passed it
                                // (distToDest < stopDistToDest implies we are "after" the stop)
                                if (distToDest < stopDistToDest - 30) {
                                    lastPassedIndex = i;
                                }
                            }
                        }

                        let newStops = 0;

                        if (!hasStopWithCoords) {
                            // Fallback: Linear progress if NO stops have coords
                            const totalDist = busSegment.distance || getDistance(startCoord, destCoord);
                            const progress = totalDist > 100 ? Math.max(0, Math.min(1, 1 - (distToDest / totalDist))) : 0;
                            const totalStopCount = intermediateStops.length + 1;
                            const passedStopsLinear = Math.floor(progress * totalStopCount);
                            newStops = Math.max(1, totalStopCount - passedStopsLinear);
                        } else {
                            // Calculate remaining intermediate stops based on last passed index
                            const remainingIntermediates = intermediateStops.length - 1 - lastPassedIndex;
                            newStops = Math.max(0, remainingIntermediates);

                            // Add destination if we haven't arrived (dist > 50m)
                            if (distToDest > 50) {
                                newStops += 1;
                            }

                            // Ensure at least 1 if not physically at destination coords provided we are in ON_BUS
                            newStops = Math.max(1, newStops);
                        }

                        if (newStops !== stopsAway) {
                            setStopsAway(newStops);
                            // Update UI Info directly here to avoid dependency cycles and ensure UI reflects latest state
                            const realArrivalTime = busSegment?.arrivalTime || '--:--';
                            setTransitInfo(prev => ({
                                ...prev,
                                status: 'ON_TIME',
                                stopsAway: newStops,
                                currentLocation: '移動中',
                                nextBusTime: realArrivalTime,
                                message: `${realArrivalTime} 着予定`
                            }));
                        }
                    } else {
                        // Fallback: timer-based countdown (if no path data)
                        const totalDuration = getSegmentDurationForStage('ON_BUS');
                        const progress = 1 - (next / (totalDuration > 0 ? totalDuration : 60)); // use valid 'next' variable
                        const initialStops = stopsAway > 0 ? stopsAway : 5;
                        const newStops = Math.max(1, initialStops - Math.floor(progress * initialStops));
                        if (newStops !== stopsAway) {
                            setStopsAway(newStops);
                            // Update simple countdown info
                            const realArrivalTime = busSegment?.arrivalTime || '--:--';
                            setTransitInfo(prev => ({ ...prev, stopsAway: newStops, message: `${realArrivalTime} 着予定` }));
                        }
                    }
                }

                return next;
            });

        }, 1000);

        return () => clearInterval(interval);
    }, [mode, navStage, selectedRoute]); // Removed dependencies that change too often to avoid reset

    // --- ARRIVAL DETECTION (Fix for Stale Closure) ---
    // --- ARRIVAL DETECTION (Fix for Stale Closure & Stage Mismatch) ---
    useEffect(() => {
        if (mode === AppMode.NAVIGATING && !isArrived) {
            // Check if simulator has finished or is very close to end
            // We removed 'navStage === TO_DEST' check because simulator might finish faster than the timer-based stages
            const state = locationSimulator.state;
            const isFinished = state.progress >= 98.0 || (state.isRunning === false && state.progress > 90.0);

            if (isFinished) {
                handleArrive();
            }
        }
    }, [mode, isArrived, locationSimulator.state.progress, locationSimulator.state.isRunning]);

    // --- ADJUST TIMER IF AUDIO IS LONG ---
    useEffect(() => {
        // If audio duration is longer than current remaining time, extend remaining time
        if (audioDuration > 0 && remainingSeconds > 0) {
            const buffer = 5; // seconds
            if (remainingSeconds < audioDuration + buffer) {
                setRemainingSeconds(Math.ceil(audioDuration + buffer));
            }
        }
    }, [audioDuration]); // Trigger when new audio starts


    // --- SYNC NAV STAGE WITH SIMULATOR MODE ---
    useEffect(() => {
        if (mode !== AppMode.NAVIGATING) return;

        // Check both real simulator and demo state (for tutorial)
        const simMode = tutorial.demoState?.simulationState?.currentTransportMode ?? locationSimulator.state.currentTransportMode;

        // Force transition to ON_BUS if simulator enters transit mode while we are still in TO_STOP
        if (navStage === 'TO_STOP' && (simMode === 'BUS' || simMode === 'SUBWAY' || simMode === 'TRAIN')) {
            changeStage('ON_BUS');
        }

        // Force transition to ALIGHTING/TO_DEST if simulator goes back to WALK after being on BUS
        if (navStage === 'ON_BUS' && simMode === 'WALK') {
            changeStage('ALIGHTING');
        }
    }, [mode, navStage, locationSimulator.state.currentTransportMode, tutorial.demoState]);

    // --- AUTO GUIDE GENERATION & AUDIO CONTROL ---
    useEffect(() => {
        // Use mode and selectedRoute to support both Real and Demo modes
        if (mode !== AppMode.NAVIGATING || !selectedRoute) return;

        const autoGenerate = async () => {
            // Determine exact duration for the AI to speak based on Actual Route Segment
            let durationSec = STAGE_DURATIONS[navStage] / 1000; // Default fallback

            // Get current location (Simulation or Real GPS)
            // simulatedPosition is already derived from effective simState
            const currentPos = simulatedPosition
                ? { latitude: simulatedPosition.lat, longitude: simulatedPosition.lng }
                : (coords || { latitude: 34.9858, longitude: 135.7588 });

            if (selectedRoute.segments) {
                if (navStage === 'TO_STOP') {
                    // First segment (Walking to start)
                    const firstSeg = selectedRoute.segments[0];
                    durationSec = parseDurationStr(firstSeg?.duration);

                    // Real-time update for Walking
                    if (firstSeg?.path && currentPos) {
                        const path = firstSeg.path;
                        const dest = path[path.length - 1];
                        const destCoord = { latitude: dest.lat, longitude: dest.lng };
                        const startCoord = { latitude: path[0].lat, longitude: path[0].lng };

                        const remainingDist = getDistance(currentPos, destCoord);
                        const totalDist = firstSeg.distance || getDistance(startCoord, destCoord);

                        if (totalDist > 0) {
                            const ratio = remainingDist / totalDist;
                            durationSec = Math.max(30, Math.floor(durationSec * ratio));
                        }
                    }

                } else if (navStage === 'ON_BUS') {
                    // Main Transit Segment
                    const transitSeg = selectedRoute.segments.find(s => ['BUS', 'SUBWAY', 'TRAIN'].includes(s.type));
                    durationSec = parseDurationStr(transitSeg?.duration);

                    // Real-time update for Transit
                    if (transitSeg?.path && currentPos) {
                        const path = transitSeg.path;
                        const dest = path[path.length - 1];
                        const destCoord = { latitude: dest.lat, longitude: dest.lng };
                        const startCoord = { latitude: path[0].lat, longitude: path[0].lng };

                        const remainingDist = getDistance(currentPos, destCoord);
                        const totalDist = transitSeg.distance || getDistance(startCoord, destCoord);

                        if (totalDist > 0) {
                            const ratio = remainingDist / totalDist;
                            durationSec = Math.max(30, Math.floor(durationSec * ratio));
                        }
                    }

                } else if (navStage === 'TO_DEST') {
                    // Last segment (Walking to destination)
                    const lastSeg = selectedRoute.segments[selectedRoute.segments.length - 1];
                    durationSec = parseDurationStr(lastSeg?.duration);

                    // Real-time update for Walking
                    if (lastSeg?.path && currentPos) {
                        const path = lastSeg.path;
                        const dest = path[path.length - 1];
                        const destCoord = { latitude: dest.lat, longitude: dest.lng };
                        const startCoord = { latitude: path[0].lat, longitude: path[0].lng };

                        const remainingDist = getDistance(currentPos, destCoord);
                        const totalDist = lastSeg.distance || getDistance(startCoord, destCoord);

                        if (totalDist > 0) {
                            const ratio = remainingDist / totalDist;
                            durationSec = Math.max(30, Math.floor(durationSec * ratio));
                        }
                    }
                }
            }

            // Play audio automatically
            // await handleGenerateGuide(selectedRoute, navStage, durationSec, true);

            // Set Transit Info from GTFS data
            // Ensure segments exist before trying to find
            if (!selectedRoute.segments) return;

            const busSegment = selectedRoute.segments.find(s => s.type === 'BUS' || s.type === 'SUBWAY');
            const realDepartureTime = busSegment?.departureTime || '--:--';
            const realArrivalTime = busSegment?.arrivalTime || '--:--';
            const realStopCount = (busSegment?.intermediateStops?.length || 0) + 1;

            if (navStage === 'TO_STOP') {
                setTransitInfo({
                    status: 'ON_TIME',
                    stopsAway: realStopCount,
                    currentLocation: '接近中',
                    nextBusTime: realDepartureTime,
                    message: `${realDepartureTime} 発`
                });
            } else if (navStage === 'ON_BUS') {
                setTransitInfo({
                    status: 'ON_TIME',
                    stopsAway: stopsAway, // Use current state (which should have been init by changeStage)
                    currentLocation: '移動中',
                    nextBusTime: realArrivalTime,
                    message: `${realArrivalTime} 着予定`
                });
            }
        };

        autoGenerate();
    }, [navStage, mode, selectedRoute, simulatedPosition, coords, stopsAway]);

    // 5. Gemini Actions (Legacy removed)
    // New GuideSlider handles guide generation and playback.

    // Audio Request ID to prevent race conditions
    const audioRequestId = useRef(0);

    const handlePlayAudio = async (text: string) => {
        if (!text) return;

        // 1. Stop currently playing audio immediately
        stopCurrentAudio();

        // 2. Start new request scope
        const myId = ++audioRequestId.current;

        // If muted, we simulate playback for visual guide aka "Karaoke Mode"
        if (isMuted) {
            // Estimate duration: ~5 chars per second for Japanese
            // Minimum 3 seconds to ensure readability
            const estimatedDuration = Math.max(text.length / 5, 3);

            setIsPlaying(true);
            setAudioDuration(estimatedDuration);

            // Auto reset playing state
            setTimeout(() => {
                // Only reset if this is still the active request
                if (myId === audioRequestId.current) {
                    setIsPlaying(false);
                }
            }, estimatedDuration * 1000 + 500);

            return;
        }

        setIsPlaying(true);

        // 3. Start fetching audio (async)
        // Note: playTextToSpeech might take time. By the time it returns, another play might have started.
        const { duration, stop } = await playTextToSpeech(text);

        // 4. Check if we are still the active request
        if (myId !== audioRequestId.current) {
            // Stale request - stop immediately and do nothing else
            stop();
            return;
        }

        // 5. We are valid - store controller
        currentAudioController.current = { stop };
        setAudioDuration(duration);

        // Auto reset playing state
        setTimeout(() => {
            if (myId === audioRequestId.current) {
                setIsPlaying(false);
                if (currentAudioController.current?.stop === stop) {
                    currentAudioController.current = null;
                }
            }
        }, duration * 1000 + 500);
    };

    const toggleMute = () => {
        if (isPlaying && !isMuted) {
            stopCurrentAudio();
        }
        setIsMuted(!isMuted);
    };

    const handleArrive = () => {
        stopCurrentAudio();
        // Trigger completion slide in GuideSlider
        setIsArrived(true);

        // Ensure we show the destination details
        if (destinationSpot) {
            setSelectedSpot(destinationSpot);
            // Set guide text to description to prevent infinite loading spinner
            if (!guideText) {
                setGuideText(destinationSpot.description || `${destinationSpot.name}に到着しました。`);
            }
        }
        // setMode(AppMode.DESTINATION); // DELAYED until user clicks "Finish"
    };

    const goBackToPlanning = () => {
        stopCurrentAudio();
        setMode(AppMode.PLANNING);
        setSheetHeight(Math.floor(window.innerHeight * 0.45));
        setSelectedSpot(null);
        setRouteOptions([]);
        setSelectedRoute(null);
        setShowRouteDetail(false);
        setGuideText("");
        setIsPlaying(false);
    };

    // Sheet Drag Handlers for Nearby Spots - Direct DOM Manipulation for Performance
    const handlePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault(); // Prevent default touch behavior and map interaction
        setIsDragging(true);
        dragStartY.current = e.clientY;
        sheetStartHeight.current = sheetHeight;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        e.stopPropagation(); // Also prevent move propagation

        // Use requestAnimationFrame to prevent layout thrashing, 
        // but for simple height updates, direct assignment is usually fine.
        // We bypass React state (setSheetHeight) to avoid re-rendering the whole App tree 60fps.

        const deltaY = dragStartY.current - e.clientY; // positive = dragging up
        const newHeight = sheetStartHeight.current + deltaY;

        // Constraints: minimum 88px, maximum 90% of screen
        const minHeight = 88;
        const maxHeight = Math.floor(window.innerHeight * 0.9);
        const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

        // Ensure DOM is in sync with the state we just set (React will update it, but good to be explicit)
        sheetRef.current.style.height = `${clampedHeight}px`;
    }
    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging) return;
        e.stopPropagation();
        e.preventDefault(); // Prevent click event from firing on map after drag
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);

        // Delay resetting isDragging to block subsequent click event from hitting the map (prevents "Tap" issue)
        // Increased to 500ms to cover standard mobile 300ms tap delay
        setTimeout(() => setIsDragging(false), 500);

        if (sheetRef.current) {
            const currentHeight = parseInt(sheetRef.current.style.height || '0', 10);

            // Snap Logic
            const screenHeight = window.innerHeight;
            let finalHeight = currentHeight;

            if (currentHeight < 150) {
                finalHeight = 88;
            } else if (currentHeight > screenHeight * 0.85) {
                finalHeight = Math.floor(screenHeight * 0.9);
            }

            setSheetHeight(finalHeight);
            sheetRef.current.style.height = `${finalHeight}px`;
        }
    };

    // Simulator Panel Drag Handlers
    const handleSimulatorDragStart = (clientX: number, clientY: number) => {
        setIsSimulatorDragging(true);
        simulatorDragStart.current = { x: clientX, y: clientY };
        simulatorPosStart.current = { x: simulatorPos.x, y: simulatorPos.y };
    };

    const handleSimulatorDragMove = (clientX: number, clientY: number) => {
        if (!isSimulatorDragging) return;
        const deltaX = clientX - simulatorDragStart.current.x;
        const deltaY = clientY - simulatorDragStart.current.y;
        setSimulatorPos({
            x: Math.max(0, Math.min(window.innerWidth - 200, simulatorPosStart.current.x + deltaX)),
            y: Math.max(60, Math.min(window.innerHeight - 100, simulatorPosStart.current.y + deltaY))
        });
    };

    const handleSimulatorDragEnd = () => {
        setIsSimulatorDragging(false);
    };

    // Helper to calculate arrival time dynamically
    const getDynamicArrivalTime = (secondsToAdd: number) => {
        const now = new Date();
        const arrival = new Date(now.getTime() + secondsToAdd * 1000);
        return `${arrival.getHours()}:${arrival.getMinutes().toString().padStart(2, '0')}`;
    };


    // Helper to get time info for current stage
    const getStageTimeInfo = () => {
        if (!selectedRoute) return null;

        // Get bus segment for departure time
        const busSegment = selectedRoute.segments?.find(s => s.type === 'BUS' || s.type === 'SUBWAY');
        const departureTimeStr = busSegment?.departureTime;
        const arrivalTimeStr = busSegment?.arrivalTime;

        // Calculate time until departure (for TO_STOP stage)
        let minutesUntilDeparture = 0;
        if (departureTimeStr) {
            const [depH, depM] = departureTimeStr.split(':').map(Number);
            const now = new Date();
            const depMinutes = depH * 60 + depM;
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            minutesUntilDeparture = Math.max(0, depMinutes - nowMinutes);
        }

        // Dynamic countdown for walk/ride segments
        const mins = Math.ceil(remainingSeconds / 60);
        const timeStr = `${mins}分`;
        const arrivalTime = getDynamicArrivalTime(remainingSeconds);

        if (navStage === 'TO_STOP') {
            const depTimeDisplay = minutesUntilDeparture > 0 ? `出発まであと${minutesUntilDeparture}分` : '出発時刻です';
            return `最寄りへ移動中 (${depTimeDisplay}) - ${departureTimeStr || arrivalTime}発`;
        }
        if (navStage === 'ON_BUS') {
            return `乗車中 (あと ${timeStr}) - ${arrivalTimeStr || arrivalTime}着予定`;
        }
        if (navStage === 'ALIGHTING') {
            return `まもなく到着 (あと ${timeStr})`;
        }
        if (navStage === 'TO_DEST') {
            return `目的地へ移動中 (あと ${timeStr}) - ${arrivalTime}着`;
        }
        return null;
    };

    // Lyrics Drag Handlers
    const handleLyricsPointerDown = (e: React.PointerEvent) => {
        setIsLyricsDragging(true);
        lyricsDragStartY.current = e.clientY;
        lyricsStartHeight.current = lyricsHeight;
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handleLyricsPointerMove = (e: React.PointerEvent) => {
        if (!isLyricsDragging) return;

        // Dragging UP = larger area (negative deltaY)
        const deltaY = lyricsDragStartY.current - e.clientY;
        const newHeight = lyricsStartHeight.current + deltaY;

        // Constrain height to keep widget on screen
        // Max 400px to prevent overflow, min 60px
        const clampedHeight = Math.max(60, Math.min(400, newHeight));
        setLyricsHeight(clampedHeight);
    };

    const handleLyricsPointerUp = (e: React.PointerEvent) => {
        if (!isLyricsDragging) return;
        setIsLyricsDragging(false);
        (e.target as Element).releasePointerCapture(e.pointerId);
    };

    const stageTimeInfo = getStageTimeInfo();

    return (
        <div className="h-screen w-full max-w-md mx-auto bg-gray-50 shadow-2xl overflow-hidden relative font-sans text-gray-800 flex flex-col">

            {/* Toast Notification */}
            {toastMessage && (
                <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900/90 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg animate-fade-in-up transition-opacity">
                    {toastMessage}
                </div>
            )}

            {/* Audio Choice Modal */}
            {showAudioPrompt && <AudioPromptModal onConfirm={confirmNavigation} />}

            {/* Global Header */}
            {mode !== AppMode.LANDING && mode !== AppMode.ROUTE_SELECT && mode !== AppMode.PLANNING && (
                <header className="bg-indigo-900/95 backdrop-blur-md text-white px-4 py-2 sticky top-0 z-40 shadow-sm flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 overflow-hidden w-full">
                        <button onClick={goBackToPlanning} className="p-1 -ml-1 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors shrink-0">
                            <ChevronLeftIcon />
                        </button>

                        {/* Traffic Info Display for Navigation */}
                        {(mode === AppMode.NAVIGATING && selectedRoute) ? (
                            <div className="flex-1 flex flex-col items-start min-w-0">
                                {(() => {
                                    const transitSeg = selectedRoute.segments.find(s => ['BUS', 'SUBWAY', 'TRAIN'].includes(s.type));

                                    // If no transit segment (Walking only), show simple destination
                                    if (!transitSeg) {
                                        return (
                                            <div className="flex flex-col justify-center h-full">
                                                <div className="text-[10px] text-white/60 font-bold uppercase tracking-wider">目的地</div>
                                                <div className="text-lg font-bold leading-tight">{selectedSpot?.name || '目的地'}</div>
                                            </div>
                                        );
                                    }

                                    // Use explicit boardingStop/alightingStop fields from route data
                                    const boardingStation = transitSeg.boardingStop || transitSeg.platform || '乗車駅';
                                    const alightingStation = transitSeg.alightingStop || transitSeg.direction || '降車駅';

                                    // Extract times
                                    const departureTime = transitSeg.departureTime || '';
                                    const arrivalTime = transitSeg.arrivalTime || '';

                                    // Bus/Line Name
                                    const lineName = transitSeg.lineName || transitSeg.text.replace('Bus ', '系統 ');

                                    return (
                                        <div className="w-full flex flex-col gap-0">
                                            {/* Top Row: Bus Name & Status */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-extrabold text-yellow-300 leading-none drop-shadow-md">
                                                        {lineName}
                                                    </span>
                                                    {transitInfo && transitInfo.stopsAway > 0 && navStage === 'ON_BUS' && (
                                                        <span className="text-[10px] font-bold text-white bg-indigo-600/80 px-1.5 py-0.5 rounded-full">
                                                            {transitInfo.stopsAway === 1 ? 'まもなく到着' : `あと${transitInfo.stopsAway}駅`}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-white/80 font-bold tracking-wider">
                                                    {transitInfo?.message || 'NAVIGATION'}
                                                </div>
                                            </div>

                                            {/* Two Lines: Departure -> Arrival */}
                                            <div className="flex flex-col text-sm font-bold w-full">
                                                {/* Departure */}
                                                <div className="flex items-center justify-between leading-none opacity-90 mb-[2px]">
                                                    <div className="flex items-center gap-1.5 truncate min-w-0">
                                                        <span className="text-[10px] w-3 text-center shrink-0 opacity-70">発</span>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0"></div>
                                                        <span className="truncate">{boardingStation}</span>
                                                    </div>
                                                    <span className="font-mono text-[10px] ml-2 tabular-nums">{departureTime}</span>
                                                </div>

                                                {/* Connecting Line (Visual Only) - Optional */}
                                                <div className="ml-[20px] w-0.5 h-1.5 bg-white/30 -my-0.5"></div>

                                                {/* Arrival */}
                                                <div className="flex items-center justify-between leading-none">
                                                    <div className="flex items-center gap-1.5 truncate min-w-0">
                                                        <span className="text-[10px] w-3 text-center shrink-0 opacity-70">着</span>
                                                        <div className="w-1.5 h-1.5 rounded-full border border-white shrink-0"></div>
                                                        <span className="truncate text-white">{alightingStation}</span>
                                                    </div>
                                                    <span className="font-mono text-[10px] ml-2 tabular-nums">{arrivalTime}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            /* Default Header for Destination Mode / Other */
                            <div className="truncate flex-1">
                                <h1 className="text-sm font-bold opacity-90 tracking-wide uppercase">Path</h1>
                                {selectedSpot && (
                                    <div className="text-base font-bold truncate leading-tight">{selectedSpot.name}</div>
                                )}
                            </div>
                        )}

                        {/* Audio Button Removed per user request */}
                    </div>
                </header>
            )}

            {/* Content Area */}
            <main className={`flex-1 relative w-full ${mode === AppMode.PLANNING ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} ${mode === AppMode.ROUTE_SELECT ? "bg-white" : ""}`}>

                {/* Map Background */}
                <div className="absolute inset-0 z-0">
                    {(mode !== AppMode.LANDING || isLandingImageLoaded) && (
                        <Map
                            center={simulatedPosition
                                ? { latitude: simulatedPosition.lat, longitude: simulatedPosition.lng }
                                : (coords || { latitude: 34.9858, longitude: 135.7588 })}
                            spots={(() => {
                                // Use nearbySpots for instant pin display (no waiting for guide content)
                                const nearbySpotIds = new Set(nearbySpots.map(s => s.id));

                                // During navigation, only show nearby spots (instantly available)
                                const isInNavMode = mode === AppMode.NAVIGATING;

                                // Show all relevant spots (filtered by route), not just "nearby" ones for audio
                                const baseSpots = visibleSpots;

                                // Filter by distance from current position - REMOVED to show all spots
                                // const cur = simulatedPosition
                                //     ? { latitude: simulatedPosition.lat, longitude: simulatedPosition.lng }
                                //     : (coords || { latitude: 34.9858, longitude: 135.7588 });
                                // return baseSpots.filter(s => getDistance(cur, s.location) > 50);
                                return baseSpots;
                            })()}
                            onSelectSpot={handleSpotSelect}
                            onViewRoute={handleRouteSearch}
                            onPinClick={() => setSheetHeight(88)}

                            selectedSpotId={selectedSpot?.id}
                            focusedSpotId={focusedSpotId || undefined}
                            selectedRoute={selectedRoute}
                            routeOptions={routeOptions}
                            isNavigating={mode === AppMode.NAVIGATING}
                            isSheetDragging={isDragging}
                            disableSmartPan={mode === AppMode.NAVIGATING}
                            showBusRoutes={showBusRoutes}
                            transportMode={simState?.currentTransportMode || 'WALK'}
                            bearing={simState?.bearing || 0}
                            busRoutes={busRoutes}
                            subwayRoutes={[]}
                            highlightedGuideSpotId={highlightedGuideSpotId}
                            recenterTrigger={recenterTrigger}
                        />
                    )}
                </div>

                {/* LANDING MODE */}
                {mode === AppMode.LANDING && (
                    <>
                        <LandingPage
                            loading={loading}
                            devMode={devMode}
                            onRequestLocation={requestLocation}
                            onToggleDevMode={() => setDevMode(prev => !prev)}
                            onImageLoad={() => setIsLandingImageLoaded(true)}
                            onShowTutorial={tutorial.startTutorial}
                        />
                    </>
                )}

                {/* PLANNING MODE UI */}
                {mode === AppMode.PLANNING && (coords || coords) && (
                    <div className="w-full h-full relative pointer-events-none">
                        {/* Legend 5 Levels */}
                        <CongestionLegend />

                        {/* Invisible overlay behind sheet to block map events when sheet is expanded */}
                        {sheetHeight > 120 && (
                            <div
                                className="absolute inset-0 z-[10]"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                        )}

                        {/* Draggable Sheet Container */}
                        <div
                            ref={sheetRef}
                            className="absolute bottom-0 left-0 right-0 z-[20] bg-white rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] flex flex-col pointer-events-auto transition-[height] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] overflow-hidden"
                            style={{ height: `${sheetHeight}px` }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            {/* Drag Handle */}
                            <div
                                className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing hover:bg-gray-50 transition-colors touch-none shrink-0"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                                onClickCapture={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                            >
                                <div className="w-12 h-1.5 bg-gray-300 rounded-full opacity-50 pointer-events-none"></div>
                            </div>

                            <div className="px-6 pb-2 shrink-0 bg-white z-20 space-y-3 pointer-events-none">
                                <div className="flex flex-wrap items-start justify-between gap-y-2 pointer-events-auto min-h-[60px]">
                                    <div>
                                        <h2 className="text-xl font-black text-gray-800 tracking-tight leading-tight whitespace-nowrap">
                                            近くの観光スポット
                                        </h2>
                                        <p className="text-xs font-bold text-gray-400 mt-1">
                                            {visibleSpots.length}件のスポットが見つかりました
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        {/* View Mode Selector */}
                                        <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
                                            <button
                                                onClick={() => setViewMode('list')}
                                                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => setViewMode('grid')}
                                                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                                </svg>
                                            </button>
                                        </div>

                                        {/* Month & Time Filter (Dev Mode Only) */}
                                        {devMode && (
                                            <>
                                                {/* Month Selector */}
                                                <div className="relative">
                                                    <select
                                                        value={selectedMonth}
                                                        onChange={(e) => setSelectedMonth(e.target.value as Month)}
                                                        className="pl-3 pr-7 py-2 rounded-lg text-xs font-bold bg-gray-100 text-gray-700 border-none appearance-none cursor-pointer hover:bg-gray-200 transition-colors focus:ring-0"
                                                    >
                                                        {(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] as Month[]).map((m) => (
                                                            <option key={m} value={m}>
                                                                {parseInt(m)}月
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </div>

                                                {/* Time Selector */}
                                                <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
                                                    {(['morning', 'noon', 'evening'] as TimeOfDay[]).map((t) => (
                                                        <button
                                                            key={t}
                                                            onClick={() => setSelectedTime(t)}
                                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${selectedTime === t
                                                                ? 'bg-white text-indigo-600 shadow-sm'
                                                                : 'text-gray-400 hover:text-gray-600'
                                                                }`}
                                                        >
                                                            {t === 'morning' ? '朝' : t === 'noon' ? '昼' : '夕'}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Day Type Selector (Weekday/Weekend) */}
                                                <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
                                                    {(['weekday', 'weekend'] as DayType[]).map((d) => (
                                                        <button
                                                            key={d}
                                                            onClick={() => setSelectedDayType(d)}
                                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${selectedDayType === d
                                                                ? 'bg-white text-indigo-600 shadow-sm'
                                                                : 'text-gray-400 hover:text-gray-600'
                                                                }`}
                                                        >
                                                            {d === 'weekday' ? '平日' : '休日'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Congestion Filter */}
                                <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 transition-all duration-300 pointer-events-auto ${sheetHeight < 120 ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'}`}>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase shrink-0">混雑度:</span>
                                    {congestionOptions.map(opt => (
                                        <button
                                            key={opt.level}
                                            onClick={() => toggleCongestion(opt.level)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${selectedCongestion.includes(opt.level)
                                                ? `${opt.color} text-white shadow-md`
                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                }`}
                                        >
                                            <span className={`w-2 h-2 rounded-full ${selectedCongestion.includes(opt.level) ? 'bg-white' : opt.color}`}></span>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={`flex-1 overflow-y-auto p-4 pt-0 custom-scrollbar transition-opacity duration-300 ${sheetHeight < 120 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                {loading ? (
                                    <div className="flex items-center justify-center h-32 text-gray-400 gap-2">
                                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-sm">スポットを探しています...</span>
                                    </div>
                                ) : visibleSpots.length > 0 ? (
                                    <div className={viewMode === 'grid' ? "grid grid-cols-3 gap-1" : "flex flex-col gap-3"}>
                                        {visibleSpots.map((spot, index) => {
                                            const photoUrl = spot.imageUrl;

                                            // Grid View Item
                                            if (viewMode === 'grid') {
                                                return (
                                                    <div
                                                        key={index}
                                                        className="aspect-square relative cursor-pointer bg-gray-100 rounded-md overflow-hidden hover:opacity-90 transition-opacity animate-fade-in-up"
                                                        style={{ animationDelay: `${index * 30}ms` }}
                                                        onClick={() => handleSpotSelect(spot)}
                                                    >
                                                        {photoUrl ? (
                                                            <img
                                                                src={photoUrl}
                                                                alt={spot.name}
                                                                loading="lazy"
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('no-image'); }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center p-2 text-center text-[10px] text-gray-500 font-bold bg-gray-50 border border-gray-100">
                                                                {spot.name}
                                                            </div>
                                                        )}

                                                        {/* Congestion Icon (Top Right) */}
                                                        <div className="absolute top-1 right-1">
                                                            <div className="scale-75 origin-top-right">
                                                                <CongestionLevelIcon level={spot.congestionLevel} />
                                                            </div>
                                                        </div>

                                                        {/* Name Overlay (Solid Semi-Transparent) */}
                                                        {photoUrl && (
                                                            <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 backdrop-blur-[1px]">
                                                                <p className="text-[10px] text-white font-bold truncate text-center">{spot.name}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            // List View Item (Card)
                                            return (
                                                <div
                                                    key={index}
                                                    className="flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow animate-fade-in-up"
                                                    style={{ animationDelay: `${index * 50}ms` }}
                                                    onClick={() => handleSpotSelect(spot)}
                                                >
                                                    {/* Full Width Cover Image */}
                                                    {photoUrl && (
                                                        <div className="w-full h-32 bg-gray-100 relative">
                                                            <img
                                                                src={photoUrl}
                                                                alt={spot.name}
                                                                loading="lazy"
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                            />
                                                            {/* Price Badge Overlay - REMOVED */}
                                                        </div>
                                                    )}

                                                    <div className="flex-1 flex flex-col gap-2 p-4 pt-3">
                                                        {/* Header: Title and Congestion Icon */}
                                                        <div className="flex justify-between items-start gap-3">
                                                            <h3 className="font-bold text-gray-900 leading-tight text-lg truncate flex-1">{spot.name}</h3>
                                                            <div className="shrink-0 pt-0.5">
                                                                <CongestionLevelIcon level={spot.congestionLevel} />
                                                            </div>
                                                        </div>

                                                        {/* Description */}
                                                        {spot.description && spot.description.length > 60 ? (
                                                            <div>
                                                                <p
                                                                    className="text-xs text-gray-600 leading-relaxed"
                                                                    style={expandedDescriptions.has(spot.id) ? {} : {
                                                                        display: '-webkit-box',
                                                                        WebkitBoxOrient: 'vertical',
                                                                        WebkitLineClamp: 2,
                                                                        overflow: 'hidden'
                                                                    }}
                                                                >
                                                                    {spot.description}
                                                                </p>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setExpandedDescriptions(prev => {
                                                                            const newSet = new Set(prev);
                                                                            if (newSet.has(spot.id)) {
                                                                                newSet.delete(spot.id);
                                                                            } else {
                                                                                newSet.add(spot.id);
                                                                            }
                                                                            return newSet;
                                                                        });
                                                                    }}
                                                                    className="text-[10px] text-indigo-600 font-bold mt-0.5 hover:underline"
                                                                >
                                                                    {expandedDescriptions.has(spot.id) ? '閉じる' : '続きを読む'}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-gray-600 leading-relaxed">
                                                                {spot.description}
                                                            </p>
                                                        )}

                                                        {/* Metadata Footer */}
                                                        <div className="mt-1 flex flex-col gap-1">
                                                            {spot.openingHours && (
                                                                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                                                    <svg className="shrink-0 w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                    <span className="truncate">{spot.openingHours}</span>
                                                                </div>
                                                            )}
                                                            {spot.price && (
                                                                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                                                    <div className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-indigo-400 font-bold text-[9px] border border-indigo-200 rounded-full">¥</div>
                                                                    <span className="truncate">{spot.price}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-500 py-10">
                                        <p>この範囲に観光スポットが見つかりませんでした。</p>
                                    </div>
                                )}
                                <div className="h-10"></div>
                            </div>
                        </div >
                    </div >
                )
                }

                {/* ROUTE SELECT MODE - Overlay */}
                {
                    mode === AppMode.ROUTE_SELECT && (
                        <div className="absolute bottom-0 left-0 right-0 h-full z-20 flex flex-col pointer-events-none animate-slide-up bg-transparent">
                            {/* Sheet Container */}
                            <div
                                className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] pointer-events-auto overflow-hidden
                                    ${routeSheetState === 'minimized' ? 'h-[180px]' : routeSheetState === 'full' ? 'h-[90%]' : 'h-[50%]'}`}
                            >
                                {/* Drag Handle Area */}
                                <div
                                    className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing hover:bg-gray-50 transition-colors"
                                    onClick={() => setRouteSheetState(s => s === 'minimized' ? 'default' : s === 'default' ? 'full' : 'minimized')}
                                >
                                    <div className="w-12 h-1.5 bg-gray-300 rounded-full opacity-50"></div>
                                </div>

                                {/* Header Content */}
                                <div className="bg-white z-20 sticky top-0 pb-0 shrink-0">
                                    <div className="p-4 pt-1 grid grid-cols-[auto_1fr] gap-3 items-center border-b border-gray-100">
                                        <button onClick={goBackToPlanning} className="text-gray-400 hover:text-gray-800 transition-colors p-2 -ml-2 rounded-full hover:bg-gray-100">
                                            <ChevronLeftIcon />
                                        </button>

                                        <div className="grid grid-cols-[20px_1fr] gap-x-3 items-center">
                                            <div className="flex flex-col items-center h-[50px] justify-between py-1">
                                                <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-400 bg-white shrink-0"></div>
                                                <div className="w-0.5 h-full bg-gray-200 border-l border-dotted border-gray-300"></div>
                                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 ring-2 ring-red-100"></div>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-gray-500 text-xs font-medium">京都駅</span>
                                                <span className="text-gray-900 text-sm font-bold truncate leading-tight">{destinationSpot?.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Route List */}
                                {showRouteDetail && selectedRoute ? (
                                    // --- DETAIL VIEW (Google Maps style) ---
                                    <div className="flex-1 flex flex-col bg-white relative animate-fade-in-right overflow-hidden">
                                        {/* Detail Header - Fixed at Top */}
                                        <div className="p-4 border-b border-gray-100 bg-gray-50 z-10 shrink-0 shadow-sm relative">
                                            <button
                                                onClick={() => setShowRouteDetail(false)}
                                                className="mb-2 flex items-center gap-1 text-sm font-bold text-indigo-600 hover:underline"
                                            >
                                                <ArrowRightIcon className="w-4 h-4 rotate-180" /> 戻る
                                            </button>
                                            <div className="flex justify-between items-baseline mb-1">
                                                <div className="text-2xl font-extrabold text-gray-900">{selectedRoute.duration}</div>
                                                <div className="font-bold text-gray-600">{selectedRoute.cost}</div>
                                            </div>
                                            <div className="text-sm text-gray-500 font-medium">
                                                {selectedRoute.startTime} 発 - {selectedRoute.endTime} 着
                                            </div>
                                        </div>

                                        {/* Scrollable Steps Timeline */}
                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative">
                                            {/* Vertical Line - Aligned to Icon Center
                                                Calculation: p-6 (1.5rem) + w-14 (3.5rem) + gap-4 (1rem) + half-icon (1rem) = 7rem
                                                Minus half line width (2px) approx.
                                            */}
                                            <div className="absolute top-8 bottom-8 left-[calc(7rem-2px)] w-1 bg-gray-200 -z-10"></div>

                                            {/* Origin */}
                                            <div className="flex gap-4 mb-8">
                                                <div className="w-14 shrink-0 text-right pt-1">
                                                    <span className="text-xs text-gray-400 font-bold">現在</span>
                                                </div>
                                                <div className="flex flex-col items-center shrink-0 w-8">
                                                    <div className="w-4 h-4 rounded-full border-4 border-gray-400 bg-white shadow-sm shrink-0 relative z-0"></div>
                                                </div>
                                                <div className="font-bold text-gray-800 pt-0.5">現在地</div>
                                            </div>

                                            {selectedRoute.segments.map((seg, i) => (
                                                <div key={i} className="flex gap-4 mb-8 relative group">
                                                    {/* Duration Column (Left) */}
                                                    <div className="w-14 shrink-0 text-right pt-1">
                                                        <div className="text-sm font-bold text-gray-900 leading-none">{seg.duration}</div>
                                                        {seg.departureTime && (
                                                            <div className="flex flex-col items-end">
                                                                <div className="text-[10px] text-gray-500 mt-1 font-mono">
                                                                    {seg.departureTime}発
                                                                </div>
                                                                {seg.arrivalTime && (
                                                                    <div className="text-[10px] text-gray-500 font-mono">
                                                                        {seg.arrivalTime}着
                                                                    </div>
                                                                )}
                                                                {seg.waitMinutes !== undefined && seg.waitMinutes > 0 && (
                                                                    <div className="text-[9px] text-orange-500 mt-0.5">
                                                                        ({seg.waitMinutes}分待ち)
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Icon Column (Center) */}
                                                    <div className="flex flex-col items-center shrink-0 w-8">
                                                        <div className={`
                                                            flex items-center justify-center w-8 h-8 rounded-full z-10 border-2 border-white shadow-sm
                                                            ${seg.type === 'WALK' ? 'bg-gray-100 text-gray-500' :
                                                                seg.type === 'BUS' ? 'bg-blue-100 text-blue-600' :
                                                                    'bg-green-100 text-green-600'}
                                                        `}>
                                                            <SegmentIcon type={seg.type} className="w-4 h-4" />
                                                        </div>
                                                    </div>

                                                    {/* Details Column (Right) */}
                                                    <div className="flex-1 pt-0.5 space-y-1">
                                                        <div className="font-bold text-base text-gray-900 leading-tight">
                                                            {seg.type === 'WALK' ? '徒歩' : seg.text}
                                                        </div>
                                                        {seg.type === 'BUS' && (
                                                            <div className="text-xs text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded mt-0.5">
                                                                京都駅前 A2
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Destination */}
                                            <div className="flex gap-4 mb-4">
                                                <div className="w-14 shrink-0 text-right">
                                                    <span className="text-xs text-gray-400 font-bold">到着</span>
                                                </div>
                                                <div className="flex flex-col items-center shrink-0 w-8">
                                                    <div className="w-4 h-4 rounded-full bg-red-500 shrink-0 shadow-sm ring-4 ring-red-100 relative z-10"></div>
                                                </div>
                                                <div className="font-bold text-gray-800 pt-0.5">{destinationSpot?.name}</div>
                                            </div>

                                            <div className="h-28"></div> {/* Spacer for fixed button */}
                                        </div>

                                        {/* Float Start Button (Fixed at Bottom of View) */}
                                        <div className="absolute bottom-6 left-6 right-6 z-20">
                                            <button
                                                onClick={() => startNavigation(selectedRoute)}
                                                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                            >
                                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                                    <PlayIcon className="w-4 h-4 ml-0.5" />
                                                </div>
                                                <span className="text-lg">ガイドを開始</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                        {loading ? (
                                            <div className="flex flex-col items-center justify-center h-full py-12 text-gray-500 space-y-4">
                                                <div className="relative w-16 h-16">
                                                    <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-200 rounded-full"></div>
                                                    <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-600 rounded-full animate-spin border-t-transparent"></div>
                                                </div>
                                                <p className="text-sm font-bold">最適なルートを検索中...</p>
                                            </div>
                                        ) : routeOptions.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-16 text-gray-500 text-center">
                                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <p className="font-bold text-gray-800">ルートが見つかりませんでした</p>
                                                <p className="text-xs text-gray-400 mt-2">
                                                    近くにバス停がないか、<br />
                                                    データが取得できませんでした。
                                                </p>
                                            </div>
                                        ) : (
                                            routeOptions.map((route, idx) => {
                                                // Metadata Calculation
                                                const durationNum = parseInt(route.duration) || 0;

                                                // Determine if Fastest
                                                const allDurations = routeOptions.map(r => parseInt(r.duration) || 999);
                                                const minDuration = Math.min(...allDurations);

                                                const isFastest = durationNum === minDuration;
                                                const isSelected = selectedRoute?.id === route.id;

                                                return (
                                                    <div
                                                        key={route.id}
                                                        onClick={() => setSelectedRoute(route)}
                                                        className={`bg-white rounded-xl p-4 border transition-all cursor-pointer relative overflow-hidden group hover:shadow-lg ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-600 shadow-md' : 'border-gray-200'
                                                            }`}
                                                    >
                                                        {/* Header: Time & Cost */}
                                                        <div className="flex justify-between items-baseline mb-3">
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-xl font-extrabold text-gray-900 leading-none">{durationNum}分</span>
                                                                <span className="text-sm font-semibold text-gray-500">
                                                                    {route.startTime} - {route.endTime}
                                                                </span>
                                                            </div>
                                                            <div className="font-bold text-gray-900 text-base">{route.cost === '0円' ? '無料' : route.cost}</div>
                                                        </div>

                                                        {/* Visual Timeline (Icons) */}
                                                        <div className="flex flex-col gap-2 mb-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                                            {route.segments.map((seg, i) => {
                                                                const isTransit = ['BUS', 'SUBWAY', 'TRAIN'].includes(seg.type);
                                                                const hasDetails = isTransit && (seg.intermediateStops?.length || seg.departureTime || seg.arrivalTime);

                                                                return (
                                                                    <div key={i} className="flex flex-col">
                                                                        <div className="flex items-center gap-3 text-xs text-gray-700">
                                                                            {/* Left: Duration */}
                                                                            <div className="w-10 text-right font-bold text-gray-900 shrink-0">
                                                                                {seg.duration}
                                                                            </div>

                                                                            {/* Center: Icon */}
                                                                            <div className={`
                                                                                flex items-center justify-center w-5 h-5 rounded-full shrink-0
                                                                                ${seg.type === 'WALK' ? 'bg-white border border-gray-200 text-gray-400' :
                                                                                    seg.type === 'BUS' ? 'bg-blue-500 text-white' :
                                                                                        'bg-green-500 text-white'}
                                                                            `}>
                                                                                <SegmentIcon type={seg.type} className="w-3 h-3" />
                                                                            </div>

                                                                            {/* Right: Text Info */}
                                                                            <div className="flex-1 truncate">
                                                                                {seg.type === 'WALK' ? (
                                                                                    <span className="font-bold">徒歩</span>
                                                                                ) : (
                                                                                    <div className="flex flex-col">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="font-bold">{seg.text}</span>
                                                                                            {seg.departureTime && seg.arrivalTime && (
                                                                                                <span className="text-[10px] text-gray-500">
                                                                                                    {seg.departureTime} - {seg.arrivalTime}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        {/* Boarding → Alighting Station */}
                                                                                        {(seg.boardingStop || seg.alightingStop) && (
                                                                                            <span className="text-[10px] text-gray-500 truncate">
                                                                                                {seg.boardingStop || '乗車'}
                                                                                                <span className="mx-0.5">→</span>
                                                                                                {seg.alightingStop || '降車'}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Accordion Content: Intermediate Stops */}
                                                                        {hasDetails && seg.intermediateStops && seg.intermediateStops.length > 0 && (
                                                                            <details className="ml-[52px] mt-1">
                                                                                <summary className="text-[10px] text-indigo-600 cursor-pointer hover:text-indigo-800 list-none">
                                                                                    途中 {seg.intermediateStops.length} 駅を表示
                                                                                </summary>
                                                                                <div className="mt-1 pl-2 border-l-2 border-gray-200 space-y-0.5">
                                                                                    {seg.intermediateStops.map((stop, stopIdx) => (
                                                                                        <div key={stopIdx} className="text-[10px] text-gray-500 flex items-center gap-1">
                                                                                            <span className="w-1 h-1 bg-gray-300 rounded-full shrink-0"></span>
                                                                                            <span className="truncate">{stop.name}</span>
                                                                                            {stop.time && <span className="text-gray-400 shrink-0">{stop.time}</span>}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </details>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Footer: Tags & Button */}
                                                        <div className="flex items-center justify-between mt-auto">
                                                            <div className="flex gap-2">
                                                                {isFastest && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">最速</span>}
                                                                {route.transportMode === TransportMode.WALKING &&
                                                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded">健康</span>
                                                                }
                                                            </div>
                                                            {isSelected && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); startNavigation(route); }}
                                                                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
                                                                >
                                                                    ガイドを開始
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}

                                        <div className="h-20"></div>

                                    </div>
                                )}
                            </div>
                        </div >
                    )
                }

                {/* NAVIGATION MODE - Overlay */}
                {
                    mode === AppMode.NAVIGATING && (selectedRoute || selectedRoute) && (
                        <>
                            {/* Location Simulator Control Panel (Dev Mode Only) */}
                            {devMode && (
                                <div
                                    className="absolute z-50 bg-white/95 backdrop-blur-md rounded-xl shadow-lg px-3 py-2 border border-gray-200 select-none"
                                    style={{ left: simulatorPos.x, top: simulatorPos.y }}
                                >
                                    {/* Drag Handle */}
                                    <div
                                        className="text-[10px] font-bold text-gray-500 mb-1.5 cursor-grab active:cursor-grabbing flex items-center gap-2"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSimulatorDragStart(e.clientX, e.clientY);
                                            const onMove = (ev: MouseEvent) => handleSimulatorDragMove(ev.clientX, ev.clientY);
                                            const onUp = () => {
                                                handleSimulatorDragEnd();
                                                document.removeEventListener('mousemove', onMove);
                                                document.removeEventListener('mouseup', onUp);
                                            };
                                            document.addEventListener('mousemove', onMove);
                                            document.addEventListener('mouseup', onUp);
                                        }}
                                        onTouchStart={(e) => {
                                            handleSimulatorDragStart(e.touches[0].clientX, e.touches[0].clientY);
                                        }}
                                        onTouchMove={(e) => {
                                            handleSimulatorDragMove(e.touches[0].clientX, e.touches[0].clientY);
                                        }}
                                        onTouchEnd={handleSimulatorDragEnd}
                                    >
                                        <span className="text-gray-400">⋮⋮</span>
                                        位置シミュレーター
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!locationSimulator.state.isRunning ? (
                                            <button
                                                onClick={startLocationSimulation}
                                                className="px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
                                            >
                                                <PlayIcon className="w-3 h-3" /> 開始
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={locationSimulator.pause}
                                                    className="px-2 py-1.5 bg-yellow-500 text-white text-xs font-bold rounded-lg hover:bg-yellow-600 transition-colors"
                                                >
                                                    ⏸
                                                </button>
                                                <button
                                                    onClick={locationSimulator.stop}
                                                    className="px-2 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                                                >
                                                    ⏹
                                                </button>
                                            </>
                                        )}
                                        <div className="flex items-center gap-1 ml-1">
                                            <button
                                                onClick={() => locationSimulator.setSpeed(locationSimulator.state.speed / 2)}
                                                className="w-6 h-6 bg-gray-200 text-gray-700 text-xs font-bold rounded hover:bg-gray-300"
                                            >−</button>
                                            <span className="text-[10px] font-mono w-8 text-center">{locationSimulator.state.speed}x</span>
                                            <button
                                                onClick={() => locationSimulator.setSpeed(locationSimulator.state.speed * 2)}
                                                className="w-6 h-6 bg-gray-200 text-gray-700 text-xs font-bold rounded hover:bg-gray-300"
                                            >+</button>
                                        </div>
                                    </div>
                                    {locationSimulator.state.isRunning && (
                                        <div className="mt-1.5">
                                            <div className="w-full bg-gray-200 rounded-full h-1">
                                                <div
                                                    className="bg-indigo-500 h-1 rounded-full transition-all duration-100"
                                                    style={{ width: `${locationSimulator.state.progress}%` }}
                                                ></div>
                                            </div>
                                            <div className="text-[9px] text-gray-500 mt-0.5 flex justify-between items-center">
                                                <span className={`px-1.5 py-0.5 rounded text-white font-bold ${locationSimulator.state.currentTransportMode === 'TRAIN' ? 'bg-blue-500' :
                                                    locationSimulator.state.currentTransportMode === 'SUBWAY' ? 'bg-purple-500' :
                                                        locationSimulator.state.currentTransportMode === 'BUS' ? 'bg-green-500' :
                                                            'bg-gray-500'
                                                    }`}>
                                                    {locationSimulator.state.currentTransportMode === 'TRAIN' ? '🚃 電車' :
                                                        locationSimulator.state.currentTransportMode === 'SUBWAY' ? '🚇 地下鉄' :
                                                            locationSimulator.state.currentTransportMode === 'BUS' ? '🚌 バス' :
                                                                '🚶 徒歩'}
                                                </span>
                                                <span>{Math.round(locationSimulator.state.progress)}%</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}



                            {/* Guide Slider UI (Always Visible) */}
                            {/* Guide Slider UI (Bottom Sheet) */}
                            <div className="absolute inset-0 z-20 pointer-events-none">
                                <div className="relative w-full h-full">
                                    <GuideSlider
                                        guides={nearbyGuides}
                                        loading={loading}
                                        onPlayAudio={(guide) => handlePlayAudio(guide.text)}
                                        onStopAudio={stopCurrentAudio}
                                        isPlaying={isPlaying}
                                        onCurrentGuideChange={(guide) => setHighlightedGuideSpotId(guide?.spotId || null)}
                                        onComplete={handleEndNavigation}
                                        showCompletion={isArrived}
                                    />
                                </div>
                            </div>
                        </>
                    )
                }

                {/* DESTINATION MODE - Full Screen Overlay */}
                {
                    mode === AppMode.DESTINATION && selectedSpot && (
                        <div className="absolute inset-0 z-30 flex flex-col overflow-hidden">
                            {/* Blurred Background Image */}
                            {selectedSpot.imageUrl && (
                                <div className="absolute inset-0 z-0">
                                    <img
                                        src={selectedSpot.imageUrl}
                                        alt=""
                                        className="w-full h-full object-cover blur-md scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gray-900/60" />
                                </div>
                            )}

                            {/* Blurred Gray Overlay (Fallback / Additional Tint) */}
                            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm z-0"></div>

                            {/* Top Section - Arrival Info (Overlay) */}
                            <div className="relative z-10 text-left pt-6 px-6 pb-2 shrink-0 bg-gradient-to-b from-gray-900 via-gray-900/80 to-transparent">
                                <div className="inline-block px-3 py-1 bg-white/10 backdrop-blur rounded-full text-[10px] text-white/80 font-bold tracking-widest uppercase border border-white/10 mb-2">
                                    到着
                                </div>
                                <h2 className="text-2xl font-bold text-white font-serif mb-4">{selectedSpot.name}</h2>
                            </div>

                            {/* Main Content - Guide Text / Description (Scrollable with Fade) */}
                            <div className="relative z-10 flex-1 px-6 overflow-hidden">
                                <div className="w-full h-full overflow-y-auto custom-scrollbar pb-32">
                                    {guideText ? (
                                        <div className="text-white/90 font-medium text-lg leading-loose font-serif">
                                            <LyricsReader text={guideText} isPlaying={isPlaying} duration={audioDuration} theme="light" />
                                        </div>
                                    ) : selectedSpot.description ? (
                                        <div className="text-white/90 font-medium text-lg leading-loose font-serif">
                                            {selectedSpot.description}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-white/60 py-4">
                                            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white/80 animate-spin"></div>
                                            <span className="text-sm">ガイドを読み込み中...</span>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Fade Out Overlay - Only show when Lyrics are active (guideText exists) */}
                                {guideText && (
                                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent pointer-events-none"></div>
                                )}
                            </div>

                            {/* Bottom Section - Controls and Spots (Overlay) */}
                            <div className="relative z-10 px-4 pb-24 shrink-0 bg-gradient-to-t from-gray-900/90 via-gray-900/70 to-transparent pt-8">
                                {/* Audio Control */}
                                {(guideText || selectedSpot.description) && (
                                    <button
                                        onClick={() => handlePlayAudio(guideText || selectedSpot.description)}
                                        disabled={isPlaying}
                                        className="mx-auto mb-3 px-6 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 text-white rounded-full text-sm font-bold transition-all flex items-center gap-2 border border-white/20"
                                    >
                                        <PlayIcon className="w-4 h-4" />
                                        {isPlaying ? '再生中...' : 'もう一度聞く'}
                                    </button>
                                )}

                                {/* Nearby Spots by Congestion Level - All 5 levels */}
                                <div className="shrink-0 bg-white/10 backdrop-blur rounded-2xl p-3 mb-3 border border-white/10">
                                    <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-2">周辺のおすすめスポット</h3>
                                    <div className="space-y-1.5">
                                        {(() => {
                                            const getDistance = (spot: Spot) => {
                                                const R = 6371;
                                                const dLat = (spot.location.latitude - selectedSpot.location.latitude) * Math.PI / 180;
                                                const dLon = (spot.location.longitude - selectedSpot.location.longitude) * Math.PI / 180;
                                                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                                    Math.cos(selectedSpot.location.latitude * Math.PI / 180) * Math.cos(spot.location.latitude * Math.PI / 180) *
                                                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                            };

                                            const congestionLabels = ['快適', 'やや快適', '通常', 'やや混雑', '混雑'];
                                            const congestionColors = ['bg-blue-400', 'bg-cyan-400', 'bg-green-400', 'bg-yellow-400', 'bg-red-400'];

                                            // Filter spots with congestion level <= 3 (1:快適, 2:やや快適, 3:通常) and sort by distance explicitly
                                            const recommendedSpots = spots
                                                .filter(s => s.id !== selectedSpot.id && s.congestionLevel <= 3)
                                                .sort((a, b) => getDistance(a) - getDistance(b))
                                                .slice(0, 3);

                                            return recommendedSpots.map(spot => {
                                                const level = spot.congestionLevel;
                                                return (
                                                    <button
                                                        key={spot.id}
                                                        onClick={() => {
                                                            stopCurrentAudio();
                                                            setMode(AppMode.PLANNING);
                                                            setSelectedSpot(spot);
                                                            setSelectedRoute(null);
                                                            setRouteOptions([]);
                                                            setHideOtherPins(false);
                                                            setFocusedSpotId(`${spot.id}-${Date.now()}`);
                                                            setGuideText("");
                                                        }}
                                                        className="w-full flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-left"
                                                    >
                                                        <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold text-white ${congestionColors[level - 1]}`}>
                                                            {congestionLabels[level - 1]}
                                                        </div>
                                                        <span className="text-xs text-white/90 flex-1 truncate">{spot.name}</span>
                                                        <span className="text-[10px] text-white/50 shrink-0">{(getDistance(spot) * 1000).toFixed(0)}m</span>
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>

                                {/* Finish Button */}
                                <button
                                    onClick={() => {
                                        stopCurrentAudio();
                                        setMode(AppMode.LANDING);
                                        setSpots([]);
                                        setSelectedSpot(null);
                                        setSelectedRoute(null);
                                        setGuideText("");
                                    }}
                                    className="shrink-0 w-full py-3 bg-white text-gray-900 rounded-2xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    終了
                                </button>
                            </div>
                        </div>
                    )
                }

            </main >

            {/* Tutorial Interaction Blocker - prevents clicking real buttons during tutorial */}
            {tutorial.isDemoMode && (
                <div
                    className="absolute inset-0 z-[85]"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                />
            )}

            {/* Recenter Button (Global Overlay) */}
            {
                mode !== AppMode.LANDING && mode !== AppMode.DESTINATION && (
                    <button

                        onClick={() => setRecenterTrigger(prev => prev + 1)}
                        className="absolute right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all border border-gray-200 overflow-hidden"
                        style={{
                            zIndex: 10,
                            top: (mode === AppMode.NAVIGATING) ? '7rem' : '1rem'
                        }}
                        title="現在地に戻る"
                    >
                        <div className="w-full h-full">
                            <Canvas
                                camera={{ position: [0, 1.5, 3], fov: 45 }}
                                gl={{ alpha: true, antialias: true }}
                            >
                                <ambientLight intensity={1.5} />
                                <directionalLight position={[5, 10, 5]} intensity={2} />
                                <PersonMarker position={[0, -0.8, 0] as [number, number, number]} scale={1.5} isStatic={true} />
                            </Canvas>
                        </div>
                    </button>
                )
            }

            {/* Interactive Tutorial Guide */}
            {tutorial.isActive && tutorial.currentStep && (
                <TutorialGuide
                    step={tutorial.currentStep}
                    stepIndex={tutorial.stepIndex}
                    totalSteps={tutorial.totalSteps}
                    isLoading={loading}
                    onNext={() => {
                        if (tutorial.stepIndex === tutorial.totalSteps - 1) {
                            setMode(AppMode.LANDING);
                            setSpots([]);
                            setSelectedSpot(null);
                            setSelectedRoute(null);
                            setRouteOptions([]);
                            setFocusedSpotId(null);
                            setGuideText("");
                            locationSimulator.stop();
                            stopCurrentAudio();
                        }
                        tutorial.nextStep();
                    }}
                    onSkip={() => {
                        setMode(AppMode.LANDING);
                        setSpots([]);
                        setSelectedSpot(null);
                        setSelectedRoute(null);
                        setRouteOptions([]);
                        setFocusedSpotId(null);
                        setGuideText("");
                        locationSimulator.stop();
                        stopCurrentAudio();
                        tutorial.skipTutorial();
                    }}
                />
            )}
        </div >
    );
}

export default App;
