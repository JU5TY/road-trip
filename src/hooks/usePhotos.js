import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';

import { getPhotoAccess, getPhotosBetween, requestPhotoAccess } from '../services/photoService';

/**
 * Gallery photos taken between `from` and `to` (ms). Never prompts by itself:
 * { access: null (loading) | 'granted' | 'ask' | 'blocked', photos, allow() }.
 * allow() asks for access, or opens Settings once asking is no longer possible.
 */
export function usePhotos(from, to) {
  const [access, setAccess] = useState(null);
  const [photos, setPhotos] = useState([]);

  const load = useCallback(
    async (nextAccess) => {
      setAccess(nextAccess);
      if (nextAccess !== 'granted' || from == null || to == null) return;
      setPhotos(await getPhotosBetween(from, to));
    },
    [from, to]
  );

  useFocusEffect(
    useCallback(() => {
      getPhotoAccess()
        .then(load)
        .catch((err) => console.warn('[photos] load failed', err));
    }, [load])
  );

  const allow = useCallback(async () => {
    try {
      if (access === 'blocked') {
        Linking.openSettings();
        return;
      }
      await load(await requestPhotoAccess());
    } catch (err) {
      console.warn('[photos] request failed', err);
    }
  }, [access, load]);

  return { access, photos, allow };
}
