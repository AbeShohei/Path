// Design Tokens - Path Kyoto Guide
// Emerald/紺系を維持した配色システム

export const colors = {
  // Primary - Emerald系（メインカラー）
  primary: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',  // メインカラー
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
  },
  // Secondary - インディゴ/紺系
  secondary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',  // indigo-500
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  // Accent - ローズ/ピンク系（お気に入り等）
  accent: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',  // rose-500
    600: '#e11d48',
    700: '#be123c',
  },
  // Neutral - 和紙・グレー
  neutral: {
    50: '#fdfcf8',   // 和紙背景
    100: '#f5f3ed',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  // Congestion levels（混雑度カラー - 維持）
  congestion: {
    1: '#3b82f6',  // blue-500 - 空いている
    2: '#06b6d4',  // cyan-500 - やや空き
    3: '#22c55e',  // green-500 - 普通
    4: '#eab308',  // yellow-500 - やや混雑
    5: '#ef4444',  // red-500 - 混雑
  }
} as const;

// アニメーション設定
export const animations = {
  // Spring transitions
  spring: {
    gentle: { type: 'spring', stiffness: 120, damping: 14 },
    bouncy: { type: 'spring', stiffness: 400, damping: 10 },
    smooth: { type: 'spring', stiffness: 300, damping: 20 },
  },
  // Duration-based transitions
  duration: {
    fast: { duration: 0.15 },
    normal: { duration: 0.3 },
    slow: { duration: 0.5 },
  },
  // Easing curves
  easing: {
    easeOut: [0.0, 0.0, 0.2, 1],
    easeIn: [0.4, 0.0, 1, 1],
    easeInOut: [0.4, 0.0, 0.2, 1],
  }
} as const;

// スペーシング (4px基準)
export const spacing = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
} as const;

// ボーダー半径
export const borderRadius = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
} as const;

// シャドウ
export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  hover: '0 12px 24px rgba(0, 0, 0, 0.1)',
} as const;

// Type exports
export type ColorKey = keyof typeof colors;
export type AnimationKey = keyof typeof animations;
