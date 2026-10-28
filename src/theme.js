// Dark, high-contrast palette: readable at a glance in a car mount, day or night.
export const colors = {
  background: '#0E1116',
  surface: '#171B22',
  surfaceRaised: '#1F2530',
  border: '#2A313D',
  text: '#F3F5F8',
  textMuted: '#8B95A5',
  accent: '#F2A93B', // route / brand amber
  start: '#2FBF71',
  stop: '#E5484D',
  link: '#5B9DFF',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { md: 12, lg: 20, pill: 999 };

// One route colour per day of a multi-day trip; repeats after six days.
// Saturated so each stands out on the light map tiles.
export const dayColors = ['#F2A93B', '#3D7DF2', '#2FBF71', '#E5484D', '#9B5DE5', '#00A6A6'];
export const dayColor = (dayNumber) => dayColors[(dayNumber - 1) % dayColors.length];
