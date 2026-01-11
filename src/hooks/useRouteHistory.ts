import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "./useAuth";
import {
  getGuestHistory,
  addGuestHistory,
  clearGuestHistory,
  GuestRouteHistory,
} from "../utils/guestStorage";
import { useState, useEffect, useCallback } from "react";

export interface RouteHistoryItem {
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
  completedAt?: number;
}

export function useRouteHistory() {
  const { isSignedIn, convexUserId } = useAuth();

  // Convex mutations
  const addRouteHistoryDb = useMutation(api.routeHistory.addRouteHistory);
  const deleteRouteHistoryDb = useMutation(api.routeHistory.deleteRouteHistory);
  const clearRouteHistoryDb = useMutation(api.routeHistory.clearRouteHistory);

  // Convex query for logged-in users
  const convexHistory = useQuery(
    api.routeHistory.getUserRouteHistory,
    convexUserId ? { userId: convexUserId } : "skip"
  );

  // Guest history state
  const [guestHistory, setGuestHistory] = useState<GuestRouteHistory[]>([]);

  // Load guest history on mount
  useEffect(() => {
    if (!isSignedIn) {
      setGuestHistory(getGuestHistory());
    }
  }, [isSignedIn]);

  // Normalize history to common format
  const history: RouteHistoryItem[] = isSignedIn
    ? (convexHistory ?? []).map((h) => ({
        id: h._id,
        originName: h.originName,
        originCoords: h.originCoords,
        destinationSpotId: h.destinationSpotId,
        destinationName: h.destinationName,
        destinationCoords: h.destinationCoords,
        routeTitle: h.routeTitle,
        duration: h.duration,
        cost: h.cost,
        transportMode: h.transportMode,
        navigatedAt: h.navigatedAt,
        completedAt: h.completedAt,
      }))
    : guestHistory.map((h) => ({
        ...h,
      }));

  // Add to history
  const addHistory = useCallback(
    async (route: {
      originName: string;
      originCoords: { latitude: number; longitude: number };
      destinationSpotId: string;
      destinationName: string;
      destinationCoords: { latitude: number; longitude: number };
      routeTitle: string;
      duration: string;
      cost: string;
      transportMode: string;
    }) => {
      if (isSignedIn && convexUserId) {
        await addRouteHistoryDb({
          userId: convexUserId,
          ...route,
        });
      } else {
        addGuestHistory(route);
        setGuestHistory(getGuestHistory());
      }
    },
    [isSignedIn, convexUserId, addRouteHistoryDb]
  );

  // Delete from history
  const deleteHistory = useCallback(
    async (historyId: string) => {
      if (isSignedIn && convexUserId) {
        await deleteRouteHistoryDb({
          historyId: historyId as any,
        });
      }
      // Guest history deletion not implemented (session-only)
    },
    [isSignedIn, convexUserId, deleteRouteHistoryDb]
  );

  // Clear all history
  const clearHistory = useCallback(async () => {
    if (isSignedIn && convexUserId) {
      await clearRouteHistoryDb({ userId: convexUserId });
    } else {
      clearGuestHistory();
      setGuestHistory([]);
    }
  }, [isSignedIn, convexUserId, clearRouteHistoryDb]);

  return {
    history,
    isLoading: isSignedIn && convexHistory === undefined,
    addHistory,
    deleteHistory,
    clearHistory,
    isGuest: !isSignedIn,
  };
}
