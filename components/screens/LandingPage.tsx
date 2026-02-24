import React, { useState } from 'react';
import { MapPinIcon, ChevronDownIcon, ChevronUpIcon } from '../icons';

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
    const [showDisclaimer, setShowDisclaimer] = useState(false);

    return (
        <div className="relative h-full flex flex-col items-center justify-end safe-pb-4 text-center safe-pt">
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

                    {/* Disclaimer Button */}
                    <div className="mt-2 pt-2 border-t border-white/10 w-full text-center">
                        <button
                            onClick={() => setShowDisclaimer(true)}
                            className="text-[10px] text-white/50 hover:text-white underline decoration-white/30 underline-offset-2 transition-colors"
                        >
                            データ利用規約・免責事項
                        </button>
                    </div>

                    {/* Developer Mode Toggle */}
                    <button
                        onClick={onToggleDevMode}
                        className={`mt-2 text-[10px] px-3 py-1 rounded-full transition-all w-full text-center ${devMode
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white/10 text-white/40 hover:text-white/60'
                            }`}
                    >
                        {devMode ? '開発者モード ON' : '開発者モード'}
                    </button>
                </div>
            </div>

            {/* Disclaimer Modal */}
            {showDisclaimer && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowDisclaimer(false)}
                >
                    <div
                        className="bg-white text-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="font-bold text-lg mb-4 text-center border-b border-gray-100 pb-3 text-indigo-900">データ利用規約・免責事項</h3>

                        <div className="text-xs text-left space-y-4 leading-relaxed max-h-[60vh] overflow-y-auto text-gray-600">
                            <p>
                                本アプリケーションが利用する公共交通データは、公共交通オープンデータセンターにおいて提供されるものです。
                            </p>
                            <p>
                                公共交通事業者により提供されたデータを元にしていますが、必ずしも正確・完全なものとは限りません。本アプリケーションの表示内容について、公共交通事業者への直接の問合せは行わないでください。
                            </p>
                            <p className="pt-2 border-t border-gray-100">
                                本アプリケーションに関するお問い合わせは、以下のメールアドレスにお願いします。<br />
                                <a href="mailto:shokoi0618@gmail.com" className="text-indigo-600 hover:text-indigo-800 underline font-medium break-all">shokoi0618@gmail.com</a>
                            </p>
                        </div>

                        <div className="mt-6 pt-2 text-center">
                            <button
                                onClick={() => setShowDisclaimer(false)}
                                className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg active:scale-95 transform"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPage;
