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

            // onProgressコールバックで部分的な結果を受け取り、随時反映
            await getPlacePhotosInBatch(places, (newPhotos) => {
                setSpotPhotos(prev => {
                    const newMap = new Map(prev);
                    newPhotos.forEach((url, name) => {
                        newMap.set(name, url);
                    });
                    return newMap;
                });
            });
        } catch (error) {
            // エラーログ抑制
        } finally {
            setLoading(false);
        }
    }, []);

    return { spotPhotos, loading, fetchPhotosForSpots };
}

export default useSpotPhotos;
