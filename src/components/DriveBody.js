import { useMemo, useRef } from 'react';

import { colors } from '../theme';
import { formatDurationShort } from '../utils/format';
import { downsample } from '../utils/geoMath';
import { buildDriveTimeline } from '../utils/timeline';
import { driveElapsedMs } from '../utils/tripSummary';
import RouteMap from './RouteMap';
import TelemetryCard from './TelemetryCard';
import TimelineCard from './TimelineCard';

/** Name of a drive's i-th rest stop, falling back to a generic label. */
const stopName = (drive, i) => drive.places.stops?.[i] || 'Rest stop';

/** Map key of a rest stop marker (shared by the map and the timeline). */
export const stopMarkerKey = (driveId, startedAt) => `stop-${driveId}-${startedAt}`;

/** Rest stop markers for a drive's map. */
export function stopMarkers(drive) {
  return drive.stats.stops.map((s, i) => ({
    key: stopMarkerKey(drive.id, s.startedAt),
    coordinate: { latitude: s.latitude, longitude: s.longitude },
    title: stopName(drive, i),
    description: formatDurationShort(s.endedAt - s.startedAt),
    color: 'orange',
  }));
}

/**
 * Map, telemetry and stop-by-stop timeline for one drive. Used by the Drive
 * screen and single-drive trips. `onShowMap` should scroll the map into view;
 * it is called before zooming to a tapped stop.
 */
export default function DriveBody({ drive, points, units, onShowMap }) {
  const mapRef = useRef(null);
  const route = useMemo(
    () => downsample(points).map(({ latitude, longitude }) => ({ latitude, longitude })),
    [points]
  );
  const timeline = useMemo(() => buildDriveTimeline(drive, points), [drive, points]);

  const markers =
    route.length > 0
      ? [
          { key: 'start', coordinate: route[0], title: drive.places.start || 'Start', color: colors.start },
          {
            key: 'end',
            coordinate: route.at(-1),
            title: drive.places.end || 'Finish',
            color: colors.stop,
          },
          ...stopMarkers(drive),
        ]
      : [];

  const showStop = (item) => {
    onShowMap?.();
    mapRef.current?.focusMarker(stopMarkerKey(drive.id, item.time));
  };

  return (
    <>
      <RouteMap
        ref={mapRef}
        segments={[{ key: 'route', coordinates: route, color: colors.accent }]}
        markers={markers}
      />
      <TelemetryCard stats={drive.stats} elapsedMs={driveElapsedMs(drive)} units={units} />
      <TimelineCard items={timeline} units={units} onStopPress={showStop} />
    </>
  );
}
