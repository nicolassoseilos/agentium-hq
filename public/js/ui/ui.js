// Everything drawn in HTML over the 3D scene: top bar, team chips, hover
// labels, speech bubbles, the room bar and the side panel (iMessage-style
// chats, the desk tray, decisions, phone and vault).
import * as THREE from 'three';
import { ROOMS, FLOORS } from '../scene/layout.js';
import { localClock, localDate, fmt, PLACE } from '../core/time.js';
import { balanceLevel, daysLeft } from '../data/derive.js';
import { DRINKS } from '../scene/drinks.js';
import { agentMeta, sortAgents } from '../scene/roster.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const SYM = { EUR: '€', GBP: '£', USD: '$' };
const longDay = (at) => fmt(at, { weekday: 'short', day: 'numeric', month: 'short' });
const shortDay = (at) => fmt(at, { day: 'numeric', month: 'short' });
const money = (n, cur) => `${SYM[cur] || '$'}${Number(n).toFixed(n % 1 ? 2 : 0)}`;
const timeOf = (at) => fmt(at, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayStamp = (at) => {
  const same = fmt(at, { year: 'numeric', month: 'numeric', day: 'numeric' }) === fmt(Date.now(), { year: 'numeric', month: 'numeric', day: 'numeric' });
  return same ? `Today ${timeOf(at)}` : fmt(at, { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
};
let PEOPLE = {};
let AGENTS = {}; // state.agents, refreshed every update
const isAgent = (id) => !!AGENTS[id] || /^(voice|chat)-(scott|bob|tom)$/.test(id) || ['scott', 'bob', 'tom'].includes(id);
const nameOf = (id) => (id === 'ceo' ? 'Nicolas' : isAgent(id) ? agentMeta(id, AGENTS[id]).name : PEOPLE[id]?.name || id);
const roleOf = (id) => (isAgent(id) ? agentMeta(id, AGENTS[id]).role : PEOPLE[id]?.role || '');
const avatar = (id) => {
  if (id === 'ceo') return '<span class="avatar ceo">N</span>';
  if (isAgent(id)) {
    const m = agentMeta(id, AGENTS[id]);
    return `<span class="avatar agent ${m.dept} ${m.rank}" title="${esc(m.name)}">${esc(m.initials)}</span>`;
  }
  return `<span class="avatar ${PEOPLE[id]?.kind === 'guest' ? 'guest' : 'staff'}">${esc(nameOf(id)[0])}</span>`;
};
const agentIds = (s) => sortAgents(Object.keys(s.agents || {}), s.agents);

export function createUI({ source, rig, camera, people, social, life, workers, office: officeRef }) {
  PEOPLE = people;
  const localBubbles = []; // things said out loud in the room
  const body = document.body;
  const panel = { el: $('panel'), body: $('panel-body'), title: $('panel-title'), back: $('panel-back'), compose: $('panel-compose'), input: $('compose-input'), view: null, history: [] };

  $('place').textContent = PLACE; // the place of his own time zone
  if (matchMedia('(hover: none)').matches) $('hint').textContent = 'Tap a floor to fly inside · drag to look around';

  // ------------------------------------------------------------ top bar
  const team = $('team');
  let teamSig = '';
  // one chip per agent (Voice first, then Chat), rebuilt when the team changes
  function buildTeam(state) {
    const ids = agentIds(state);
    const sig = ids.join(',');
    if (sig === teamSig) return;
    teamSig = sig;
    team.classList.toggle('big', ids.length > 3);
    team.innerHTML = ids
      .map((id) => {
        const m = agentMeta(id, state.agents[id]);
        return `<div class="chip" data-agent="${id}" role="button" tabindex="0">${avatar(id)}<div class="chip-text"><div class="chip-name">${esc(m.legacy ? m.name : m.first)}${m.legacy ? '' : `<span class="chip-dept ${m.dept}">${m.dept === 'voice' ? 'Voice' : 'Chat'}</span>`}<span class="dot"></span></div><div class="chip-act"></div></div></div>`;
      })
      .join('');
  }
  AGENTS = source.get().agents || {};
  buildTeam(source.get());
  team.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const id = chip.dataset.agent;
    const a = source.get().agents[id];
    if (a) rig.flyToRoom(a.room);
  });
  $('desk-btn').addEventListener('click', () => {
    // the desk tray opens right where you are (no trip to the office)
    openPanel({ type: 'tray' });
  });

  // ------------------------------------------------------------ room bar
  $('back-btn').addEventListener('click', () => rig.back());
  const floorOf = (roomId) => ROOMS[roomId].floor;
  $('floor-up').addEventListener('click', () => {
    const f = floorOf(rig.room);
    if (f < 3) rig.flyToRoom(FLOORS[f + 1].rooms[FLOORS[f + 1].rooms.length - 1]);
  });
  $('floor-down').addEventListener('click', () => {
    const f = floorOf(rig.room);
    if (f > 0) rig.flyToRoom(FLOORS[f - 1].rooms[FLOORS[f - 1].rooms.length - 1]);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (panel.el.classList.contains('open')) closePanel();
      else if (rig.mode !== 'tower' && rig.mode !== 'flying') rig.back();
    }
  });

  rig.onChange((mode, room) => {
    const inRoom = !!room && mode !== 'tower';
    $('roombar').hidden = !inRoom;
    $('back-btn').innerHTML = mode === 'seated' || mode === 'inspect' ? '<span aria-hidden="true">‹</span> Room' : '<span aria-hidden="true">‹</span> Tower';
    renderActions();
    $('hint').classList.toggle('hidden', mode !== 'tower');
    if (room) {
      const r = ROOMS[room];
      const f = FLOORS[r.floor];
      $('room-floor').textContent = f.name;
      $('room-name').textContent = r.name;
      // the other room on this floor: tap its floor (no room buttons)
      $('room-switch').innerHTML = '';
      $('floor-up').disabled = r.floor === 3;
      $('floor-down').disabled = r.floor === 0;
    }
    tooltip.hidden = true;
  });

  // ------------------------------------------------------------ room actions (depend on what you are doing)
  const actions = $('room-actions');
  function renderActions() {
    const btns = [];
    const here = rig.presentRoom;
    if (rig.mode === 'seated') {
      btns.push(['stand', 'Stand up']);
      // the office and the planning table have a phone; the rooftop doesn't
      if (here === 'rooftop') btns.push(['invite', 'Invite someone']);
      if (life.ceoSpot?.type === 'stool') btns.push(['menu', 'Ask for the menu'], ['order', 'Order a drink']);
    }
    const office = officeRef.get();
    const moving = rig.mode === 'flying' || rig.mode === 'walking' || office.busy;
    if (rig.mode === 'standing' && !office.atCabinet) btns.unshift(['stand', 'Back to the room view']);
    const atCab = office.atCabinet;
    if ((here === 'penthouse' || here === 'planning') && !moving && !atCab) btns.push(['phone', 'Call an agent']);
    if (here === 'penthouse' && !moving) {
      btns.push(['pour', 'Pour a whisky']);
      if (office.cigarInHand) btns.push(['light', 'Light the cigar']);
      else btns.push(['cigar', office.atCabinet && office.humidorOpen ? 'Close the box' : 'Have a cigar']);
      if (office.atCabinet) {
        if (social.meetingsIn('penthouse').some((id) => !officeRef.leisure().cigarOf(workers[id]))) btns.push(['guestcigars', 'Cigars for the guests']);
        btns.push(['desk', 'Back to my desk']);
      }
    }
    if (here === 'penthouse' && office.busy) btns.push(['wait', '…']);
    if (here && social.meetingsIn(here).length && !atCab) btns.push(['excuse', 'That’s all']);
    if (rig.mode === 'inspect' && rig.inspecting?.room === 'vault') btns.push(['vault', 'Details']);
    if (here && !atCab && Object.values(people).some((p) => p.presentRoom === here && p.kind !== 'guest')) btns.push(['people', 'People here']);
    const html = btns.map(([a, l]) => `<button class="nav-btn ${a === 'order' ? 'gold' : ''}" data-act="${a}" type="button">${l}</button>`).join('');
    if (html !== actions.innerHTML) actions.innerHTML = html; // don't swap buttons under a finger
  }
  actions.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const a = b.dataset.act;
    const office = officeRef.get();
    if (a === 'stand') rig.standUp();
    else if (a === 'cigar') office.openHumidor();
    else if (a === 'light') office.light();
    else if (a === 'guestcigars') office.cigarsForGuests();
    else if (a === 'desk') office.backToDesk();
    else if (a === 'menu') {
      if (life.ceoAskMenu()) toast('Marco is bringing you the menu.');
    } else if (a === 'order') openPanel({ type: 'drinks' });
    else if (a === 'vault') openPanel({ type: 'vault' });
    else if (a === 'people') openPanel({ type: 'people' });
    else if (a === 'invite') openPanel({ type: 'invite' });
    else if (a === 'phone') openPanel({ type: 'phone' });
    else if (a === 'pour') officeRef.get().goToCorner().then((ok) => ok && openPanel({ type: 'pour' }));
    else if (a === 'excuse') {
      for (const id of social.meetingsIn(here())) social.dismiss(id);
      renderActions();
    }
  });
  const here = () => rig.presentRoom;

  // ------------------------------------------------------------ toast
  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.hidden = true;
  document.body.appendChild(toastEl);
  let toastTimer;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 3800);
  }

  // ------------------------------------------------------------ tooltip
  const tooltip = $('tooltip');
  function showTooltip(x, y, html) {
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
    const left = Math.min(x, window.innerWidth - w - 24);
    const top = Math.min(y, window.innerHeight - h - 24);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }
  function hideTooltip() {
    tooltip.hidden = true;
  }
  function roomTooltip(roomId, x, y) {
    const st = source.get().derived?.rooms?.[roomId];
    const r = ROOMS[roomId];
    if (!st) return;
    showTooltip(x, y, `<div class="tt-floor">${esc(FLOORS[r.floor].name)}</div><div class="tt-name">${esc(r.name)}</div><div class="tt-act"><span class="dot ${st.status}"></span><span>${esc(cap(st.activity))}</span></div><div class="tt-hint">Click to fly inside</div>`);
  }
  function agentTooltip(id, x, y) {
    const a = source.get().agents[id];
    if (!a) return;
    showTooltip(x, y, `<div class="tt-floor">${esc(a.role)}</div><div class="tt-name">${esc(a.name)}</div><div class="tt-act"><span class="dot ${a.status}"></span><span>${esc(cap(a.activity))}</span></div><div class="tt-hint">Click to message ${esc(a.name)}</div>`);
  }
  function personTooltip(id, x, y) {
    const p = people[id];
    if (!p) return;
    if (workers[id]) return agentTooltip(id, x, y);
    const doing = p.mode === 'swim' ? 'Swimming' : p.spot?.type === 'stool' ? 'At the bar' : p.spot?.type === 'sunbed' ? 'Sunbathing' : p.spot?.type === 'edge' ? 'By the pool' : p.role === 'Barman' ? 'Behind the bar' : p.role === 'DJ' ? 'On the decks' : 'Enjoying the music';
    showTooltip(x, y, `<div class="tt-floor">${esc(p.role)}</div><div class="tt-name">${esc(p.name)}</div><div class="tt-act"><span>${esc(doing)}${p.hasDrink ? ' · 🥂' : ''}</span></div>${p.kind === 'guest' ? '' : `<div class="tt-hint">Click to talk to ${esc(p.name)}</div>`}`);
  }
  function objectTooltip(label, x, y) {
    showTooltip(x, y, `<div class="tt-name">${esc(label)}</div>`);
  }

  // ------------------------------------------------------------ speech bubbles
  const bubbleLayer = $('bubbles');
  const bubbleEls = new Map();
  bubbleLayer.addEventListener('click', (e) => {
    const b = e.target.closest('.bubble');
    if (b) b.dataset.conv ? openPanel({ type: 'conversation', id: b.dataset.conv }) : openChat(b.dataset.person);
  });
  const v = new THREE.Vector3();
  // Bubbles are timed from when this page first sees a message, not from the
  // message's own time: live messages arrive by polling, often seconds late.
  const firstSeen = new Map();
  let seenReady = false;
  function freshBubbles(state, now) {
    const out = [];
    for (const c of state.conversations || []) {
      const last = c.messages?.[c.messages.length - 1];
      if (!last || last.from === 'ceo') continue;
      const key = `${c.id}|${last.at}|${last.from}|${String(last.text).length}`;
      if (!firstSeen.has(key)) firstSeen.set(key, seenReady ? now : last.at); // (on page load only genuinely new ones show)
      const seen = firstSeen.get(key);
      if (now - seen < 6500) out.push({ convId: c.id, from: last.from, text: last.text, at: seen });
    }
    seenReady = true;
    if (firstSeen.size > 500) for (const k of [...firstSeen.keys()].slice(0, 250)) firstSeen.delete(k);
    return out;
  }
  function updateBubbles(state) {
    const now = Date.now();
    while (localBubbles.length && now - localBubbles[0].at > 7000) localBubbles.shift();
    const list = [...freshBubbles(state, now), ...localBubbles];
    const keep = new Set();
    for (const b of list) {
      const key = `${b.convId}:${b.at}`;
      keep.add(key);
      let el = bubbleEls.get(key);
      const person = people[b.from];
      const ch = person?.c;
      if (!ch) continue;
      if (!el) {
        // one bubble per speaker at a time
        for (const [k, other] of bubbleEls) if (other.dataset.from === b.from) { other.remove(); bubbleEls.delete(k); }
        el = document.createElement('div');
        el.className = 'bubble';
        el.dataset.conv = b.convId || '';
        el.dataset.person = b.from;
        el.dataset.from = b.from;
        el.innerHTML = `<div class="in"><b>${esc(nameOf(b.from))}</b>${esc(b.text)}</div>`;
        bubbleLayer.appendChild(el);
        bubbleEls.set(key, el);
      }
      // only show when the speaker is in view
      let visible = true;
      if (rig.presentRoom && ROOMS[rig.presentRoom].floor !== person.floor) visible = false;
      if (rig.mode === 'flying') visible = false;
      ch.headPosition(v);
      v.project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) visible = false;
      el.style.display = visible ? '' : 'none';
      if (visible) {
        const x = (v.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, calc(-100% - 10px))`;
      }
      el.classList.toggle('fade', now - b.at > 5800);
    }
    for (const [k, el] of bubbleEls) if (!keep.has(k)) { el.remove(); bubbleEls.delete(k); }
  }

  // ------------------------------------------------------------ panel
  $('panel-close').addEventListener('click', closePanel);
  panel.back.addEventListener('click', () => {
    const prev = panel.history.pop();
    if (prev) openPanel(prev, true);
  });
  panel.compose.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = panel.input.value.trim();
    const v = panel.view;
    if (!text || (v?.type !== 'chat' && v?.type !== 'npc' && v?.type !== 'meeting')) return;
    if (v.type === 'meeting') source.act('sendMeeting', { meeting: v.id, text, ...(panel.to?.[v.id] ? { to: panel.to[v.id] } : {}) });
    else social.send(v.type === 'chat' ? v.agent : v.id, text);
    panel.input.value = '';
    render(true);
  });
  // ---- voice mode: push-to-talk (muted by default). The mic button in the input row turns voice
  // mode on/off; the big button unmutes ("Talk") and sends ("Send"). Hold V does the same.
  // Everything starts straight from the tap: browsers only allow the mic and sound from a real click.
  const micBtn = $('mic-btn');
  const vBar = $('voice-bar'), vStatus = $('vb-status'), vTalk = $('vb-talk'), vCancel = $('vb-cancel'), vEnd = $('vb-end');
  const addressing = $('addressing');
  const voiceTarget = (v) => (v?.type === 'meeting' ? { meeting: v.id } : v?.type === 'chat' ? { agent: v.agent } : null);
  const voiceMine = (vo, v) => !!vo?.on && !!v && (v.type === 'chat' ? vo.agent === v.agent : v.type === 'meeting' && vo.meeting === v.id);
  const toFor = (v) => (v?.type === 'meeting' ? panel.to?.[v.id] || null : null);
  addressing.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="addr"]');
    if (!b || panel.view?.type !== 'meeting') return;
    panel.to = panel.to || {};
    panel.to[panel.view.id] = null;
    updateVoice(true);
    render(true);
  });
  micBtn.addEventListener('click', () => {
    const vo = source.get().voice;
    const v = panel.view;
    if (!vo || !voiceTarget(v)) return;
    if (!vo.supported) return toast('Voice needs Chrome or Edge.');
    if (voiceMine(vo, v)) source.act('voiceStop');
    else {
      if (vo.on) source.act('voiceStop');
      source.act('voiceStart', { ...voiceTarget(v), listen: false }); // starts muted
    }
    updateVoice(true);
  });
  function talk() {
    const vo = source.get().voice;
    const v = panel.view;
    if (!voiceMine(vo, v)) return;
    const to = toFor(v);
    if (vo.phase === 'speaking') source.act('voiceInterrupt');
    if (vo.mic === 'live') source.act('micOff'); // = Send
    else source.act('micOn', to ? { to } : {});
    updateVoice(true);
  }
  vTalk.addEventListener('click', talk);
  vCancel.addEventListener('click', () => { source.act('micCancel'); updateVoice(true); });
  vEnd.addEventListener('click', () => { source.act('voiceStop'); updateVoice(true); });
  // hold V to talk (not while typing in a field)
  let vHeld = false;
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyV' || e.repeat || vHeld || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
    const vo = source.get().voice;
    if (!voiceMine(vo, panel.view)) return;
    vHeld = true;
    if (vo.phase === 'speaking') source.act('voiceInterrupt');
    if (vo.mic !== 'live') { const to = toFor(panel.view); source.act('micOn', to ? { to } : {}); }
    updateVoice(true);
  });
  window.addEventListener('keyup', (e) => {
    if (e.code !== 'KeyV' || !vHeld) return;
    vHeld = false;
    if (source.get().voice?.mic === 'live') source.act('micOff');
    updateVoice(true);
  });
  let voiceSig = '';
  function updateVoice(force = false) {
    const s = source.get();
    const vo = s.voice;
    const v = panel.view;
    const can = !!vo && !!voiceTarget(v);
    const mine = can && voiceMine(vo, v);
    const to = toFor(v);
    const sig = `${can}|${vo?.supported}|${mine}|${vo?.mic}|${vo?.phase}|${vo?.partial}|${vo?.error}|${vo?.speakingAgent}|${to}`;
    if (!force && sig === voiceSig) return;
    voiceSig = sig;
    micBtn.hidden = !can;
    micBtn.className = `mic ${!can ? '' : !vo.supported ? 'unsupported' : mine ? 'on' : ''}`;
    micBtn.textContent = '🎙';
    micBtn.title = !can ? '' : !vo.supported ? 'Voice needs Chrome or Edge' : mine ? 'End voice mode' : 'Voice mode (push to talk)';
    // "Talking to …" in a meeting
    addressing.hidden = !(v?.type === 'meeting' && to);
    if (!addressing.hidden) addressing.innerHTML = `Talking to <b>${esc(nameOf(to))}</b> <button data-act="addr" data-id="">× anyone</button>`;
    vBar.hidden = !mine;
    if (!mine) return;
    const live = vo.mic === 'live';
    const speaking = vo.phase === 'speaking';
    vTalk.className = `vb-talk ${live ? 'live' : 'muted'}${speaking ? ' speaking' : ''}`;
    vTalk.innerHTML = live ? '<span class="vb-ic">➤</span> Send' : `<span class="vb-ic">🎙</span> ${speaking ? 'Cut in and talk' : 'Talk'}`;
    vCancel.hidden = !live;
    const who = vo.speakingAgent ? nameOf(vo.speakingAgent) : v.type === 'chat' ? nameOf(v.agent) : 'Someone';
    let line;
    if (live) line = `<span class="vdot live"></span><b>Listening</b>${vo.partial ? ` · <i>${esc(vo.partial)}</i>` : ' · say it, then Send'}`;
    else if (vo.phase === 'thinking') line = '<span class="vdot"></span><b>Thinking…</b>';
    else if (speaking) line = `<span class="vdot"></span><b>${esc(who)}</b> is speaking…`;
    else line = '<span class="vdot muted"></span><b>MUTED</b> · tap Talk or hold V';
    vStatus.innerHTML = line + (vo.error ? `<div class="verr">${esc(vo.error)}</div>` : '');
  }

  // the team meeting picker
  panel.body.addEventListener('submit', (e) => {
    const f = e.target.closest('form.teampick');
    if (!f) return;
    e.preventDefault();
    const ids = [...f.querySelectorAll('input[name=who]:checked')].map((x) => x.value);
    if (!ids.length) return toast('Pick who joins the meeting.');
    const topic = f.querySelector('input.topic').value.trim();
    toast(`${ids.length === 1 ? nameOf(ids[0]) + ' is' : 'Everyone is'} on the way to the planning table.`);
    Promise.resolve(social.teamMeeting(ids, topic)).then((r) => {
      if (r?.id) openPanel({ type: 'meeting', id: r.id, agents: ids, topic });
    });
    closePanel();
  });
  // typing the balance a console shows (OpenAI, Google: no balance API)
  panel.body.addEventListener('submit', (e) => {
    const f = e.target.closest('form.enter');
    if (!f) return;
    e.preventDefault();
    const amount = parseFloat(String(f.querySelector('input').value).replace(/[^0-9.,-]/g, '').replace(',', '.'));
    if (!Number.isFinite(amount)) return;
    source.act('setBalance', { id: f.dataset.id, amount });
    panel.entering = null;
    toast('Saved. The new figure arrives in a minute or two.');
    render(true);
  });
  window.addEventListener('focus', () => {
    if (!panel.askOnReturn) return;
    panel.entering = panel.askOnReturn;
    panel.askOnReturn = null;
    openPanel({ type: 'vault' });
    setTimeout(() => panel.body.querySelector('form.enter input')?.focus(), 50);
  });
  panel.el.addEventListener('pointerdown', () => (panel.pressing = true));
  window.addEventListener('pointerup', () => setTimeout(() => (panel.pressing = false), 0));
  window.addEventListener('pointercancel', () => (panel.pressing = false));
  panel.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const { act, id } = t.dataset;
    if (act === 'approve' || act === 'reject') source.act('decide', { id, verdict: act === 'approve' ? 'approved' : 'rejected' });
    else if (act === 'doc') openPanel({ type: 'doc', id });
    else if (act === 'chat') openChat(id);
    else if (act === 'invite') social.invite(id);
    else if (act === 'inviteall') {
      if (social.live()) { openPanel({ type: 'teampick', all: true }); return; }
      for (const a of agentIds(source.get())) if (!social.inMeeting(a)) social.invite(a);
    } else if (act === 'discuss') {
      const s0 = source.get();
      const item = [...s0.ceo.documents, ...s0.ceo.decisions].find((x) => x.id === id);
      const who = item && social.discuss(item);
      if (who) {
        toast(`${nameOf(who)} is coming to your office to go through it with you.`);
        openPanel({ type: 'chat', agent: who });
      }
      return;
    } else if (act === 'play') {
      // the answer's pieces, one after the other
      const urls = t.dataset.url.split(' ').filter(Boolean);
      const next = (i) => { if (i >= urls.length) return; const a = new Audio(urls[i]); a.onended = () => next(i + 1); a.play().catch(() => {}); };
      next(0);
      return;
    } else if (act === 'setupmeetings') {
      source.showMeetingSetup?.();
      return;
    }
    else if (act === 'dismiss') social.dismiss(id);
    else if (act === 'pour') {
      if (social.pour(id.split(','))) closePanel();
    } else if (act === 'cigarorder') {
      if (life.ceoOrderCigar()) {
        toast('Marco is preparing your cigar.');
        closePanel();
      } else toast('Take a seat at the bar first.');
    } else if (act === 'drink') {
      if (!life.ceoSpot || life.ceoSpot.type !== 'stool') toast('Take a seat at the bar to order.');
      else if (life.ceoOrder(id)) {
        toast(`Marco is preparing your ${DRINKS[id].name}.`);
        closePanel();
      } else toast('Marco is already on it.');
      return;
    }
    else if (act === 'conv') openPanel({ type: 'conversation', id });
    else if (act === 'topup') {
      // a real link: the browser opens the payment page in a new tab (no pop-up blocker)
      source.act('topupOpened', { id });
      const bal = (source.get().balances || []).find((x) => x.id === id || `topup-${x.id}` === id);
      if (bal?.canEnter) panel.askOnReturn = bal.id; // back on this tab: "What does it show now?"
    } else if (act === 'enterbal') {
      panel.entering = id;
      render(true);
      panel.body.querySelector('form.enter input')?.focus();
      return;
    } else if (act === 'convos') openPanel({ type: 'conversations' });
    render(true);
  });

  function openPanel(view, isBack = false) {
    if (!isBack && panel.view && panel.el.classList.contains('open') && JSON.stringify(panel.view) !== JSON.stringify(view)) panel.history.push(panel.view);
    if (!panel.el.classList.contains('open')) panel.history = [];
    panel.view = view;
    panel.el.classList.add('open');
    panel.el.setAttribute('aria-hidden', 'false');
    panel.lastSig = '';
    if (view.type === 'doc') source.act('readDoc', { id: view.id });
    if (view.type === 'chat') source.act('readChat', { agent: view.agent });
    render(true);
    if ((view.type === 'chat' || view.type === 'npc') && window.innerWidth > 700) setTimeout(() => panel.input.focus(), 350);
  }

  function closePanel() {
    panel.el.classList.remove('open');
    panel.el.setAttribute('aria-hidden', 'true');
    panel.view = null;
    panel.history = [];
  }

  function render(force = false) {
    const view = panel.view;
    if (!view) return;
    const s = source.get();
    const meet = agentIds(s).map((i) => social.inMeeting(i)).join();
    const typing = view.type === 'chat' ? source.isTyping?.(view.agent) : view.type === 'npc' ? social.typing.has(view.id) : view.type === 'meeting' ? source.meetingTyping?.(view.id) : false;
    const vSig = s.voice ? `${s.voice.on}|${s.voice.phase}|${s.voice.partial}|${s.voice.agent}|${s.voice.meeting}` : '';
    const mtgSig = vSig + JSON.stringify(s.ceo?.meetingHands || {}) + JSON.stringify(panel.to || {}) + (s.meetings || []).slice(0, 8).map((m) => `${m.id}${m.status}${(m.summary || '').length}`).join() + `|${s.setup?.meetings}`;
    const extra = view.type === 'npc' ? `${social.thread(view.id).length}|${view.id === 'dj' && window.AHQ_MUSIC ? `${social.djConnect}|${window.AHQ_MUSIC.connected?.()}|${JSON.stringify(window.AHQ_MUSIC.nowPlaying?.() || null)}` : ''}` : view.type === 'people' ? Object.values(people).map((p) => p.presentRoom).join() : view.type === 'drinks' ? !!life.ceoSpot : 0;
    const sig = JSON.stringify([view, s.ceo, s.balances.map((b) => `${b.balance?.toFixed?.(0)}|${b.entering}|${JSON.stringify(b.view || '')}`), (s.bills || []).map((b) => JSON.stringify(b.view || '')), panel.entering, view.type === 'conversation' ? s.conversations.find((c) => c.id === view.id)?.messages.length : 0, typing, extra, meet, mtgSig]);
    if (!force && sig === panel.lastSig) return;
    // never swap the contents under a press (the click would be lost)
    if (!force && panel.pressing) return;
    if (!force && panel.body.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return; // typing
    const atBottom = panel.body.scrollHeight - panel.body.scrollTop - panel.body.clientHeight < 40;
    panel.lastSig = sig;
    panel.back.hidden = panel.history.length === 0;
    panel.compose.hidden = view.type !== 'chat' && view.type !== 'npc' && view.type !== 'meeting';
    panel.input.placeholder = view.type === 'npc' || (view.type === 'chat' && social.inPerson(view.agent)) ? 'Say something…' : 'iMessage';
    const r = VIEWS[view.type](s, view);
    if (r.title !== panel.lastTitle) panel.title.innerHTML = panel.lastTitle = r.title;
    if (r.body !== panel.lastBody || force) panel.body.innerHTML = panel.lastBody = r.body;
    if (r.scrollBottom && (atBottom || force)) panel.body.scrollTop = panel.body.scrollHeight;
    if (view.type === 'chat') source.act('readChat', { agent: view.agent });
  }

  // iMessage thread renderer
  function thread(messages, rightIds, { names = false } = {}) {
    let html = '<div class="imsg">';
    let lastAt = 0, lastFrom = null;
    messages.forEach((m, i) => {
      if (m.at - lastAt > 15 * 60 * 1000) {
        html += `<div class="stamp">${esc(dayStamp(m.at))}</div>`;
        lastFrom = null;
      }
      const right = rightIds.includes(m.from);
      if (names && !right && m.from !== lastFrom) html += `<div class="sender">${esc(nameOf(m.from))}</div>`;
      const first = m.from !== lastFrom ? ' first' : '';
      html += `<div class="msg ${right ? 'right' : 'left'}${first}${m.ack ? ' ack' : ''}">${esc(m.text)}</div>`;
      if (m.quick && !right) html += '<div class="msg-tag">quick reply</div>';
      const parts = m.audioParts?.length ? m.audioParts : m.audio ? [m.audio] : [];
      if (parts.length && !right) html += `<button class="play-btn" data-act="play" data-url="${esc(parts.join(' '))}" aria-label="Play">▶ Play</button>`;
      lastAt = m.at;
      lastFrom = m.from;
      if (i === messages.length - 1 && right && m.from === 'ceo') html += '<div class="delivered">Delivered</div>';
    });
    return html + '</div>';
  }

  // the latest live meeting for an agent's 1:1 chat / office meeting
  const meetingFor = (s, agent) => (s.meetings || []).find((m) => m.agents?.includes(agent) && (m.kind === 'chat' || m.room === 'office'));
  function meetingFooter(m) {
    if (!m) return '';
    if (m.status === 'ended' && m.summary) return `<div class="card meeting-end"><div class="c-top"><span>Meeting closed</span><span>${m.endedAt ? esc(dayStamp(m.endedAt)) : ''}</span></div><div class="c-detail">${esc(m.summary)}</div></div>`;
    if (m.status === 'ending') return '<div class="meeting-note">Wrapping up and writing down the decisions…</div>';
    if (m.status === 'failed') return `<div class="meeting-note fail">The live session could not start${m.error ? `: ${esc(String(m.error).slice(0, 120))}` : ''}. Quick replies are answering meanwhile.</div>`;
    return '';
  }
  // voice mode: his words as he says them (a draft bubble)
  const voiceFor = (s, v) => {
    const vo = s.voice;
    if (!vo?.on) return null;
    if (v.type === 'chat' && vo.agent === v.agent) return vo;
    if (v.type === 'meeting' && vo.meeting === v.id) return vo;
    return null;
  };
  const withDraft = (body, vo) => (vo?.mic === 'live' && vo.partial ? body.replace(/<\/div>$/, `<div class="msg right first draft">${esc(vo.partial)}</div></div>`) : body);
  const withTyping = (body, on) => (on ? body.replace(/<\/div>$/, '<div class="typing"><i></i><i></i><i></i></div></div>') : body);

  const VIEWS = {
    meeting(s, v) {
      const m = (s.meetings || []).find((x) => x.id === v.id) || { agents: v.agents || [], status: 'requested', topic: v.topic };
      const msgs = (s.ceo.meetingChats?.[v.id] || []).filter((x) => !x.hand);
      const hands = s.ceo.meetingHands?.[v.id] || [];
      const to = panel.to?.[v.id] || null;
      const vo = voiceFor(s, v);
      let body = withTyping(withDraft(thread(msgs, ['ceo'], { names: true }), vo), source.meetingTyping?.(v.id) || vo?.phase === 'thinking');
      if (!msgs.length && ['requested', 'starting'].includes(m.status)) body = '<div class="empty" style="text-align:center;margin-top:20px">Everyone is taking a seat…</div>' + body;
      body += meetingFooter(m);
      const open = !['ended', 'failed'].includes(m.status);
      const status = { requested: 'Starting…', starting: 'Starting…', live: 'Meeting live', ending: 'Wrapping up', ended: 'Meeting closed', failed: 'Not live' }[m.status] || '';
      return {
        title: `<div class="pt-avatars mtg">${(m.agents || []).map((a) => { const hand = hands.find((h) => h.agent === a); return `<button class="mtg-who ${to === a ? 'to' : ''}" data-act="${hand ? 'hand' : 'addr'}" data-id="${a}" title="${esc(hand ? `${nameOf(a)} has something: ${hand.about || ''} — tap to call on him` : `Talk to ${nameOf(a)}`)}">${avatar(a)}${hand ? '<span class="hand">✋</span>' : ''}</button>`; }).join('')}</div>${hands.length ? `<div class="hands">${hands.map((h) => `<button data-act="hand" data-id="${h.agent}">✋ ${esc(nameOf(h.agent))}: ${esc(h.about || 'has something')}</button>`).join('')}</div>` : ''}<div class="pt-name">${esc(m.topic || 'Team meeting')}</div><div class="pt-sub">${esc(status)} · ${esc((m.agents || []).map(nameOf).join(', '))}</div>${open ? `<div class="pt-actions"><button data-act="endmeeting" data-id="${esc(v.id)}">That’s all, thanks</button></div>` : ''}`,
        body,
        scrollBottom: true,
      };
    },
    teampick(s, v) {
      const ids = agentIds(s);
      const rows = ids.map((id) => `<label class="card agent-pick pick"><input type="checkbox" name="who" value="${id}" ${v.all ? 'checked' : ''}>${avatar(id)}<div style="flex:1;min-width:0"><div class="ap-name">${esc(nameOf(id))}</div><div class="ap-role">${esc(roleOf(id))} · ${esc(cap(s.agents[id]?.activity || ''))}</div></div></label>`).join('');
      return { title: '<h2>Team meeting</h2>', body: `<form class="teampick"><div class="section-title">Who joins</div>${rows}<div class="section-title">Topic (optional)</div><input class="topic" name="topic" placeholder="e.g. Next week’s releases" autocomplete="off"><button class="btn gold" type="submit" style="width:100%;margin-top:14px">Start the meeting</button></form>` };
    },
    conversation(s, v) {
      const c = s.conversations.find((x) => x.id === v.id);
      if (!c) return { title: '', body: '' };
      const names = c.participants.map((p) => nameOf(p)).join(c.participants.length > 2 ? ', ' : ' & ');
      const right = c.participants.length === 2 ? [c.participants[1]] : [];
      return {
        title: `<div class="pt-avatars">${c.participants.map(avatar).join('')}</div><div class="pt-name">${esc(names)}</div><div class="pt-sub">${c.participants.length > 2 ? 'Team chat' : 'Agent conversation'}</div>`,
        body: thread(c.messages, right, { names: true }),
        scrollBottom: true,
      };
    },
    conversations(s) {
      const items = s.conversations
        .map((c) => ({ c, last: c.messages[c.messages.length - 1] }))
        .sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0))
        .map(({ c, last }) => `<div class="card clickable" data-act="conv" data-id="${c.id}"><div class="pt-avatars" style="display:flex">${c.participants.map(avatar).join('')}</div><div style="min-width:0;flex:1"><div class="c-top"><span>${esc(c.participants.map((p) => nameOf(p)).join(', '))}</span><span>${last ? timeOf(last.at) : ''}</span></div><div class="c-detail" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(last ? `${nameOf(last.from)}: ${last.text}` : '')}</div></div></div>`)
        .join('');
      return { title: '<h2>Conversations</h2>', body: `<div class="convo-list">${items}</div>` };
    },
    chat(s, v) {
      const list = s.ceo.chats[v.agent] || [];
      const a = s.agents[v.agent];
      const vo = voiceFor(s, v);
      let body = withTyping(withDraft(thread(list, ['ceo']), vo), source.isTyping?.(v.agent) || vo?.phase === 'thinking');
      body += meetingFooter(meetingFor(s, v.agent));
      const here = social.inPerson(v.agent);
      return {
        title: `<div class="pt-avatars">${avatar(v.agent)}</div><div class="pt-name">${esc(nameOf(v.agent))}</div><div class="pt-sub">${here ? 'Here with you' : esc(roleOf(v.agent)) + ' · ' + esc(cap(a?.activity || ''))}</div><div class="pt-actions">${social.inMeeting(v.agent) ? `<button data-act="dismiss" data-id="${v.agent}">That’s all, thanks</button>` : ''}</div>`,
        body,
        scrollBottom: true,
      };
    },
    npc(s, v) {
      const p = people[v.id];
      let body = thread(social.thread(v.id), ['ceo']);
      if (!social.thread(v.id).length) body = `<div class="empty" style="text-align:center;margin-top:20px">Say hello to ${esc(p.name)}.</div>`;
      if (social.typing.has(v.id)) body = body.replace(/<\/div>$/, '<div class="typing"><i></i><i></i><i></i></div></div>');
      // the DJ: what's playing, and the Spotify connect button when needed
      let sub = `${esc(p.role)} · here with you`, actions = '';
      const music = v.id === 'dj' ? window.AHQ_MUSIC : null;
      if (music) {
        const np = music.nowPlaying?.();
        if (np) sub = `${np.paused ? 'Paused' : 'Playing'} · ${esc(np.name)} — ${esc(np.artists)}`;
        if (social.djConnect || (music.configured?.() && !music.connected?.())) actions = '<div class="pt-actions"><button data-act="spotify" class="spotify">Connect Spotify</button></div>';
      }
      return { title: `<div class="pt-avatars">${avatar(v.id)}</div><div class="pt-name">${esc(p.name)}</div><div class="pt-sub">${sub}</div>${actions}`, body, scrollBottom: true };
    },
    people(s) {
      const here = rig.presentRoom;
      const list = Object.values(people).filter((p) => p.presentRoom === here && p.kind !== 'guest');
      const rows = list.map((p) => `<div class="card clickable agent-pick" data-act="chat" data-id="${p.id}">${avatar(p.id)}<div style="flex:1;min-width:0"><div class="ap-name">${esc(p.name)}</div><div class="ap-role">${esc(p.role)}${workers[p.id] ? ' · ' + esc(cap(s.agents[p.id].activity)) : ''}</div></div><span class="mini">Talk</span></div>`).join('');
      return { title: `<h2>${esc(ROOMS[here]?.name || 'Here')}</h2>`, body: `<div class="section-title">People here <span>${list.length}</span></div>${rows || '<div class="empty">Nobody else is here right now.</div>'}` };
    },
    invite(s) {
      const where = rig.seat?.kind === 'stool' ? 'for a drink at the bar' : rig.seat?.kind === 'ceo' ? 'in your office' : rig.seat?.kind === 'chair' ? 'at the planning table' : rig.seat?.kind === 'sunbed' ? 'by the pool' : rig.seat?.kind === 'sofa' ? 'on the sofa' : rig.seat?.kind === 'cabana' ? 'in the cabana' : 'here';
      const rows = agentIds(s).map((id) => {
        const a = s.agents[id];
        const busy = social.inMeeting(id);
        return `<div class="card agent-pick">${avatar(id)}<div style="flex:1;min-width:0"><div class="ap-name">${esc(a.name)}</div><div class="ap-role">${esc(a.role)} · ${esc(cap(busy ? 'with you' : a.activity))}</div></div>${busy ? `<button class="btn reject" style="flex:none" data-act="dismiss" data-id="${id}">That’s all</button>` : `<button class="btn gold" style="flex:none" data-act="invite" data-id="${id}">Join me</button>`}</div>`;
      }).join('');
      return { title: '<h2>Invite someone</h2>', body: `<div class="section-title">Ask an agent to join you ${esc(where)}</div>${rows}<div class="empty" style="margin-top:10px">They stop what they are doing, take the lift and sit with you. Then just talk.</div>` };
    },
    drinks() {
      const seated = life.ceoSpot?.type === 'stool';
      const items = Object.entries(DRINKS).map(([k, d]) => `<div class="card clickable drink-row" data-act="drink" data-id="${k}"><div class="c-title" style="font-family:var(--display);font-size:22px;font-weight:500">${esc(d.name)}</div><div class="c-detail">${esc(d.note)}</div></div>`).join('');
      const cigar = `<div class="menu-head" style="margin-top:18px">CIGARS</div><div class="card clickable drink-row" data-act="cigarorder"><div class="c-title" style="font-family:var(--display);font-size:22px;font-weight:500">Cohiba Robusto</div><div class="c-detail">Cut and lit for you at the bar, with an ashtray (for whoever is sitting with you too)</div></div>`;
      return { title: '<h2>The Bar</h2>', body: `<div class="menu-head">AGENTIUM ROOFTOP · DRINKS</div>${seated ? '' : '<div class="empty">Take a seat at the bar to order.</div>'}${items}${cigar}` };
    },
    tray(s) {
      const docs = s.ceo.documents;
      const decisions = s.ceo.decisions;
      const topups = s.derived?.topups || [];
      const pending = decisions.filter((d) => d.status === 'pending');
      const done = decisions.filter((d) => d.status !== 'pending').slice(0, 3);
      let html = '';
      if (s.setup && s.setup.meetings === false && source.showMeetingSetup) html += `<div class="card setup"><div class="c-title">Live meetings</div><div class="c-detail">Connect them once and every conversation here becomes a real briefing: agenda first, one item at a time, your decisions written down. Until then the agents send quick replies.</div><div class="c-actions"><button class="btn gold" data-act="setupmeetings">Connect live meetings</button></div></div>`;
      html += `<div class="section-title">Decisions <span>${pending.length} waiting</span></div>`;
      html += pending.length ? pending.map(decisionCard).join('') : '<div class="empty">Nothing needs you right now.</div>';
      html += done.map(decisionCard).join('');
      html += `<div class="section-title">Top-ups <span>${topups.length}</span></div>`;
      html += topups.length ? topups.map(topupCard).join('') : '<div class="empty">All balances are healthy.</div>';
      html += `<div class="section-title">Documents <span>${docs.filter((d) => !d.read).length} new</span></div>`;
      html += docs.length ? docs.slice(0, 12).map(docCard).join('') : '<div class="empty">No documents yet.</div>';
      html += `<div class="section-title">Talk to the team</div>`;
      html += agentIds(s).map((id) => agentCard(s, id)).join('');
      html += `<div class="card clickable" data-act="convos"><div class="c-title">Agent conversations</div><div class="c-detail">Read what the team is saying to each other.</div></div>`;
      return { title: '<h2>Your Desk</h2>', body: html };
    },
    decisions(s) {
      const d = s.ceo.decisions;
      const pending = d.filter((x) => x.status === 'pending');
      return {
        title: '<h2>Decisions</h2>',
        body: (pending.length ? pending.map(decisionCard).join('') : '<div class="empty">Nothing needs you right now.</div>') + d.filter((x) => x.status !== 'pending').map(decisionCard).join(''),
      };
    },
    phone(s) {
      // the desk phone (office) and the conference phone (planning table)
      const room = rig.presentRoom;
      const canInvite = room === 'penthouse' || room === 'planning';
      const where = room === 'penthouse' ? 'to your office' : 'to the planning table';
      const rows = agentIds(s).map((id) => {
        const a = s.agents[id];
        const busy = social.inMeeting(id);
        const unread = (s.ceo.chats[id] || []).filter((m) => m.from !== 'ceo' && !m.read).length;
        const btn = busy
          ? `<button class="btn reject" style="flex:none" data-act="dismiss" data-id="${id}">That’s all</button>`
          : canInvite ? `<button class="btn gold" style="flex:none" data-act="invite" data-id="${id}">Invite</button>` : '';
        return `<div class="card agent-pick">${avatar(id)}<div style="flex:1;min-width:0"><div class="ap-name">${esc(a.name)}${unread ? ` <span class="badge">${unread}</span>` : ''}</div><div class="ap-role">${esc(a.role)} · ${esc(cap(busy ? 'with you' : a.activity))}</div></div><button class="btn outline" style="flex:none" data-act="chat" data-id="${id}">Message</button>${btn}</div>`;
      }).join('');
      // the planning room is the team's meeting room: everyone at once
      const everyone = room === 'planning' && agentIds(s).some((id) => !social.inMeeting(id)) ? `<div class="card clickable drink-row" data-act="inviteall"><div class="c-title" style="font-family:var(--display);font-size:22px;font-weight:500">${social.live() ? 'Team meeting' : 'Invite everyone'}</div><div class="c-detail">${social.live() ? 'Pick who joins and a topic; they come to the planning table' : 'A team meeting: every agent comes to the planning table'}</div></div>` : '';
      return { title: '<h2>Call an agent</h2>', body: `${everyone}<div class="section-title">Contacts</div>${rows}${canInvite ? `<div class="empty" style="margin-top:10px">Invite asks them ${esc(where)}. They take a seat across from you and wait until you say “That’s all”.</div>` : ''}` };
    },
    pour() {
      const L = officeRef.leisure();
      const guests = social.meetingsIn('penthouse');
      const row = (ids, title, detail) => `<div class="card clickable drink-row" data-act="pour" data-id="${ids.join(',')}"><div class="c-title" style="font-family:var(--display);font-size:22px;font-weight:500">${esc(title)}</div><div class="c-detail">${esc(detail)}</div></div>`;
      const mine = L.drinkOf('ceo');
      const rows = [row(['ceo'], mine ? 'Refill mine' : 'One for me', mine ? 'Take your glass back to the decanter and pour again' : 'Walk to the cabinet, take a crystal tumbler and pour from the decanter')];
      for (const id of guests) {
        const g = L.drinkOf(workers[id]);
        rows.push(row([id], g ? `Refill ${nameOf(id)}’s glass` : `One for ${nameOf(id)}`, g ? 'Take the glass from the desk, refill it and bring it back' : 'Pour a glass and put it in front of them'));
      }
      if (guests.length) rows.push(row(['ceo', ...guests], 'For everyone', 'All the glasses at once, carried back on the silver tray'));
      return { title: '<h2>Whisky</h2>', body: `<div class="menu-head">THE CEO’S CABINET</div>${rows.join('')}${guests.length ? '' : '<div class="empty">Invite someone to your office to pour them a glass too.</div>'}` };
    },
    doc(s, v) {
      const d = s.ceo.documents.find((x) => x.id === v.id);
      if (!d) return { title: '', body: '' };
      return {
        title: `<h2>${esc(d.kind)}</h2>`,
        body: `<div class="c-title" style="font-family:var(--display);font-size:26px;line-height:1.15">${esc(d.title)}</div><div class="doc-meta">From ${esc(nameOf(d.from))} · ${esc(dayStamp(d.at))}</div><div class="doc">${esc(d.body)}</div>`,
      };
    },
    vault(s) {
      // with live data each balance carries the balance page's own reading (b.view); the sample has none
      const LVL = { ok: 'ok', soon: 'low', urgent: 'urgent', card: 'onCard', info: 'ok' };
      const viewCard = (b) => {
        const v = b.view;
        const lvl = LVL[v.status] || 'ok';
        const sug = v.suggest;
        const pay = sug && b.payUrl ? `<a class="btn gold" href="${esc(b.payUrl)}" target="_blank" rel="noopener noreferrer" data-act="topup" data-id="${esc(b.id)}">Top up ${esc(sug.amount)} ↗</a>` : '';
        let enter = '';
        if (b.canEnter) {
          if (b.entering) enter = '<div class="c-detail enter-note">Updating…</div>';
          else if (panel.entering === b.id) enter = `<form class="enter" data-id="${esc(b.id)}"><label>What does ${esc(b.service)} show now?</label><div class="enter-row"><input inputmode="decimal" placeholder="${esc(b.currency === 'EUR' ? '€' : b.currency === 'GBP' ? '£' : '$')}0.00" autocomplete="off"><button class="btn gold" type="submit">Save</button></div></form>`;
          else enter = `<button class="link-btn" data-act="enterbal" data-id="${esc(b.id)}">Update balance</button>`;
        }
        return `<div class="card ${lvl === 'ok' ? '' : lvl}"><div class="c-top"><span class="lvl ${lvl}">${esc(v.label || 'Fine')}</span></div><div class="c-title">${esc(b.service)}</div><div class="amount">${esc(v.big)}</div>${(v.lines || []).map((l) => `<div class="c-detail">${esc(l)}</div>`).join('')}${v.step ? `<div class="c-step">${esc(v.step)}</div>` : ''}${sug ? `<div class="c-suggest">Suggested top-up: <b>${esc(sug.amount)}</b>${sug.why ? ` (${esc(sug.why)})` : ''}</div>` : ''}${pay ? `<div class="c-actions">${pay}</div>` : ''}${enter}${v.read ? `<div class="c-read">${esc(v.read)}</div>` : ''}</div>`;
      };
      const rows = s.balances
        .map((b) => {
          if (b.view) return viewCard(b);
          const lvl = balanceLevel(b);
          const days = daysLeft(b);
          const t = (s.derived?.topups || []).find((x) => x.serviceId === b.id);
          // monthly accounts (Zadarma) are charged on a day of the month; usage accounts run down day by day
          const rate = b.kind === 'monthly' ? (b.monthly ? `${money(b.monthly, b.currency)}/month` : 'Monthly') : `${money(b.perDay, b.currency)}/day`;
          let detail;
          if (b.kind === 'monthly') {
            detail = b.nextCharge ? `Charged on ${longDay(b.nextCharge)}${b.monthly ? ` (${money(b.monthly, b.currency)})` : ''}` : 'Charged monthly';
            if (b.needs > 0) detail += `<br><span class="needs">Needs ${money(Number(b.needs).toFixed(2), b.currency)} more${b.nextCharge ? ` before ${shortDay(b.nextCharge)}` : ''}</span>`;
          } else detail = days === Infinity ? 'Nothing used lately' : `Lasts about ${Math.max(0, Math.floor(days))} days`;
          return `<div class="card ${lvl === 'ok' ? '' : lvl}"><div class="c-top"><span class="lvl ${lvl}">${lvl === 'ok' ? 'Healthy' : lvl}</span><span>${rate}</span></div><div class="c-title">${esc(b.service)}</div><div class="amount">${money(b.balance.toFixed(2), b.currency)}</div><div class="c-detail">${detail}</div>${t ? `<div class="c-actions">${t.url ? `<a class="btn gold" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" data-act="topup" data-id="${t.id}">Top up ${money(t.amount, t.currency)} ↗</a>` : '<span class="btn" style="opacity:.6">No payment link yet</span>'}</div>` : ''}</div>`;
        })
        .join('');
      const bills = (s.bills || []).length ? `<div class="section-title">Card bills</div>${s.bills.map((b) => (b.view ? viewCard(b) : '')).join('')}` : '';
      const u = s.claudeUsage;
      const bar = (label, x) => {
        if (!x) return '';
        const pct = Math.max(0, Math.min(100, Number(x.pct) || 0));
        const lvl = pct >= 90 ? 'urgent' : pct >= 70 ? 'low' : 'ok';
        const reset = x.resetsAt ? new Date(typeof x.resetsAt === 'number' ? x.resetsAt : Date.parse(x.resetsAt)) : null;
        const when = reset && !Number.isNaN(reset.getTime()) ? `Resets ${dayStamp(reset.getTime())}` : '';
        return `<div class="usage"><div class="c-top"><span>${esc(label)}</span><span class="lvl ${lvl}">${Math.round(pct)}%</span></div><div class="usage-bar"><i class="${lvl}" style="width:${pct}%"></i></div><div class="c-detail">${esc(when)}</div></div>`;
      };
      const plan = u ? `<div class="section-title">Claude plan</div><div class="card">${bar('This week', u.week)}${bar('This session', u.session)}</div>` : '';
      return { title: '<h2>The Vault</h2>', body: `${plan}<div class="section-title">Agentium Balance Tracker</div>${rows}${bills}` };
    },
    files(s) {
      const f = s.files;
      if (!f?.groups?.length) return { title: '<h2>Project files</h2>', body: '<div class="empty">The file list arrives with the live data.</div>' };
      const total = f.groups.reduce((n, gr) => n + (gr.count || 0), 0);
      const groups = [...f.groups].sort((a, b) => b.count - a.count).map((gr) => `<details class="card files"><summary><span class="c-title">${esc(gr.folder || '/')}</span><span class="mini">${gr.count} files</span></summary><div class="file-list">${(gr.files || []).map((x) => `<div>${esc(x)}</div>`).join('')}</div></details>`).join('');
      return { title: '<h2>Project files</h2>', body: `<div class="section-title">${total} files in ${f.groups.length} folders${f.updated ? ` <span>${esc(dayStamp(typeof f.updated === 'number' ? f.updated : Date.parse(f.updated)))}</span>` : ''}</div>${groups}` };
    },
  };

  function decisionCard(d) {
    const amount = d.amount ? `<div class="amount">${money(d.amount, d.currency)}${d.period ? `<span style="font-size:15px;color:var(--muted)"> / ${esc(d.period)}</span>` : ''}</div>` : '';
    const actions = d.status === 'pending'
      ? `<div class="c-actions"><button class="btn approve" data-act="approve" data-id="${d.id}">Approve</button><button class="btn reject" data-act="reject" data-id="${d.id}">Reject</button>${social.live() ? `<button class="btn outline" data-act="discuss" data-id="${d.id}">Discuss</button>` : ''}</div>`
      : `<div class="c-actions"><span class="status-tag ${d.status}">${esc(d.status)}</span></div>`;
    return `<div class="card"><div class="c-top"><span>From ${esc(nameOf(d.from))}</span><span>${esc(dayStamp(d.at))}</span></div><div class="c-title">${esc(d.title)}</div><div class="c-detail">${esc(d.detail)}</div>${amount}${actions}</div>`;
  }
  function topupCard(t) {
    const bal = (source.get().balances || []).find((x) => x.id === t.serviceId);
    if (bal?.view?.suggest) t = { ...t, amount: bal.view.suggest.value, why: bal.view.suggest.why, amountText: bal.view.suggest.amount };
    return `<div class="card ${t.level}"><div class="c-top"><span class="lvl ${t.level}">${t.level === 'urgent' ? 'Urgent' : 'Low balance'}</span><span>${Number.isFinite(t.days) ? `about ${Math.max(0, t.days)} days left` : ''}</span></div><div class="c-title">Top up ${esc(t.service)}</div><div class="c-detail">${esc(t.why ? cap(t.why) + (/[.!?]$/.test(t.why) ? '' : '.') : 'Suggested amount for the next 30 days.')}</div><div class="amount">${(t.amountText || money(t.amount, t.currency))}</div><div class="c-actions">${t.url ? `<a class="btn gold" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" data-act="topup" data-id="${t.id}">Open ${esc(t.service)} payment page ↗</a>` : `<span class="btn" style="opacity:.6">No payment link yet</span>`}</div></div>`;
  }
  function docCard(d) {
    return `<div class="card clickable ${d.read ? '' : 'unread'}" data-act="doc" data-id="${d.id}"><div class="c-top"><span>${esc(d.kind)} · from ${esc(nameOf(d.from))}</span><span>${esc(dayStamp(d.at))}</span></div><div class="c-title">${esc(d.title)}</div>${social.live() ? `<div class="c-actions"><button class="btn outline" style="flex:none" data-act="discuss" data-id="${d.id}">Discuss</button></div>` : ''}</div>`;
  }
  function openChat(id) {
    if (workers[id]) openPanel({ type: 'chat', agent: id });
    else if (people[id] && social.canChat(id)) openPanel({ type: 'npc', id });
  }
  panel.title.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'invite') social.invite(b.dataset.id);
    if (b.dataset.act === 'dismiss') social.dismiss(b.dataset.id);
    if (b.dataset.act === 'endmeeting') social.endMeetingById(b.dataset.id);
    if (b.dataset.act === 'addr' || b.dataset.act === 'hand') {
      const v = panel.view;
      if (v?.type === 'meeting') {
        panel.to = panel.to || {};
        panel.to[v.id] = b.dataset.id || null;
        // calling on a raised hand: "Go ahead"
        if (b.dataset.act === 'hand') source.act('sendMeeting', { meeting: v.id, text: 'Go ahead', to: b.dataset.id });
        updateVoice(true);
      }
    }
    if (b.dataset.act === 'spotify') {
      // straight from the tap: it opens Spotify's small login window
      try { window.AHQ_MUSIC?.gesture(); window.AHQ_MUSIC?.connect(); } catch { /* ignore */ }
      social.djConnect = false;
    }
    render(true);
  });
  function say(id, text) {
    localBubbles.push({ from: id, text, at: Date.now() });
  }
  function agentCard(s, id) {
    const a = s.agents[id];
    const unread = (s.ceo.chats[id] || []).filter((m) => m.from !== 'ceo' && !m.read).length;
    return `<div class="card clickable agent-pick" data-act="chat" data-id="${id}">${avatar(id)}<div style="flex:1;min-width:0"><div class="ap-name">${esc(a.name)}</div><div class="ap-role">${esc(a.role)} · ${esc(cap(a.activity))}</div></div>${unread ? `<span class="badge">${unread}</span>` : ''}</div>`;
  }

  // ------------------------------------------------------------ per-frame
  let lastHud = 0;
  function update(state, env) {
    const now = performance.now();
    if (now - lastHud > 500) {
      lastHud = now;
      $('clock').textContent = localClock();
      $('date').textContent = localDate();
      $('sky-icon').classList.toggle('night', env.daylight < 0.35);
      AGENTS = state.agents || {};
      buildTeam(state);
      // live or sample?
      const pill = $('sample-pill');
      if (pill) {
        const st = state.live ? state.liveStatus || 'ok' : 'sample';
        if (pill.dataset.st !== st) {
          pill.dataset.st = st;
          pill.className = `sample-pill ${state.live ? 'live' : ''} ${st}`;
          pill.textContent = { sample: 'Sample activity', ok: 'Live', loading: 'Live · connecting…', login: 'Live · sign in', error: 'Live · offline' }[st] || 'Live';
          pill.title = { sample: 'Sample activity: the live data is not connected', ok: 'Live data from the real team', loading: 'Connecting to the live data…', login: 'Sign in to see the live data', error: 'The live data could not be reached — showing the last known state' }[st] || '';
        }
      }
      for (const chip of team.children) {
        const id = chip.dataset.agent;
        const a = state.agents[id];
        if (!a) continue;
        const moving = workers[id]?.moving && workers[id].floor !== (ROOMS[a.room]?.floor ?? -1);
        chip.title = `${nameOf(id)} · ${roleOf(id)} — ${a.activity || ''}`;
        chip.querySelector('.chip-act').textContent = social.inMeeting(id) ? (workers[id]?.mode === 'idle' ? 'With you' : 'On the way to you') : moving ? `Taking the lift to the ${ROOMS[a.room].name}` : cap(a.activity);
        chip.querySelector('.dot').className = `dot ${moving ? 'moving' : state.derived.rooms[a.room]?.status === 'problem' ? 'problem' : a.status}`;
      }
      const d = state.derived;
      const count = state.ceo.documents.filter((x) => !x.read).length + state.ceo.decisions.filter((x) => x.status === 'pending').length + d.topups.length + d.unreadChats;
      $('desk-badge').hidden = count === 0;
      $('desk-badge').textContent = count;
      if (rig.room) $('room-activity').textContent = rig.mode === 'seated' ? (rig.seat?.kind === 'stool' ? 'You’re at the bar' : rig.seat?.kind === 'sunbed' ? 'You’re relaxing by the pool' : 'You’re seated') : cap(d.rooms[rig.room]?.activity || '');
      renderActions();
    }
    updateBubbles(state);
    updateVoice();
    render();
  }

  function finishLoading() {
    $('loader').classList.add('done');
  }

  /** The bookshelf's hover label: which files exist. */
  function filesLabel() {
    const f = source.get().files;
    if (!f?.groups?.length) return 'Project files';
    const total = f.groups.reduce((n, gr) => n + (gr.count || 0), 0);
    const top = [...f.groups].sort((a, b) => b.count - a.count).slice(0, 4).map((gr) => `${gr.folder} (${gr.count})`).join(', ');
    return `Project files · ${total} in ${f.groups.length} folders: ${top}${f.groups.length > 4 ? '…' : ''}`;
  }

  return { filesLabel, update, openPanel, closePanel, openChat, say, toast, roomTooltip, agentTooltip, personTooltip, objectTooltip, hideTooltip, finishLoading, setPointer: (on) => body.classList.toggle('pointer', on) };
}
