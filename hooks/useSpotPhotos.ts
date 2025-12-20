/**
 * useSpotPhotos Hook
 * スポットの写真を取得するカスタムフック
 */

import { useState, useCallback, useRef } from 'react';
import { Spot } from '../types';
import { getPlacePhotosInBatch } from '../services/placesService';

// SpotDetails interface
export interface SpotDetail {
    types?: string[];
}

interface UseSpotPhotosResult {
    spotPhotos: Map<string, string>;
    spotDetails: Map<string, SpotDetail>;
    loading: boolean;
    fetchPhotosForSpots: (spots: Spot[]) => Promise<void>;
}

/**
 * スポットの写真を取得するフック
 */
export function useSpotPhotos(): UseSpotPhotosResult {
    const [spotPhotos, setSpotPhotos] = useState<Map<string, string>>(new Map());
    const [spotDetails, setSpotDetails] = useState<Map<string, SpotDetail>>(new Map());
    const [loading, setLoading] = useState(false);

    const prevSpotIdsRef = useRef<string>('');
    const isFetchingRef = useRef<boolean>(false);
    const pendingUpdatesRef = useRef<Map<string, { url?: string; types?: string[] }>>(new Map());
    const updateTimeoutRef = useRef<number | null>(null);

    // Batch updates to reduce re-renders
    const flushPendingUpdates = useCallback(() => {
        if (pendingUpdatesRef.current.size === 0) return;

        const updates = pendingUpdatesRef.current;
        pendingUpdatesRef.current = new Map();

        setSpotPhotos(prev => {
            const newMap = new Map(prev);
            let hasChange = false;
            updates.forEach((data, name) => {
                if (data.url && prev.get(name) !== data.url) {
                    newMap.set(name, data.url);
                    hasChange = true;
                }
            });
            return hasChange ? newMap : prev;
        });

        setSpotDetails(prev => {
            const newMap = new Map(prev);
            let hasChange = false;
            updates.forEach((data, name) => {
                if (data.types && JSON.stringify(prev.get(name)?.types) !== JSON.stringify(data.types)) {
                    newMap.set(name, { types: data.types });
                    hasChange = true;
                }
            });
            return hasChange ? newMap : prev;
        });
    }, []);

    const fetchPhotosForSpots = useCallback(async (spots: Spot[]) => {
        if (spots.length === 0) return;

        // Prevent concurrent fetches
        if (isFetchingRef.current) return;

        // Generate ID string to check for duplicates
        const currentIds = spots.map(s => s.id).sort().join(',');
        if (currentIds === prevSpotIdsRef.current) return;

        prevSpotIdsRef.current = currentIds;
        isFetchingRef.current = true;
        setLoading(true);

        try {
            const places = spots.map(spot => ({
                name: spot.name,
                lat: spot.location.latitude,
                lng: spot.location.longitude
            }));

            await getPlacePhotosInBatch(places, (newPhotos) => {
                // Queue updates instead of immediate setState
                newPhotos.forEach((data, name) => {
                    pendingUpdatesRef.current.set(name, {
                        url: data.url,
                        types: data.types
                    });
                });

                // Debounce the actual state update
                if (updateTimeoutRef.current) {
                    clearTimeout(updateTimeoutRef.current);
                }
                updateTimeoutRef.current = window.setTimeout(() => {
                    flushPendingUpdates();
                }, 100);
            });

            // Final flush
            flushPendingUpdates();
        } catch (error) {
            // エラーログ抑制
        } finally {
            isFetchingRef.current = false;
            setLoading(false);
        }
    }, [flushPendingUpdates]);

    return { spotPhotos, spotDetails, loading, fetchPhotosForSpots };
}

export default useSpotPhotos;

