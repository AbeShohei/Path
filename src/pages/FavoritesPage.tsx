import { motion, AnimatePresence } from 'framer-motion';
import { useFavorites } from "../hooks/useFavorites";
import { useAuth } from "../hooks/useAuth";
import { LoginButton } from "../components/auth/LoginButton";
import { SkeletonList } from "../components/ui/SkeletonCard";

interface FavoritesPageProps {
  onSpotSelect?: (spot: {
    id: string;
    name: string;
    description?: string;
    location: { latitude: number; longitude: number };
    congestionLevel?: number;
    imageUrl?: string;
  }) => void;
}

// アニメーション設定
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    x: -50,
    transition: { duration: 0.2 },
  },
};

export function FavoritesPage({ onSpotSelect }: FavoritesPageProps) {
  const { favorites, isLoading, removeFavorite, isGuest } = useFavorites();
  const { openSignIn } = useAuth();

  const getCongestionColor = (level?: number) => {
    if (!level) return "bg-gray-400";
    const colors = [
      "bg-blue-500",    // 空いている
      "bg-cyan-500",    // やや空き
      "bg-green-500",   // 普通
      "bg-yellow-500",  // やや混雑
      "bg-red-500",     // 混雑
    ];
    return colors[level - 1] || "bg-gray-400";
  };

  const getCongestionText = (level?: number) => {
    if (!level) return "不明";
    const texts = ["空いている", "やや空き", "普通", "やや混雑", "混雑"];
    return texts[level - 1] || "不明";
  };

  return (
    <motion.div
      className="min-h-full bg-gray-50 pb-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Guest notice */}
      <AnimatePresence>
        {isGuest && favorites.length > 0 && (
          <motion.div
            className="mx-4 mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
          >
            <p className="text-sm text-amber-800">
              ログインすると保存したスポットが永続化されます
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <SkeletonList count={3} />
          </motion.div>
        ) : favorites.length === 0 ? (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            >
              <motion.svg
                className="w-16 h-16 mx-auto text-gray-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: 'reverse',
                }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </motion.svg>
            </motion.div>
            <motion.p
              className="text-gray-500 mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              お気に入りのスポットがありません
            </motion.p>
            <motion.p
              className="text-sm text-gray-400"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              スポットのハートをタップして追加できます
            </motion.p>

            {isGuest && (
              <motion.div
                className="mt-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <LoginButton variant="secondary" />
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="popLayout">
              {favorites.map((favorite) => (
                <motion.div
                  key={favorite.id}
                  variants={cardVariants}
                  exit="exit"
                  layout
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer"
                  whileHover={{
                    y: -2,
                    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)',
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  onClick={() =>
                    onSpotSelect?.({
                      id: favorite.spotId,
                      name: favorite.spotName,
                      description: favorite.spotDescription,
                      location: favorite.spotLocation,
                      congestionLevel: favorite.spotCongestionLevel as
                        | 1
                        | 2
                        | 3
                        | 4
                        | 5
                        | undefined,
                      imageUrl: favorite.spotImageUrl,
                    })
                  }
                >
                  {/* Content */}
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-900 text-base">
                        {favorite.spotName}
                      </h3>
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFavorite(favorite.spotId);
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-full"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                      >
                        <motion.svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          whileHover={{ scale: 1.1 }}
                        >
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </motion.svg>
                      </motion.button>
                    </div>

                    {favorite.spotDescription && (
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                        {favorite.spotDescription}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <motion.span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white ${getCongestionColor(
                          favorite.spotCongestionLevel
                        )}`}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse"></span>
                        {getCongestionText(favorite.spotCongestionLevel)}
                      </motion.span>

                      <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                        <span>詳細を見る</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {isGuest && (
                <motion.div
                  className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ delay: 0.2 }}
                >
                  <p className="text-sm text-emerald-800 mb-3">
                    ログインすると、お気に入りが永続的に保存されます
                  </p>
                  <LoginButton variant="primary" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
