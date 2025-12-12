/**
 * useSpotPhotos Hook
 * スポットの写真を取得するカスタムフック
 */

import { useState, useCallback } from 'react';
import { Spot } from '../types';
import { getPlacePhotosInBatch } from '../services/placesService';

interface UseSpotPhotosResult {
    spotPhotos: Map<string, string>;
    loading: boolean;
    fetchPhotosForSpots: (spots: Spot[]) => Promise<void>;
}

/**
 * スポットの写真を取得するフック
 */
export function useSpotPhotos(): UseSpotPhotosResult {
    const [spotPhotos, setSpotPhotos] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(false);

    const fetchPhotosForSpots = useCallback(async (spots: Spot[]) => {
        console.log('[useSpotPhotos] fetchPhotosForSpots called with', spots.length, 'spots');

        if (spots.length === 0) {
            return;
        }

        setLoading(true);

        try {
            const places = spots.map(spot => ({
                name: spot.name,
                lat: spot.location.latitude,
                lng: spot.location.longitude
            }));

            console.log('[useSpotPhotos] Fetching photos for', places.length, 'places');
            const photos = await getPlacePhotosInBatch(places);
            console.log('[useSpotPhotos] Got', photos.size, 'photos');

            setSpotPhotos(prev => {
                const newMap = new Map(prev);
                photos.forEach((url, name) => {
                    newMap.set(name, url);
                });
                return newMap;
            });
        } catch (error) {
            console.error('Failed to fetch spot photos:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    return { spotPhotos, loading, fetchPhotosForSpots };
}

export default useSpotPhotos;
