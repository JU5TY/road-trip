import { router } from 'expo-router';
import { View } from 'react-native';

import { useStyles } from '../../hooks/useTheme';
import { completedLabel, dayLabel, getRoad } from '../../utils/iconicRoads';
import SectionHeader from '../ui/SectionHeader';
import RoadRow from './RoadRow';

/**
 * "Iconic Roads" on a Trip or Day page: one row per road, counting completions
 * on this trip/day ("Completed 2 times · Day 3"). `dayOf(driveId)` gives the day
 * number for the suffix; leave it out on a Day page. Renders nothing when
 * there are no completions.
 */
export default function IconicRoadsSection({ completions, dayOf }) {
  const styles = useStyles(makeStyles);
  const groups = new Map();
  for (const c of completions) {
    if (!getRoad(c.roadId)) continue;
    const g = groups.get(c.roadId) ?? { road: getRoad(c.roadId), count: 0, days: [] };
    g.count += 1;
    if (dayOf) g.days.push(dayOf(c.driveId));
    groups.set(c.roadId, g);
  }
  if (groups.size === 0) return null;
  return (
    <>
      <SectionHeader
        title="Iconic Roads"
        actionLabel="All roads"
        onAction={() => router.push('/roads')}
        style={styles.header}
      />
      <View style={styles.list}>
        {[...groups.values()].map(({ road, count, days }) => (
          <RoadRow
            key={road.id}
            completed
            name={road.name}
            subtitle={
              dayOf ? `${completedLabel(count)} · ${dayLabel(days)}` : completedLabel(count)
            }
            onPress={() => router.push(`/roads/${road.id}`)}
          />
        ))}
      </View>
    </>
  );
}

const makeStyles = () => ({
  header: { marginBottom: 14 },
  list: { gap: 8 },
});
