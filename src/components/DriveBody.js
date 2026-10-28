import { useMemo } from 'react';

import { colors } from '../theme';
import { formatDurationShort } from '../utils/format';
import { downsample } from '../utils/geoMath';
import { driveElapsedMs } from '../utils/tripSummary';
import RestStopsCard, { stopName } from './RestStopsCard';
import RouteMap from './RouteMap';
import TelemetryCard from './TelemetryCard';

/** Map, telemetry and rest stops for one drive. Used by the Drive screen and single-drive trips. */
export default function DriveBody({ drive, points, units }) {
  const route = useMemo(
    () => downsample(points).map(({ latitude, longitude }) => ({ latitude, longitude })),
    [points]
  );

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
          ...drive.stats.stops.map((s, i) => ({
            key: `stop-${s.startedAt}`,
            coordinate: { latitude: s.latitude, longitude: s.longitude },
            title: stopName(drive, i),
            description: formatDurationShort(s.endedAt - s.startedAt),
            color: 'orange',
          })),
        ]
      : [];

  return (
    <>
      <RouteMap
        segments={[{ key: 'route', coordinates: route, color: colors.accent }]}
        markers={markers}
      />
      <TelemetryCard stats={drive.stats} elapsedMs={driveElapsedMs(drive)} units={units} />
      <RestStopsCard drive={drive} />
    </>
  );
}
