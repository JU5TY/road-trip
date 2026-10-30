// Photos from the phone's gallery, matched to trips by the time they were taken.
// Nothing is copied or uploaded: the app only reads the gallery when a trip is shown.
import {
  AssetField,
  MediaType,
  Query,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-media-library';

/** Stops looking after this many photos in one span (a trip's worth, comfortably). */
const MAX_PHOTOS = 1000;

/** 'granted' (all or selected photos), 'ask' (can prompt) or 'blocked' (only Settings can allow). */
function toAccess(res) {
  if (res.granted) return 'granted';
  return res.canAskAgain ? 'ask' : 'blocked';
}

export async function getPhotoAccess() {
  return toAccess(await getPermissionsAsync(false, ['photo']));
}

export async function requestPhotoAccess() {
  return toAccess(await requestPermissionsAsync(false, ['photo']));
}

/**
 * Photos taken between two times (ms), oldest first: [{ id, time, width, height }].
 * `id` can be shown directly with expo-image.
 */
export async function getPhotosBetween(from, to) {
  // Creation times are milliseconds on both platforms (checked in the SDK 58 source).
  const rows = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .gte(AssetField.CREATION_TIME, from)
    .lte(AssetField.CREATION_TIME, to)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: true })
    .limit(MAX_PHOTOS)
    .exeForMetadata();
  return rows
    .filter((r) => r.creationTime != null)
    .map((r) => ({
      id: String(r.id),
      time: r.creationTime,
      width: r.width,
      height: r.height,
    }));
}
