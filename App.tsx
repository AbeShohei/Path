import React, { useState, useEffect, useRef } from 'react';
import { Coordinates, AppMode, Spot, TransportMode, GroundingChunk, RouteOption, RouteSegment, TransitUpdate } from './types';
import { getTransitInfo, generateGuideContent, playTextToSpeech, getRouteOptions } from './services/geminiService';
import { findNearbySpots, filterSpotsNearRoute, getDistanceFromLatLonInKm } from './services/spotService';
import Map from './components/Map';
import LyricsReader from './components/LyricsReader';

// SVG Icons
const MapPinIcon = ({ className = "w-5 h-5" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const WalkIcon = ({ className = "w-5 h-5" }: { className?: string }) => <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2V8.9z" /></svg>;
const BusIcon = ({ className = "w-5 h-5" }: { className?: string }) => <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h11v5z" /></svg>;
const TrainIcon = ({ className = "w-5 h-5" }: { className?: string }) => <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" /></svg>;
const SpeakerIcon = ({ className = "w-5 h-5" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>;
const MuteIcon = ({ className = "w-5 h-5" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>;
const PlayIcon = ({ className = "w-5 h-5" }: { className?: string }) => <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>;
const RefreshIcon = ({ className = "w-5 h-5" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const ArrowRightIcon = ({ className = "w-3 h-3 text-gray-400" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;
const SwapIcon = () => <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
const ChevronLeftIcon = ({ className = "w-6 h-6" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
const ChevronDownIcon = ({ className = "w-6 h-6" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
const ChevronUpIcon = ({ className = "w-6 h-6" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;
const ClockIcon = ({ className = "w-4 h-4" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

// Navigation Stages
type NavigationStage = 'TO_STOP' | 'ON_BUS' | 'ALIGHTING' | 'TO_DEST';

// Durations in Milliseconds for Simulation (and for Audio generation hint)
const STAGE_DURATIONS = {
    TO_STOP: 40000,   // 40s
    ON_BUS: 45000,    // 45s
    ALIGHTING: 20000, // 20s
    TO_DEST: 30000    // 30s
};

// Helper to parse "X時間Y分" to seconds (e.g. "17分" -> 1020)
const parseDurationStr = (str: string | undefined): number => {
    if (!str) return 30;
    let total = 0;
    const hourMatch = str.match(/(\d+)時間/);
    if (hourMatch) total += parseInt(hourMatch[1]) * 3600;
    const minMatch = str.match(/(\d+)分/);
    if (minMatch) total += parseInt(minMatch[1]) * 60;
    return total > 0 ? total : 30; // Minimum 30s fallback
};

function App() {
    const [mode, setMode] = useState<AppMode>(AppMode.LANDING);
    const [coords, setCoords] = useState<Coordinates | null>(null);
    const [spots, setSpots] = useState<Spot[]>([]);
    const [selectedCongestion, setSelectedCongestion] = useState<number[]>([1, 2, 3]); // Default: Comfortable, Somewhat Comfortable, Normal
    const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
    const [focusedSpotId, setFocusedSpotId] = useState<string | null>(null);  // For list click pan+popup
    const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
    const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
    const [showRouteDetail, setShowRouteDetail] = useState(false); // Separate state for showing detail view
    const [showAudioPrompt, setShowAudioPrompt] = useState(false);
    const [isSheetMinimized, setIsSheetMinimized] = useState(false);
    const [routeSheetState, setRouteSheetState] = useState<'minimized' | 'default' | 'full'>('default');
    const [routeTab, setRouteTab] = useState<'RECOMMENDED' | 'TRANSIT' | 'WALKING'>('RECOMMENDED');
    const [showNavRouteDetail, setShowNavRouteDetail] = useState(false); // Route detail during navigation
    const [lyricsHeight, setLyricsHeight] = useState(100); // Lyrics area height in pixels

    // Sheet Drag State
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef(0);
    const sheetStartHeight = useRef(0);
    const sheetRef = useRef<HTMLDivElement>(null);

    // Lyrics Drag State
    const [isLyricsDragging, setIsLyricsDragging] = useState(false);
    const lyricsDragStartY = useRef(0);
    const lyricsStartHeight = useRef(0);

    // Navigation State
    const [navStage, setNavStage] = useState<NavigationStage>('TO_STOP');
    const [stopsAway, setStopsAway] = useState(5); // Simulation state
    const [remainingSeconds, setRemainingSeconds] = useState(0); // Countdown timer
    const [toastMessage, setToastMessage] = useState<string | null>(null); // Visual notification for stage change

    const [loading, setLoading] = useState(false);
    const [guideText, setGuideText] = useState("");
    const [transitInfo, setTransitInfo] = useState<TransitUpdate | null>(null);

    // Audio Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [audioDuration, setAudioDuration] = useState(0);
    const currentAudioController = useRef<{ stop: () => void } | null>(null);

    const congestionOptions = [
        { level: 1, label: '快適', color: 'bg-blue-500' },
        { level: 2, label: 'やや快適', color: 'bg-cyan-500' },
        { level: 3, label: '通常', color: 'bg-green-500' },
        { level: 4, label: 'やや混雑', color: 'bg-yellow-500' },
        { level: 5, label: '混雑', color: 'bg-red-500' }
    ];

    // 1. Get Location
    const requestLocation = () => {
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
        setLoading(true);
        // Simulate slight delay for realism
        setTimeout(() => {
            // Fetch all spots (use large radius to include all)
            const nearbySpots = findNearbySpots(pos, 9999);
            setSpots(nearbySpots);
            setMode(AppMode.PLANNING);
            setIsSheetMinimized(false);
            setLoading(false);
        }, 600);
    };

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

    const handleSpotSelect = async (spot: Spot) => {
        setSelectedSpot(spot);
        setIsSheetMinimized(true); // Minimize sheet to show popup/pin clearly
        // Use timestamp to ensure re-trigger even for same spot
        setFocusedSpotId(`${spot.id}-${Date.now()}`);
    };

    // Force sheet open when navigation starts
    useEffect(() => {
        if (mode === AppMode.NAVIGATING) {
            setIsSheetMinimized(false);
        }
    }, [mode]);

    // Calculate derived state for visible spots based on selected route
    // Calculate derived state for visible spots based on selected route
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

        if ((mode === AppMode.ROUTE_SELECT || mode === AppMode.NAVIGATING) && selectedRoute?.path) {
            // Filter spots near the selected route
            const nearbySpots = filterSpotsNearRoute(spots, selectedRoute.path, 0.05); // 50m radius
            // Always include destination spot if it exists
            if (selectedSpot && !nearbySpots.find(s => s.id === selectedSpot.id)) {
                nearbySpots.push(selectedSpot);
            }
            return nearbySpots;
        }
        // Filter by congestion level, then sort by congestion (ascending) and distance (ascending)
        return spots
            .filter(s => selectedCongestion.includes(s.congestionLevel))
            .sort((a, b) => {
                // Primary: congestion level (lower is better)
                if (a.congestionLevel !== b.congestionLevel) {
                    return a.congestionLevel - b.congestionLevel;
                }
                // Secondary: distance (closer is better)
                return getDistance(a) - getDistance(b);
            });
    }, [mode, selectedRoute, spots, selectedSpot, selectedCongestion, coords]);

    // ルート検索を開始（InfoWindowの「ルートを見る」ボタンから呼ばれる）
    // ルート検索を開始（InfoWindowの「ルートを見る」ボタンから呼ばれる）
    const handleRouteSearch = async (spot: Spot) => {
        setSelectedSpot(spot);
        setMode(AppMode.ROUTE_SELECT);
        setLoading(true);
        setRouteSheetState('default');
        setShowRouteDetail(false); // Start on comparison screen, not detail view
        setRouteTab('RECOMMENDED'); // Reset tab

        // Use current location if available, otherwise fallback to Kyoto Station
        const kyotoStation = { latitude: 34.9858, longitude: 135.7588 };
        const originCoords = coords || kyotoStation;
        const originName = coords ? "現在地" : "京都駅";

        const fetchedRoutes = await getRouteOptions(
            originName,
            spot.name,
            originCoords,
            spot.location
        );

        setRouteOptions(fetchedRoutes);

        // Auto-select first route to show it by default
        if (fetchedRoutes.length > 0) {
            setSelectedRoute(fetchedRoutes[0]);
        }

        setLoading(false);
    };

    // 4. Start Navigation (Trigger Prompt)
    const startNavigation = (route: RouteOption) => {
        setSelectedRoute(route);
        setShowAudioPrompt(true);
    };

    // Confirm and start
    const confirmNavigation = (enableAudio: boolean) => {
        setShowAudioPrompt(false);
        setIsMuted(!enableAudio);
        stopCurrentAudio();

        // UNLOCK AUDIO ENGINE: Play a short sound immediately on user interaction
        // This is required for mobile browsers (iOS/Android) to allow subsequent auto-play
        if (enableAudio) {
            playTextToSpeech("ナビゲーションを開始します");
        }

        setMode(AppMode.NAVIGATING);
        setNavStage('TO_STOP');
        setStopsAway(5);
        setGuideText("");
        setTransitInfo(null);
        setAudioDuration(0);
        // Initialize timer with actual segment duration from route
        const firstSegmentDuration = selectedRoute?.segments?.[0]?.duration;
        const initialSeconds = parseDurationStr(firstSegmentDuration) || STAGE_DURATIONS['TO_STOP'] / 1000;
        setRemainingSeconds(initialSeconds);
        // Reset lyrics widget to readable size
        setLyricsHeight(180);
        setIsSheetMinimized(false); // Ensure sheet is open
        showToast("ナビゲーションを開始します");
    };

    // Stop current audio helper
    const stopCurrentAudio = () => {
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
    }

    // --- AUTOMATED JOURNEY SIMULATION (1-second tick) ---
    useEffect(() => {
        if (mode !== AppMode.NAVIGATING || !selectedRoute) return;

        // Use interval for 1s ticks to update UI timer
        const interval = setInterval(() => {
            // Decrease timer
            setRemainingSeconds(prev => {
                const next = prev - 1;

                // Check for transition
                if (next <= 0) {
                    // If audio is playing, wait (don't transition yet)
                    // In a real app we might wait, but for simulation let's ensure we wait at least for audioDuration
                    // However, the countdown was initialized with MAX(stageDuration, audioDuration) in logic below?
                    // Actually, let's just transition when timer hits 0, assuming timer was set correctly.

                    // Logic to switch stages
                    if (navStage === 'TO_STOP') {
                        showToast("バスが到着しました。乗車します。");
                        changeStage('ON_BUS');
                        setStopsAway(4);
                        return getSegmentDurationForStage('ON_BUS');
                    } else if (navStage === 'ON_BUS') {
                        showToast("まもなく目的地付近のバス停です。");
                        changeStage('ALIGHTING');
                        return getSegmentDurationForStage('ALIGHTING');
                    } else if (navStage === 'ALIGHTING') {
                        showToast("降車しました。目的地へ向かいます。");
                        changeStage('TO_DEST');
                        return getSegmentDurationForStage('TO_DEST');
                    } else if (navStage === 'TO_DEST') {
                        // Stay at 0
                        return 0;
                    }
                }

                // Special logic for ON_BUS stops update
                if (navStage === 'ON_BUS') {
                    const totalDuration = getSegmentDurationForStage('ON_BUS');
                    // Update stops every 20% of the way
                    const progress = 1 - (next / totalDuration); // 0 to 1
                    const newStops = Math.max(1, 5 - Math.floor(progress * 5));
                    if (newStops !== stopsAway) {
                        setStopsAway(newStops);
                    }
                }

                return next;
            });

        }, 1000);

        return () => clearInterval(interval);
    }, [mode, navStage, selectedRoute]); // Removed dependencies that change too often to avoid reset

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


    // --- AUTO GUIDE GENERATION & AUDIO CONTROL ---
    useEffect(() => {
        if (mode !== AppMode.NAVIGATING || !selectedRoute) return;

        const autoGenerate = async () => {
            // Determine exact duration for the AI to speak based on Actual Route Segment
            let durationSec = STAGE_DURATIONS[navStage] / 1000; // Default fallback

            if (selectedRoute.segments) {
                if (navStage === 'TO_STOP') {
                    // First segment (Walking to start)
                    durationSec = parseDurationStr(selectedRoute.segments[0]?.duration);
                } else if (navStage === 'ON_BUS') {
                    // Main Transit Segment
                    const transitSeg = selectedRoute.segments.find(s => ['BUS', 'SUBWAY', 'TRAIN'].includes(s.type));
                    durationSec = parseDurationStr(transitSeg?.duration);
                } else if (navStage === 'TO_DEST') {
                    // Last segment (Walking to destination)
                    durationSec = parseDurationStr(selectedRoute.segments[selectedRoute.segments.length - 1]?.duration);
                }
                // ALIGHTING uses default short duration (20s)
            }

            // Play audio automatically
            await handleGenerateGuide(selectedRoute, navStage, durationSec, true);

            // Set Transit Info Mockup
            if (navStage === 'TO_STOP') {
                setTransitInfo({
                    status: 'ON_TIME',
                    stopsAway: 1,
                    currentLocation: '接近中',
                    nextBusTime: 'まもなく',
                    message: 'まもなく到着'
                });
            } else if (navStage === 'ON_BUS') {
                setTransitInfo({
                    status: 'ON_TIME',
                    stopsAway: stopsAway,
                    currentLocation: '移動中',
                    nextBusTime: '10:45',
                    message: '定刻通り運行中'
                });
            }
        };

        autoGenerate();
    }, [navStage, mode]);


    // 5. Gemini Actions in Navigation
    const handleGenerateGuide = async (routeOverride?: RouteOption, stageOverride?: NavigationStage, durationSeconds: number = 30, isAutoPlay: boolean = false) => {
        const route = routeOverride || selectedRoute;
        const stage = stageOverride || navStage;
        if (!selectedSpot || !route) return;

        setLoading(true);

        // Create detailed context
        let context = `目的地: ${selectedSpot.name}。ルート: ${route.title}。`;
        if (stage === 'ON_BUS') {
            context += `現在、バスに乗車中です。目的地まであと${stopsAway}駅です。`;
        }

        const text = await generateGuideContent(context, stage, durationSeconds);
        setLoading(false);
        setGuideText(text);

        // Only auto-play if still in navigation mode
        if (text && isAutoPlay && mode === AppMode.NAVIGATING) {
            handlePlayAudio(text);
        }
    };

    const handlePlayAudio = async (text: string) => {
        if (!text) return;

        stopCurrentAudio(); // Double safety

        // If muted, we simulate playback for visual guide aka "Karaoke Mode"
        if (isMuted) {
            // Estimate duration: ~5 chars per second for Japanese
            // Minimum 3 seconds to ensure readability
            const estimatedDuration = Math.max(text.length / 5, 3);

            setIsPlaying(true);
            setAudioDuration(estimatedDuration);

            // Auto reset playing state
            setTimeout(() => {
                setIsPlaying(false);
            }, estimatedDuration * 1000 + 500);

            return;
        }

        setIsPlaying(true);
        const { duration, stop } = await playTextToSpeech(text);

        currentAudioController.current = { stop };
        setAudioDuration(duration);

        // Auto reset playing state
        setTimeout(() => {
            setIsPlaying(false);
            if (currentAudioController.current?.stop === stop) {
                currentAudioController.current = null;
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
        setMode(AppMode.DESTINATION);
        handleGenerateDestinationGuide(true);
    };

    const handleGenerateDestinationGuide = async (isAutoPlay: boolean = false) => {
        if (!selectedSpot) return;
        setLoading(true);
        // 60 seconds for destination guide
        const text = await generateGuideContent(`ユーザーは${selectedSpot.name}に到着しました。この場所の歴史的背景、見どころ、参拝のマナーなどを案内してください。`, 'TO_DEST', 60);
        setLoading(false);
        setGuideText(text);

        // Only auto-play if still in destination mode
        if (text && isAutoPlay && mode === AppMode.DESTINATION) {
            handlePlayAudio(text);
        }
    };

    const goBackToPlanning = () => {
        stopCurrentAudio();
        setMode(AppMode.PLANNING);
        setIsSheetMinimized(false);
        setSelectedSpot(null);
        setRouteOptions([]);
        setSelectedRoute(null);
        setShowRouteDetail(false);
        setGuideText("");
        setIsPlaying(false);
    };

    // Helper to calculate arrival time dynamically
    const getDynamicArrivalTime = (secondsToAdd: number) => {
        const now = new Date();
        const arrival = new Date(now.getTime() + secondsToAdd * 1000);
        return `${arrival.getHours()}:${arrival.getMinutes().toString().padStart(2, '0')}`;
    };

    // Helper component for segment icon
    const SegmentIcon = ({ type, className }: { type: string, className?: string }) => {
        if (type === 'BUS') return <BusIcon className={className} />;
        if (type === 'TRAIN' || type === 'SUBWAY') return <TrainIcon className={className} />;
        return <WalkIcon className={className} />;
    };

    // Helper to get time info for current stage
    const getStageTimeInfo = () => {
        if (!selectedRoute) return null;

        // Dynamic countdown display: Remove seconds, just use ceil minutes
        const mins = Math.ceil(remainingSeconds / 60);
        const timeStr = `${mins}分`;
        const arrivalTime = getDynamicArrivalTime(remainingSeconds);

        if (navStage === 'TO_STOP') {
            return `バス停へ移動中 (あと ${timeStr}) - ${arrivalTime}着`;
        }
        if (navStage === 'ON_BUS') {
            return `乗車中 (あと ${timeStr}) - ${arrivalTime}着予定`;
        }
        if (navStage === 'ALIGHTING') {
            return `まもなく到着 (あと ${timeStr})`;
        }
        if (navStage === 'TO_DEST') {
            return `目的地へ移動中 (あと ${timeStr}) - ${arrivalTime}着`;
        }
        return null;
    };

    // DRAG HANDLERS
    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        dragStartY.current = e.clientY;
        if (sheetRef.current) {
            const rect = sheetRef.current.getBoundingClientRect();
            sheetStartHeight.current = rect.height;
            // Capture pointer to track dragging even if mouse leaves element
            (e.target as Element).setPointerCapture(e.pointerId);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !sheetRef.current) return;

        const deltaY = dragStartY.current - e.clientY; // positive = up, negative = down
        const newHeight = sheetStartHeight.current + deltaY;

        // Apply constraints roughly
        const minHeight = 88;
        const maxHeight = window.innerHeight * 0.6;

        if (newHeight >= minHeight && newHeight <= maxHeight) {
            sheetRef.current.style.height = `${newHeight}px`;
            // Disable transition during drag for responsiveness
            sheetRef.current.style.transition = 'none';
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging) return;
        setIsDragging(false);
        (e.target as Element).releasePointerCapture(e.pointerId);

        if (sheetRef.current) {
            // Restore transition
            sheetRef.current.style.transition = '';
            sheetRef.current.style.height = ''; // Let class control height again

            const deltaY = dragStartY.current - e.clientY;

            // Snap logic
            if (deltaY < -50) {
                // Dragged down significantly -> Minimize
                setIsSheetMinimized(true);
            } else if (deltaY > 50) {
                // Dragged up significantly -> Expand
                setIsSheetMinimized(false);
            } else {
                // Small drag/Tap -> Toggle
                if (Math.abs(deltaY) < 10) {
                    setIsSheetMinimized(prev => !prev);
                } else {
                    // Revert to current state logic (re-render will fix height via class)
                }
            }
        }
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

        // Constrain between 60px and 180px to keep widget on screen
        const clampedHeight = Math.max(60, Math.min(180, newHeight));
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
            {showAudioPrompt && (
                <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl transform scale-100 transition-all">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                <SpeakerIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">音声ガイドを利用しますか？</h3>
                                <p className="text-gray-500 text-sm mt-2">
                                    移動に合わせてAIが音声で案内します。<br />
                                    音量は端末で調整してください。
                                </p>
                            </div>
                            <div className="flex gap-3 w-full mt-2">
                                <button
                                    onClick={() => confirmNavigation(false)}
                                    className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    オフにする
                                </button>
                                <button
                                    onClick={() => confirmNavigation(true)}
                                    className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors"
                                >
                                    オンにする
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Header */}
            {mode !== AppMode.LANDING && mode !== AppMode.ROUTE_SELECT && mode !== AppMode.PLANNING && (
                <header className="bg-indigo-900/95 backdrop-blur-md text-white px-4 py-3 sticky top-0 z-40 shadow-sm flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 overflow-hidden w-full">
                        <button onClick={goBackToPlanning} className="p-1 -ml-1 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors shrink-0">
                            <ChevronLeftIcon />
                        </button>
                        <div className="truncate flex-1">
                            <h1 className="text-sm font-bold opacity-90 tracking-wide uppercase">Path</h1>
                            {selectedSpot && (
                                <div className="text-base font-bold truncate leading-tight">{selectedSpot.name}</div>
                            )}
                        </div>
                        {(mode === AppMode.NAVIGATING || mode === AppMode.DESTINATION) && (
                            <button onClick={toggleMute} className={`p-2 rounded-full hover:bg-white/10 transition-colors ${isMuted ? 'text-red-300' : 'text-white'}`}>
                                {isMuted ? <MuteIcon /> : <SpeakerIcon />}
                            </button>
                        )}
                    </div>
                </header>
            )}

            {/* Content Area */}
            <main className={`flex-1 relative w-full ${mode === AppMode.PLANNING ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} ${mode === AppMode.ROUTE_SELECT ? "bg-white" : ""}`}>

                {/* Map Background */}
                <div className="absolute inset-0 z-0">
                    <Map
                        center={coords || { latitude: 34.9858, longitude: 135.7588 }}
                        spots={visibleSpots}
                        onSelectSpot={handleRouteSearch}
                        onPinClick={() => setIsSheetMinimized(true)}
                        selectedSpotId={selectedSpot?.id}
                        focusedSpotId={focusedSpotId || undefined}
                        selectedRoute={selectedRoute}
                        routeOptions={routeOptions} // Pass all routes
                    />
                </div>

                {/* LANDING MODE */}
                {mode === AppMode.LANDING && (
                    <div className="relative h-full flex flex-col items-center justify-end pb-20 text-center">
                        {/* Background Image */}
                        <div className="absolute inset-0 z-0">
                            <img
                                src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2000&auto=format&fit=crop"
                                alt="Kyoto Street"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-indigo-900 via-indigo-900/40 to-transparent"></div>
                        </div>

                        <div className="relative z-10 w-full px-6 space-y-8 animate-fade-in-up">
                            <div className="space-y-4">
                                <p className="text-indigo-200 text-sm tracking-[0.2em] uppercase font-bold">スマートツーリズム</p>
                                <h1 className="text-6xl font-bold text-white font-serif tracking-tighter drop-shadow-md">Path</h1>
                                <p className="text-white/80 font-light text-lg tracking-widest">京都観光案内ガイド</p>
                            </div>

                            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-left shadow-2xl">
                                <p className="text-white text-sm leading-relaxed mb-6 opacity-90">
                                    AIがあなただけのガイドに。<br />
                                    現在地から最適な観光スポットとルートを提案し、その場の歴史を語ります。
                                </p>
                                <button
                                    onClick={requestLocation}
                                    disabled={loading}
                                    className="w-full bg-white text-indigo-900 font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                                >
                                    {loading ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-indigo-900 border-t-transparent rounded-full animate-spin"></div>
                                            <span>位置情報を取得中...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <MapPinIcon className="w-5 h-5" />
                                            <span>京都駅から始める</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* PLANNING MODE UI */}
                {mode === AppMode.PLANNING && coords && (
                    <div className="w-full h-full relative pointer-events-none">
                        {/* Legend 5 Levels - Make pointer-events-auto */}
                        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg px-2 py-2 shadow-lg z-[1] border border-gray-200/50 pointer-events-auto">
                            <div className="font-bold mb-1.5 text-center text-gray-500 text-[9px] uppercase tracking-wider">混雑状況</div>
                            <div className="flex gap-1.5">
                                <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-white text-[10px] shadow-sm">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>
                                </div>
                                <div className="w-6 h-6 rounded bg-cyan-500 flex items-center justify-center text-white text-[10px] shadow-sm">
                                    <div className="flex -space-x-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg></div>
                                </div>
                                <div className="w-6 h-6 rounded bg-green-500 flex items-center justify-center text-white text-[10px] shadow-sm">
                                    <div className="flex -space-x-2"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg></div>
                                </div>
                                <div className="w-6 h-6 rounded bg-yellow-500 flex items-center justify-center text-white text-[10px] shadow-sm">
                                    <div className="flex -space-x-2"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg></div>
                                </div>
                                <div className="w-6 h-6 rounded bg-red-500 flex items-center justify-center text-white text-[10px] shadow-sm">
                                    <div className="flex -space-x-2"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg></div>
                                </div>
                            </div>
                            <div className="w-full h-1 bg-gradient-to-r from-blue-500 via-green-500 to-red-500 mt-2 rounded-full opacity-50"></div>
                        </div>

                        {/* List Sheet - Now Draggable */}
                        <div
                            ref={sheetRef}
                            className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-10 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] pointer-events-auto ${isSheetMinimized ? 'h-[88px]' : 'h-[45%] max-h-[500px]'}`}
                        >
                            {/* Drag Handle Area */}
                            <div
                                className="w-full pt-3 pb-1 flex justify-center shrink-0 cursor-grab active:cursor-grabbing hover:bg-gray-50 rounded-t-[32px] transition-colors touch-none"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                            >
                                <div className="w-12 h-1.5 bg-gray-300 rounded-full opacity-50 pointer-events-none"></div>
                            </div>

                            <div className="px-6 pb-2 shrink-0 bg-white z-20 space-y-3 pointer-events-none">
                                <div className="flex items-center justify-between pointer-events-auto">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-800">近くの観光スポット</h2>
                                        <p className={`text-sm text-gray-400 transition-opacity duration-200 ${isSheetMinimized ? 'opacity-0 h-0' : 'opacity-100'}`}>{visibleSpots.length}件のスポットが見つかりました</p>
                                    </div>
                                </div>

                                {/* Congestion Filter */}
                                <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 transition-all duration-300 pointer-events-auto ${isSheetMinimized ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'}`}>
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

                            <div className={`flex-1 overflow-y-auto p-4 pt-0 space-y-4 custom-scrollbar transition-opacity duration-300 ${isSheetMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                {loading ? (
                                    <div className="flex items-center justify-center h-32 text-gray-400 gap-2">
                                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-sm">スポットを探しています...</span>
                                    </div>
                                ) : visibleSpots.length > 0 ? (
                                    visibleSpots.map((spot, index) => (
                                        <div key={index} className="group bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer" onClick={() => handleSpotSelect(spot)}>
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="font-bold text-gray-800 text-base group-hover:text-indigo-600 transition-colors flex-1">{spot.name}</h3>
                                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm ml-2 shrink-0 ${spot.congestionLevel === 5 ? 'bg-red-500' :
                                                    spot.congestionLevel === 4 ? 'bg-yellow-500' :
                                                        spot.congestionLevel === 3 ? 'bg-green-500' :
                                                            spot.congestionLevel === 2 ? 'bg-cyan-500' :
                                                                'bg-blue-500'
                                                    }`}>
                                                    {spot.congestionLevel === 5 ? '混雑' :
                                                        spot.congestionLevel === 4 ? 'やや混雑' :
                                                            spot.congestionLevel === 3 ? '通常' :
                                                                spot.congestionLevel === 2 ? 'やや快適' : '快適'}
                                                </div>
                                            </div>

                                            <p className="text-gray-500 text-xs line-clamp-2 leading-relaxed mb-3">{spot.description}</p>

                                            <div className="space-y-1.5">
                                                {spot.openingHours && (
                                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                                        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <circle cx="12" cy="12" r="10" strokeWidth="2" />
                                                            <polyline points="12 6 12 12 16 14" strokeWidth="2" />
                                                        </svg>
                                                        <span className="truncate">{spot.openingHours}</span>
                                                    </div>
                                                )}
                                                {spot.price && (
                                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                                        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <line x1="12" y1="1" x2="12" y2="23" strokeWidth="2" />
                                                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeWidth="2" />
                                                        </svg>
                                                        <span className="truncate">{spot.price}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))) : (
                                    <div className="text-center text-gray-500 py-10">
                                        <p>この範囲に観光スポットが見つかりませんでした。</p>
                                    </div>
                                )}
                                <div className="h-10"></div>
                            </div>
                        </div>
                    </div>
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
                                    <div className="p-4 pt-1 grid grid-cols-[auto_1fr_auto] gap-3 items-center border-b border-gray-100">
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
                                                <span className="text-gray-900 text-sm font-bold truncate leading-tight">{selectedSpot?.name}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col justify-center text-gray-400 pl-1">
                                            <SwapIcon />
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
                                                {(() => {
                                                    const now = new Date();
                                                    const durationNum = parseInt(selectedRoute.duration) || 0;
                                                    const arrivalDate = new Date(now.getTime() + durationNum * 60000);
                                                    return `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} 発 - ${arrivalDate.getHours()}:${arrivalDate.getMinutes().toString().padStart(2, '0')} 着`;
                                                })()}
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
                                                        {seg.departureTime && <div className="text-[10px] text-gray-500 mt-1">{seg.departureTime}</div>}
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
                                                <div className="font-bold text-gray-800 pt-0.5">{selectedSpot?.name}</div>
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
                                        ) : (
                                            routeOptions.map((route, idx) => {
                                                // Metadata Calculation
                                                const now = new Date();
                                                const startTime = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
                                                const durationNum = parseInt(route.duration) || 0;
                                                const arrivalDate = new Date(now.getTime() + durationNum * 60000);
                                                const arrivalTime = `${arrivalDate.getHours()}:${arrivalDate.getMinutes().toString().padStart(2, '0')}`;

                                                // Determine if Cheapest/Fastest
                                                const allCosts = routeOptions.map(r => parseInt(r.cost.replace(/[^0-9]/g, '')) || 0);
                                                const allDurations = routeOptions.map(r => parseInt(r.duration) || 999);
                                                const minCost = Math.min(...allCosts);
                                                const minDuration = Math.min(...allDurations);
                                                const currentCost = parseInt(route.cost.replace(/[^0-9]/g, '')) || 0;

                                                const isFastest = durationNum === minDuration;
                                                const isCheapest = currentCost === minCost && currentCost > 0;
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
                                                                    {startTime} - {arrivalTime}
                                                                </span>
                                                            </div>
                                                            <div className="font-bold text-gray-900 text-base">{route.cost === '0円' ? '無料' : route.cost}</div>
                                                        </div>

                                                        {/* Visual Timeline (Icons) */}
                                                        <div className="flex flex-col gap-2 mb-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                                            {route.segments.map((seg, i) => (
                                                                <div key={i} className="flex items-center gap-3 text-xs text-gray-700">
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
                                                                    <div className="flex-1 font-bold truncate">
                                                                        {seg.type === 'WALK' ? '徒歩' : seg.text}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Footer: Tags & Button */}
                                                        <div className="flex items-center justify-between mt-auto">
                                                            <div className="flex gap-2">
                                                                {isFastest && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">最速</span>}
                                                                {isCheapest && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded">最安</span>}
                                                                {route.transportMode === TransportMode.WALKING &&
                                                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded">健康</span>
                                                                }
                                                                {isSelected && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded">選択中</span>}
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
                        </div>
                    )
                }

                {/* NAVIGATION MODE - Overlay */}
                {
                    mode === AppMode.NAVIGATING && selectedRoute && selectedSpot && (
                        <>
                            {/* Minimized Floating Icon (Top Right) */}
                            {isSheetMinimized && (
                                <button
                                    onClick={() => setIsSheetMinimized(false)}
                                    className="absolute top-20 right-4 z-50 w-14 h-14 bg-indigo-600 rounded-full shadow-2xl flex items-center justify-center text-white animate-bounce-in border-4 border-white/30 backdrop-blur-md hover:scale-105 transition-transform"
                                >
                                    <SpeakerIcon className="w-6 h-6" />
                                    {isPlaying && (
                                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                        </span>
                                    )}
                                </button>
                            )}

                            {/* Expanded AI Guide Widget - Compact Version */}
                            {!isSheetMinimized && (
                                <div className={`absolute bottom-0 left-0 right-0 z-10 p-3 pointer-events-none transition-all duration-300 ${showNavRouteDetail ? 'max-h-[70vh]' : 'max-h-[50vh]'}`}>
                                    <div className="pointer-events-auto w-full max-w-md mx-auto">
                                        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden relative flex flex-col animate-fade-in-up">
                                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 z-10"></div>

                                            {/* Compact Header with Controls */}
                                            <div className="px-3 py-1.5 flex justify-between items-center bg-gray-50/80 z-10 shrink-0">
                                                <div className="flex items-center gap-2">
                                                    {showNavRouteDetail ? (
                                                        <span className="text-[10px] font-bold text-gray-700">ルート詳細</span>
                                                    ) : (
                                                        <>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                                                {isMuted ? <MuteIcon className="w-3 h-3" /> : <SpeakerIcon className="w-3 h-3" />} AI
                                                            </span>
                                                            {guideText && (
                                                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${isPlaying ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                                    {isPlaying ? '再生中' : '自動'}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => setShowNavRouteDetail(!showNavRouteDetail)}
                                                        className={`p-1 hover:bg-gray-200 rounded transition-colors ${showNavRouteDetail ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500'}`}
                                                        title="ルート詳細"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => setIsSheetMinimized(true)}
                                                        className="p-1 hover:bg-gray-200 rounded text-gray-400 transition-colors"
                                                    >
                                                        <ChevronDownIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Main Content - Switches between Guide and Route Detail */}
                                            {showNavRouteDetail ? (
                                                /* Route Detail Expanded View */
                                                <div className="flex-1 overflow-y-auto max-h-[35vh]">
                                                    {/* Route Summary */}
                                                    <div className="px-3 py-2 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg font-extrabold text-indigo-900">{selectedRoute.duration}</span>
                                                            <span className="text-xs font-bold text-indigo-600">{selectedRoute.title}</span>
                                                        </div>
                                                        <span className="text-sm font-bold text-indigo-700">{selectedRoute.cost}</span>
                                                    </div>

                                                    {/* Segments List */}
                                                    <div className="p-2 space-y-1.5">
                                                        {selectedRoute.segments.map((seg, i) => (
                                                            <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                                                <div className={`
                                                                    flex items-center justify-center w-7 h-7 rounded-full shrink-0
                                                                    ${seg.type === 'WALK' ? 'bg-gray-200 text-gray-600' :
                                                                        seg.type === 'BUS' ? 'bg-blue-100 text-blue-600' :
                                                                            seg.type === 'SUBWAY' ? 'bg-green-100 text-green-600' :
                                                                                'bg-orange-100 text-orange-600'}
                                                                `}>
                                                                    <SegmentIcon type={seg.type} className="w-3.5 h-3.5" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-xs font-bold text-gray-800 truncate">
                                                                        {seg.type === 'WALK' ? '徒歩' : seg.text}
                                                                    </div>
                                                                </div>
                                                                <div className="text-[10px] font-bold text-gray-500 shrink-0">
                                                                    {seg.duration || '---'}
                                                                </div>
                                                            </div>
                                                        ))}

                                                        {/* Destination */}
                                                        <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                                                            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-red-500 text-white shrink-0">
                                                                <MapPinIcon className="w-3.5 h-3.5" />
                                                            </div>
                                                            <div className="text-xs font-bold text-gray-800 truncate flex-1">{selectedSpot.name}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Normal Guide View */
                                                <>
                                                    {/* Compact Journey Stage Bar */}
                                                    <div className="px-3 py-1.5 bg-white border-b border-gray-100">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1">
                                                                <button onClick={() => changeStage('TO_STOP')} className={`p-1.5 rounded-full ${navStage === 'TO_STOP' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                                                                    <WalkIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                                <div className={`w-4 h-0.5 ${navStage !== 'TO_STOP' ? 'bg-indigo-400' : 'bg-gray-200'}`}></div>
                                                                <button onClick={() => changeStage('ON_BUS')} className={`p-1.5 rounded-full ${navStage === 'ON_BUS' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                                                                    <BusIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                                <div className={`w-4 h-0.5 ${navStage === 'ALIGHTING' || navStage === 'TO_DEST' ? 'bg-indigo-400' : 'bg-gray-200'}`}></div>
                                                                <button onClick={() => changeStage('TO_DEST')} className={`p-1.5 rounded-full ${navStage === 'TO_DEST' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                                                                    <MapPinIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                            {stageTimeInfo && (
                                                                <div className="flex items-center gap-1 text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">
                                                                    <ClockIcon className="w-3 h-3" />
                                                                    <span className="truncate max-w-[120px]">{stageTimeInfo}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Compact Transit Info (Integrated) */}
                                                    {selectedRoute.transportMode === TransportMode.TRANSIT && (navStage === 'TO_STOP' || navStage === 'ON_BUS' || navStage === 'ALIGHTING') && (() => {
                                                        // Find the current transit segment
                                                        const transitSeg = selectedRoute.segments.find(s => s.type === 'BUS' || s.type === 'TRAIN' || s.type === 'SUBWAY');
                                                        const lineName = transitSeg?.text || selectedRoute.title;
                                                        const lineNumber = lineName.match(/\d+/)?.[0];
                                                        const isBus = transitSeg?.type === 'BUS';

                                                        return (
                                                            <div className="px-3 py-2 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-bold text-indigo-600">
                                                                        {isBus && lineNumber ? `${lineNumber}系統` : lineName}
                                                                    </span>
                                                                </div>
                                                                <div className="text-right">
                                                                    {navStage === 'TO_STOP' ? (
                                                                        <span className="text-xs font-bold text-indigo-600">まもなく到着</span>
                                                                    ) : (
                                                                        <span className="text-sm font-black text-indigo-600">あと{stopsAway}駅</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Compact Lyrics Content Area - Draggable */}
                                                    <div
                                                        className="relative bg-gray-50 overflow-hidden"
                                                        style={{ height: `${lyricsHeight}px`, transition: isLyricsDragging ? 'none' : 'height 0.2s ease' }}
                                                    >
                                                        {/* Drag Handle - Top */}
                                                        <div
                                                            className="absolute top-0 left-0 right-0 h-4 flex items-center justify-center cursor-ns-resize z-20 hover:bg-gray-100/50 touch-none"
                                                            onPointerDown={handleLyricsPointerDown}
                                                            onPointerMove={handleLyricsPointerMove}
                                                            onPointerUp={handleLyricsPointerUp}
                                                            onPointerCancel={handleLyricsPointerUp}
                                                        >
                                                            <div className="w-8 h-1 bg-gray-300 rounded-full"></div>
                                                        </div>
                                                        <div className="relative z-10 h-full flex flex-col items-center justify-center p-2 pt-4">
                                                            {guideText ? (
                                                                <LyricsReader text={guideText} isPlaying={isPlaying} duration={audioDuration} />
                                                            ) : (
                                                                <div className="flex items-center gap-2 text-gray-400">
                                                                    <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-indigo-500 animate-spin"></div>
                                                                    <span className="text-xs">{navStage === 'TO_STOP' ? "バス停へ..." : "ガイド生成中..."}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {/* Compact Controls */}
                                            <div className="px-3 py-2 bg-white border-t border-gray-100 shrink-0 flex items-center justify-between gap-2">
                                                {!showNavRouteDetail && guideText ? (
                                                    <button
                                                        onClick={() => handlePlayAudio(guideText)}
                                                        disabled={isPlaying}
                                                        className="flex-1 flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-black disabled:bg-gray-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
                                                    >
                                                        <PlayIcon className="w-3 h-3" />
                                                        {isPlaying ? '再生中' : 'もう一度'}
                                                    </button>
                                                ) : <div className="flex-1"></div>}

                                                {navStage === 'TO_DEST' && (
                                                    <button
                                                        onClick={handleArrive}
                                                        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
                                                    >
                                                        <MapPinIcon className="w-3 h-3" />
                                                        到着
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )
                }

                {/* DESTINATION MODE - Full Screen Overlay */}
                {
                    mode === AppMode.DESTINATION && selectedSpot && (
                        <div className="absolute inset-0 z-30 flex flex-col overflow-hidden">
                            {/* Blurred Gray Overlay */}
                            <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-md"></div>

                            {/* Full Screen Lyrics Background */}
                            <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
                                <div className="w-full h-full flex items-center justify-center px-8 py-32">
                                    {guideText ? (
                                        <LyricsReader text={guideText} isPlaying={isPlaying} duration={audioDuration} />
                                    ) : (
                                        <div className="flex items-center gap-2 text-white/60">
                                            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white/80 animate-spin"></div>
                                            <span className="text-sm">ガイドを読み込み中...</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Top Section - Arrival Info (Overlay) */}
                            <div className="relative z-10 text-center pt-6 pb-4 shrink-0 bg-gradient-to-b from-gray-900/90 to-transparent">
                                <div className="inline-block px-3 py-1 bg-white/10 backdrop-blur rounded-full text-[10px] text-white/80 font-bold tracking-widest uppercase border border-white/10 mb-2">
                                    到着
                                </div>
                                <h2 className="text-xl font-bold text-white font-serif">{selectedSpot.name}</h2>
                            </div>

                            {/* Spacer */}
                            <div className="flex-1"></div>

                            {/* Bottom Section - Controls and Spots (Overlay) */}
                            <div className="relative z-10 px-4 pb-4 shrink-0 bg-gradient-to-t from-gray-900/90 via-gray-900/70 to-transparent pt-8">
                                {/* Audio Control */}
                                {guideText && (
                                    <button
                                        onClick={() => handlePlayAudio(guideText)}
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
        </div >
    );
}

export default App;