import { ReactNode } from 'react';
import { motion } from 'framer-motion';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  pulse = false,
  className = '',
}: BadgeProps) {
  return (
    <motion.span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {dot && (
        <span
          className={`
            w-1.5 h-1.5 rounded-full bg-current
            ${pulse ? 'animate-pulse' : ''}
          `}
        />
      )}
      {children}
    </motion.span>
  );
}

// 混雑度バッジ専用コンポーネント
interface CongestionBadgeProps {
  level: 1 | 2 | 3 | 4 | 5 | undefined;
  showLabel?: boolean;
  size?: BadgeSize;
  className?: string;
}

const congestionConfig: Record<number, { color: string; label: string }> = {
  1: { color: 'bg-blue-500', label: '空いている' },
  2: { color: 'bg-cyan-500', label: 'やや空き' },
  3: { color: 'bg-green-500', label: '普通' },
  4: { color: 'bg-yellow-500', label: 'やや混雑' },
  5: { color: 'bg-red-500', label: '混雑' },
};

export function CongestionBadge({
  level,
  showLabel = true,
  size = 'sm',
  className = '',
}: CongestionBadgeProps) {
  if (!level) {
    return (
      <motion.span
        className={`
          inline-flex items-center gap-1 rounded-full font-medium text-white bg-gray-400
          ${sizeStyles[size]}
          ${className}
        `}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
        {showLabel && '不明'}
      </motion.span>
    );
  }

  const config = congestionConfig[level];

  return (
    <motion.span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium text-white shadow-sm
        ${config.color}
        ${sizeStyles[size]}
        ${className}
      `}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <motion.span
        className="w-1.5 h-1.5 rounded-full bg-white/80"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {showLabel && config.label}
    </motion.span>
  );
}
