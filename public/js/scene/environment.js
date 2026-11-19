// Sky, sun, moon, city skyline and sea. Driven by the real time in Cyprus.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from '../core/textures.js';
import { sunPosition, moonPosition, toDirection, daylightFactor, goldenFactor, sceneNow } from '../core/time.js';

export const CITY_Y = -55;
const PODIUM = 84;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 sunDir;
uniform vec3 moonDir;
uniform float day;
uniform float golden;
uniform float time;
varying vec3 vDir;

float hash(vec3 p) { p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);

  vec3 dayZen = vec3(0.20, 0.45, 0.85);
  vec3 dayHor = vec3(0.70, 0.84, 0.96);
  vec3 nightZen = vec3(0.012, 0.022, 0.06);
  vec3 nightHor = vec3(0.05, 0.08, 0.16);
  vec3 goldHor = vec3(1.0, 0.55, 0.25);
  vec3 goldZen = vec3(0.32, 0.30, 0.52);

  float t = pow(max(h, 0.0), 0.45);
  vec3 zen = mix(nightZen, dayZen, day);
  vec3 hor = mix(nightHor, dayHor, day);
  zen = mix(zen, goldZen, golden * 0.6);
  // golden glow is strongest towards the sun's azimuth
  float toward = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z) + 1e-5)), 0.0);
  hor = mix(hor, goldHor, golden * (0.35 + 0.65 * pow(toward, 2.0)));
  vec3 col = mix(hor, zen, t);

  // city light dome near the horizon at night
  col += vec3(0.35, 0.22, 0.12) * (1.0 - day) * pow(1.0 - max(h, 0.0), 8.0) * 0.35;

  // sun disc + halo
  float sd = max(dot(d, sunDir), 0.0);
  col += vec3(1.0, 0.85, 0.6) * pow(sd, 900.0) * 18.0 * smoothstep(-0.05, 0.02, sunDir.y);
  col += vec3(1.0, 0.7, 0.4) * pow(sd, 12.0) * 0.35 * (golden + day * 0.4) * smoothstep(-0.1, 0.0, sunDir.y);

  // moon + stars at night
  float night = 1.0 - day;
  float md = max(dot(d, moonDir), 0.0);
  col += vec3(0.95, 0.93, 0.85) * smoothstep(0.99955, 0.99975, md) * night * 1.6;
  col += vec3(0.5, 0.6, 0.8) * pow(md, 200.0) * night * 0.25;
  vec3 sp = floor(d * 380.0);
  float star = step(0.9975, hash(sp)) * smoothstep(0.05, 0.3, h);
  star *= 0.6 + 0.4 * sin(time * 1.5 + hash(sp + 3.0) * 30.0);
  col += vec3(star) * night * 0.9;

  // below horizon fade into haze
  col = mix(col, hor * 0.8, smoothstep(0.0, -0.15, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function createEnvironment(scene, renderer) {
  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();

  // ---------------------------------------------------------- sky dome
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: { sunDir: { value: sunDir }, moonDir: { value: moonDir }, day: { value: 1 }, golden: { value: 0 }, time: { value: 0 } },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // ---------------------------------------------------------- lights
  const sun = new THREE.DirectionalLight('#fff4e0', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 140;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.target.position.set(0, 8, 0);
  scene.add(sun, sun.target);

  const moon = new THREE.DirectionalLight('#9fb4e0', 0.25);
  moon.target.position.set(0, 8, 0);
  scene.add(moon, moon.target);

  const hemi = new THREE.HemisphereLight('#bcd4ff', '#3a3026', 0.8);
  scene.add(hemi);

  scene.fog = new THREE.Fog('#aac4dd', 220, 1400);

  // ---------------------------------------------------------- ground & sea
  const groundMat = new THREE.MeshStandardMaterial({ color: '#3d3f43', roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = CITY_Y - 0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  const seaMat = new THREE.MeshStandardMaterial({ color: '#2a5f86', roughness: 0.18, metalness: 0.6 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 1200), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, CITY_Y, -1050);
  scene.add(sea);

  // the tower stands on a raised podium deck high above the city streets
  const plazaMat = new THREE.MeshStandardMaterial({ map: T.planks({ base: '#8d8478', rows: 4, repeat: [14, 14], gap: '#00000030', vary: 0.08 }), roughness: 0.75 });
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(PODIUM, PODIUM), plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.receiveShadow = true;
  scene.add(plaza);
  const podiumFacade = T.facade({ seed: 9, glass: '#3c4a5a', frame: '#1d2228', cols: 16, rows: 40 });
  const podiumLit = T.facade({ seed: 19, lit: true, litRatio: 0.25 });
  for (const t of [podiumFacade, podiumLit]) t.repeat.set(3, 1.4);
  const podiumMat = new THREE.MeshStandardMaterial({ map: podiumFacade, emissiveMap: podiumLit, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.35, metalness: 0.4 });
  const podiumBody = new THREE.Mesh(new THREE.BoxGeometry(PODIUM, -CITY_Y, PODIUM), [podiumMat, podiumMat, new THREE.MeshStandardMaterial({ color: '#222' }), podiumMat, podiumMat, podiumMat]);
  podiumBody.position.y = CITY_Y / 2 - 0.05;
  scene.add(podiumBody);
  // brass-capped glass balustrade around the deck edge
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#c9a15e', metalness: 1, roughness: 0.3 });
  const edgeGlass = new THREE.MeshPhysicalMaterial({ color: '#9fc0d4', transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
  for (const [x, z, ry] of [[0, PODIUM / 2, 0], [0, -PODIUM / 2, 0], [PODIUM / 2, 0, Math.PI / 2], [-PODIUM / 2, 0, Math.PI / 2]]) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(PODIUM, 1.1), edgeGlass);
    gl.position.set(x, 0.55, z);
    gl.rotation.y = ry;
    scene.add(gl);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(ry ? 0.08 : PODIUM, 0.06, ry ? PODIUM : 0.08), edgeMat);
    cap.position.set(x, 1.12, z);
    scene.add(cap);
  }

  // ---------------------------------------------------------- city
  const city = buildCity();
  city.group.position.y = CITY_Y;
  scene.add(city.group);

  // ---------------------------------------------------------- update
  const state = { daylight: 1, golden: 0, sunUp: true };
  const tmp = new THREE.Color();

  function update(elapsed) {
    const now = sceneNow();
    const sp = sunPosition(now);
    toDirection(sp, sunDir);
    toDirection(moonPosition(now), moonDir);
    const day = daylightFactor(sp.altitude);
    const golden = goldenFactor(sp.altitude);
    state.daylight = day;
    state.golden = golden;
    state.sunUp = sp.altitude > -0.02;

    skyMat.uniforms.day.value = day;
    skyMat.uniforms.golden.value = golden;
    skyMat.uniforms.time.value = elapsed;

    sun.position.copy(sunDir).multiplyScalar(80).add(sun.target.position);
    const sunStrength = THREE.MathUtils.smoothstep(sp.altitude, -0.03, 0.2);
    sun.intensity = 3.4 * sunStrength;
    sun.color.set('#fff2dc').lerp(tmp.set('#ff9a4a'), golden * 0.8);
    sun.castShadow = sunStrength > 0.02;

    moon.position.copy(moonDir).multiplyScalar(80).add(moon.target.position);
    moon.intensity = 0.35 * (1 - day);

    hemi.intensity = 0.12 + 0.9 * day;
    hemi.color.set('#26324e').lerp(tmp.set('#c3d8ff'), day);
    hemi.groundColor.set('#120e0b').lerp(tmp.set('#4a3f33'), day);

    const fogDay = tmp.set('#b4cbe0');
    const fogCol = new THREE.Color('#0b1220').lerp(fogDay, day).lerp(new THREE.Color('#d7a27a'), golden * 0.45);
    scene.fog.color.copy(fogCol);

    scene.environmentIntensity = 0.07 + 0.5 * day;
    renderer.toneMappingExposure = 0.95 + (1 - day) * 0.25;

    groundMat.color.set('#1a1b1e').lerp(tmp.set('#4a4b4f'), day);
    seaMat.color.set('#081320').lerp(tmp.set('#2f6a92'), day).lerp(new THREE.Color('#b0603a'), golden * 0.35);
    city.setNight(1 - day);
    podiumMat.emissiveIntensity = 1.2 * THREE.MathUtils.smoothstep(1 - day, 0.15, 0.85);
    return state;
  }

  return { update, state, sunDir, sun };
}

// ------------------------------------------------------------------ city
function buildCity() {
  const group = new THREE.Group();
  const r = T.rng(77);

  const styles = [
    { glass: '#3f5164', frame: '#59606a', seed: 1, warm: true },
    { glass: '#4d5560', frame: '#a39a8d', seed: 2, warm: true },
    { glass: '#2e3a47', frame: '#3b4048', seed: 3, warm: true },
    { glass: '#56708a', frame: '#9aa1a8', seed: 4, warm: false },
    { glass: '#4a4642', frame: '#8a7d70', seed: 5, warm: true },
  ];
  const buckets = styles.map(() => []);
  const emissiveMats = [];

  const addBuilding = (x, z, w, d, h, s) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const ny = nrm.getY(i);
      if (Math.abs(ny) > 0.5) {
        uv.setXY(i, 0.003, 0.003); // roof → wall colour in the frame margin
      } else {
        const along = Math.abs(nrm.getX(i)) > 0.5 ? d : w;
        uv.setXY(i, (uv.getX(i) * along) / 32, (pos.getY(i) + h / 2) / 128);
      }
    }
    geo.translate(x, h / 2, z);
    buckets[s].push(geo);
  };

  // Avoid the plaza; densest towards the south (behind the windows).
  for (let i = 0; i < 900; i++) {
    const ang = r() * Math.PI * 2;
    const dist = 60 + Math.pow(r(), 0.75) * 560;
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist * 0.9;
    if (z < -700) continue;
    const south = z < 0 ? 1.25 : 0.8;
    const core = Math.max(0, 1 - dist / 420);
    // most rooftops sit below the podium deck (55 m), the skyline rises far away
    const far = Math.min(1, Math.max(0, (dist - 260) / 300));
    const h = 14 + r() * (28 + far * 26) + Math.pow(r(), 6) * 150 * far * south;
    const w = 10 + r() * 18;
    const d = 10 + r() * 18;
    addBuilding(Math.round(x / 6) * 6, Math.round(z / 6) * 6, w, d, h, (r() * styles.length) | 0);
  }
  // a handful of landmark towers with spires on the southern skyline
  const spireMat = new THREE.MeshStandardMaterial({ color: '#9aa4ae', metalness: 0.8, roughness: 0.3 });
  const beaconMat = new THREE.MeshStandardMaterial({ color: '#f33', emissive: '#ff2a2a', emissiveIntensity: 0 });
  emissiveMats.push({ mat: beaconMat, max: 3 });
  const landmarks = [[-140, -300, 210], [70, -380, 250], [240, -260, 190], [-300, -420, 220], [-20, -520, 280], [330, -460, 230]];
  for (const [x, z, h] of landmarks) {
    addBuilding(x, z, 22, 22, h * 0.72, 3);
    addBuilding(x, z, 16, 16, h * 0.85, 0);
    addBuilding(x, z, 10, 10, h * 0.95, 0);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(2.2, h * 0.25, 8), spireMat);
    sp.position.set(x, h * 0.95 + h * 0.125, z);
    group.add(sp);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), beaconMat);
    b.position.set(x, h * 1.2, z);
    group.add(b);
  }

  styles.forEach((st, i) => {
    if (!buckets[i].length) return;
    const geo = mergeGeometries(buckets[i]);
    const map = T.facade({ seed: st.seed, glass: st.glass, frame: st.frame });
    const emissiveMap = T.facade({ seed: st.seed + 10, lit: true, warm: st.warm, litRatio: 0.32 });
    const mat = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.45, metalness: 0.35 });
    emissiveMats.push({ mat, max: 1.6 });
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = false;
    group.add(m);
  });

  // avenues with streaming car lights
  const roadMat = new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.9 });
  const lightsTex = carLights();
  const lightMat = new THREE.MeshBasicMaterial({ map: lightsTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const roads = [];
  for (const [x, z, len, rot] of [[0, -60, 1400, 0], [0, 64, 1400, 0], [-62, 0, 1400, Math.PI / 2], [66, 0, 1400, Math.PI / 2], [0, -240, 1400, 0], [-250, 0, 1400, Math.PI / 2], [240, 0, 1400, Math.PI / 2], [0, -420, 1400, 0]]) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(len, 10), roadMat);
    road.rotation.set(-Math.PI / 2, 0, rot);
    road.position.set(x, 0.01, z);
    road.receiveShadow = true;
    group.add(road);
    const l = new THREE.Mesh(new THREE.PlaneGeometry(len, 6), lightMat);
    l.rotation.set(-Math.PI / 2, 0, rot);
    l.position.set(x, 0.05, z);
    group.add(l);
    roads.push(l);
  }

  function setNight(n) {
    for (const e of emissiveMats) e.mat.emissiveIntensity = e.max * THREE.MathUtils.smoothstep(n, 0.15, 0.85);
    lightMat.opacity = THREE.MathUtils.smoothstep(n, 0.2, 0.8);
    lightsTex.offset.x = (performance.now() / 60000) % 1;
  }
  return { group, setNight };
}

function carLights() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 32;
  const g = c.getContext('2d');
  const r = T.rng(5);
  for (let i = 0; i < 260; i++) {
    const lane = r() < 0.5;
    g.fillStyle = lane ? `rgba(255,${180 + r() * 60},${120 + r() * 60},${0.4 + r() * 0.6})` : `rgba(255,${40 + r() * 40},40,${0.4 + r() * 0.6})`;
    g.fillRect(r() * 1024, lane ? 6 + r() * 6 : 20 + r() * 6, 3 + r() * 10, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(12, 1);
  return t;
}
