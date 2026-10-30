// Sample drives for Welcome's map: an illustration, not the user's data.
// [latitude, longitude] pairs, roughly along the real roads.

const p = (pairs) => pairs.map(([latitude, longitude]) => ({ latitude, longitude }));

/** Manchester to the Peak District, the Lakes and the Scottish Highlands, plus short branches. */
export const WELCOME_ROUTES = [
  // Manchester over Snake Pass to Ladybower
  p([
    [53.48, -2.24],
    [53.45, -2.05],
    [53.44, -1.87],
    [53.4, -1.75],
    [53.38, -1.7],
  ]),
  // Manchester to Buxton by the Cat and Fiddle
  p([
    [53.48, -2.24],
    [53.35, -2.12],
    [53.26, -2.02],
    [53.26, -1.91],
  ]),
  // Up the M6 to the Lakes
  p([
    [53.48, -2.24],
    [53.75, -2.6],
    [54.05, -2.75],
    [54.33, -2.75],
    [54.43, -2.96],
    [54.6, -3.13],
  ]),
  // Coniston branch
  p([
    [54.43, -2.96],
    [54.4, -3.02],
    [54.37, -3.07],
  ]),
  // Keswick to Glasgow and up through Glencoe to Inverness
  p([
    [54.6, -3.13],
    [54.75, -3.0],
    [54.89, -2.93],
    [55.3, -3.4],
    [55.86, -4.25],
    [56.08, -4.63],
    [56.4, -4.7],
    [56.68, -5.1],
    [56.82, -5.11],
    [57.1, -4.75],
    [57.48, -4.22],
  ]),
  // Fort William to Skye
  p([
    [56.82, -5.11],
    [56.95, -5.4],
    [57.15, -5.6],
    [57.28, -5.71],
    [57.3, -6.0],
  ]),
  // Glencoe to Oban
  p([
    [56.68, -5.1],
    [56.55, -5.3],
    [56.41, -5.47],
  ]),
];

/** West coast, south to north, for the sea under the routes. */
export const WELCOME_COAST = p([
  [52.9, -3.1],
  [53.3, -3.1],
  [53.6, -3.0],
  [53.9, -3.05],
  [54.15, -2.95],
  [54.2, -3.2],
  [54.5, -3.6],
  [54.9, -3.4],
  [54.85, -4.4],
  [55.4, -4.7],
  [55.9, -4.85],
  [56.4, -5.55],
  [56.8, -5.9],
  [57.3, -5.75],
  [57.7, -5.8],
]);

/** A few major roads, drawn faintly under the routes. */
export const WELCOME_ROADS = [
  p([
    [53.48, -2.24],
    [53.65, -1.9],
    [53.8, -1.55],
  ]),
  p([
    [54.6, -3.13],
    [54.66, -2.75],
    [54.44, -1.67],
  ]),
  p([
    [55.86, -4.25],
    [56.12, -3.94],
    [56.4, -3.43],
    [57.0, -3.9],
    [57.48, -4.22],
  ]),
];
