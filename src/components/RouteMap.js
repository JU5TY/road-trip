import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { colors, radius, spacing } from '../theme';

const MAP_PADDING = { top: 48, right: 48, bottom: 48, left: 48 };

/**
 * Map of one or more route segments.
 * segments: [{ key, coordinates: [{latitude, longitude}], color }]
 * markers:  [{ key, coordinate, title, description?, color }]
 */
export default function RouteMap({ segments, markers = [], height = 320 }) {
  const mapRef = useRef(null);
  const all = segments.flatMap((s) => s.coordinates);

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
