import { useMemo } from 'react';

import { useSettings } from '../../context/SettingsContext';
import { useRoadTotals } from '../../hooks/useRoadTotals';
import { countryRows } from '../../utils/countries';
import { driveGaps, withoutCrossings } from '../../utils/crossings';
import { averageMovingSpeed } from '../../utils/geoMath';
import { getRoad } from '../../utils/iconicRoads';
import { buildDriveTimeline } from '../../utils/timeline';
import { driveElapsedMs } from '../../utils/tripSummary';
import ChartsCard from '../charts/ChartsCard';
import CountriesSection from '../countries/CountriesSection';
import IconicRoadsSection from '../roads/IconicRoadsSection';
import Timeline from './Timeline';
import { DetailsRows, HeroStats } from './TripStats';
import VehicleSection from './VehicleSection';

/**
 * One drive of a trip, as the Trip page shows it when its pill is picked (or
 * when the trip is just that drive): stats, timeline, roads, countries,
 * charts, vehicle and details. `completions` are this drive's Iconic Roads,
 * `photos` those taken during it; onChangeVehicle opens the picker (null when
 * there's nothing to change to).
 */
export default function DriveSections({
  drive,
  points,
  color,
  completions,
  photos,
  vehicle,
  onChangeVehicle,
  onStopPress,
  onScrub,
}) {
  const { units, showIconicRoads } = useSettings();
  const roadTotals = useRoadTotals();
  const timeline = useMemo(() => buildDriveTimeline(drive, points), [drive, points]);
  const chartMarkers = useMemo(
    () => (drive.countries ?? []).slice(1).map((v) => ({ time: v.enteredAt, label: 'Border' })),
    [drive]
  );
  // A drive that is just an Iconic Road (starts and ends at its gates) shows no times.
  const hideTimes = Boolean(drive.stats.timesHidden);
  const roadsShown = showIconicRoads ? completions : [];
  const countries = countryRows([drive]);

  return (
    <>
      <HeroStats
        stats={drive.stats}
        units={units}
        avgSpeedMps={averageMovingSpeed(drive.stats)}
        timesHidden={hideTimes}
        roadCount={new Set(roadsShown.map((r) => r.roadId)).size}
        countryCount={countries.length}
      />
      <Timeline
        items={timeline}
        color={color}
        units={units}
        onStopPress={onStopPress}
        roads={roadsShown.map((r) => ({
          name: getRoad(r.roadId)?.name,
          completedAt: r.completedAt,
        }))}
        hideTimes={hideTimes}
        photos={photos}
      />
      <IconicRoadsSection
        completions={roadsShown}
        totals={roadTotals ?? new Map()}
        today={new Date(drive.startedAt).toDateString() === new Date().toDateString()}
      />
      <CountriesSection rows={countries} units={units} scope="drive" />
      <ChartsCard
        tracks={[{ key: 'route', color, points: withoutCrossings(points, driveGaps(drive)) }]}
        units={units}
        avgSpeedMps={averageMovingSpeed(drive.stats)}
        onScrub={onScrub}
        speedHidden={hideTimes}
        markers={chartMarkers}
      />
      <VehicleSection vehicle={vehicle} onChange={onChangeVehicle} />
      <DetailsRows
        stats={drive.stats}
        elapsedMs={driveElapsedMs(drive)}
        units={units}
        timesHidden={hideTimes}
        subtitle="This drive"
      />
    </>
  );
}
