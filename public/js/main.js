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
import { makeCharacter, AgentController } from './scene/agents.js';
import { CameraRig } from './scene/camera.js';
import { ROOMS, floorY, ceilY } from './scene/layout.js';
import { buildLab } from './rooms/lab.js';
import { buildWorkshop, buildPlanning } from './rooms/workfloor.js';
import { buildPenthouse, buildVault } from './rooms/topfloor.js';
import { buildRooftop } from './rooms/rooftop.js';
import { createSource } from './data/source.js';
import { createUI } from './ui/ui.js';

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
  // the rooftop sunbeds need a walking route between the rows
  const roof = rooms.rooftop.stations;
  roof.scott.via = [new THREE.Vector3(-7.85, 0, 0), new THREE.Vector3(-7.85, 0, roof.scott.pos.z)];
  roof.bob.via = [new THREE.Vector3(-7.85, 0, 0), new THREE.Vector3(-7.85, 0, roof.bob.pos.z)];
  roof.tom.via = [new THREE.Vector3(6.85, 0, 0), new THREE.Vector3(6.85, 0, roof.tom.pos.z)];
  for (const st of [roof.scott, roof.bob, roof.tom]) st.via[0].z = 4.7;

  // agents
  const source = createSource();
  const state0 = source.get();
  const getStation = (roomId, agentId) => rooms[roomId].stations[agentId] || rooms[roomId].stations.visit;
  const characters = {};
  const controllers = {};
  for (const id of ['scott', 'bob', 'tom']) {
    const c = makeCharacter(id);
    scene.add(c.root);
    characters[id] = c;
    const ctrl = new AgentController(c, tower.lift, getStation);
    const room = state0.agents[id].room;
    ctrl.placeAt(room, ROOMS[room].floor);
    controllers[id] = ctrl;
  }

  // post-processing
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.2, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(dpr);
  composer.setSize(window.innerWidth, window.innerHeight);

  const rig = new CameraRig(camera, canvas);
  const ui = createUI({ source, rig, camera, characters, controllers });
  rig.onChange((mode) => tower.setTowerView(mode === 'tower' || (mode === 'flying' && !rig.room)));

  // ------------------------------------------------------------ picking
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const agentMeshes = [];
  for (const c of Object.values(characters)) c.root.traverse((o) => o.isMesh && agentMeshes.push(o));
  const objectPickables = [...rooms.penthouse.pickables, ...rooms.vault.pickables];

  function pick(clientX, clientY) {
    pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (rig.mode === 'tower') {
      const hitAgent = raycaster.intersectObjects(agentMeshes, false)[0];
      const hitRoom = raycaster.intersectObjects(tower.pickables, false)[0];
      if (hitRoom) return { kind: 'room', id: hitRoom.object.userData.roomId };
      if (hitAgent) return { kind: 'agent', id: hitAgent.object.userData.agentId };
      return null;
    }
    if (rig.mode === 'room') {
      const hits = raycaster.intersectObjects([...agentMeshes, ...objectPickables], false);
      for (const h of hits) {
        if (h.object.userData.agentId) {
          const ctrl = controllers[h.object.userData.agentId];
          if (ctrl && ctrl.floor === ROOMS[rig.room].floor) return { kind: 'agent', id: h.object.userData.agentId };
        }
        if (h.object.userData.action) return { kind: 'object', action: h.object.userData.action, label: h.object.userData.label };
      }
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
    else if (h.kind === 'agent') ui.agentTooltip(h.id, hoverAt.x, hoverAt.y);
    else ui.objectTooltip(h.label, hoverAt.x, hoverAt.y);
  }

  canvas.addEventListener('click', (e) => {
    if (rig.wasDrag() || rig.mode === 'flying') return;
    const h = pick(e.clientX, e.clientY);
    if (!h) return;
    ui.hideTooltip();
    if (h.kind === 'room') rig.flyToRoom(h.id);
    else if (h.kind === 'agent') ui.openPanel({ type: 'chat', agent: h.id });
    else if (h.action === 'tray') ui.openPanel({ type: 'tray' });
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

  function frame() {
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05);
    adaptQuality(raw);
    t += dt;
    source.tick(dt);
    const state = source.get();
    const derived = state.derived;

    // sky follows Cyprus time (cheap, but no need every frame)
    if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) envState = env.update(t);
    setNight(envState.daylight);

    for (const [id, r] of Object.entries(derived.rooms)) tower.setRoomStatus(id, r.status);
    tower.update(dt, t, envState.daylight);

    for (const [id, room] of Object.entries(rooms)) {
      const st = derived.rooms[id]?.status;
      room.update(dt, t, state, envState.daylight, st === 'working' || st === 'problem' ? 1 : 0);
    }

    for (const [id, ctrl] of Object.entries(controllers)) {
      const a = state.agents[id];
      ctrl.update(dt, t, a.room, ROOMS[a.room].floor);
    }

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

  // warm-up render, then reveal
  composer.render(0);
  requestAnimationFrame(frame);
  setTimeout(() => ui.finishLoading(), 400);

  // debug hooks for previews: ?view=penthouse opens a room directly
  const q = new URLSearchParams(location.search);
  const startRoom = q.get('view');
  if (startRoom && ROOMS[startRoom]) rig.jumpToRoom(startRoom);
  window.__hq = { rig, source, ui, tower, controllers, characters, scene, renderer, camera, pick };
}

boot().catch((err) => {
  console.error(err);
  const l = document.getElementById('loader');
  if (l) l.querySelector('.loader-sub').textContent = 'Could not start the 3D view. Please reload.';
});
