/**
 * useSpotPhotos Hook
 * スポットの写真を取得するカスタムフック
 */

import { useState, useEffect, useCallback } from 'react';
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

        // 既にimageUrlがあるスポットは除外
        const spotsNeedingPhotos = spots.filter(spot => !spot.imageUrl);
        console.log('[useSpotPhotos] Spots needing photos:', spotsNeedingPhotos.length);

        if (spotsNeedingPhotos.length === 0) {
            console.log('[useSpotPhotos] All spots have imageUrl, skipping API call');
            return;
        }

        setLoading(true);

        try {
            const places = spotsNeedingPhotos.map(spot => ({
                name: spot.name,
                lat: spot.location.latitude,
                lng: spot.location.longitude
            }));

            const photos = await getPlacePhotosInBatch(places);

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
