import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';

import { useTheme } from '../hooks/useTheme';

/**
 * Drawn map (land, a river, a few roads) for Welcome and the empty Home card.
 * With `route`, a three-day trip is drawn on top in the day colours.
 */
export default function MapIllustration({ height, route = false }) {
  const { c } = useTheme();
  const [day1, day2, day3] = c.dayColors;
  const line = { fill: 'none', strokeWidth: 9, strokeLinejoin: 'round', strokeLinecap: 'round' };

  return (
    <Svg width="100%" height={height} viewBox="0 0 390 440" preserveAspectRatio="xMidYMid slice">
      <Rect width="390" height="440" fill={c.mapLand} />
      <Path
        d="M-20 340 Q90 300 190 352 T420 320"
        fill="none"
        stroke={c.mapWater}
        strokeWidth={50}
      />
      <Path d="M0 140 Q120 110 210 160 T400 140" fill="none" stroke={c.mapRoad} strokeWidth={10} />
      <Path d="M270 -10 Q240 170 290 300 T270 460" fill="none" stroke={c.mapRoad} strokeWidth={8} />
      {route ? (
        <>
          <Polyline points="250,410 238,350 212,300 190,270" stroke={day1} {...line} />
          <Polyline points="190,270 150,248 118,232 92,206" stroke={day2} {...line} />
          <Polyline points="92,206 62,160 92,120 160,104 240,84 306,66" stroke={day3} {...line} />
          <Circle cx="250" cy="410" r="11" fill={c.start} stroke={c.mapRoad} strokeWidth={4} />
          <Circle cx="306" cy="66" r="11" fill={c.finish} stroke={c.mapRoad} strokeWidth={4} />
        </>
      ) : (
        <Path d="M40 460 Q70 340 140 280 T210 150" fill="none" stroke={c.mapRoad} strokeWidth={5} />
      )}
    </Svg>
  );
}
