import { formatDurationShort } from '../../utils/format';

/** Name of a drive's i-th rest stop, falling back to a generic label. */
const stopName = (drive, i) => drive.places.stops?.[i] || 'Rest stop';

/** Map key of a rest stop marker (shared by the map and the timeline). */
export const stopMarkerKey = (driveId, startedAt) => `stop-${driveId}-${startedAt}`;

/** Rest stop markers for a drive's map, ringed in the drive's route colour. */
export function stopMarkers(drive, color) {
  return drive.stats.stops.map((s, i) => ({
    key: stopMarkerKey(drive.id, s.startedAt),
    kind: 'stop',
    coordinate: { latitude: s.latitude, longitude: s.longitude },
    title: stopName(drive, i),
    description: formatDurationShort(s.endedAt - s.startedAt),
    color,
  }));
}

/**
 * Start and finish dots for a route, plus every drive's rest stops. In draw
 * order: stops, then start, then finish on top (a round trip ends where it began).
 * colorOf(drive) is the drive's route colour (its day's colour on a trip map).
 */
export function routeMarkers({
  firstPoint,
  lastPoint,
  startName,
  endName,
  drives,
  c,
  colorOf = () => c.accent,
}) {
  return [
    ...drives.flatMap((d) => stopMarkers(d, colorOf(d))),
    ...(firstPoint
      ? [
          {
            key: 'start',
            kind: 'start',
            coordinate: firstPoint,
            title: startName || 'Start',
            color: c.start,
          },
        ]
      : []),
    ...(lastPoint
      ? [
          {
            key: 'end',
            kind: 'finish',
            coordinate: lastPoint,
            title: endName || 'Finish',
            color: c.finish,
          },
        ]
      : []),
  ];
}
