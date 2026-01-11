import { useAuth } from "../hooks/useAuth";
import { LoginButton } from "../components/auth/LoginButton";
import { useRouteHistory } from "../hooks/useRouteHistory";

export function SettingsPage() {
  const { isSignedIn, user, openUserProfile, signOut } = useAuth();
  const { history, clearHistory, isGuest } = useRouteHistory();

  return (
    <div className="min-h-full bg-gray-50 pb-20">
      <div className="p-4 space-y-4">
        {/* Account Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="font-medium text-gray-700">アカウント</h2>
          </div>

          <div>
            {isSignedIn && user ? (
              <div className="p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div>
                    {user.imageUrl ? (
                      <img
                        src={user.imageUrl}
                        alt={user.name || "User"}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white text-2xl font-medium">
                        {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {user.name || "ユーザー"}
                    </p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={openUserProfile}
                    className="w-full py-3 px-4 text-left text-gray-700 hover:bg-gray-50 rounded-lg flex items-center justify-between transition-colors"
                  >
                    <span>プロフィール設定</span>
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={signOut}
                    className="w-full py-3 px-4 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    ログアウト
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <p className="text-gray-600 mb-4">
                  ログインすると、お気に入りや履歴を保存できます。
                </p>
                <LoginButton variant="primary" className="w-full" />
              </div>
            )}
          </div>
        </div>

        {/* History Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="font-medium text-gray-700">ナビゲーション履歴</h2>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-900">
                  {history.length} 件の履歴
                </p>
                {isGuest && (
                  <p className="text-sm text-gray-500">
                    ゲストの履歴はブラウザに一時保存されます
                  </p>
                )}
              </div>
            </div>

            <div>
              {history.length > 0 && (
                <div>
                  {/* Recent history preview */}
                  <div className="space-y-2 mb-4">
                    {history.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-gray-50 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2 text-gray-700">
                          <span className="truncate">{item.originName}</span>
                          <svg
                            className="w-4 h-4 text-gray-400 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                          </svg>
                          <span className="truncate font-medium">
                            {item.destinationName}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.routeTitle} • {item.duration}
                        </p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={clearHistory}
                    className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors"
                  >
                    履歴をクリア
                  </button>
                </div>
              )}
            </div>

            {history.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                まだ履歴がありません
              </p>
            )}
          </div>
        </div>

        {/* App Info Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="font-medium text-gray-700">アプリ情報</h2>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">バージョン</span>
              <span className="text-gray-900">1.0.0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">開発元</span>
              <span className="text-gray-900">Path Team</span>
            </div>
          </div>
        </div>

        {/* Guest mode info */}
        {isGuest && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
            <div className="flex gap-3">
              <svg
                className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm text-amber-800 font-medium">
                  ゲストモードで利用中
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  お気に入りと履歴はこのブラウザにのみ保存されます。ログインすると、データが永続的に保存され、他のデバイスからもアクセスできるようになります。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
