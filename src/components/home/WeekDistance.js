import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { fonts, radius, type } from '../../theme';
import { distanceParts } from '../../utils/format';
import Icon from '../ui/Icon';

const DAYS = 7;
const CHART_W = 206;
const CHART_H = 98;
const BAR_W = 16;
const BAR_MAX = 64; // tallest bar
const BASE_Y = 74; // bars stand on this line; labels sit under it

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Metres driven on each of the last 7 days, oldest first: [{ date, metres }]. */
export function lastSevenDays(trips, now = Date.now()) {
  const days = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ date: d, metres: 0 });
  }
  const index = new Map(days.map((day, i) => [dayKey(day.date), i]));
  for (const trip of trips) {
    for (const drive of trip.drives) {
      const i = index.get(dayKey(new Date(drive.startedAt)));
      if (i !== undefined) days[i].metres += drive.stats.distanceM ?? 0;
    }
  }
  return days;
}

/** "Distance · Last 7 days" card: today's distance and a bar per day. Opens Trips. */
export default function WeekDistance({ trips, units, now }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const days = lastSevenDays(trips, now);
  const max = Math.max(...days.map((d) => d.metres), 1);
  const today = distanceParts(days.at(-1).metres, units);
  const step = (CHART_W - BAR_W) / (DAYS - 1);
  const label = days
    .map(
      (d) =>
        `${d.date.toLocaleDateString(undefined, { weekday: 'short' })} ${distanceParts(d.metres, units).value}`
    )
    .join(', ');

  return (
    <Pressable
      onPress={() => router.navigate('/trips')}
      accessibilityRole="link"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <View>
          <Text style={[type.section, styles.text]}>Distance</Text>
          <Text style={[type.label, styles.muted, styles.sub]}>Last 7 days</Text>
        </View>
        <Icon name="chevron_right" size={24} color={c.textMuted} />
      </View>
      <View style={styles.body}>
        <View style={styles.today}>
          <Text style={[type.statLarge, styles.value]} numberOfLines={1}>
            {today.value}
            <Text style={type.statUnit}> {today.unit}</Text>
          </Text>
          <Text style={[type.label, styles.value, styles.todayLabel]}>Today</Text>
        </View>
        <Svg
          width={CHART_W}
          height={CHART_H}
          accessible
          accessibilityLabel={`Distance per day: ${label}`}
        >
          {days.map((d, i) => {
            const h = d.metres > 0 ? Math.max(6, (d.metres / max) * BAR_MAX) : 3;
            const x = i * step;
            const isToday = i === DAYS - 1;
            return [
              <Rect
                key={`b${i}`}
                x={x}
                y={BASE_Y - h}
                width={BAR_W}
                height={h}
                rx={3}
                fill={d.metres > 0 ? c.accent : c.progressTrack}
              />,
              <SvgText
                key={`l${i}`}
                x={x + BAR_W / 2}
                y={94}
                fontSize={13}
                fontFamily={isToday ? fonts.semibold : type.body.fontFamily}
                fill={isToday ? c.text : c.textMuted}
                textAnchor="middle"
              >
                {d.date.toLocaleDateString(undefined, { weekday: 'narrow' })}
              </SvgText>,
            ];
          })}
        </Svg>
      </View>
    </Pressable>
  );
}

const makeStyles = (c) => ({
  card: {
    marginTop: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderRadius: radius.card,
    backgroundColor: c.card,
    ...c.cardShadow,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  pressed: { opacity: 0.8 },
  text: { color: c.text },
  muted: { color: c.textMuted },
  sub: { fontFamily: type.body.fontFamily, marginTop: 2 },
  body: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 14 },
  today: { width: 92, paddingBottom: 20 },
  value: { color: c.accent },
  todayLabel: { fontFamily: type.body.fontFamily, marginTop: 6 },
});
