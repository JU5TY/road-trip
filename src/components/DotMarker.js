import { useEffect, useState } from 'react';
import { Marker } from 'react-native-maps';

import { useTheme } from '../hooks/useTheme';

const DRAW_MS = 500;

/**
 * A map Marker drawn from a small custom view (a dot), centred on its point.
 * It tracks view changes until the view has drawn, then stops for speed: on
 * Android a marker frozen before its first draw shows up blank. It redraws when
 * the theme or `redrawKey` (e.g. its colour) changes. Other props go to Marker.
 */
export default function DotMarker({ redrawKey = '', children, ...props }) {
  const { scheme } = useTheme();
  const key = `${scheme}:${redrawKey}`;
  const [drawnFor, setDrawnFor] = useState(null);
  useEffect(() => {
    const id = setTimeout(() => setDrawnFor(key), DRAW_MS);
    return () => clearTimeout(id);
  }, [key]);
  return (
    <Marker anchor={{ x: 0.5, y: 0.5 }} {...props} tracksViewChanges={drawnFor !== key}>
      {children}
    </Marker>
  );
}
