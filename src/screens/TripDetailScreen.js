import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { useSettings } from '../context/SettingsContext';
import { ensureTripPlaces, routeLabel } from '../services/placeService';
import { getTrip, getTripPoints } from '../storage/tripStorage';
import { colors, radius, spacing } from '../theme';
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatDurationShort,
  formatElevation,
  formatSpeed,
  formatTime,
} from '../utils/format';
import { averageMovingSpeed, averageOverallSpeed, downsample } from '../utils/geoMath';

const MAP_PADDING = { top: 48, right: 48, bottom: 48, left: 48 };

function StatPair({ label, left, right }) {
  return (
    <View style={styles.pair}>
      <Text style={styles.pairLabel}>{label}</Text>
      <View style={styles.pairValues}>
        {[left, right].map((cell) => (
          <View key={cell.caption} style={styles.cell}>
            <Text style={styles.cellValue} numberOfLines={1} adjustsFontSizeToFit>
              {cell.value}
            </Text>
            <Text style={styles.cellCaption}>{cell.caption}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams();
  const { units } = useSettings();
  const [trip, setTrip] = useState(null);
  const [points, setPoints] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tripId = Number(id);
      const [t, p] = await Promise.all([getTrip(tripId), getTripPoints(tripId)]);
      if (cancelled || !t) return;
      setTrip(t);
      setPoints(p);
      const places = await ensureTripPlaces(t, { includeStops: true });
      if (!cancelled) setTrip((prev) => ({ ...prev, places }));
    })().catch((err) => console.warn('[trip] load failed', err));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const route = useMemo(
    () => downsample(points ?? []).map(({ latitude, longitude }) => ({ latitude, longitude })),
    [points]
  );

  const fitRoute = () => {
    if (route.length > 1) {
      mapRef.current?.fitToCoordinates(route, { edgePadding: MAP_PADDING, animated: false });
    }
  };

  if (!trip || !points) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const { stats, places } = trip;
  const elapsedMs = (trip.endedAt ?? Date.now()) - trip.startedAt;
  const stopName = (i) => places.stops?.[i] || 'Rest stop';
  // Trips recorded before these stats existed don't have them.
  const longestStint = stats.longestStintMs === undefined ? '—' : formatDuration(stats.longestStintMs);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: formatDate(trip.startedAt) }} />

      {routeLabel(places) ? <Text style={styles.routeTitle}>{routeLabel(places)}</Text> : null}

      <View style={styles.mapWrap}>
        {route.length > 0 ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            onMapReady={fitRoute}
            initialRegion={{
              latitude: route[0].latitude,
              longitude: route[0].longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <Polyline coordinates={route} strokeColor={colors.accent} strokeWidth={5} />
            <Marker coordinate={route[0]} title={places.start || 'Start'} pinColor={colors.start} />
            <Marker
              coordinate={route[route.length - 1]}
              title={places.end || 'Finish'}
              pinColor={colors.stop}
            />
            {stats.stops.map((s, i) => (
              <Marker
                key={s.startedAt}
                coordinate={{ latitude: s.latitude, longitude: s.longitude }}
                title={stopName(i)}
                description={formatDurationShort(s.endedAt - s.startedAt)}
                pinColor="orange"
              />
            ))}
          </MapView>
        ) : (
          <View style={styles.center}>
            <Text style={styles.cellCaption}>No GPS points were recorded for this trip.</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Telemetry Summary</Text>
        <StatPair
          label="Distance & Time"
          left={{ value: formatDistance(stats.distanceM, units, 2), caption: 'Distance' }}
          right={{ value: formatDuration(elapsedMs), caption: 'Total elapsed' }}
        />
        <StatPair
          label="Drive Time"
          left={{ value: formatDuration(stats.movingTimeMs), caption: 'Moving time' }}
          right={{ value: longestStint, caption: 'Longest without a break' }}
        />
        <StatPair
          label="Average Speed"
          left={{ value: formatSpeed(averageMovingSpeed(stats), units), caption: 'While moving' }}
          right={{ value: formatSpeed(averageOverallSpeed(trip), units), caption: 'Overall (incl. stops)' }}
        />
        <StatPair
          label="Top Speed & Elevation"
          left={{ value: formatSpeed(stats.topSpeedMps, units), caption: 'Top speed (held 3 s)' }}
          right={{ value: formatElevation(stats.maxAltitudeM, units), caption: 'Max altitude' }}
        />
        <StatPair
          label="Climbing & Stops"
          left={{ value: formatElevation(stats.elevationGainM, units), caption: 'Elevation gain' }}
          right={{
            value: `${stats.stopCount} · ${formatDurationShort(stats.totalStopMs)}`,
            caption: 'Rest stops · total time',
          }}
        />
      </View>

      {stats.stops.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rest Stops</Text>
          {stats.stops.map((s, i) => (
            <View key={s.startedAt} style={styles.stopRow}>
              <View style={styles.stopText}>
                <Text style={styles.stopName} numberOfLines={1}>
                  {stopName(i)}
                </Text>
                <Text style={styles.cellCaption}>
                  {formatTime(s.startedAt)} – {formatTime(s.endedAt)}
                </Text>
              </View>
              <Text style={styles.stopDuration}>{formatDurationShort(s.endedAt - s.startedAt)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  routeTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  mapWrap: {
    height: 320,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  pair: { gap: spacing.xs },
  pairLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pairValues: { flexDirection: 'row', gap: spacing.sm },
  cell: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  cellValue: { color: colors.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  cellCaption: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stopText: { flex: 1 },
  stopName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  stopDuration: { color: colors.accent, fontSize: 15, fontWeight: '700' },
});
