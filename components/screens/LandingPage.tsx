import React from 'react';
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
        </div>
    );
};

export default LandingPage;
