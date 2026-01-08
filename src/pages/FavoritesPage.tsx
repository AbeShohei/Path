import { useFavorites } from "../hooks/useFavorites";
import { useAuth } from "../hooks/useAuth";
import { LoginButton } from "../components/auth/LoginButton";

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

export function FavoritesPage({ onSpotSelect }: FavoritesPageProps) {
  const { favorites, isLoading, removeFavorite, isGuest } = useFavorites();
  const { openSignIn } = useAuth();

  const getCongestionColor = (level?: number) => {
    if (!level) return "bg-gray-200";
    const colors = [
      "bg-green-400",
      "bg-lime-400",
      "bg-yellow-400",
      "bg-orange-400",
      "bg-red-400",
    ];
    return colors[level - 1] || "bg-gray-200";
  };

  const getCongestionText = (level?: number) => {
    if (!level) return "不明";
    const texts = ["空いている", "やや空き", "普通", "やや混雑", "混雑"];
    return texts[level - 1] || "不明";
  };

  return (
    <div className="min-h-full bg-gray-50 pb-20">
      {/* Guest notice */}
      {isGuest && (
        <div className="mx-4 mt-4 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-800">
            ログインすると保存したスポットが永続化されます
          </p>
        </div>
      )}

      {/* Content */}
      <div className={`px-4 ${!isGuest ? 'pt-4' : ''}`}>
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 mx-auto text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <p className="text-gray-500 mb-4">
              お気に入りのスポットがありません
            </p>
            <p className="text-sm text-gray-400">
              スポットのハートアイコンをタップして追加できます
            </p>

            {isGuest && (
              <div className="mt-6">
                <LoginButton variant="secondary" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {favorites.map((favorite) => (
              <div
                key={favorite.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="flex">
                  {/* Image */}
                  {favorite.spotImageUrl ? (
                    <img
                      src={favorite.spotImageUrl}
                      alt={favorite.spotName}
                      className="w-24 h-24 object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gray-200 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {favorite.spotName}
                        </h3>
                        {favorite.spotDescription && (
                          <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">
                            {favorite.spotDescription}
                          </p>
                        )}
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => removeFavorite(favorite.spotId)}
                        className="p-1 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>

                    {/* Congestion badge */}
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${getCongestionColor(
                          favorite.spotCongestionLevel
                        )}`}
                      >
                        {getCongestionText(favorite.spotCongestionLevel)}
                      </span>
                    </div>

                    {/* Action button */}
                    <button
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
                      className="mt-2 text-sm text-emerald-600 font-medium hover:text-emerald-700"
                    >
                      ルートを検索 →
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {isGuest && (
              <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-sm text-emerald-800 mb-3">
                  ログインすると、お気に入りが永続的に保存され、他のデバイスからもアクセスできます。
                </p>
                <LoginButton variant="primary" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
