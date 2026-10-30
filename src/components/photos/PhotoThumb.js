import { Image } from 'expo-image';
import { Pressable } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

/** A square gallery photo with rounded corners; `children` draw on top (e.g. "+20"). */
export default function PhotoThumb({ photo, size, style, onPress, children }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel="Photo"
      style={[{ width: size, height: size, borderRadius: 8, overflow: 'hidden' }, style]}
    >
      <Image
        source={{ uri: photo.id }}
        style={{ flex: 1, backgroundColor: c.track }}
        contentFit="cover"
        recyclingKey={photo.id}
        transition={120}
      />
      {children}
    </Pressable>
  );
}
