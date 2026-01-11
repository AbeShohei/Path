import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "./useAuth";
import {
  getGuestFavorites,
  addGuestFavorite,
  removeGuestFavorite,
  isGuestFavorite,
  GuestFavoriteSpot,
} from "../utils/guestStorage";
import { useState, useEffect, useCallback } from "react";

export interface FavoriteSpot {
  id: string;
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

export function useFavorites() {
  const { isSignedIn, convexUserId } = useAuth();

  // Convex mutations
  const addSpotFavorite = useMutation(api.favorites.addSpotFavorite);
  const removeSpotFavoriteDb = useMutation(api.favorites.removeSpotFavorite);

  // Convex query for logged-in users
  const convexFavorites = useQuery(
    api.favorites.getSpotFavorites,
    convexUserId ? { userId: convexUserId } : "skip"
  );

  // Guest favorites state
  const [guestFavorites, setGuestFavorites] = useState<GuestFavoriteSpot[]>([]);

  // Load guest favorites on mount
  useEffect(() => {
    if (!isSignedIn) {
      setGuestFavorites(getGuestFavorites());
    }
  }, [isSignedIn]);

  // Normalize favorites to common format
  const favorites: FavoriteSpot[] = isSignedIn
    ? (convexFavorites ?? []).map((f) => ({
        id: f._id,
        spotId: f.spotId ?? "",
        spotName: f.spotName ?? "",
        spotDescription: f.spotDescription,
        spotLocation: f.spotLocation ?? { latitude: 0, longitude: 0 },
        spotImageUrl: f.spotImageUrl,
        spotCongestionLevel: f.spotCongestionLevel,
        createdAt: f.createdAt,
      }))
    : guestFavorites.map((f) => ({
        id: f.spotId,
        ...f,
      }));

  // Add to favorites
  const addFavorite = useCallback(
    async (spot: {
      spotId: string;
      spotName: string;
      spotDescription?: string;
      spotLocation: { latitude: number; longitude: number };
      spotImageUrl?: string;
      spotCongestionLevel?: number;
    }) => {
      if (isSignedIn && convexUserId) {
        await addSpotFavorite({
          userId: convexUserId,
          ...spot,
        });
      } else {
        addGuestFavorite(spot);
        setGuestFavorites(getGuestFavorites());
      }
    },
    [isSignedIn, convexUserId, addSpotFavorite]
  );

  // Remove from favorites
  const removeFavorite = useCallback(
    async (spotId: string) => {
      if (isSignedIn && convexUserId) {
        await removeSpotFavoriteDb({
          userId: convexUserId,
          spotId,
        });
      } else {
        removeGuestFavorite(spotId);
        setGuestFavorites(getGuestFavorites());
      }
    },
    [isSignedIn, convexUserId, removeSpotFavoriteDb]
  );

  // Check if a spot is favorited
  const isFavorite = useCallback(
    (spotId: string): boolean => {
      if (isSignedIn) {
        return (convexFavorites ?? []).some((f) => f.spotId === spotId);
      }
      return isGuestFavorite(spotId);
    },
    [isSignedIn, convexFavorites]
  );

  // Toggle favorite
  const toggleFavorite = useCallback(
    async (spot: {
      spotId: string;
      spotName: string;
      spotDescription?: string;
      spotLocation: { latitude: number; longitude: number };
      spotImageUrl?: string;
      spotCongestionLevel?: number;
    }) => {
      if (isFavorite(spot.spotId)) {
        await removeFavorite(spot.spotId);
      } else {
        await addFavorite(spot);
      }
    },
    [isFavorite, removeFavorite, addFavorite]
  );

  return {
    favorites,
    isLoading: isSignedIn && convexFavorites === undefined,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    isGuest: !isSignedIn,
  };
}
