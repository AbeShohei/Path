import React from 'react';
import { SpeakerIcon } from '../icons';

interface AudioPromptModalProps {
    onConfirm: (enableAudio: boolean) => void;
}

/**
 * 音声ガイドの利用確認モーダル
 * ナビゲーション開始前に表示
 */
export const AudioPromptModal: React.FC<AudioPromptModalProps> = ({ onConfirm }) => {
    return (
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
                            onClick={() => onConfirm(false)}
                            className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            オフにする
                        </button>
                        <button
                            onClick={() => onConfirm(true)}
                            className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors"
                        >
                            オンにする
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AudioPromptModal;
