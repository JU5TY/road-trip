import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';

import { colors } from '../theme';

/** Region that fits all coordinates with some padding (no imperative fitting needed). */
function regionFor(coordinates) {
  const lats = coordinates.map((c) => c.latitude);
  const lngs = coordinates.map((c) => c.longitude);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  const PADDING = 1.35; // leave room around the route
  const MIN_DELTA = 0.005; // ~500 m, so a short drive isn't zoomed to street level
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * PADDING, MIN_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * PADDING, MIN_DELTA),
  };
}

/**
 * Non-interactive map thumbnail of a route, for cards and lists.
 * On Android it uses Google Maps lite mode (a static image), which is much
 * cheaper when several previews are on screen. Taps pass through to the parent.
 * segments: [{ key, coordinates, color }]
 */
export default function RoutePreview({ segments, height = 160 }) {
  const all = segments.flatMap((s) => s.coordinates);
  if (all.length === 0) return <View style={[styles.placeholder, { height }]} />;

  return (
    <View style={{ height }} pointerEvents="none">
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(all)}
        liteMode={Platform.OS === 'android'}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
      >
        {segments.map((s) => (
          <Polyline key={s.key} coordinates={s.coordinates} strokeColor={s.color} strokeWidth={4} />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.surfaceRaised },
});
