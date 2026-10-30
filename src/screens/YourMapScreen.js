import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import IconButton from '../components/ui/IconButton';
import { useSettings } from '../context/SettingsContext';
import { useRoadTotals } from '../hooks/useRoadTotals';
import { useStyles, useTheme } from '../hooks/useTheme';
import { getLocationAccess } from '../services/locationService';
import { getDriveRoutePreview } from '../storage/driveStorage';
import { listTrips } from '../storage/tripStorage';
import { type } from '../theme';
import { summarizeCountries } from '../utils/countries';
import { driveGaps, routeSegments } from '../utils/crossings';
import { distanceParts } from '../utils/format';
import { getRoad } from '../utils/iconicRoads';
import { computeTotals, firstDriveMonth } from '../utils/tripSummary';

const MAX_MAP_POINTS = 6000; // across every drive, so a long history stays quick to draw
const SHEET_HEIGHT = 130; // the totals panel (above the nav inset), kept clear when fitting
const POSITION_DELTA = 0.05;

/** Every drive's route (all trips), thinned: [{ drive, points }]. Null while loading. */
function useEveryRoute() {
  const [data, setData] = useState(null); // { trips, routes }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const trips = await listTrips();
      const drives = trips.flatMap((t) => t.drives);
      const perDrive = Math.max(60, Math.floor(MAX_MAP_POINTS / Math.max(1, drives.length)));
      const routes = await Promise.all(
        drives.map(async (drive) => ({
          drive,
          points: await getDriveRoutePreview(drive.id, perDrive),
        }))
      );
      if (!cancelled) setData({ trips, routes });
    })().catch((err) => console.warn('[your map] load failed', err));
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}

/**
 * Full-screen "Your map": every road you've driven, all time, in one style on a
 * real map you can pan and zoom. Completed Iconic Roads are teal dots. A sheet
 * at the bottom has the all-time totals.
 */
export default function YourMapScreen() {
  const { units, showIconicRoads } = useSettings();
  const { c, scheme } = useTheme();
  const dark = scheme === 'dark';
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const data = useEveryRoute();
  const roadTotals = useRoadTotals();

  const segments = useMemo(
    () =>
      (data?.routes ?? []).flatMap(({ drive, points }) =>
        routeSegments(`drive-${drive.id}`, points, driveGaps(drive), c.accent)
      ),
    [data, c]
  );
  // A dot halfway along each completed road.
  const roadDots = useMemo(
    () =>
      showIconicRoads && roadTotals
        ? [...roadTotals.keys()]
            .map(getRoad)
            .filter(Boolean)
            .map((road) => {
              const [latitude, longitude] = road.line[Math.floor(road.line.length / 2)];
              return { id: road.id, name: road.name, coordinate: { latitude, longitude } };
            })
        : [],
    [showIconicRoads, roadTotals]
  );

  const fit = () => {
    const all = segments.flatMap((s) => s.coordinates);
    if (all.length < 2) return;
    mapRef.current?.fitToCoordinates(all, {
      edgePadding: {
        top: insets.top + 72,
        right: 32,
        bottom: SHEET_HEIGHT + insets.bottom + 24,
        left: 32,
      },
      animated: false,
    });
  };
  // Fit once the routes arrive (the map may be ready first).
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || segments.length === 0) return;
    fitted.current = true;
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  // Without location (never prompted for here), it re-fits to every route instead.
  const centreOnMe = async () => {
    const pos = (await getLocationAccess()).granted
      ? await Location.getLastKnownPositionAsync()
      : null;
    if (!pos) return fit();
    mapRef.current?.animateToRegion(
      {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: POSITION_DELTA,
        longitudeDelta: POSITION_DELTA,
      },
      500
    );
  };

  const trips = data?.trips ?? [];
  const totals = computeTotals(trips);
  const distance = distanceParts(totals.distanceM, units, { whole: true });
  const countryCount = summarizeCountries(
    trips
      .flatMap((t) => t.drives)
      .sort((a, b) => a.startedAt - b.startedAt)
      .flatMap((d) => d.countries ?? [])
  ).length;
  const stats = [
    [distance.value, distance.unit],
    [String(totals.tripCount), totals.tripCount === 1 ? 'trip' : 'trips'],
    [String(countryCount), countryCount === 1 ? 'country' : 'countries'],
  ];

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        userInterfaceStyle={scheme}
        onMapReady={() => {
          if (segments.length > 0) fit();
        }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {segments.map((s) => (
          <Polyline
            key={s.key}
            coordinates={s.coordinates}
            strokeColor={s.color}
            strokeWidth={3}
            {...(s.dotted ? { lineDashPattern: [1, 8], lineCap: 'round' } : null)}
          />
        ))}
        {roadDots.map((r) => (
          <Marker
            key={r.id}
            coordinate={r.coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            accessibilityLabel={r.name}
            onPress={() => router.push(`/roads/${r.id}`)}
          >
            <View style={styles.roadDot} />
          </Marker>
        ))}
      </MapView>

      <IconButton
        icon="arrow_back"
        variant="floating"
        accessibilityLabel="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))}
        style={[styles.button, styles.left, { top: insets.top + 12 }]}
      />
      <IconButton
        icon="my_location"
        variant="floating"
        accessibilityLabel="Centre on my position"
        onPress={() => centreOnMe().catch(() => fit())}
        style={[styles.button, styles.right, { top: insets.top + 12 }]}
      />

      <View style={[styles.sheet, dark && styles.sheetDark, { paddingBottom: insets.bottom + 24 }]}>
        {trips.length > 0 ? (
          <Text style={[type.bodyStrong, styles.since]}>Since {firstDriveMonth(trips)}</Text>
        ) : null}
        <View style={styles.stats}>
          {stats.map(([value, unit]) => (
            <View key={unit} style={styles.stat}>
              <Text style={[type.stat, styles.value]}>{value}</Text>
              <Text style={[type.small, styles.muted]}>{unit}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.mapLand },
  button: { position: 'absolute' },
  left: { left: 12 },
  right: { right: 12 },
  roadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.card,
    backgroundColor: c.roadBadge,
  },
  // A fixed panel, not a draggable sheet: square corners, no handle.
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 20,
    paddingHorizontal: 16,
    backgroundColor: c.card,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  sheetDark: { shadowOpacity: 0.5 },
  since: { color: c.text, textAlign: 'center', marginBottom: 10 },
  stats: { flexDirection: 'row', paddingBottom: 4 },
  stat: { flex: 1, alignItems: 'center' },
  value: { color: c.accent, fontSize: 22, lineHeight: 28 },
  muted: { color: c.textMuted },
});
