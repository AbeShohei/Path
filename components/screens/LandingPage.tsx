import React from 'react';
import { MapPinIcon } from '../icons';

interface LandingPageProps {
    loading: boolean;
    devMode: boolean;
    onRequestLocation: () => void;
    onToggleDevMode: () => void;
    onImageLoad: () => void;
    onShowTutorial: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
    loading,
    devMode,
    onRequestLocation,
    onToggleDevMode,
    onImageLoad,
    onShowTutorial
}) => {
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
                    <p className="text-white/80 font-light text-lg tracking-widest">京都観光案内AIガイド</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-left shadow-2xl">
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

                    {/* Help Button */}
                    <button
                        onClick={onShowTutorial}
                        className="mt-3 w-full py-2 text-white/70 text-sm font-medium hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        使い方を見る
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
        </div>
    );
};

export default LandingPage;
