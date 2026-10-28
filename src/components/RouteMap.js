import { useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { colors, radius, spacing } from '../theme';

const MAP_PADDING = { top: 48, right: 48, bottom: 48, left: 48 };
const FOCUS_DELTA = 0.01; // ~1 km across when zooming to a single marker

/**
 * Map of one or more route segments.
 * segments: [{ key, coordinates: [{latitude, longitude}], color }]
 * markers:  [{ key, coordinate, title, description?, color }]
 * `ref` exposes focusMarker(key): zoom to that marker and open its callout.
 */
export default function RouteMap({ segments, markers = [], height = 320, ref }) {
  const mapRef = useRef(null);
  const markerRefs = useRef(new Map());
  const all = segments.flatMap((s) => s.coordinates);

  useImperativeHandle(ref, () => ({
    focusMarker(key) {
      const marker = markers.find((m) => m.key === key);
      if (!marker) return;
      mapRef.current?.animateToRegion(
        { ...marker.coordinate, latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA },
        600
      );
      markerRefs.current.get(key)?.showCallout();
    },
  }));

  const fit = () => {
    if (all.length > 1) {
      mapRef.current?.fitToCoordinates(all, { edgePadding: MAP_PADDING, animated: false });
    }
  };

  return (
    <View style={[styles.wrap, { height }]}>
      {all.length > 0 ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          onMapReady={fit}
          initialRegion={{
            latitude: all[0].latitude,
            longitude: all[0].longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {segments.map((s) => (
            <Polyline key={s.key} coordinates={s.coordinates} strokeColor={s.color} strokeWidth={5} />
          ))}
          {markers.map((m) => (
            <Marker
              key={m.key}
              ref={(r) => {
                if (r) markerRefs.current.set(m.key, r);
                else markerRefs.current.delete(m.key);
              }}
              coordinate={m.coordinate}
              title={m.title}
              description={m.description}
              pinColor={m.color}
            />
          ))}
        </MapView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No GPS points were recorded.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});
