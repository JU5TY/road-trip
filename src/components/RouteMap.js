import { useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStyles, useTheme } from '../hooks/useTheme';
import { radius, spacing, type } from '../theme';

const MAP_PADDING = { top: 48, right: 48, bottom: 48, left: 48 };
const FOCUS_DELTA = 0.01; // ~1 km across when zooming to a single marker
// Round caps make each dash a dot (Google Maps on Android draws true dots).
const DOTS = { lineDashPattern: [1, 10], lineCap: 'round' };

/**
 * Map of one or more route segments.
 * segments: [{ key, coordinates: [{latitude, longitude}], color, dotted? }]
 *           (`dotted` for a ferry or tunnel crossing, see utils/crossings.js)
 * markers:  [{ key, coordinate, title, description?, color }]
 * highlight: optional { latitude, longitude } shown as a dot (e.g. while
 *            dragging across a chart).
 * `ref` exposes focusMarker(key): zoom to that marker and open its callout.
 * `flat` fills its parent edge to edge, under the status bar (Trip / Day pages).
 */
export default function RouteMap({
  segments,
  markers = [],
  height = 320,
  flat = false,
  highlight,
  ref,
}) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
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
      const edgePadding = flat
        ? { ...MAP_PADDING, top: MAP_PADDING.top + insets.top }
        : MAP_PADDING;
      mapRef.current?.fitToCoordinates(all, { edgePadding, animated: false });
    }
  };

  return (
    <View style={flat ? styles.flat : [styles.wrap, { height }]}>
      {all.length > 0 ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          onMapReady={fit}
          userInterfaceStyle={scheme}
          initialRegion={{
            latitude: all[0].latitude,
            longitude: all[0].longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {segments.map((s) => (
            <Polyline
              key={s.key}
              coordinates={s.coordinates}
              strokeColor={s.color}
              strokeWidth={5}
              {...(s.dotted ? DOTS : null)}
            />
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
          {highlight ? (
            <Marker
              key="highlight"
              coordinate={{ latitude: highlight.latitude, longitude: highlight.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.highlight} />
            </Marker>
          ) : null}
        </MapView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No GPS points were recorded.</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c) => ({
  wrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.surface },
  flat: { flex: 1, backgroundColor: c.surface },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  emptyText: { ...type.small, color: c.textMuted },
  highlight: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: c.accent,
    borderWidth: 3,
    borderColor: c.background,
  },
});
