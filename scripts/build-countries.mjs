// Builds src/data/countries.json, the bundled country borders used to work out
// which countries a drive went through. Run by hand when the borders need a refresh:
// `node scripts/build-countries.mjs`
//
// Borders come from Natural Earth's 1:10m "admin 0 map units" (public domain),
// which split the United Kingdom into England, Scotland, Wales and Northern
// Ireland. Other split countries (Belgium's regions, Portugal's islands, …) are
// merged back into one. Shapes are simplified with mapshaper to about 500 m,
// which is plenty for border crossings, and stored as encoded polylines.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_units.geojson';
const OUT = new URL('../src/data/countries.json', import.meta.url);
const PRECISION = 1e3; // ~100 m

const UK = {
  ENG: ['GB-ENG', 'England'],
  SCT: ['GB-SCT', 'Scotland'],
  WLS: ['GB-WLS', 'Wales'],
  NIR: ['GB-NIR', 'Northern Ireland'],
};
// Natural Earth's ADMIN names, shortened to what people say.
const NAMES = {
  'United States of America': 'United States',
  'Republic of Serbia': 'Serbia',
  'United Republic of Tanzania': 'Tanzania',
  'Macao S.A.R': 'Macao',
  'Hong Kong S.A.R.': 'Hong Kong',
  Aland: 'Åland',
  'Saint Barthelemy': 'Saint-Barthélemy',
  eSwatini: 'Eswatini',
  'The Bahamas': 'Bahamas',
};

/** Google encoded-polyline number. */
function encodeValue(v) {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let s = '';
  while (n >= 0x20) {
    s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return s + String.fromCharCode(n + 63);
}

/** A ring of [lng, lat] as an encoded polyline of lat, lng. */
function encodeRing(ring) {
  let lat0 = 0;
  let lng0 = 0;
  let s = '';
  for (const [lng, lat] of ring) {
    const lat1 = Math.round(lat * PRECISION);
    const lng1 = Math.round(lng * PRECISION);
    s += encodeValue(lat1 - lat0) + encodeValue(lng1 - lng0);
    lat0 = lat1;
    lng0 = lng1;
  }
  return s;
}

const dir = await mkdtemp(join(tmpdir(), 'countries-'));
const raw = join(dir, 'raw.geojson');
const prepped = join(dir, 'prepped.geojson');
const simplified = join(dir, 'simplified.geojson');

console.log('Downloading Natural Earth map units…');
const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
await writeFile(raw, Buffer.from(await res.arrayBuffer()));

const source = JSON.parse(await readFile(raw, 'utf8'));
// Dissolving keeps the first part's fields, so put each country's main part
// (the most people) first: France's flag, not French Guiana's.
source.features.sort((a, b) => b.properties.POP_EST - a.properties.POP_EST);
for (const f of source.features) {
  const p = f.properties;
  const [code, name] = p.ADM0_A3 === 'GBR' ? UK[p.GU_A3] : [p.ADM0_A3, NAMES[p.ADMIN] ?? p.ADMIN];
  const iso = p.ADM0_A3 === 'GBR' ? 'GB' : p.ISO_A2_EH;
  f.properties = { code, name, iso: /^[A-Z]{2}$/.test(iso) ? iso : null };
}
await writeFile(prepped, JSON.stringify(source));

console.log('Simplifying…');
execFileSync(
  'npx',
  [
    '--yes',
    'mapshaper@0.6.102',
    prepped,
    '-dissolve',
    'code',
    'copy-fields=name,iso',
    '-filter-islands',
    'min-area=30km2',
    'remove-empty',
    '-simplify',
    'interval=500',
    'keep-shapes',
    '-o',
    'precision=0.001',
    'format=geojson',
    simplified,
  ],
  { stdio: 'inherit' }
);

const { features } = JSON.parse(await readFile(simplified, 'utf8'));
const countries = features
  .map(({ properties: p, geometry: g }) => {
    const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
    let [minLat, minLng, maxLat, maxLng] = [90, 180, -90, -180];
    for (const poly of polys)
      for (const [lng, lat] of poly[0]) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      }
    return {
      code: p.code,
      name: p.name,
      iso: p.iso,
      bbox: [minLat, minLng, maxLat, maxLng],
      // Each polygon: outer ring, then any holes.
      polys: polys.map((poly) => poly.map(encodeRing)),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

await writeFile(
  OUT,
  JSON.stringify({ attribution: 'Borders: Natural Earth (public domain)', countries })
);
console.log(`Wrote ${countries.length} countries.`);
