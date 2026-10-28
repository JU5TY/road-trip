import { formatDurationShort } from '../../utils/format';

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

/** Start and finish pins for a route, plus every drive's rest stops. */
export function routeMarkers({ firstPoint, lastPoint, startName, endName, drives, c }) {
  return [
    ...(firstPoint
      ? [{ key: 'start', coordinate: firstPoint, title: startName || 'Start', color: c.start }]
      : []),
    ...(lastPoint
      ? [{ key: 'end', coordinate: lastPoint, title: endName || 'Finish', color: c.finish }]
      : []),
    ...drives.flatMap(stopMarkers),
  ];
}
