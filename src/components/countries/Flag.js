import * as flags from 'country-flag-icons/string/3x2';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useTheme } from '../../hooks/useTheme';
import Icon from '../ui/Icon';

/**
 * A country's flag, flat 3:2 with rounded corners and a faint outline; a globe
 * when there's no artwork. `flag` is getCountry()'s key ("FR", "GB_SCT").
 */
export default function Flag({ flag, width = 32 }) {
  const { c } = useTheme();
  const height = Math.round((width * 22) / 32);
  // Looked up by name, so the import rule can't check it.
  // eslint-disable-next-line import/namespace
  const xml = flag ? flags[flag] : null;
  if (!xml) return <Icon name="public" size={height} color={c.textMuted} />;
  return (
    <View
      style={{
        width,
        height,
        borderRadius: 3,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.12)',
      }}
    >
      <SvgXml xml={xml} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
    </View>
  );
}
