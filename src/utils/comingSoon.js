import { Alert } from 'react-native';

/** Placeholder for features shown in the design but not built yet (Premium, Share, Export). */
export const comingSoon = (what) =>
  Alert.alert('Coming soon', `${what} is coming in a future update.`);
