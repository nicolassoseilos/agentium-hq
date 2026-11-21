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
import { loadGuestModels, createRealWoman } from './scene/woman.js';
import { replyTo } from './scene/social.js';
import { Hands } from './scene/fp-hands.js';
import { Smoke } from './scene/smoking.js';
import { Leisure } from './scene/leisure.js';
import { Office } from './scene/ceo-office.js';
import { CameraRig } from './scene/camera.js';
import { ROOMS, floorY, ceilY, roomAt } from './scene/layout.js';
import { buildLab } from './rooms/lab.js';
import { buildWorkshop, buildPlanning } from './rooms/workfloor.js';
import { buildPenthouse, buildVault } from './rooms/topfloor.js';
import { buildRooftop } from './rooms/rooftop.js';
import { createSource } from './data/source.js';
import { createUI } from './ui/ui.js';
import { agentMeta, agentLook } from './scene/roster.js';


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
  // rooftop guests: realistic women built from four body/face variants
  const guestModels = await loadGuestModels(['a', 'b', 'c', 'd']);
  const HAIR = {
    blonde: [0.74, 0.58, 0.36], platinum: [0.86, 0.78, 0.62], honey: [0.6, 0.4, 0.2], brunette: [0.22, 0.13, 0.07],
    chestnut: [0.36, 0.2, 0.1], black: [0.05, 0.04, 0.035], auburn: [0.45, 0.17, 0.08], darkbrown: [0.13, 0.08, 0.05],
  };
  const GUESTS = [
    { v: 'a', hair: 'blonde', style: 'long-wavy', bikini: '#111111' },
    { v: 'b', hair: 'brunette', style: 'long', bikini: '#b0283a' },
    { v: 'c', hair: 'black', style: 'long-wavy', bikini: '#e8e2d6' },
    { v: 'd', hair: 'black', style: 'long', bikini: '#c9a15e' },
    { v: 'a', hair: 'platinum', style: 'long', bikini: '#1f4f7a' },
    { v: 'b', hair: 'chestnut', style: 'long-wavy', bikini: '#111111' },
    { v: 'a', hair: 'auburn', style: 'long-wavy', bikini: '#2f6b4a' },
    { v: 'c', hair: 'honey', style: 'long-wavy', bikini: '#e07a5f' },
    { v: 'd', hair: 'darkbrown', style: 'long-wavy', bikini: '#f2f2f2' },
    { v: 'b', hair: 'darkbrown', style: 'long', bikini: '#7a3a6a' },
  ];
  const makeGuest = (i, id) => {
    const g = GUESTS[i % GUESTS.length];
    return createRealWoman(id, guestModels[g.v], { hairRGB: HAIR[g.hair], hairStyle: g.style, bikini: g.bikini, seed: 7 + i * 13, part: i % 2 ? 0.028 : -0.028, height: 0.98 + ((i * 37) % 5) * 0.01 });
  };
  const life = new RooftopLife({ scene, roof: rooms.rooftop, lift, makeGuest });

  // ------------------------------------------------------------ the agents
  // They appear as the data provides them (the three sample agents, or the six
  // real ones: Scott, Bob and Tom in the Voice and the Chat department). Each
  // gets a look from their department and rank, and their own spot in every
  // room: builders at a desk in the workshop, testers at a bench in the lab,
  // supervisors at the head of the planning table, everyone else wherever is free.
  const slotOwner = (sl) => (sl.ref ? sl.ref.takenBy : sl.takenBy);
  const setSlotOwner = (sl, v) => { if (sl.ref) sl.ref.takenBy = v; else sl.takenBy = v; };
  function slotFor(roomId, p) {
    const room = rooms[roomId];
    const slots = room.slots || [];
    const free = (x) => !slotOwner(x) || slotOwner(x) === p.id;
    const sl = slots.find((x) => slotOwner(x) === p.id) || slots.find((x) => free(x) && x.ranks?.includes(p.rank)) || slots.find((x) => free(x) && !x.ranks) || slots.find(free);
    if (!sl) {
      // every spot taken: stand near the door, side by side
      const n = workerList.filter((w) => w !== p && w.room === roomId).length;
      const st = room.stations.visit;
      return { ...st, pos: st.pos.clone().add(new THREE.Vector3(((n % 3) - 1) * 0.75, 0, Math.floor(n / 3) * 0.7)), room: roomId, floor: ROOMS[roomId].floor, type: 'station', release() {} };
    }
    setSlotOwner(sl, p.id);
    return {
      pos: sl.pos, face: sl.face, pose: sl.pose, via: sl.via, seat: sl.seat, room: roomId, floor: ROOMS[roomId].floor, type: 'station', slot: sl,
      release() { if (slotOwner(sl) === p.id) setSlotOwner(sl, null); },
    };
  }
  const workerWorld = { lift, spotFor: (p, roomId) => (roomId === 'rooftop' ? life.spotFor(p) : slotFor(roomId, p)) };

  const source = createSource();
  const state0 = source.get();
  const workers = {};
  const workerList = [];
  const people = {};
  const personMeshes = [];
  const roomOf = (a) => (ROOMS[a?.room] ? a.room : a?.status === 'idle' ? 'rooftop' : 'planning');
  function ensureWorker(id, a) {
    const existing = workers[id];
    const meta = agentMeta(id, a);
    if (existing) {
      existing.name = meta.name;
      existing.role = meta.role;
      return existing;
    }
    const c = makeCharacter(id, agentLook(meta));
    scene.add(c.root);
    const p = new Person(c, workerWorld, { name: meta.name, role: meta.role, kind: 'worker', vibe: false });
    Object.assign(p, { dept: meta.dept, rank: meta.rank, base: meta.base });
    workers[id] = p;
    workerList.push(p);
    people[id] = p;
    c.root.traverse((o) => o.isMesh && personMeshes.push(o));
    const spot = workerWorld.spotFor(p, roomOf(a));
    p.placeAt(spot || slotFor('planning', p));
    return p;
  }
  for (const [id, a] of Object.entries(state0.agents || {})) ensureWorker(id, a);
  // an agent the data no longer lists (e.g. the sample team when the live one takes over) leaves the building
  function removeWorker(p) {
    p.removed = true;
    p.spot?.release?.(p);
    meetings.delete(p.id);
    leisure.removeDrink(p);
    leisure.removeCigar(p);
    p.c.root.removeFromParent();
    const meshes = new Set();
    p.c.root.traverse((o) => meshes.add(o));
    for (let i = personMeshes.length - 1; i >= 0; i--) if (meshes.has(personMeshes[i])) personMeshes.splice(i, 1);
    delete workers[p.id];
    delete people[p.id];
    workerList.splice(workerList.indexOf(p), 1);
  }

  // everyone you can see, talk to or hover
  const djChar = rooms.rooftop.dj;
  const dj = { id: 'dj', name: 'Leo', role: 'DJ', kind: 'staff', c: djChar, floor: 3, presentRoom: 'rooftop', vibe: true };
  for (const p of [...life.guests, life.barman, dj]) {
    people[p.id] = p;
    p.c.root.traverse((o) => o.isMesh && personMeshes.push(o));
  }

  // ------------------------------------------------------------ seats you can take
  const seats = [];
  const dirOf = (face) => new THREE.Vector3(Math.sin(face), 0, Math.cos(face));
  for (const s of [...rooms.planning.seats, ...rooms.penthouse.seats, ...rooms.lab.seats]) {
    seats.push({ ...s, src: s, eyePos: s.pos.clone().add(new THREE.Vector3(0, s.eye, 0)).addScaledVector(dirOf(s.face), -(s.back ?? 0.05)), lookDown: s.lookDown ?? -0.4, available: () => !s.takenBy });
  }
  // rooftop: bar stools, sunbeds, the sofas (incl. the view couch) and the cabana seats
  for (const sp of life.spots.filter((x) => ['stool', 'sunbed', 'sofa', 'cabana'].includes(x.type))) {
    const lying = sp.type === 'sunbed';
    const high = sp.type === 'stool';
    const eyeH = typeof sp.ceo?.eye === 'number' ? sp.ceo.eye : lying ? 0.95 : high ? 1.55 : 1.15; // (sunbeds keep an [x,y,z] eye offset)
    const eye = sp.pos.clone().add(new THREE.Vector3(0, eyeH, 0)).addScaledVector(dirOf(sp.face), lying ? 0.05 : high ? 0.02 : -0.12);
    seats.push({
      id: sp.id, room: 'rooftop', floor: 3, kind: sp.type, spot: sp, pos: sp.pos, face: sp.face, eyePos: eye, fov: sp.ceo?.fov, lookDown: sp.ceo?.lookDown ?? (lying ? -0.55 : high ? -0.5 : -0.3),
      // guests make way for the CEO; only an agent he invited keeps a seat
      available: () => !sp.occupant || sp.occupant === 'ceo' || !sp.occupant.invited,
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
    if (seat.spot) life.evict(seat.spot);
    seat.onSit?.();
    // nobody else may take the chair you are sitting in
    if (seat.src) seat.src.takenBy = 'ceo';
    // you don't see the chair you are sitting in
    if (seat.chair) seat.chair.visible = false;
    // standing up does NOT end a meeting: invited agents wait until you say "That's all"
    seat.onLeave = () => {
      if (seat.spot) life.ceoLeave();
      if (seat.src && seat.src.takenBy === 'ceo') seat.src.takenBy = null;
      if (seat.chair) seat.chair.visible = true;
    };
    rig.sitAt(seat);
  }

  // ------------------------------------------------------------ inviting someone to join you
  // At the bar they sit on the stool next to you (and get a drink), in your
  // office they take a chair across the desk, in the planning room a chair at
  // the table, by the pool the next sunbed.
  const meetings = new Map(); // agentId -> { spot, seat }
  const mkSpot = (o) => ({ type: 'invite', pose: 'sit', seat: 0.47, release() { this.takenBy = null; }, ...o });
  const planTable = rooms.planning.seats;
  function inviteSpot(p, roomOverride = null) {
    const room = roomOverride || rig.presentRoom;
    const seat = rig.presentRoom === room ? rig.seat : null;
    if (room === 'rooftop') {
      if (seat?.kind === 'stool') return life.inviteToBar(p);
      if (seat?.kind === 'sunbed' || seat?.kind === 'sofa' || seat?.kind === 'cabana') {
        const beds = life.spots.filter((x) => x.type === seat.kind && x !== seat.spot && x.occupant !== 'ceo' && (!x.occupant || !workers[x.occupant.id]));
        beds.sort((a, b) => a.pos.distanceTo(seat.pos) - b.pos.distanceTo(seat.pos));
        const bed = beds[0];
        if (!bed) return null;
        life.evict(bed);
        bed.occupant = p;
        return bed;
      }
      const st = rooms.rooftop.stations.visit;
      return mkSpot({ ...st, room, floor: 3, pose: 'stand' });
    }
    if (room === 'penthouse') {
      // the armchairs across the desk
      const g = rooms.penthouse.guestSeats.find((x) => !x.takenBy);
      if (!g) return null;
      g.takenBy = p.id;
      return mkSpot({ ...g, release() { g.takenBy = null; } });
    }
    if (room === 'planning') {
      // Across the table from you first, so you can see each other; only when that
      // side is full do people sit beside you. Never in your chair.
      const me = seat?.kind === 'chair' ? seat : { pos: new THREE.Vector3(6.85, 0, -4.15), face: 0 };
      const free = planTable.filter((x) => !x.takenBy);
      const score = (c) => (c.face !== me.face ? 0 : 100) + Math.abs(c.pos.x - me.pos.x);
      free.sort((a, b) => score(a) - score(b));
      const c = free[0];
      if (!c) return null;
      c.takenBy = p.id;
      const back = c.face === 0;
      return mkSpot({
        pos: c.pos.clone(), face: c.face, room: 'planning', floor: 1,
        via: back ? [{ x: 12.1, z: 4.7 }, { x: 12.1, z: c.pos.z }, { x: c.pos.x, z: c.pos.z }] : null,
        release() { if (c.takenBy === p.id) c.takenBy = null; if (c.chair) c.chair.visible = true; },
      });
    }
    return null;
  }
  // With live data an invite to the office starts a real Claude session (a meeting) that
  // briefs Nicolas; "That's all" ends it so the decisions get written down.
  const liveMeetings = () => typeof source.startMeeting === 'function';
  function startLive(ids, room, extra = {}) {
    if (!liveMeetings()) return Promise.resolve(null);
    return source.startMeeting({ agents: ids, room, ...extra }).then((r) => {
      if (!r || !r.ok) {
        ui.toast('The live meeting could not start; quick replies will answer meanwhile.');
        return null;
      }
      for (const id of ids) { const m = meetings.get(id); if (m) m.liveId = r.id; }
      return r;
    }).catch(() => null);
  }
  function invite(id, roomOverride = null, live = {}) {
    const p = workers[id];
    if (!p) return false;
    if (meetings.has(id)) {
      // already here: a new topic (e.g. "Discuss" on a desk item) just starts on it
      if (live.topic || live.itemId) startLive([id], 'office', live);
      return true;
    }
    const spot = inviteSpot(p, roomOverride);
    if (!spot) {
      ui.toast('There is no free seat next to you.');
      return false;
    }
    p.invited = true;
    const where = spot.room === 'rooftop' ? 'the bar' : ROOMS[spot.room].name;
    meetings.set(id, { spot, room: spot.room });
    const greet = spot.type === 'stool' ? 'Cheers, Nicolas. What are we drinking?' : spot.room === 'penthouse' ? 'You wanted to see me, Nicolas?' : 'I’m here. What’s on your mind?';
    spot.onArrive = (person) => {
      if (spot.onArriveExtra) spot.onArriveExtra();
      ui.say(id, greet);
      ui.toast(`${person.name} joined you.`);
      ui.openChat(id);
    };
    if (p.spot && p.spot !== spot) p.spot.release?.(p);
    p.goToSpot(spot, spot.floor);
    ui.toast(`${p.name} is on the way to ${where}.`);
    if (spot.room === 'penthouse' && !live.team) startLive([id], 'office', live);
    return true;
  }
  /** A meeting with several agents at the planning table. */
  function teamMeeting(ids, topic) {
    for (const id of ids) {
      // someone still in a meeting elsewhere wraps that one up first (its decisions get written down)
      const m = meetings.get(id);
      if (m && m.room !== 'planning') dismiss(id);
      invite(id, 'planning', { team: true });
    }
    return startLive(ids, 'conference', topic ? { topic } : {});
  }
  function dismiss(id) {
    const m = meetings.get(id);
    const p = workers[id];
    if (!m || !p) return;
    meetings.delete(id);
    // end the live session once (a team meeting ends when the last one leaves… or straight away on "That's all")
    if (m.liveId && ![...meetings.values()].some((x) => x.liveId === m.liveId)) source.act('endMeeting', { id: m.liveId });
    p.invited = false;
    m.spot.onArrive = null;
    m.spot.release?.(p);
    if (p.spot === m.spot) p.spot = null;
    p.room = null; // the main loop sends them back to where the data says
    ui.say(id, 'Thanks, Nicolas. Back to it.');
  }
  const meetingsIn = (room) => [...meetings].filter(([, m]) => m.room === room).map(([id]) => id);

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

  // ------------------------------------------------------------ your own hands, drinks and cigars
  scene.add(camera); // (your hands are attached to it)
  const hands = new Hands(camera, scene);
  hands.rig = rig;
  const smoke = new Smoke(scene);
  const leisure = new Leisure({ scene, smoke, hands, rig });
  life.leisure = leisure;
  const ceoSeat = seats.find((s) => s.kind === 'ceo');
  const office = new Office({
    scene, rig, hands, leisure, W: rooms.penthouse.whisky, workers, meetings,
    sitCeo: () => sit(ceoSeat), ceoSeat, toast: (t) => ui.toast(t), floorY: floorY(2),
  });
  leisure.ceoBusy = () => office.busy;

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
    canChat: (id) => !!people[id] && people[id].kind !== 'guest',
    invite: (id) => invite(id),
    dismiss: (id) => dismiss(id),
    live: liveMeetings,
    teamMeeting,
    liveIdOf: (id) => meetings.get(id)?.liveId || null,
    /** "Discuss" on a desk item: its author comes to the office and goes through it. */
    discuss(item) {
      const id = workers[item.realFrom] ? item.realFrom : item.from;
      if (!workers[id]) return false;
      invite(id, 'penthouse', { topic: item.title, itemId: item.id });
      return id;
    },
    endMeetingById(liveId) {
      const ids = [...meetings].filter(([, m]) => m.liveId === liveId).map(([id]) => id);
      if (ids.length) for (const id of ids) dismiss(id);
      else source.act('endMeeting', { id: liveId });
    },
    inMeeting: (id) => meetings.has(id),
    meetingsIn,
    pour: (ids) => {
      office.pour(ids);
      return true;
    },
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
      // the DJ plays real music from Nicolas's Spotify (window.AHQ_MUSIC, from the data side)
      const music = window.AHQ_MUSIC;
      if (id === 'dj' && music) {
        try { music.gesture(); } catch { /* ignore */ } // (this send is a real tap: lets the browser start the sound)
        Promise.resolve()
          .then(() => music.request(text))
          .catch(() => ({ text: 'The decks are acting up, give me a second and ask again.', action: 'error' }))
          .then((r) => {
            social.typing.delete(id);
            social.djConnect = r?.action === 'connect';
            const say = r?.text || 'You got it.';
            list.push({ from: id, text: say, at: Date.now() });
            ui.say(id, say);
          });
        return;
      }
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

  const ui = createUI({ source, rig, camera, people, social, life, seats, workers, office: { get: () => office, leisure: () => leisure } });
  rig.onChange((mode) => tower.setTowerView(mode === 'tower' || (mode === 'flying' && !rig.room)));
  life.on((ev, data) => {
    if (ev === 'menu') ui.openPanel({ type: 'drinks' });
    if (ev === 'cigar') ui.toast('Your cigar is lit. Enjoy.');
    if (ev === 'served') ui.toast(`Your ${data.drink === 'gintonic' ? 'Gin & Tonic' : data.drink} is served. Cheers.`);
  });

  // ------------------------------------------------------------ picking
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  // every clickable thing belongs to its room: only the room you are in offers its things
  const objectPickables = [];
  for (const id of ['penthouse', 'vault', 'planning', 'workshop']) for (const m of rooms[id].pickables || []) { m.userData.room = id; objectPickables.push(m); }

  // The other room on the same floor: tap its open floor area to go there.
  // (Only where you can actually see it: walls and furniture in front block the tap.)
  const floorPicks = [];
  for (const r of Object.values(ROOMS)) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0 - 0.4, 15.4), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((r.x0 + r.x1) / 2, floorY(r.floor) + 0.03, 0);
    m.visible = false;
    m.userData.floorOf = r.id;
    m.updateMatrixWorld();
    floorPicks.push(m);
  }
  const shown = (o) => {
    for (let x = o; x; x = x.parent) if (!x.visible) return false;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    return !!mat && mat.visible !== false && !(mat.transparent && mat.opacity < 0.6);
  };
  function otherRoomUnder(here) {
    const f = ROOMS[here].floor;
    const picks = floorPicks.filter((m) => m.userData.floorOf !== here && ROOMS[m.userData.floorOf].floor === f);
    if (!picks.length) return null;
    const hit = raycaster.intersectObjects(picks, false)[0];
    if (!hit) return null;
    const other = hit.object.userData.floorOf;
    // something solid in the way (a wall, a frame, furniture)?
    const solids = raycaster.intersectObjects([rooms[here].group, rooms[other].group, tower.group], true);
    const block = solids.find((h) => h.distance < hit.distance - 0.05 && shown(h.object));
    return block ? null : { id: other, distance: hit.distance };
  }
  const screenMeshes = inspectables.map((i) => i.mesh);

  function pick(clientX, clientY) {
    pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (rig.mode === 'tower') {
      const hitRoom = raycaster.intersectObjects(tower.pickables, false)[0];
      if (hitRoom) return { kind: 'room', id: hitRoom.object.userData.roomId };
      return null;
    }
    if (rig.mode === 'flying' || rig.mode === 'walking' || office.busy) return null;
    const here = rig.presentRoom;
    // in the office: the cigars in the open humidor, the glasses on the desk
    if (here === 'penthouse') {
      const objs = [];
      if (rooms.penthouse.whisky.humidor.userData.open) objs.push(...rooms.penthouse.whisky.humidor.userData.cigars);
      for (const [, d] of leisure.drinks) if (d.at.y > floorY(2) && d.at.y < ceilY(2)) objs.push(d.glass);
      const hit = raycaster.intersectObjects(objs, true)[0];
      if (hit) {
        let o = hit.object;
        while (o && !objs.includes(o)) o = o.parent;
        if (o?.userData.kind === 'cigar') return { kind: 'object', action: 'cigar', label: 'Take this cigar', target: o };
        if (o) {
          const owner = o.userData.owner;
          const name = owner === 'ceo' ? 'your' : `${owner.name}’s`;
          return { kind: 'object', action: 'refill', label: `Refill ${name} whisky`, target: owner };
        }
      }
    }
    const candidates = [...personMeshes, ...objectPickables.filter((m) => m.userData.room === here), ...screenMeshes.filter((m) => m.userData.inspect?.room === here)];
    if (rig.mode === 'room' || rig.mode === 'seated') candidates.push(...seatPicks.filter((m) => m.userData.seat.room === here && m.userData.seat !== rig.seat));
    const hits = raycaster.intersectObjects(candidates, false);
    if (rig.mode === 'room' || rig.mode === 'seated') {
      const other = here && otherRoomUnder(here);
      if (other) {
        // something of this room (a person, a seat, a screen, a desk item) in front wins
        const mine = hits.find((h) => {
          const u = h.object.userData;
          if (u.personId) return !!people[u.personId] && inSameRoom(people[u.personId]);
          if (u.inspect) return u.inspect.room === here;
          return !!(u.seat || u.action) && roomAt(ROOMS[here].floor, h.point.x)?.id === here;
        });
        if (!mine || mine.distance > other.distance) return { kind: 'room', id: other.id };
      }
    }
    for (const h of hits) {
      const u = h.object.userData;
      if (u.personId) {
        const p = people[u.personId];
        if (p && inSameRoom(p) && p.kind !== 'guest') return { kind: 'person', id: u.personId };
        continue;
      }
      if (u.seat) return { kind: 'seat', seat: u.seat };
      if (u.inspect && u.inspect.room === here) return { kind: 'screen', item: u.inspect };
      if (u.action) return { kind: 'object', action: u.action, label: u.action === 'files' ? ui.filesLabel() : u.label };
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
    if (h.kind === 'room' && rig.mode !== 'tower') ui.objectTooltip(`Go to the ${ROOMS[h.id].name}`, hoverAt.x, hoverAt.y);
    else if (h.kind === 'room') ui.roomTooltip(h.id, hoverAt.x, hoverAt.y);
    else if (h.kind === 'person') ui.personTooltip(h.id, hoverAt.x, hoverAt.y);
    else if (h.kind === 'seat') ui.objectTooltip(h.seat.available() ? (h.seat.kind === 'ceo' ? 'Sit in your chair' : h.seat.kind === 'sunbed' ? 'Lie down here' : h.seat.kind === 'stool' ? 'Sit at the bar' : h.seat.id?.startsWith('view-') ? 'Sit here: the whole lounge in view' : 'Sit here') : 'Taken', hoverAt.x, hoverAt.y);
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
    else if (h.action === 'whisky') office.goToCorner().then((ok) => ok && ui.openPanel({ type: 'pour' }));
    else if (h.action === 'files') ui.openPanel({ type: 'files' });
    else if (h.action === 'humidor') office.openHumidor();
    else if (h.action === 'cigar') office.takeCigar(h.target);
    else if (h.action === 'lighter') office.light();
    else if (h.action === 'refill') office.pour([h.target === 'ceo' ? 'ceo' : h.target.id]);
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
    for (const [id, a] of Object.entries(state.agents || {})) if (!workers[id]) ensureWorker(id, a);
    // voice mode: who is speaking / being listened to
    const vo = state.voice;
    const mtg = vo?.meeting ? (state.meetings || []).find((m) => m.id === vo.meeting) : null;
    for (const p of workerList) {
      p.talking = !!vo && vo.phase === 'speaking' && vo.speakingAgent === p.id;
      p.listening = !!vo?.on && vo.mic === 'live' && (vo.agent === p.id || (vo.to ? vo.to === p.id : !!mtg?.agents?.includes(p.id)));
    }
    for (const p of workerList) {
      const a = state.agents?.[p.id];
      if (!a) {
        p.missingSince ??= t;
        if (t - p.missingSince > 3 && !['waitLift', 'ride', 'board', 'alight', 'press'].includes(p.mode)) removeWorker(p);
        else p.update(dt, t);
        continue;
      }
      p.missingSince = null;
      const want = roomOf(a);
      if (!p.invited && !p.trip && p.mode !== 'walk' && p.room !== want && p.mode !== 'waitLift' && p.mode !== 'ride' && p.mode !== 'board' && p.mode !== 'alight') p.goToRoom(want, ROOMS[want].floor);
      p.update(dt, t);
    }
    life.update(dt, t, workerList);
    lift.update(dt);

    rig.update(dt);
    hands.update(dt);
    leisure.update(dt, t);
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
  window.__hq = { hands, leisure, office, smoke, rig, source, ui, tower, workers, people, life, lift, seats, scene, renderer, camera, pick, sit, invite, dismiss, meetings };
}

boot().catch((err) => {
  console.error(err);
  const l = document.getElementById('loader');
  if (l) l.querySelector('.loader-sub').textContent = 'Could not start the 3D view. Please reload.';
});
