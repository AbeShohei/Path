import React, { useState } from 'react';
import { TutorialStep } from '../../hooks/useTutorial';

interface TutorialGuideProps {
    step: TutorialStep;
    stepIndex: number;
    totalSteps: number;
    isLoading?: boolean;
    onNext: () => void;
    onSkip: () => void;
}

export const TutorialGuide: React.FC<TutorialGuideProps> = ({
    step,
    stepIndex,
    totalSteps,
    isLoading = false,
    onNext,
    onSkip
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const isLastStep = stepIndex === totalSteps - 1;
    const isFirstStep = stepIndex === 0;

    // Layout container styles based on step.position
    const getContainerStyles = () => {
        const isNavStep = step.id.startsWith('nav_');
        const baseClasses = "fixed inset-0 z-[100] pointer-events-none flex justify-center px-4";

        switch (step.position) {
            case 'top':
                // Align to top with padding
                return `${baseClasses} items-start ${isNavStep ? 'pt-20' : 'pt-24'}`;
            case 'bottom':
                // Align to bottom with padding
                return `${baseClasses} items-end ${isNavStep ? 'pb-72' : 'pb-24'}`;
            case 'center':
            default:
                // Center alignment
                return `${baseClasses} items-center`;
        }
    };

    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                className="fixed top-24 right-4 z-[100] bg-white/40 backdrop-blur-md rounded-full p-2.5 shadow-lg border border-white/40 text-gray-600 hover:bg-white/60 transition-all animate-scale-in"
                aria-label="チュートリアルを表示"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>
        );
    }

    return (
        <>
            {/* Semi-transparent overlay - only for center positioned steps */}
            {step.position === 'center' && (
                <div className="fixed inset-0 bg-black/50 z-[90] animate-fade-in" />
            )}

            {/* Tutorial tooltip Container (Flexbox for positioning) */}
            <div className={getContainerStyles()}>
                {/* The Card Itself */}
                <div className="w-full max-w-[400px] pointer-events-auto bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl p-4 sm:p-6 border border-white/40 relative animate-scale-in origin-center">

                    {/* Header: Title and Progress Dots */}
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                        {/* Title */}
                        <h3 className="text-base sm:text-lg font-bold text-gray-800">
                            {step.title}
                        </h3>

                        <div className="flex items-center gap-3">
                            {/* Step indicator (Dots only) */}
                            <div className="flex gap-1.5">
                                {Array.from({ length: totalSteps }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${i === stepIndex
                                            ? 'bg-indigo-600 w-5 sm:w-6'
                                            : i < stepIndex
                                                ? 'bg-indigo-400 w-1.5'
                                                : 'bg-indigo-200 w-1.5'
                                            }`}
                                    />
                                ))}
                            </div>

                            {/* Hide Button */}
                            <button
                                onClick={() => setIsMinimized(true)}
                                className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 bg-white/30 hover:bg-white/50 rounded-full transition-colors"
                                aria-label="閉じる"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-gray-900 text-xs sm:text-sm leading-relaxed whitespace-pre-line mb-4 sm:mb-5 font-semibold drop-shadow-sm">
                        {step.description.split(/(\*\*.*?\*\*)/g).map((part, i) =>
                            part.startsWith('**') && part.endsWith('**')
                                ? <span key={i} className="font-extrabold text-indigo-900 leading-normal">{part.slice(2, -2)}</span>
                                : part
                        )}
                    </p>

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={onSkip}
                            className="flex-1 py-2 sm:py-2.5 text-gray-600 text-xs sm:text-sm font-bold hover:text-gray-800 transition-colors"
                        >
                            スキップ
                        </button>
                        <button
                            onClick={onNext}
                            disabled={isFirstStep && isLoading}
                            className={`flex-[2] py-2 sm:py-2.5 bg-indigo-600/80 hover:bg-indigo-700/90 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg backdrop-blur-sm transition-all duration-200 transform
                                ${isFirstStep && isLoading
                                    ? 'opacity-50 cursor-not-allowed bg-gray-500'
                                    : 'active:scale-95'
                                }`}
                        >
                            {isFirstStep && isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    準備中...
                                </span>
                            ) : (
                                isLastStep ? '完了' : isFirstStep ? '始める' : '次へ'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default TutorialGuide;
