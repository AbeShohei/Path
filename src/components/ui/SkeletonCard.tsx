import { motion } from 'framer-motion';

interface SkeletonCardProps {
  className?: string;
}

// カード形状のスケルトンローディング
export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100/50 ${className}`}>
      {/* 画像エリア */}
      <motion.div
        className="aspect-[4/3] bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]"
        animate={{
          backgroundPosition: ['0% 0%', '-200% 0%'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* ボタンエリア */}
      <div className="px-3 py-2.5">
        <motion.div
          className="h-4 w-24 mx-auto rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]"
          animate={{
            backgroundPosition: ['0% 0%', '-200% 0%'],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
            delay: 0.2,
          }}
        />
      </div>
    </div>
  );
}

// グリッド用のスケルトン（複数カード）
export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 }}
        >
          <SkeletonCard />
        </motion.div>
      ))}
    </div>
  );
}

// リスト用のスケルトン
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <div className="flex items-center gap-4">
            {/* アバター */}
            <motion.div
              className="w-12 h-12 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]"
              animate={{
                backgroundPosition: ['0% 0%', '-200% 0%'],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'linear',
              }}
            />

            {/* テキスト */}
            <div className="flex-1 space-y-2">
              <motion.div
                className="h-4 w-3/4 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]"
                animate={{
                  backgroundPosition: ['0% 0%', '-200% 0%'],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: 0.1,
                }}
              />
              <motion.div
                className="h-3 w-1/2 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]"
                animate={{
                  backgroundPosition: ['0% 0%', '-200% 0%'],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: 0.2,
                }}
              />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
