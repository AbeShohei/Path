import React, { useEffect, useMemo, useState } from 'react';
import { MapPinIcon } from '../icons';

interface LandingPageProps {
    loading: boolean;
    devMode: boolean;
    onRequestLocation: () => void;
    onToggleDevMode: () => void;
    onImageLoad: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
    loading,
    devMode,
    onRequestLocation,
    onToggleDevMode,
    onImageLoad
}) => {
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingIndex, setOnboardingIndex] = useState(0);
    const onboardingSteps = useMemo(
        () => ([
            {
                title: '混雑回避で快適に',
                description: '人流データから、今空いているスポットを優先して提案します。'
            },
            {
                title: '移動が体験になる',
                description: 'バス移動中にAIが街の物語をガイド。移動時間が観光に変わります。'
            },
            {
                title: 'ルートは直感操作',
                description: '時間・料金・徒歩距離を見比べて、あなたに合うルートを選べます。'
            }
        ]),
        []
    );

    useEffect(() => {
        const hasSeenOnboarding = window.localStorage.getItem('path:onboardingSeen') === 'true';
        if (!hasSeenOnboarding) {
            setShowOnboarding(true);
        }
    }, []);

    const handleOnboardingClose = () => {
        window.localStorage.setItem('path:onboardingSeen', 'true');
        setShowOnboarding(false);
    };

    const handleOnboardingNext = () => {
        setOnboardingIndex(prev => Math.min(prev + 1, onboardingSteps.length - 1));
    };

    const handleOnboardingBack = () => {
        setOnboardingIndex(prev => Math.max(prev - 1, 0));
    };

    const isLastStep = onboardingIndex === onboardingSteps.length - 1;
    const isFirstStep = onboardingIndex === 0;

    return (
        <div className="relative h-full flex flex-col items-center justify-end pb-20 text-center">
            {/* Background Image */}
            <div className="absolute inset-0 z-0 bg-indigo-900">
                <img
                    src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2000&auto=format&fit=crop"
                    alt="Kyoto Street"
                    className="w-full h-full object-cover"
                    onLoad={onImageLoad}
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
                    <button
                        onClick={() => {
                            setOnboardingIndex(0);
                            setShowOnboarding(true);
                        }}
                        className="w-full mb-5 text-white/90 text-sm font-semibold border border-white/30 rounded-full py-2 px-4 hover:bg-white/10 transition"
                    >
                        初めての方へ
                    </button>
                    <p className="text-white text-sm leading-relaxed mb-6 opacity-90">
                        AIがあなただけのガイドに。<br />
                        現在地から最適な観光スポットとルートを提案し、その場の歴史を語ります。
                    </p>
                    <button
                        onClick={onRequestLocation}
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

                    {/* Credits */}
                    <div className="mt-4 text-center">
                        <p className="text-[10px] text-white/50">Images provided by Wikimedia Commons (CC-BY-SA)<br />and Unsplash</p>
                    </div>

                    {/* Developer Mode Toggle */}
                    <button
                        onClick={onToggleDevMode}
                        className={`mt-2 text-[10px] px-3 py-1 rounded-full transition-all ${devMode
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white/10 text-white/40 hover:text-white/60'
                            }`}
                    >
                        {devMode ? '開発者モード ON' : '開発者モード'}
                    </button>
                </div>
            </div>

            {showOnboarding && (
                <div className="absolute inset-0 z-20 bg-black/50 backdrop-blur-sm flex items-end justify-center">
                    <div className="w-full max-w-lg mx-6 mb-10 rounded-3xl bg-white shadow-2xl overflow-hidden animate-fade-in-up">
                        <div className="px-6 pt-6 pb-4 text-left space-y-4">
                            <p className="text-xs font-bold tracking-[0.25em] text-indigo-500 uppercase">Welcome</p>
                            <h2 className="text-2xl font-bold text-gray-900">{onboardingSteps[onboardingIndex].title}</h2>
                            <p className="text-sm text-gray-600 leading-relaxed">{onboardingSteps[onboardingIndex].description}</p>
                        </div>
                        <div className="px-6 pb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {onboardingSteps.map((_, index) => (
                                    <span
                                        key={index}
                                        className={`h-2 w-2 rounded-full ${index === onboardingIndex ? 'bg-indigo-600' : 'bg-gray-200'}`}
                                    />
                                ))}
                            </div>
                            <button
                                onClick={handleOnboardingClose}
                                className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition"
                            >
                                スキップ
                            </button>
                        </div>
                        <div className="px-6 pb-6 flex items-center justify-between gap-3">
                            <button
                                onClick={handleOnboardingBack}
                                disabled={isFirstStep}
                                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition ${isFirstStep ? 'bg-gray-100 text-gray-400' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                戻る
                            </button>
                            <button
                                onClick={isLastStep ? handleOnboardingClose : handleOnboardingNext}
                                className="flex-1 py-3 rounded-xl font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
                            >
                                {isLastStep ? 'はじめる' : '次へ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPage;
