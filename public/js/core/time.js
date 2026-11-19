// Cyprus time + real sun position for Nicosia, so the tower's sky matches the
// actual time of day there. `?time=21:30` in the URL overrides the clock for
// previewing (Cyprus local time, today).

const LAT = 35.1856;
const LON = 33.3823;
const TZ = 'Asia/Nicosia';
const DEG = Math.PI / 180;

let overrideMinutes = null;
{
  const t = new URLSearchParams(location.search).get('time');
  const m = t && t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) overrideMinutes = Number(m[1]) * 60 + Number(m[2]);
}

// Offset of Cyprus from UTC in minutes for a given instant (handles DST).
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
  const local = new Date(now.getTime() + off * 60000); // fields in UTC == Cyprus local
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + overrideMinutes * 60000 - off * 60000 + (now.getSeconds() * 1000));
}

export function cyprusClock(date = sceneNow()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export function cyprusDate(date = sceneNow()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

/**
 * Solar position (NOAA simplified). Returns altitude and azimuth in radians;
 * azimuth measured clockwise from north.
 */
export function sunPosition(date = sceneNow(), lat = LAT, lon = LON) {
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

/** Moon is placed roughly opposite the sun — good enough for a skyline. */
export function moonPosition(date = sceneNow()) {
  const s = sunPosition(date);
  return { altitude: Math.max(0.35, -s.altitude * 0.8 + 0.25), azimuth: (s.azimuth + Math.PI * 0.92) % (2 * Math.PI) };
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
