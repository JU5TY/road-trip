import { router } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { spacing, type } from '../../theme';
import Icon from '../ui/Icon';
import IconButton from '../ui/IconButton';

export const MAP_HEIGHT = 400;

/**
 * Trip page: a full-width map under the status bar with a round back
 * button, the content below it on a panel that slides up over the map (the
 * map scrolls at half speed, so it seems to stay behind), and a floating
 * toolbar at the bottom.
 * actions: [{ icon, label, onPress, primary? }]; a primary action shows its label.
 * `mapHeight` below the status bar: 400 on Trip, 380 on Day, 360 on a road.
 */
export default function DetailLayout({
  map,
  mapHeight = MAP_HEIGHT,
  actions = [],
  scrollRef,
  children,
}) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const [scrollY] = useState(() => new Animated.Value(0));
  // Scrolling up, the map moves at half speed; pulled down past the top, it
  // stays pinned while the content bounces.
  const mapShift = scrollY.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-1, 0, 0.5],
  });

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        ref={scrollRef}
        // The panel's own colour runs to the end, under the toolbar.
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        <Animated.View
          style={[
            styles.map,
            { height: mapHeight + insets.top, transform: [{ translateY: mapShift }] },
          ]}
        >
          {map}
        </Animated.View>
        <View style={[styles.content, { paddingBottom: 120 + insets.bottom }]}>{children}</View>
      </Animated.ScrollView>
      <IconButton
        icon="arrow_back"
        variant="floating"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={[styles.back, { top: insets.top + 12 }]}
      />
      {actions.length > 0 ? <Toolbar actions={actions} bottom={insets.bottom + 28} /> : null}
    </View>
  );
}

function Toolbar({ actions, bottom }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.toolbarWrap, { bottom }]} pointerEvents="box-none">
      <View style={styles.toolbar}>
        {actions.map((a) =>
          a.primary ? (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Icon name={a.icon} size={22} color={c.onAccent} />
              <Text style={[type.button, { color: c.onAccent }]}>{a.label}</Text>
            </Pressable>
          ) : (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}
              accessibilityRole="button"
              accessibilityLabel={a.label}
            >
              <Icon name={a.icon} size={24} color={c.text} />
            </Pressable>
          )
        )}
      </View>
    </View>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  map: { backgroundColor: c.surface },
  scrollContent: { flexGrow: 1 },
  // A straight top edge where it meets the map (the Google logo stays clear).
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    backgroundColor: c.background,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
  },
  back: { position: 'absolute', left: 12 },
  toolbarWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderRadius: 32,
    backgroundColor: c.toolbar,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  tool: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  toolPressed: { backgroundColor: c.track },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    paddingLeft: 18,
    paddingRight: 22,
    borderRadius: 26,
    backgroundColor: c.accent,
  },
  pressed: { opacity: 0.85 },
});
