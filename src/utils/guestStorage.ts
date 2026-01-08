// Guest mode localStorage utilities
// Temporary storage for guests (not persisted across sessions)

const FAVORITES_KEY = "path_guest_favorites";
const HISTORY_KEY = "path_guest_history";

export interface GuestFavoriteSpot {
  spotId: string;
  spotName: string;
  spotDescription?: string;
  spotLocation: {
    latitude: number;
    longitude: number;
  };
  spotImageUrl?: string;
  spotCongestionLevel?: number;
  createdAt: number;
}

export interface GuestRouteHistory {
  id: string;
  originName: string;
  originCoords: {
    latitude: number;
    longitude: number;
  };
  destinationSpotId: string;
  destinationName: string;
  destinationCoords: {
    latitude: number;
    longitude: number;
  };
  routeTitle: string;
  duration: string;
  cost: string;
  transportMode: string;
  navigatedAt: number;
}

// Favorites
export function getGuestFavorites(): GuestFavoriteSpot[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addGuestFavorite(favorite: Omit<GuestFavoriteSpot, "createdAt">): void {
  const favorites = getGuestFavorites();

  // Check if already exists
  if (favorites.some((f) => f.spotId === favorite.spotId)) {
    return;
  }

  favorites.unshift({
    ...favorite,
    createdAt: Date.now(),
  });

  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export function removeGuestFavorite(spotId: string): void {
  const favorites = getGuestFavorites();
  const filtered = favorites.filter((f) => f.spotId !== spotId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
}

export function isGuestFavorite(spotId: string): boolean {
  const favorites = getGuestFavorites();
  return favorites.some((f) => f.spotId === spotId);
}

export function clearGuestFavorites(): void {
  localStorage.removeItem(FAVORITES_KEY);
}

// History
export function getGuestHistory(): GuestRouteHistory[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addGuestHistory(
  history: Omit<GuestRouteHistory, "id" | "navigatedAt">
): void {
  const histories = getGuestHistory();

  histories.unshift({
    ...history,
    id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    navigatedAt: Date.now(),
  });

  // Keep only last 20 items
  const trimmed = histories.slice(0, 20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

export function clearGuestHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

// Sync guest data to Convex on login
export function getGuestDataForSync(): {
  favorites: GuestFavoriteSpot[];
  history: GuestRouteHistory[];
} {
  return {
    favorites: getGuestFavorites(),
    history: getGuestHistory(),
  };
}

export function clearAllGuestData(): void {
  clearGuestFavorites();
  clearGuestHistory();
}
