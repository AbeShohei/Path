import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GuideContent } from '../services/guideService';

interface GuideSliderProps {
    guides: GuideContent[];
    loading?: boolean;
    onPlayAudio: (guide: GuideContent) => void;
    onStopAudio: () => void;
    isPlaying: boolean;
    onSelectGuide?: (guide: GuideContent) => void;
    onCurrentGuideChange?: (guide: GuideContent | null) => void;
    onComplete?: () => void; // Called when user taps completion button
    showCompletion?: boolean;
}

// Simple Icons
const VolumeUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
);

// Arrow Icons for navigation
const ChevronLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M15 18l-6-6 6-6" /></svg>
);
const ChevronRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 18l6-6-6-6" /></svg>
);

// Internal component for smooth image loading with skeleton and brightness analysis
const ImageWithSkeleton: React.FC<{
    src: string;
    alt: string;
    onBrightnessDetected?: (isDark: boolean) => void;
}> = ({ src, alt, onBrightnessDetected }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        setIsLoaded(true);
        if (onBrightnessDetected) {
            try {
                const img = e.currentTarget;
                // Create canvas for analysis
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Set canvas to analyze bottom 20% of image (where text is)
                const heightToAnalyze = Math.floor(img.naturalHeight * 0.2);
                // Limit canvas size for performance
                canvas.width = Math.min(img.naturalWidth, 100);
                canvas.height = Math.min(heightToAnalyze, 20);

                // Draw bottom portion resized
                ctx.drawImage(
                    img,
                    0, img.naturalHeight - heightToAnalyze, img.naturalWidth, heightToAnalyze, // Source rect
                    0, 0, canvas.width, canvas.height // Dest rect
                );

                // Get pixel data
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                let r, g, b, avg;
                let colorSum = 0;

                for (let i = 0; i < data.length; i += 4) {
                    r = data[i];
                    g = data[i + 1];
                    b = data[i + 2];
                    avg = (r + g + b) / 3;
                    colorSum += avg;
                }

                // Average Brightness (0-255)
                const brightness = Math.floor(colorSum / (data.length / 4));
                onBrightnessDetected(brightness < 128);
            } catch (err) {
                console.warn("Color analysis failed", err);
                onBrightnessDetected(true);
            }
        }
    };

    return (
        <div className="relative w-full h-full">
            {/* Skeleton Loading State */}
            {!isLoaded && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse z-10" />
            )}
            <img
                crossOrigin="anonymous" // Crucial for Canvas access
                src={src}
                alt={alt}
                className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={handleLoad}
            />
        </div>
    );
};

export const GuideSlider: React.FC<GuideSliderProps> = ({
    guides,
    loading,
    onPlayAudio,
    onStopAudio,
    isPlaying: isGlobalPlaying,
    onSelectGuide,
    onCurrentGuideChange,
    onComplete,
    showCompletion = false
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playingId, setPlayingId] = useState<string | null>(null);
    // Multi-state expansion: 'full' | 'normal' | 'compact' | 'collapsed'
    const [viewState, setViewState] = useState<'full' | 'normal' | 'compact' | 'collapsed'>('normal');
    const [titleColor, setTitleColor] = useState<'white' | 'black'>('white');
    // Auto-Scroll Toggle State
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
    const textRef = useRef<HTMLDivElement>(null);

    // Touch drag state
    const dragStartY = useRef<number | null>(null);
    const dragOffsetRef = useRef(0); // Ref for closure access in mouse handlers
    const [dragOffset, setDragOffset] = useState(0); // Real-time drag offset in pixels

    // Persist the currently playing guide so it doesn't disappear if specific props change
    const [activeGuide, setActiveGuide] = useState<GuideContent | null>(null);

    // Sync activeGuide: if playing, keep it updated with latest data, or hold onto old data
    useEffect(() => {
        if (playingId) {
            const found = guides.find(g => g.id === playingId);
            if (found) {
                setActiveGuide(found);
            }
        } else {
            setActiveGuide(null);
        }
    }, [playingId, guides]);

    // Only show guides that have a photo
    // Use useMemo to ensure stability and inject activeGuide if needed
    const displayGuides = useMemo(() => {
        const list = guides.filter(g => g.imageUrl).slice(0, 15);

        // If audio is playing and the playing guide is NOT in the list, inject it at the start
        if (isGlobalPlaying && activeGuide && activeGuide.imageUrl && !list.find(g => g.id === activeGuide.id)) {
            return [activeGuide, ...list];
        }
        return list;
    }, [guides, activeGuide, isGlobalPlaying]);
    const totalCards = displayGuides.length;
    const totalSlides = totalCards + 1; // +1 for completion slide
    const isCompletionSlide = (showCompletion && autoScrollEnabled) || (totalCards > 0 && currentIndex >= totalCards);


    const currentGuide = isCompletionSlide ? null : displayGuides[currentIndex];

    // Height configuration for each state (in pixels for calculation)
    const getHeightPx = (state: 'full' | 'normal' | 'compact' | 'collapsed'): number => {
        switch (state) {
            case 'full': return window.innerHeight * 0.85;
            case 'normal': return 420; // Increased for Auto-Scroll Header
            case 'compact': return 220; // Increased for Auto-Scroll Header
            case 'collapsed': return 48;
        }
    };

    // State order for drag navigation
    const stateOrder: ('full' | 'normal' | 'compact' | 'collapsed')[] = ['collapsed', 'compact', 'normal', 'full'];

    // Reset color on slide change (default to white before analysis)
    useEffect(() => {
        setTitleColor('white');
    }, [currentIndex]);

    // Notify parent when current guide changes
    useEffect(() => {
        if (onCurrentGuideChange) {
            onCurrentGuideChange(currentGuide || null);
        }
    }, [currentGuide?.id, onCurrentGuideChange]);

    // Reset index when guides change
    // Track previous guides to handle updates synchronously (preventing flicker)
    const prevDisplayGuides = useRef(displayGuides);





    // Render-phase state update (Derived State pattern)
    // This allows us to adjust the index BEFORE the browser paints, eliminating the flicker
    if (prevDisplayGuides.current !== displayGuides) {

        const oldGuides = prevDisplayGuides.current;
        const currentGuide = oldGuides[currentIndex];
        const wasOnCompletion = oldGuides.length > 0 && currentIndex >= oldGuides.length;

        prevDisplayGuides.current = displayGuides;

        // If we were on the completion slide, ensure we STAY on the completion slide (adjust for new length)
        if (wasOnCompletion) {
            const newTotal = displayGuides.length;
            if (currentIndex !== newTotal) {
                setCurrentIndex(newTotal);
            }
        }
        else if (!showCompletion) {
            let newIndex = 0; // Default behavior: snap to nearest (index 0)

            // If audio is playing, RELENTLESSLY track that card (Priority 1)
            if (isGlobalPlaying && playingId) {
                const foundIdx = displayGuides.findIndex(g => g.id === playingId);
                if (foundIdx > -1) {
                    newIndex = foundIdx;
                }
            }
            // If Auto-Scroll is OFF, try to stay on the same guide (Priority 2)
            else if (!autoScrollEnabled && currentGuide) {
                const foundIdx = displayGuides.findIndex(g => g.id === currentGuide.id);
                if (foundIdx > -1) {
                    newIndex = foundIdx;
                }
            }

            // Only update if different to avoid redundant re-renders (though React handles bailouts)
            if (currentIndex !== newIndex) {
                setCurrentIndex(newIndex);
                // If we are resetting to 0 (auto-transition because NOT playing), also reset view state
                if (newIndex === 0 && !playingId && autoScrollEnabled) {
                    setViewState('normal');
                }
            }
        }
    }

    useEffect(() => {
        if (!isGlobalPlaying) {
            setPlayingId(null);
        }
    }, [isGlobalPlaying]);

    // Force completion state
    useEffect(() => {
        if (showCompletion && autoScrollEnabled) {
            setViewState('normal');
        }
    }, [showCompletion, autoScrollEnabled]);

    // Preload images for smooth transition
    useEffect(() => {
        displayGuides.forEach(guide => {
            if (guide.imageUrl) {
                const img = new Image();
                img.src = guide.imageUrl;
            }
        });
    }, [displayGuides]);

    // Touch handlers for drag gesture using absolute screen position
    const handleTouchStart = (e: React.TouchEvent) => {
        setDragOffset(0);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const currentY = e.touches[0].clientY;

        // Calculate absolute height from bottom of screen
        const absoluteHeight = window.innerHeight - currentY;
        const currentBaseHeight = getHeightPx(viewState);

        // Update visual drag offset so slider follows finger
        setDragOffset(absoluteHeight - currentBaseHeight);

        // Determine new state based on absolute height
        // - collapsed: < 100px
        // - full: > 80% screen height
        // - normal/compact: defined ranges
        let newState: typeof viewState = viewState;
        const heights = stateOrder.map(s => getHeightPx(s));
        // heights[0]=collapsed, heights[1]=compact, heights[2]=normal, heights[3]=full

        if (absoluteHeight <= 100) {
            newState = 'collapsed';
        } else if (absoluteHeight >= window.innerHeight * 0.8) {
            newState = 'full';
        } else if (absoluteHeight >= heights[2] - 50 && absoluteHeight < window.innerHeight * 0.8) {
            newState = 'normal';
        } else if (absoluteHeight >= heights[1] - 50 && absoluteHeight < heights[2] - 50) {
            newState = 'compact';
        } else {
            // Fallback logic for gaps (snap to nearest)
            if (absoluteHeight < heights[1]) newState = 'collapsed';
            else if (absoluteHeight < heights[2]) newState = 'compact';
            else newState = 'normal';
        }

        // Update state if changed
        if (newState !== viewState) {
            setViewState(newState);
            // When state changes, we need to adjust dragOffset to prevent jumping
            // The absolute position hasn't changed, but the base height has
            // New offset = absoluteHeight - newBaseHeight
            setDragOffset(absoluteHeight - getHeightPx(newState));
        }
    };

    const handleTouchEnd = () => {
        setDragOffset(0);
    };

    // Mouse handlers for PC drag support using absolute screen position
    const viewStateRef = useRef(viewState);
    viewStateRef.current = viewState; // Keep ref in sync

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setDragOffset(0);

        const handleMouseMove = (ev: MouseEvent) => {
            const currentY = ev.clientY;

            // Calculate absolute height from bottom of screen
            const absoluteHeight = window.innerHeight - currentY;
            const currentBaseHeight = getHeightPx(viewStateRef.current);

            // Update visual drag offset so slider follows pointer
            setDragOffset(absoluteHeight - currentBaseHeight);

            // Determine new state based on absolute height
            // - collapsed: < 100px
            // - full: > 80% screen height
            // - normal/compact: defined ranges
            let newState: typeof viewState = viewStateRef.current;
            const heights = stateOrder.map(s => getHeightPx(s));
            // heights[0]=collapsed, heights[1]=compact, heights[2]=normal, heights[3]=full

            if (absoluteHeight <= 100) {
                newState = 'collapsed';
            } else if (absoluteHeight >= window.innerHeight * 0.8) {
                newState = 'full';
            } else if (absoluteHeight >= heights[2] - 50 && absoluteHeight < window.innerHeight * 0.8) {
                newState = 'normal';
            } else if (absoluteHeight >= heights[1] - 50 && absoluteHeight < heights[2] - 50) {
                newState = 'compact';
            } else {
                // Fallback logic for gaps (snap to nearest)
                if (absoluteHeight < heights[1]) newState = 'collapsed';
                else if (absoluteHeight < heights[2]) newState = 'compact';
                else newState = 'normal';
            }

            // Update state if changed
            if (newState !== viewStateRef.current) {
                setViewState(newState);
                // When state changes, we need to adjust dragOffset to prevent jumping
                setDragOffset(absoluteHeight - getHeightPx(newState));
            }
        };

        const handleMouseUp = () => {
            setDragOffset(0);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Click handler for drag handle (cycles through states)
    const handleDragHandleClick = () => {
        const currentStateIndex = stateOrder.indexOf(viewState);
        // Cycle: collapsed -> compact -> normal -> full -> normal -> compact -> ...
        // Simplified: click expands one step, if already full, go back to normal
        if (viewState === 'full') {
            setViewState('normal');
        } else if (currentStateIndex < stateOrder.length - 1) {
            setViewState(stateOrder[currentStateIndex + 1]);
        }
    };

    const handlePlayClick = (guide: GuideContent) => {
        if (playingId === guide.id && isGlobalPlaying) {
            onStopAudio();
            setPlayingId(null);
        } else {
            setPlayingId(guide.id);
            setActiveGuide(guide); // Sync update to prevent flickering/loss of guide
            onPlayAudio(guide);
        }
    };

    const goNext = () => {
        if (currentIndex < totalSlides - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const goPrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    // Safe render condition
    if (!loading && !showCompletion && guides.length === 0) return null;

    return (
        <div className="relative w-full h-full pointer-events-none">
            {/* Card Container - individual cards have pointer-events-auto */}
            <div className="relative w-full h-full">
                {/* Skeleton Loader */}
                {/* Skeleton Loader - Show when loading and no guides, OR when implicitly waiting */}
                {loading && guides.length === 0 && (
                    <div className="w-full mx-4 h-[250px] rounded-xl bg-white shadow-sm overflow-hidden border border-gray-100 flex flex-col items-center justify-center animate-pulse">
                        <div className="w-full h-32 bg-gray-200 mb-4" />
                        <div className="w-3/4 h-4 bg-gray-200 rounded mb-2" />
                        <div className="w-1/2 h-4 bg-gray-200 rounded mb-2" />
                        <div className="w-full h-8 bg-gray-100 mt-2" />
                        <div className="text-gray-400 text-sm mt-2 font-bold">AIガイド生成中...</div>
                    </div>
                )}

                {/* Current Card */}
                {currentGuide && (
                    <div
                        className={`
                            absolute bottom-0 left-0 right-0 z-[50] w-full bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] flex flex-col 
                            rounded-t-[32px] overflow-hidden pointer-events-auto safe-pb box-content
                        `}
                        style={{
                            height: `${Math.max(48, Math.min(window.innerHeight * 0.85, getHeightPx(viewState) + dragOffset))}px`,
                            transition: dragOffset !== 0 ? 'none' : 'height 300ms cubic-bezier(0.25, 0.1, 0.25, 1.0)'
                        }}
                    >


                        {/* Drag Handle (Overlay) */}
                        <div
                            className="absolute top-0 left-0 right-0 z-40 flex justify-center py-3 cursor-grab active:cursor-grabbing select-none"
                            onClick={handleDragHandleClick}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onMouseDown={handleMouseDown}
                        >
                            <div className="w-10 h-1 bg-gray-600 rounded-full shadow-md"></div>
                        </div>

                        {/* Image Section (show only in 'full' and 'normal' states) */}
                        {(viewState === 'full' || viewState === 'normal') && (
                            <div
                                className={`relative w-full bg-zinc-800 overflow-hidden ${viewState === 'full' ? 'flex-shrink-0' : ''}`}
                                style={{
                                    height: viewState === 'full' ? 'auto' : '200px',
                                    maxHeight: viewState === 'full' ? '50vh' : undefined,
                                    flex: viewState === 'full' ? '0 0 auto' : '0 0 200px'
                                }}
                            >
                                {currentGuide.imageUrl && (
                                    <ImageWithSkeleton
                                        key={currentGuide.imageUrl}
                                        src={currentGuide.imageUrl}
                                        alt={currentGuide.spotName}
                                        onBrightnessDetected={(isDarkBg) => setTitleColor(isDarkBg ? 'white' : 'black')}
                                    />
                                )}
                                {/* Unified Title Overlay (Bottom Anchored) */}
                                <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4">
                                    {/* Title with Pill Background */}
                                    <span
                                        className={`
                                            inline-block text-xl font-bold leading-none tracking-tight transition-colors duration-300 px-3 py-2 rounded-lg
                                            ${titleColor === 'white' ? 'text-white' : 'text-gray-900'}
                                        `}
                                        style={{
                                            backgroundColor: titleColor === 'white'
                                                ? 'rgba(0,0,0,0.5)'
                                                : 'rgba(255,255,255,0.7)',
                                            backdropFilter: 'blur(4px)',
                                            WebkitBackdropFilter: 'blur(4px)'
                                        }}
                                    >
                                        {currentGuide.spotName}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Content Section (show in 'full', 'normal', and 'compact' but NOT 'collapsed') */}
                        {viewState !== 'collapsed' && (
                            <div className="flex flex-col bg-white px-6 w-full flex-1 min-h-0 pb-6 pt-3">
                                {/* Header Row: Title (Compact only) + Auto-Scroll Toggle */}
                                <div className="flex justify-between items-start mb-2 shrink-0">
                                    {/* Title (show only in compact mode where image is hidden) */}
                                    {viewState === 'compact' ? (
                                        <h3 className="text-lg font-bold text-gray-900 mr-2 leading-tight">{currentGuide.spotName}</h3>
                                    ) : (
                                        <div className="flex-1" /> // Spacer
                                    )}

                                    {/* Auto Scroll Toggle */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setAutoScrollEnabled(!autoScrollEnabled);
                                        }}
                                        className={`
                                            px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all flex items-center gap-1 shrink-0 border
                                            ${autoScrollEnabled
                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                : 'bg-gray-50 border-gray-200 text-gray-500'}
                                        `}
                                    >
                                        {autoScrollEnabled ? (
                                            <>
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                                自動切替 ON
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                                手動 (固定)
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Text (show in all non-collapsed states) */}
                                {(viewState === 'full' || viewState === 'normal' || viewState === 'compact') && (
                                    <>
                                        <div className={`text-xs text-gray-600 leading-relaxed whitespace-pre-wrap text-left ${viewState === 'full' || viewState === 'compact' ? 'flex-1 overflow-y-auto mb-4 pr-2 custom-scrollbar' :
                                            'line-clamp-5 mb-1'
                                            }`}>
                                            <div ref={textRef}>
                                                {currentGuide.text}
                                            </div>
                                        </div>
                                        {/* Read More Button for Normal View */}
                                        {viewState === 'normal' && currentGuide.text.length > 100 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setViewState('full');
                                                }}
                                                className="mb-3 text-xs font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-800 transition-colors self-start"
                                            >
                                                続きを見る <span className="text-[10px]">▼</span>
                                            </button>
                                        )}
                                    </>
                                )}

                                {/* Action Row: Left Arrow + Play Button + Right Arrow */}
                                <div className="mt-auto shrink-0 flex items-center gap-3 w-full pb-4">
                                    {/* Left Arrow */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); goPrev(); }}
                                        disabled={currentIndex === 0}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0
                                            ${currentIndex === 0
                                                ? 'bg-gray-50 text-gray-300'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-indigo-600'}`}
                                    >
                                        <ChevronLeftIcon />
                                    </button>

                                    {/* Play Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handlePlayClick(currentGuide);
                                        }}
                                        className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm
                                            ${playingId === currentGuide.id && isGlobalPlaying
                                                ? 'bg-gray-100 text-gray-900 border border-gray-200'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                                            }`}
                                    >
                                        {playingId === currentGuide.id && isGlobalPlaying ? (
                                            <>
                                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                停止
                                            </>
                                        ) : (
                                            <>
                                                <VolumeUpIcon /> 音声ガイドを再生
                                            </>
                                        )}
                                    </button>

                                    {/* Right Arrow */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); goNext(); }}
                                        disabled={currentIndex >= totalSlides - 1}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0
                                            ${currentIndex >= totalSlides - 1
                                                ? 'bg-gray-50 text-gray-300'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-indigo-600'}`}
                                    >
                                        <ChevronRightIcon />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Completion Slide */}
                {isCompletionSlide && (
                    <div
                        className="absolute bottom-0 left-0 right-0 z-[50] w-full bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] flex flex-col rounded-t-[32px] overflow-hidden pointer-events-auto max-h-[85dvh] safe-pb"
                    >
                        {/* Drag Handle */}
                        <div className="flex justify-center py-3">
                            <div className="w-10 h-1 bg-gray-600 rounded-full shadow-md"></div>
                        </div>

                        {/* Completion Content */}
                        <div className="flex flex-col items-center justify-center flex-1 px-6 pb-12">
                            <div className="text-4xl mb-4">🎉</div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">お疲れ様でした！</h3>
                            <p className="text-sm text-gray-500 mb-6 text-center">
                                すべてのスポットをご案内しました
                            </p>

                            {/* Completion Button */}
                            <button
                                onClick={() => onComplete?.()}
                                className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg transition-colors"
                            >
                                案内を終了
                            </button>

                            {/* Back Button */}
                            <button
                                onClick={() => setCurrentIndex(totalCards - 1)}
                                className="mt-6 text-sm text-gray-500 hover:text-gray-700 font-medium"
                            >
                                ← 前のスポットに戻る
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
