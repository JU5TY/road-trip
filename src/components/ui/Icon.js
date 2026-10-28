import Svg, { Path } from 'react-native-svg';

import paths from './iconPaths';

/**
 * Material Symbols Rounded icon. `filled` uses the filled variant when the icon
 * has one (see iconPaths.js), e.g. the selected tab.
 */
export default function Icon({ name, size = 24, color, filled = false, style }) {
  const variants = paths[name];
  if (!variants) {
    if (__DEV__) console.warn(`[Icon] unknown icon "${name}"`);
    return null;
  }
  const d = (filled && variants[1]) || variants[0];
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" style={style}>
      <Path d={d} fill={color} />
    </Svg>
  );
}
