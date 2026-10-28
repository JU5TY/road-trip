// Material 3 look with one green accent, in light and dark. Screens read the
// palette for the phone's current setting through useTheme() (src/hooks/useTheme.js).
const light = {
  background: '#FFFFFF',
  surface: '#F1F3F4', // cards, round buttons, nav bar
  surfaceLow: '#F8F9FA', // list cards (trip cards)
  outline: '#DADCE0',
  outlineStrong: '#72777F', // switch track when off
  divider: '#ECEEF0',
  text: '#1B1C1E',
  textMuted: '#44474E',
  accent: '#00796B',
  onAccent: '#FFFFFF',
  accentContainer: '#CDEFE9',
  onAccentContainer: '#00201C',
  accentContainerMuted: '#005047', // secondary text on accentContainer
  // The big green stat card (Driving time).
  statAccent: '#00796B',
  onStatAccent: '#FFFFFF',
  statAccentIcon: '#FFFFFF',
  statAccentIconWell: 'rgba(255,255,255,0.18)',
  warningContainer: '#FEEFC3',
  onWarningContainer: '#5F3B00',
  stop: '#D93025',
  onStop: '#FFFFFF',
  start: '#1E8E3E',
  finish: '#D93025',
  // Drawn map illustrations (Welcome, empty Home).
  mapLand: '#EEF2EC',
  mapWater: '#C9DDF2',
  mapRoad: '#FFFFFF',
  floating: '#FFFFFF', // round buttons over the map
  toolbar: '#E6EBE9', // floating action toolbar
  navBar: '#F1F3F4',
  navPill: '#CDEFE9',
  onNavPill: '#00201C',
  scrim: 'rgba(0,0,0,0.32)',
  dayColors: ['#F29900', '#1A73E8', '#9334E6'],
  // Number badges in the Days list: [background, text] per day colour.
  dayBadges: [
    ['#FEEFC3', '#5F3B00'],
    ['#D2E3FC', '#0B2E6B'],
    ['#F3E8FD', '#3B0A6B'],
  ],
};

const dark = {
  background: '#111416',
  surface: '#1E2225',
  surfaceLow: '#191C1F',
  outline: '#3A3F42',
  outlineStrong: '#8C9199',
  divider: '#2A2E31',
  text: '#E2E3E3',
  textMuted: '#C4C7C5',
  accent: '#5CD5C4',
  onAccent: '#003731',
  accentContainer: '#0F3B36',
  onAccentContainer: '#A6F2E5',
  accentContainerMuted: '#7FD3C6',
  statAccent: '#00504A',
  onStatAccent: '#E2F7F3',
  statAccentIcon: '#A6F2E5',
  statAccentIconWell: 'rgba(166,242,229,0.14)',
  warningContainer: '#3D3214',
  onWarningContainer: '#FDD663',
  stop: '#F2B8B5',
  onStop: '#601410',
  start: '#34A853',
  finish: '#EA4335',
  mapLand: '#1C2226',
  mapWater: '#1E3348',
  mapRoad: '#2C343A',
  floating: '#2A2F31',
  toolbar: '#2A2F31',
  navBar: '#1A1D1F',
  navPill: '#00504A',
  onNavPill: '#A6F2E5',
  scrim: 'rgba(0,0,0,0.5)',
  dayColors: ['#FDD663', '#8AB4F8', '#C58AF9'],
  dayBadges: [
    ['#3D3214', '#FDD663'],
    ['#1C2F4D', '#8AB4F8'],
    ['#33204A', '#D7AEFB'],
  ],
};

export const palettes = { light, dark };

/** Route colour for day N of a trip; repeats after three days. */
export const dayColorFor = (palette, dayNumber) =>
  palette.dayColors[(dayNumber - 1) % palette.dayColors.length];

/** [background, text] of day N's number badge. */
export const dayBadgeFor = (palette, dayNumber) =>
  palette.dayBadges[(dayNumber - 1) % palette.dayBadges.length];

// Roboto Flex, one static file per weight (loaded in src/app/_layout.js). Set
// fontFamily only, never fontWeight, or Android falls back to the system font.
export const fonts = {
  regular: 'RobotoFlex-Regular', // 400
  medium: 'RobotoFlex-Medium', // 500: stat numbers
  semibold: 'RobotoFlex-SemiBold', // 600: labels, section headers
  strong: 'RobotoFlex-Strong', // 650: titles, buttons
  bold: 'RobotoFlex-Bold', // 700
  display: 'RobotoFlex-Display', // 500 cut for large sizes: hero numbers
};

export const fontFiles = {
  [fonts.regular]: require('../assets/fonts/RobotoFlex-Regular.ttf'),
  [fonts.medium]: require('../assets/fonts/RobotoFlex-Medium.ttf'),
  [fonts.semibold]: require('../assets/fonts/RobotoFlex-SemiBold.ttf'),
  [fonts.strong]: require('../assets/fonts/RobotoFlex-Strong.ttf'),
  [fonts.bold]: require('../assets/fonts/RobotoFlex-Bold.ttf'),
  [fonts.display]: require('../assets/fonts/RobotoFlex-Display.ttf'),
};

// Text styles, without colour.
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 96, lineHeight: 100, letterSpacing: -2 },
  display: { fontFamily: fonts.display, fontSize: 56, lineHeight: 60, letterSpacing: -1.5 },
  headline: { fontFamily: fonts.strong, fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: fonts.strong, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  section: { fontFamily: fonts.strong, fontSize: 20, lineHeight: 26 },
  statLarge: { fontFamily: fonts.medium, fontSize: 32, lineHeight: 38, letterSpacing: -0.3 },
  stat: { fontFamily: fonts.medium, fontSize: 28, lineHeight: 34 },
  statUnit: { fontFamily: fonts.medium, fontSize: 15 },
  bodyLarge: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 0.2 },
  button: { fontFamily: fonts.strong, fontSize: 15, lineHeight: 20 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  caps: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  nav: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  navActive: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 16, lg: 24, card: 28, pill: 999 };
