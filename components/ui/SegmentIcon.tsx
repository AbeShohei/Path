import React from 'react';
import { WalkIcon, BusIcon, TrainIcon } from '../icons';

interface SegmentIconProps {
    type: string;
    className?: string;
}

/**
 * ルートセグメントの種類に応じたアイコンを表示するコンポーネント
 */
export const SegmentIcon: React.FC<SegmentIconProps> = ({ type, className }) => {
    if (type === 'BUS') return <BusIcon className={className} />;
    if (type === 'TRAIN' || type === 'SUBWAY') return <TrainIcon className={className} />;
    return <WalkIcon className={className} />;
};

export default SegmentIcon;
