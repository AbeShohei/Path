import React from 'react';

/**
 * 混雑状況を表示するレジェンドコンポーネント
 * 5段階の混雑度を視覚的に表示
 */
export const CongestionLegend: React.FC = () => {
    const PersonIcon = () => (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
        </svg>
    );

    return (
        <div className="absolute safe-top left-4 bg-white/95 backdrop-blur-sm rounded-lg px-2 py-2 shadow-lg z-[1] border border-gray-200/50 pointer-events-auto">
            <div className="font-bold mb-1.5 text-center text-gray-500 text-[9px] uppercase tracking-wider">混雑状況</div>
            <div className="flex gap-1.5">
                {/* Level 1 - Very Low */}
                <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-white text-[10px] shadow-sm">
                    <PersonIcon />
                </div>
                {/* Level 2 - Low */}
                <div className="w-6 h-6 rounded bg-cyan-500 flex items-center justify-center text-white text-[10px] shadow-sm">
                    <div className="flex -space-x-1"><PersonIcon /></div>
                </div>
                {/* Level 3 - Normal */}
                <div className="w-6 h-6 rounded bg-green-500 flex items-center justify-center text-white text-[10px] shadow-sm">
                    <div className="flex -space-x-2"><PersonIcon /><PersonIcon /></div>
                </div>
                {/* Level 4 - High */}
                <div className="w-6 h-6 rounded bg-yellow-500 flex items-center justify-center text-white text-[10px] shadow-sm">
                    <div className="flex -space-x-2"><PersonIcon /><PersonIcon /><PersonIcon /></div>
                </div>
                {/* Level 5 - Very High */}
                <div className="w-6 h-6 rounded bg-red-500 flex items-center justify-center text-white text-[10px] shadow-sm">
                    <div className="flex -space-x-2"><PersonIcon /><PersonIcon /><PersonIcon /><PersonIcon /></div>
                </div>
            </div>
        </div>
    );
};

export default CongestionLegend;
