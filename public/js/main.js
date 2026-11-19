// Agentium HQ — boots the scene, wires data to visuals, runs the loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { initMaterials, setNight } from './core/materials.js';
import { createEnvironment } from './scene/environment.js';
import { buildTower } from './scene/tower.js';
import { makeCharacter } from './scene/people.js';
import { Person } from './scene/person.js';
import { Elevator } from './scene/lift.js';
import { RooftopLife } from './scene/rooftop-life.js';
import { replyTo } from './scene/social.js';
import { CameraRig } from './scene/camera.js';
import { ROOMS, floorY, ceilY } from './scene/layout.js';
import { buildLab } from './rooms/lab.js';
import { buildWorkshop, buildPlanning } from './rooms/workfloor.js';
import { buildPenthouse, buildVault } from './rooms/topfloor.js';
import { buildRooftop } from './rooms/rooftop.js';
import { createSource } from './data/source.js';
import { createUI } from './ui/ui.js';

const WORKERS = { scott: ['Scott', 'Supervisor'], bob: ['Bob', 'Builder'], tom: ['Tom', 'Tester'] };

async function boot() {
  // canvas textures use the brand fonts, so wait for them
  try {
    await Promise.race([
      Promise.all(['500 40px "Cormorant Garamond"', '600 20px Manrope', '500 20px Manrope'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fall back to system fonts */ }

  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 3000);

  initMaterials();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const env = createEnvironment(scene, renderer);
  const tower = buildTower(scene);
  const lift = new Elevator(scene);

  // rooms
  const height = (f) => ceilY(f) - floorY(f);
  const rooms = {
    lab: buildLab(scene, ROOMS.lab, floorY(0), height(0)),
    workshop: buildWorkshop(scene, ROOMS.workshop, floorY(1), height(1)),
    planning: buildPlanning(scene, ROOMS.planning, floorY(1), height(1)),
    vault: buildVault(scene, ROOMS.vault, floorY(2), height(2)),
    penthouse: buildPenthouse(scene, ROOMS.penthouse, floorY(2), height(2)),
    rooftop: buildRooftop(scene, ROOMS.rooftop, floorY(3), makeCharacter),
  };
  const life = new RooftopLife({ scene, roof: rooms.rooftop, lift });

  // ------------------------------------------------------------ the workers
  const stationSpots = new Map();
  function stationSpot(roomId, agentId) {
    const key = `${roomId}:${agentId}`;
    if (!stationSpots.has(key)) {
      const st = rooms[roomId].stations[agentId] || rooms[roomId].stations.visit;
      stationSpots.set(key, { ...st, room: roomId, floor: ROOMS[roomId].floor, type: 'station', release() {} });
    }
    return stationSpots.get(key);
  }
  const workerWorld = { lift, spotFor: (p, roomId) => (roomId === 'rooftop' ? life.spotFor(p) : stationSpot(roomId, p.id)) };

  const source = createSource();
  const state0 = source.get();
  const workers = {};
  for (const id of Object.keys(WORKERS)) {
    const c = makeCharacter(id);
    scene.add(c.root);
    const p = new Person(c, workerWorld, { name: WORKERS[id][0], role: WORKERS[id][1], kind: 'worker', vibe: false });
    const spot = workerWorld.spotFor(p, state0.agents[id].room);
    p.placeAt(spot || stationSpot('planning', id));
    workers[id] = p;
  }

  // everyone you can see, talk to or hover
  const djChar = rooms.rooftop.dj;
  const dj = { id: 'dj', name: 'Leo', role: 'DJ', kind: 'staff', c: djChar, floor: 3, presentRoom: 'rooftop', vibe: true };
  const people = {};
  for (const p of [...Object.values(workers), ...life.guests, life.barman, dj]) people[p.id] = p;

  // ------------------------------------------------------------ seats you can take
  const seats = [];
  const dirOf = (face) => new THREE.Vector3(Math.sin(face), 0, Math.cos(face));
  for (const s of [...rooms.planning.seats, ...rooms.penthouse.seats]) {
    seats.push({ ...s, eyePos: s.pos.clone().add(new THREE.Vector3(0, s.eye, 0)).addScaledVector(dirOf(s.face), -0.05), lookDown: -0.45, available: () => true });
  }
  for (const sp of life.spots.filter((x) => x.type === 'stool' || x.type === 'sunbed')) {
    const lying = sp.type === 'sunbed';
    const eye = sp.pos.clone().add(new THREE.Vector3(0, lying ? 0.95 : 1.55, 0)).addScaledVector(dirOf(sp.face), lying ? 0.05 : 0.02);
    seats.push({
      id: sp.id, room: 'rooftop', floor: 3, kind: sp.type, spot: sp, pos: sp.pos, face: sp.face, eyePos: eye, lookDown: lying ? -0.55 : -0.5,
      available: () => !sp.occupant || sp.occupant === 'ceo',
      onSit: () => life.ceoSit(sp),
    });
  }
  const seatPicks = [];
  const pickMat = new THREE.MeshBasicMaterial();
  for (const s of seats) {
    const big = s.kind === 'sunbed';
    const m = new THREE.Mesh(new THREE.BoxGeometry(big ? 2.0 : 0.6, 1.0, big ? 0.8 : 0.6), pickMat);
    m.position.copy(s.pos).add(new THREE.Vector3(0, 0.5, 0));
    m.visible = false;
    m.userData.seat = s;
    scene.add(m);
    seatPicks.push(m);
  }
  function sit(seat) {
    if (!seat.available()) return;
    seat.onSit?.();
    seat.onLeave = () => {
      if (seat.spot) life.ceoLeave();
    };
    rig.sitAt(seat);
  }

  // screens you can look at closely
  const inspectables = [...(rooms.lab.inspect || []), ...(rooms.workshop.inspect || []), ...(rooms.planning.inspect || []), ...(rooms.vault.inspect || [])];
  for (const it of inspectables) it.mesh.userData.inspect = it;

  // ------------------------------------------------------------ post-processing
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.2, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(dpr);
  composer.setSize(window.innerWidth, window.innerHeight);

  const rig = new CameraRig(camera, canvas);

  // ------------------------------------------------------------ talking
  // In the same room: they answer out loud (speech bubble).
  // Anywhere else: they take out their phone, type, and then the message arrives.
  const npcChats = new Map();
  const inSameRoom = (p) => !!rig.presentRoom && (p.presentRoom ?? (p.floor === 3 ? 'rooftop' : null)) === rig.presentRoom;
  source.replyHandler = (agent, text, deliver, inPerson) => {
    const p = workers[agent];
    if (inPerson && p && inSameRoom(p)) {
      setTimeout(() => {
        ui.say(agent, text);
        deliver();
      }, 1100 + Math.random() * 900);
    } else if (p) {
      // a moment to notice the phone, then typing
      setTimeout(() => p.usePhone(2.6 + Math.min(4, text.length / 40), deliver), 500 + Math.random() * 900);
    } else setTimeout(deliver, 2000);
  };
  const social = {
    isWorker: (id) => !!workers[id],
    inPerson: (id) => !!people[id] && inSameRoom(people[id]),
    thread: (id) => npcChats.get(id) || [],
    typing: new Set(),
    send(id, text) {
      if (workers[id]) return source.act('sendChat', { agent: id, text, inPerson: social.inPerson(id) });
      const p = people[id];
      const list = npcChats.get(id) || [];
      list.push({ from: 'ceo', text, at: Date.now() });
      npcChats.set(id, list);
      social.typing.add(id);
      const atBar = life.ceoSpot?.type === 'stool';
      setTimeout(() => {
        const r = replyTo(p, text, { atBar });
        social.typing.delete(id);
        list.push({ from: id, text: r.text, at: Date.now() });
        ui.say(id, r.text);
        if (r.order) life.ceoOrder(r.order);
        if (r.menu) life.ceoAskMenu();
        if (r.goBar && p.goToSpot) {
          const stool = life.roof.stools.find((s) => !s.occupant);
          if (stool) {
            stool.occupant = p;
            p.goToSpot(stool, 3);
          }
        }
      }, 1100 + Math.random() * 900);
    },
  };

  const ui = createUI({ source, rig, camera, people, social, life, seats, workers });
  rig.onChange((mode) => tower.setTowerView(mode === 'tower' || (mode === 'flying' && !rig.room)));
  life.on((ev, data) => {
    if (ev === 'menu') ui.openPanel({ type: 'drinks' });
    if (ev === 'served') ui.toast(`Your ${data.drink === 'gintonic' ? 'Gin & Tonic' : data.drink} is served. Cheers.`);
  });

  // ------------------------------------------------------------ picking
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const personMeshes = [];
  for (const p of Object.values(people)) p.c.root.traverse((o) => o.isMesh && personMeshes.push(o));
  const objectPickables = [...rooms.penthouse.pickables, ...rooms.vault.pickables];
  const screenMeshes = inspectables.map((i) => i.mesh);

  function pick(clientX, clientY) {
    pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (rig.mode === 'tower') {
      const hitRoom = raycaster.intersectObjects(tower.pickables, false)[0];
      if (hitRoom) return { kind: 'room', id: hitRoom.object.userData.roomId };
      return null;
    }
    if (rig.mode === 'flying') return null;
    const here = rig.presentRoom;
    const candidates = [...personMeshes, ...objectPickables, ...screenMeshes];
    if (rig.mode === 'room' || rig.mode === 'seated') candidates.push(...seatPicks.filter((m) => m.userData.seat.room === here && m.userData.seat !== rig.seat));
    const hits = raycaster.intersectObjects(candidates, false);
    for (const h of hits) {
      const u = h.object.userData;
      if (u.personId) {
        const p = people[u.personId];
        if (p && inSameRoom(p)) return { kind: 'person', id: u.personId };
        continue;
      }
      if (u.seat) return { kind: 'seat', seat: u.seat };
      if (u.inspect && u.inspect.room === here) return { kind: 'screen', item: u.inspect };
      if (u.action) return { kind: 'object', action: u.action, label: u.label };
      if (h.distance < 30) break;
    }
    return null;
  }

  let hoverAt = null;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    hoverAt = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerleave', () => {
    hoverAt = null;
    ui.hideTooltip();
    ui.setPointer(false);
  });
  function processHover() {
    if (!hoverAt || rig.mode === 'flying' || rig.drag) return;
    const h = pick(hoverAt.x, hoverAt.y);
    ui.setPointer(!!h);
    if (!h) return ui.hideTooltip();
    if (h.kind === 'room') ui.roomTooltip(h.id, hoverAt.x, hoverAt.y);
    else if (h.kind === 'person') ui.personTooltip(h.id, hoverAt.x, hoverAt.y);
    else if (h.kind === 'seat') ui.objectTooltip(h.seat.available() ? (h.seat.kind === 'ceo' ? 'Sit in your chair' : h.seat.kind === 'sunbed' ? 'Lie down here' : h.seat.kind === 'stool' ? 'Sit at the bar' : 'Sit here') : 'Taken', hoverAt.x, hoverAt.y);
    else if (h.kind === 'screen') ui.objectTooltip(rig.inspecting === h.item ? 'Open the details' : 'Look closer', hoverAt.x, hoverAt.y);
    else ui.objectTooltip(h.label, hoverAt.x, hoverAt.y);
  }

  canvas.addEventListener('click', (e) => {
    if (rig.wasDrag() || rig.mode === 'flying') return;
    const h = pick(e.clientX, e.clientY);
    if (!h) return;
    ui.hideTooltip();
    if (h.kind === 'room') rig.flyToRoom(h.id);
    else if (h.kind === 'person') ui.openChat(h.id);
    else if (h.kind === 'seat') sit(h.seat);
    else if (h.kind === 'screen') {
      if (rig.inspecting === h.item && h.item.room === 'vault') ui.openPanel({ type: 'vault' });
      else rig.inspect(h.item);
    } else if (h.action === 'tray') ui.openPanel({ type: 'tray' });
    else if (h.action === 'decisions') ui.openPanel({ type: 'decisions' });
    else if (h.action === 'phone') ui.openPanel({ type: 'phone' });
    else if (h.action === 'vault') ui.openPanel({ type: 'vault' });
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloom.resolution.set(window.innerWidth / 2, window.innerHeight / 2);
  });

  // ------------------------------------------------------------ loop
  const clock = new THREE.Clock();
  let t = 0;
  let hoverTick = 0;
  let envState = env.update(0);

  // adaptive quality: step down on slower devices to keep things smooth
  let qAcc = 0, qFrames = 0, qLevel = 0;
  function adaptQuality(raw) {
    qAcc += raw;
    qFrames++;
    if (qAcc < 3) return;
    const ms = (qAcc / qFrames) * 1000;
    qAcc = 0;
    qFrames = 0;
    if (ms < 38 || qLevel >= 3 || new URLSearchParams(location.search).has('hq')) return;
    qLevel++;
    if (qLevel === 1) {
      renderer.setPixelRatio(1);
      composer.setPixelRatio(1);
      composer.setSize(window.innerWidth, window.innerHeight);
    } else if (qLevel === 2) bloom.enabled = false;
    else if (qLevel === 3) {
      renderer.shadowMap.enabled = false;
      scene.traverse((o) => o.material && (o.material.needsUpdate = true));
    }
  }

  const workerList = Object.values(workers);
  function frame() {
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05);
    adaptQuality(raw);
    t += dt;
    source.tick(dt);
    const state = source.get();
    const derived = state.derived;

    if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) envState = env.update(t);
    setNight(envState.daylight);

    for (const [id, r] of Object.entries(derived.rooms)) tower.setRoomStatus(id, r.status);
    tower.update(dt, t, envState.daylight);

    for (const [id, room] of Object.entries(rooms)) {
      const st = derived.rooms[id]?.status;
      room.update(dt, t, state, envState.daylight, st === 'working' || st === 'problem' ? 1 : 0);
    }

    // workers follow the data: go to the room they should be in
    for (const p of workerList) {
      const want = state.agents[p.id].room;
      if (!p.trip && p.mode !== 'walk' && p.room !== want && p.mode !== 'waitLift' && p.mode !== 'ride' && p.mode !== 'board' && p.mode !== 'alight') p.goToRoom(want, ROOMS[want].floor);
      p.update(dt, t);
    }
    life.update(dt, t, workerList);
    lift.update(dt);

    rig.update(dt);
    hoverTick += dt;
    if (hoverTick > 0.08) {
      hoverTick = 0;
      processHover();
    }
    ui.update(state, envState);
    composer.render(dt);
    requestAnimationFrame(frame);
  }

  composer.render(0);
  requestAnimationFrame(frame);
  setTimeout(() => ui.finishLoading(), 400);

  // previews: ?view=penthouse opens a room directly
  const q = new URLSearchParams(location.search);
  const startRoom = q.get('view');
  if (startRoom && ROOMS[startRoom]) rig.jumpToRoom(startRoom);
  window.__hq = { rig, source, ui, tower, workers, people, life, lift, seats, scene, renderer, camera, pick, sit };
}

boot().catch((err) => {
  console.error(err);
  const l = document.getElementById('loader');
  if (l) l.querySelector('.loader-sub').textContent = 'Could not start the 3D view. Please reload.';
});
