// Local time and the real sky where the CEO is. Every time and date in HQ uses
// his device's time zone (if he flies to Cyprus and his phone switches, HQ
// follows). The sun and moon are worked out for his location: the browser's
// position once (kept on this device), otherwise the main city of his time zone.
// `?time=21:30` previews a time of day (local, today); `?tz=Asia/Tokyo` previews a zone.

const DEG = Math.PI / 180;
const params = new URLSearchParams(location.search);
export const TZ = (() => {
  const want = params.get('tz');
  if (want) {
    try { new Intl.DateTimeFormat('en-GB', { timeZone: want }); return want; } catch { /* fall through */ }
  }
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
})();

// main city of common time zones: [lat, lon, place name]
const ZONES = {
  'Asia/Nicosia': [35.1856, 33.3823, 'Nicosia'], 'Asia/Famagusta': [35.12, 33.94, 'Famagusta'], 'Europe/Nicosia': [35.1856, 33.3823, 'Nicosia'],
  'Europe/London': [51.5072, -0.1276, 'London'], 'Europe/Dublin': [53.35, -6.26, 'Dublin'], 'Europe/Lisbon': [38.72, -9.14, 'Lisbon'],
  'Europe/Paris': [48.8566, 2.3522, 'Paris'], 'Europe/Berlin': [52.52, 13.405, 'Berlin'], 'Europe/Madrid': [40.4168, -3.7038, 'Madrid'],
  'Europe/Rome': [41.9028, 12.4964, 'Rome'], 'Europe/Amsterdam': [52.37, 4.9, 'Amsterdam'], 'Europe/Brussels': [50.85, 4.35, 'Brussels'],
  'Europe/Zurich': [47.37, 8.54, 'Zurich'], 'Europe/Vienna': [48.21, 16.37, 'Vienna'], 'Europe/Athens': [37.9838, 23.7275, 'Athens'],
  'Europe/Istanbul': [41.0082, 28.9784, 'Istanbul'], 'Europe/Moscow': [55.7558, 37.6173, 'Moscow'], 'Europe/Kyiv': [50.45, 30.52, 'Kyiv'],
  'Europe/Warsaw': [52.23, 21.01, 'Warsaw'], 'Europe/Stockholm': [59.33, 18.07, 'Stockholm'], 'Europe/Oslo': [59.91, 10.75, 'Oslo'],
  'Europe/Copenhagen': [55.68, 12.57, 'Copenhagen'], 'Europe/Helsinki': [60.17, 24.94, 'Helsinki'], 'Europe/Prague': [50.08, 14.44, 'Prague'],
  'Europe/Budapest': [47.5, 19.04, 'Budapest'], 'Europe/Bucharest': [44.43, 26.1, 'Bucharest'], 'Europe/Sofia': [42.7, 23.32, 'Sofia'],
  'Asia/Dubai': [25.2048, 55.2708, 'Dubai'], 'Asia/Beirut': [33.89, 35.5, 'Beirut'], 'Asia/Jerusalem': [31.77, 35.21, 'Jerusalem'],
  'Asia/Tel_Aviv': [32.08, 34.78, 'Tel Aviv'], 'Africa/Cairo': [30.0444, 31.2357, 'Cairo'], 'Asia/Riyadh': [24.71, 46.68, 'Riyadh'],
  'Asia/Qatar': [25.29, 51.53, 'Doha'], 'Asia/Kolkata': [28.61, 77.21, 'Delhi'], 'Asia/Singapore': [1.3521, 103.8198, 'Singapore'],
  'Asia/Hong_Kong': [22.32, 114.17, 'Hong Kong'], 'Asia/Shanghai': [31.23, 121.47, 'Shanghai'], 'Asia/Tokyo': [35.6762, 139.6503, 'Tokyo'],
  'Asia/Seoul': [37.57, 126.98, 'Seoul'], 'Asia/Bangkok': [13.76, 100.5, 'Bangkok'], 'Australia/Sydney': [-33.8688, 151.2093, 'Sydney'],
  'Australia/Melbourne': [-37.81, 144.96, 'Melbourne'], 'Pacific/Auckland': [-36.85, 174.76, 'Auckland'], 'Africa/Johannesburg': [-26.2, 28.05, 'Johannesburg'],
  'Africa/Lagos': [6.52, 3.38, 'Lagos'], 'Africa/Nairobi': [-1.29, 36.82, 'Nairobi'], 'America/New_York': [40.7128, -74.006, 'New York'],
  'America/Toronto': [43.65, -79.38, 'Toronto'], 'America/Chicago': [41.8781, -87.6298, 'Chicago'], 'America/Denver': [39.74, -104.99, 'Denver'],
  'America/Los_Angeles': [34.0522, -118.2437, 'Los Angeles'], 'America/Phoenix': [33.45, -112.07, 'Phoenix'], 'America/Mexico_City': [19.43, -99.13, 'Mexico City'],
  'America/Sao_Paulo': [-23.55, -46.63, 'São Paulo'], 'America/Buenos_Aires': [-34.6, -58.38, 'Buenos Aires'], 'America/Argentina/Buenos_Aires': [-34.6, -58.38, 'Buenos Aires'],
  'UTC': [51.48, 0, 'UTC'],
};

/** The place name shown next to the clock. */
export const PLACE = ZONES[TZ]?.[2] || TZ.split('/').pop().replace(/_/g, ' ');

// where to work the sky out for
const where = { lat: 35.1856, lon: 33.3823 };
{
  const z = ZONES[TZ];
  if (z) [where.lat, where.lon] = z;
  else {
    // unknown zone: a longitude from its UTC offset, a mid latitude
    where.lon = Math.max(-180, Math.min(180, -new Date().getTimezoneOffset() / 4));
    where.lat = 35;
  }
  try {
    const saved = JSON.parse(localStorage.getItem('ahq-geo') || 'null');
    if (saved && saved.tz === TZ && Number.isFinite(saved.lat)) Object.assign(where, saved);
  } catch { /* storage may be blocked */ }
  // the browser's position, once per time zone (only kept on this device)
  if (!params.has('tz') && navigator.geolocation) {
    try {
      navigator.geolocation.getCurrentPosition((pos) => {
        where.lat = pos.coords.latitude;
        where.lon = pos.coords.longitude;
        try { localStorage.setItem('ahq-geo', JSON.stringify({ lat: where.lat, lon: where.lon, tz: TZ })); } catch { /* ignore */ }
      }, () => {}, { maximumAge: 6 * 3600 * 1000, timeout: 15000 });
    } catch { /* ignore */ }
  }
}

let overrideMinutes = null;
{
  const t = params.get('time');
  const m = t && t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) overrideMinutes = Number(m[1]) * 60 + Number(m[2]);
}

// Offset of the local zone from UTC in minutes for a given instant (handles DST).
function tzOffsetMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** The instant the scene should show. */
export function sceneNow() {
  const now = new Date();
  if (overrideMinutes === null) return now;
  const off = tzOffsetMinutes(now);
  const local = new Date(now.getTime() + off * 60000); // fields in UTC == local time
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + overrideMinutes * 60000 - off * 60000 + (now.getSeconds() * 1000));
}

export function localClock(date = sceneNow()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export function localDate(date = sceneNow()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

/** Format any time/date in the CEO's zone (Intl options without timeZone). */
export function fmt(at, opts) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts }).format(at);
}

/**
 * Solar position (NOAA simplified). Returns altitude and azimuth in radians;
 * azimuth measured clockwise from north.
 */
export function sunPosition(date = sceneNow(), lat = where.lat, lon = where.lon) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = (gmst * 15 + lon) * DEG;
  const ha = lst - ra;
  const phi = lat * DEG;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
  return { altitude: alt, azimuth: (az + 2 * Math.PI) % (2 * Math.PI) };
}

/** Turn equatorial coordinates into altitude/azimuth for the place and time. */
function altAz(ra, dec, n, lat, lon) {
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = (gmst * 15 + lon) * DEG;
  const ha = lst - ra;
  const phi = lat * DEG;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
  return { altitude: alt, azimuth: (az + 2 * Math.PI) % (2 * Math.PI) };
}

/**
 * The real moon (low-precision orbital elements, with the largest
 * perturbations): where it is in the sky. Its phase follows from where it is
 * relative to the sun, so the sky draws it lit from the sun's side.
 */
export function moonPosition(date = sceneNow(), lat = where.lat, lon = where.lon) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451543.5;
  const n = jd - 2451545.0;
  const rev = (x) => ((x % 360) + 360) % 360;
  const N = rev(125.1228 - 0.0529538083 * d) * DEG;
  const i = 5.1454 * DEG;
  const w = rev(318.0634 + 0.1643573223 * d) * DEG;
  const e = 0.0549;
  const M = rev(115.3654 + 13.0649929509 * d) * DEG;
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 3; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xv = Math.cos(E) - e, yv = Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const xh = Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i);
  const yh = Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i);
  const zh = Math.sin(v + w) * Math.sin(i);
  let lonE = Math.atan2(yh, xh);
  let latE = Math.atan2(zh, Math.hypot(xh, yh));
  // main perturbations (evection, variation, yearly equation)
  const Ms = rev(356.047 + 0.9856002585 * d) * DEG;
  const Ls = Ms + rev(282.9404 + 4.70935e-5 * d) * DEG;
  const Lm = M + w + N;
  const D = Lm - Ls, F = Lm - N;
  lonE += (-1.274 * Math.sin(M - 2 * D) + 0.658 * Math.sin(2 * D) - 0.186 * Math.sin(Ms) - 0.059 * Math.sin(2 * M - 2 * D) - 0.057 * Math.sin(M - 2 * D + Ms) + 0.053 * Math.sin(M + 2 * D)) * DEG;
  latE += (-0.173 * Math.sin(F - 2 * D) - 0.055 * Math.sin(M - F - 2 * D) - 0.046 * Math.sin(M + F - 2 * D)) * DEG;
  const ecl = (23.4393 - 3.563e-7 * d) * DEG;
  const xe = Math.cos(lonE) * Math.cos(latE);
  const ye = Math.cos(ecl) * Math.sin(lonE) * Math.cos(latE) - Math.sin(ecl) * Math.sin(latE);
  const ze = Math.sin(ecl) * Math.sin(lonE) * Math.cos(latE) + Math.cos(ecl) * Math.sin(latE);
  return altAz(Math.atan2(ye, xe), Math.atan2(ze, Math.hypot(xe, ye)), n, lat, lon);
}

/**
 * Scene axes: -z = south (the tower's big windows), +x = west, +y = up.
 * Converts altitude/azimuth into a unit direction pointing at the body.
 */
export function toDirection({ altitude, azimuth }, out) {
  const c = Math.cos(altitude);
  out.set(-Math.sin(azimuth) * c, Math.sin(altitude), Math.cos(azimuth) * c);
  return out;
}

/** 0 = deep night, 1 = full day, smooth through twilight. */
export function daylightFactor(altitude) {
  const a = altitude / DEG; // degrees
  const t = (a + 7) / 17; // -7° -> 0, +10° -> 1
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** 1 near sunrise/sunset (warm light), 0 otherwise. */
export function goldenFactor(altitude) {
  const a = altitude / DEG;
  return Math.max(0, 1 - Math.abs(a - 3) / 11);
}
