/**
 * useSpotPhotos Hook
 * スポットの写真を取得するカスタムフック
 */

import { useState, useCallback } from 'react';
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
                    newPhotos.forEach((data, name) => {
                        if (data.url) newMap.set(name, data.url);
                    });
                    return newMap;
                });

                setSpotDetails(prev => {
                    const newMap = new Map(prev);
                    newPhotos.forEach((data, name) => {
                        newMap.set(name, { types: data.types });
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

    return { spotPhotos, spotDetails, loading, fetchPhotosForSpots };
}

export default useSpotPhotos;
