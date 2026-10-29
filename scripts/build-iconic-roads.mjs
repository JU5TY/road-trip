// Builds src/data/iconicRoads.json, the bundled Iconic Roads list.
// Run by hand when roads are added or changed: `node scripts/build-iconic-roads.mjs`
//
// Road lines come from OpenStreetMap data (© OpenStreetMap contributors, ODbL):
//   - public roads: routed with the OSRM demo server between two anchors, then
//     trimmed to the steps whose road name/ref matches `match`
//   - the Nordschleife: the raceway ways from the Overpass API (cars can't be
//     routed onto a raceway)
// Heights come from the Open-Meteo elevation API (Copernicus DEM).
import { writeFile } from 'node:fs/promises';

const UA = { 'User-Agent': 'road-trip-app-build/0.1 (justwoodford@gmail.com)' };
const SPACING_M = 40; // distance between stored line points
const OUT = new URL('../src/data/iconicRoads.json', import.meta.url);

/** anchors: [lng, lat] points to route through; match: which steps belong to the road. */
const ROADS = [
  {
    id: 'snake-pass',
    name: 'Snake Pass',
    region: 'Peak District',
    country: 'England',
    roadType: 'A road',
    from: 'Glossop',
    to: 'Ladybower',
    blurb:
      'The A57 over the moors between Glossop and Ladybower, climbing to 510 m with long sweeping bends and big views.',
    anchors: [
      [-1.9367, 53.4441],
      [-1.7134, 53.3797],
    ],
    match: /Snake Road/,
  },
  {
    id: 'winnats-pass',
    name: 'Winnats Pass',
    region: 'Peak District',
    country: 'England',
    roadType: 'Narrow lane',
    from: 'Castleton',
    to: 'Windy Knoll',
    blurb:
      'A steep, narrow limestone gorge above Castleton, climbing at up to 1 in 5 between grassy cliffs.',
    anchors: [
      [-1.779, 53.344],
      [-1.82, 53.3405],
    ],
    match: /Winnats/,
  },
  {
    id: 'cat-and-fiddle',
    name: 'Cat and Fiddle',
    region: 'Peak District',
    country: 'England',
    roadType: 'A road',
    from: 'Macclesfield',
    to: 'Buxton',
    blurb:
      'The A537 across the moors from Macclesfield to Buxton, named after the inn near its highest point.',
    anchors: [
      [-2.115, 53.2585],
      [-1.93, 53.256],
    ],
    match: /Buxton New Road|Macclesfield (Main )?Road/,
  },
  {
    id: 'hardknott-wrynose',
    name: 'Hardknott and Wrynose',
    region: 'Lake District',
    country: 'England',
    roadType: 'Single track',
    from: 'Little Langdale',
    to: 'Eskdale',
    blurb:
      "Two back-to-back passes with gradients of 1 in 3, among England's steepest roads. Low gears and patience.",
    anchors: [
      [-3.0466, 54.4229],
      [-3.2733, 54.3965],
    ],
    match: /Wrynose|Hardknott/,
  },
  {
    id: 'bealach-na-ba',
    name: 'Bealach na Bà',
    region: 'Highlands',
    country: 'Scotland',
    roadType: 'Single track',
    from: 'Tornapress',
    to: 'Applecross',
    blurb:
      'A single-track pass with hairpin bends like an Alpine road, climbing from sea level to 626 m. Use the passing places and take it slowly.',
    anchors: [
      [-5.4935, 57.4025],
      [-5.8131, 57.4337],
    ],
    match: /Bealach|C1087/,
  },
  {
    id: 'glen-coe',
    name: 'Glen Coe',
    region: 'Highlands',
    country: 'Scotland',
    roadType: 'A road',
    from: 'Kingshouse',
    to: 'Glencoe village',
    blurb:
      'The A82 from Rannoch Moor down through the glen, beneath the Three Sisters and Buachaille Etive Mòr.',
    anchors: [
      [-4.827, 56.645],
      [-5.103, 56.6825],
    ],
    match: /A82/,
  },
  {
    id: 'black-mountain-pass',
    name: 'Black Mountain Pass',
    region: 'Brecon Beacons',
    country: 'Wales',
    roadType: 'A road',
    from: 'Llangadog',
    to: 'Brynamman',
    blurb:
      'The A4069 over the Black Mountain, with hairpins at Tro Gwcw and open views across the Bannau Brycheiniog.',
    anchors: [
      [-3.889, 51.94],
      [-3.867, 51.815],
    ],
    match: /A4069/,
  },
  {
    id: 'horseshoe-pass',
    name: 'Horseshoe Pass',
    region: 'North Wales',
    country: 'Wales',
    roadType: 'A road',
    from: 'Llangollen',
    to: 'Ponderosa',
    blurb:
      'The A542 from Llangollen, curving round a horseshoe-shaped valley up to the Ponderosa café at the top.',
    anchors: [
      [-3.1915, 52.994],
      [-3.216, 53.03],
    ],
    match: /A542/,
  },
  {
    id: 'cheddar-gorge',
    name: 'Cheddar Gorge',
    region: 'Somerset',
    country: 'England',
    roadType: 'B road',
    from: 'Cheddar',
    to: 'Black Rock',
    blurb:
      "The B3135 through England's largest gorge, winding between limestone cliffs up to 137 m high.",
    anchors: [
      [-2.7765, 51.2797],
      [-2.718, 51.2984],
    ],
    match: /B3135/,
  },
  {
    id: 'buttertubs-pass',
    name: 'Buttertubs Pass',
    region: 'Yorkshire Dales',
    country: 'England',
    roadType: 'Narrow road',
    from: 'Thwaite',
    to: 'Simonstone',
    blurb:
      'A high moorland road between Swaledale and Wensleydale, named after the limestone potholes beside it.',
    anchors: [
      [-2.164, 54.38],
      [-2.201, 54.318],
    ],
    match: /Cliff Gate/,
  },
];

const RING = {
  id: 'nordschleife',
  name: 'Nürburgring Nordschleife',
  region: 'Eifel',
  country: 'Germany',
  roadType: 'Toll road, one way',
  from: 'Döttinger Höhe',
  to: 'Döttinger Höhe',
  blurb:
    'The Green Hell: 73 corners through the Eifel forest. On tourist days it is a public toll road, with laps bought at the Döttinger Höhe gate.',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function haversine([lng1, lat1], [lng2, lat2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const lengthOf = (line) => line.reduce((sum, p, i) => (i ? sum + haversine(line[i - 1], p) : 0), 0);

/** Evenly spaced points along a line, keeping both ends. */
function resample(line, spacing) {
  const out = [line[0]];
  let carry = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const seg = haversine(a, b);
    let t = spacing - carry;
    while (t <= seg) {
      const f = t / seg;
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      t += spacing;
    }
    carry = seg - (t - spacing);
  }
  const last = line.at(-1);
  if (haversine(out.at(-1), last) > 1) out.push(last);
  return out;
}

async function routedLine(road) {
  const coords = road.anchors.map((p) => p.join(',')).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false&steps=true&geometries=geojson`;
  const res = await fetch(url, { headers: UA });
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error(`${road.id}: OSRM ${data.code}`);
  const steps = data.routes[0].legs.flatMap((l) => l.steps);
  const matching = steps
    .map((s, i) => ({ i, s, label: `${s.ref ?? ''} ${s.name ?? ''}` }))
    .filter(({ label }) => road.match.test(label));
  if (matching.length === 0) throw new Error(`${road.id}: no steps match ${road.match}`);
  // Keep the run from the first to the last matching step, so a short unnamed
  // stretch in the middle (a bridge, a junction) doesn't split the road.
  const first = matching[0].i;
  const last = matching.at(-1).i;
  const line = [];
  for (const s of steps.slice(first, last + 1)) {
    for (const p of s.geometry.coordinates) {
      if (!line.length || haversine(line.at(-1), p) > 0.5) line.push(p);
    }
  }
  return line;
}

/**
 * The Nordschleife tourist lap, from the raceway ways in OSM. The track is
 * mapped as one-way pieces per corner (Hatzenbach, Flugplatz, ...) drawn in the
 * driving direction, so following each piece's last node to the next piece's
 * first node walks the lap clockwise. A tourist lap joins at T13 from the car
 * park and leaves after Antoniusbuche, skipping Tiergarten and Hohenrain.
 */
async function ringLine() {
  const query = `[out:json][timeout:90];
way["highway"="raceway"]["access"="private"](50.32,6.90,50.40,7.03);
(._;>;);out body;`;
  const servers = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];
  let data;
  for (const server of servers) {
    try {
      const res = await fetch(server, {
        method: 'POST',
        headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
      break;
    } catch (err) {
      console.warn(`overpass ${server} failed: ${err.message}`);
    }
  }
  if (!data) throw new Error('nordschleife: every Overpass server failed');
  const nodes = new Map(
    data.elements.filter((e) => e.type === 'node').map((n) => [n.id, [n.lon, n.lat]])
  );
  const ways = data.elements.filter((e) => e.type === 'way');
  const byFirstNode = new Map();
  for (const w of ways) byFirstNode.set(w.nodes[0], [...(byFirstNode.get(w.nodes[0]) ?? []), w]);

  let way = ways.find((w) => w.tags.name === 'T13');
  if (!way) throw new Error('nordschleife: no T13 way');
  const ids = [...way.nodes];
  const names = [way.tags.name];
  const seen = new Set([way.id]);
  while (way.tags.name !== 'Antoniusbuche') {
    const next = (byFirstNode.get(way.nodes.at(-1)) ?? []).filter((w) => !seen.has(w.id));
    if (next.length === 0)
      throw new Error(`nordschleife: lap breaks after ${way.tags.name ?? way.id}`);
    // At a fork, stay on the named Nordschleife piece rather than a short link.
    way = next.find((w) => w.tags.name) ?? next[0];
    seen.add(way.id);
    ids.push(...way.nodes.slice(1));
    if (way.tags.name && names.at(-1) !== way.tags.name) names.push(way.tags.name);
  }
  console.log(`nordschleife: ${names.length} sections, ${names[0]} → ${names.at(-1)}`);
  return ids.map((id) => nodes.get(id));
}

async function elevations(points) {
  const out = [];
  for (let i = 0; i < points.length; i += 100) {
    const batch = points.slice(i, i + 100);
    const lat = batch.map((p) => p[1].toFixed(5)).join(',');
    const lng = batch.map((p) => p[0].toFixed(5)).join(',');
    let data;
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(
        `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`,
        { headers: UA }
      );
      data = await res.json();
      if (data.elevation) break;
      // The free tier counts each point; wait out the per-minute limit.
      console.warn(`elevation: ${data.reason ?? 'failed'}, retrying in 65 s`);
      await sleep(65000);
    }
    if (!data.elevation) throw new Error(`elevation failed: ${JSON.stringify(data)}`);
    out.push(...data.elevation);
    await sleep(1000);
  }
  return out;
}

async function finish(meta, rawLine) {
  const line = resample(rawLine, SPACING_M);
  const heights = await elevations(resample(rawLine, 100));
  const round5 = (p) => [Number(p[1].toFixed(5)), Number(p[0].toFixed(5))]; // stored as [lat, lng]
  const road = {
    ...meta,
    lengthM: Math.round(lengthOf(rawLine)),
    highestM: Math.round(Math.max(...heights)),
    climbM: Math.round(Math.max(...heights) - Math.min(...heights)),
    line: line.map(round5),
  };
  delete road.anchors;
  delete road.match;
  console.log(
    `${road.id.padEnd(20)} ${(road.lengthM / 1000).toFixed(1).padStart(5)} km  highest ${road.highestM} m  climb ${road.climbM} m  ${road.line.length} pts`
  );
  return road;
}

const roads = [];
for (const meta of ROADS) {
  roads.push(await finish(meta, await routedLine(meta)));
  await sleep(1000);
}
roads.push(await finish(RING, await ringLine()));

await writeFile(
  OUT,
  `${JSON.stringify({ attribution: 'Road data © OpenStreetMap contributors (ODbL)', roads }, null, 0)}\n`
);
console.log(`wrote ${roads.length} roads to ${OUT.pathname}`);
