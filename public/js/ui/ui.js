// Everything drawn in HTML over the 3D scene: top bar, team chips, hover
// labels, speech bubbles, the room bar and the side panel (iMessage-style
// chats, the desk tray, decisions, phone and vault).
import * as THREE from 'three';
import { ROOMS, FLOORS } from '../scene/layout.js';
import { cyprusClock, cyprusDate } from '../core/time.js';
import { balanceLevel, daysLeft } from '../data/derive.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const NAMES = { scott: 'Scott', bob: 'Bob', tom: 'Tom', ceo: 'Nicolas' };
const ROLES = { scott: 'Supervisor', bob: 'Builder', tom: 'Tester' };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const money = (n, cur) => `${cur === 'EUR' ? '€' : '$'}${Number(n).toFixed(n % 1 ? 2 : 0)}`;
const timeOf = (at) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', minute: '2-digit' }).format(at);
const dayStamp = (at) => {
  const d = new Date(at);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return same ? `Today ${timeOf(at)}` : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Nicosia', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(at);
};
const avatar = (id) => `<span class="avatar ${id}">${esc((NAMES[id] || '?')[0])}</span>`;

export function createUI({ source, rig, camera, characters, controllers }) {
  const body = document.body;
  const panel = { el: $('panel'), body: $('panel-body'), title: $('panel-title'), back: $('panel-back'), compose: $('panel-compose'), input: $('compose-input'), view: null, history: [] };

  if (matchMedia('(hover: none)').matches) $('hint').textContent = 'Tap a floor to fly inside · drag to look around';

  // ------------------------------------------------------------ top bar
  const team = $('team');
  team.innerHTML = ['scott', 'bob', 'tom']
    .map((id) => `<div class="chip" data-agent="${id}" role="button" tabindex="0">${avatar(id)}<div class="chip-text"><div class="chip-name">${NAMES[id]}<span class="dot"></span></div><div class="chip-act"></div></div></div>`)
    .join('');
  team.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const id = chip.dataset.agent;
    const a = source.get().agents[id];
    if (a) rig.flyToRoom(a.room);
  });
  $('desk-btn').addEventListener('click', () => {
    if (rig.room !== 'penthouse' || rig.mode !== 'room') rig.flyToRoom('penthouse');
    openPanel({ type: 'tray' });
  });

  // ------------------------------------------------------------ room bar
  $('back-btn').addEventListener('click', () => rig.flyToTower());
  const floorOf = (roomId) => ROOMS[roomId].floor;
  $('floor-up').addEventListener('click', () => {
    const f = floorOf(rig.room);
    if (f < 3) rig.flyToRoom(FLOORS[f + 1].rooms[FLOORS[f + 1].rooms.length - 1]);
  });
  $('floor-down').addEventListener('click', () => {
    const f = floorOf(rig.room);
    if (f > 0) rig.flyToRoom(FLOORS[f - 1].rooms[FLOORS[f - 1].rooms.length - 1]);
  });
  $('room-switch').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && b.dataset.room !== rig.room) rig.flyToRoom(b.dataset.room);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (panel.el.classList.contains('open')) closePanel();
      else if (rig.mode === 'room') rig.flyToTower();
    }
  });

  rig.onChange((mode, room) => {
    const inRoom = mode === 'room' || (mode === 'flying' && room);
    $('roombar').hidden = !inRoom;
    $('hint').classList.toggle('hidden', mode !== 'tower');
    if (room) {
      const r = ROOMS[room];
      const f = FLOORS[r.floor];
      $('room-floor').textContent = f.name;
      $('room-name').textContent = r.name;
      $('room-switch').innerHTML = f.rooms.length > 1 ? f.rooms.map((id) => `<button class="nav-btn ${id === room ? 'active' : ''}" data-room="${id}" type="button">${esc(ROOMS[id].name.replace('CEO ', ''))}</button>`).join('') : '';
      $('floor-up').disabled = r.floor === 3;
      $('floor-down').disabled = r.floor === 0;
    }
    tooltip.hidden = true;
  });

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
  function objectTooltip(label, x, y) {
    showTooltip(x, y, `<div class="tt-name">${esc(label)}</div>`);
  }

  // ------------------------------------------------------------ speech bubbles
  const bubbleLayer = $('bubbles');
  const bubbleEls = new Map();
  bubbleLayer.addEventListener('click', (e) => {
    const b = e.target.closest('.bubble');
    if (b) openPanel({ type: 'conversation', id: b.dataset.conv });
  });
  const v = new THREE.Vector3();
  function updateBubbles(state) {
    const list = state.derived?.bubbles || [];
    const keep = new Set();
    for (const b of list) {
      const key = `${b.convId}:${b.at}`;
      keep.add(key);
      let el = bubbleEls.get(key);
      const ch = characters[b.from];
      const ctrl = controllers[b.from];
      if (!ch) continue;
      if (!el) {
        // one bubble per speaker at a time
        for (const [k, other] of bubbleEls) if (other.dataset.from === b.from) { other.remove(); bubbleEls.delete(k); }
        el = document.createElement('div');
        el.className = 'bubble';
        el.dataset.conv = b.convId;
        el.dataset.from = b.from;
        el.innerHTML = `<div class="in"><b>${esc(NAMES[b.from])}</b>${esc(b.text)}</div>`;
        bubbleLayer.appendChild(el);
        bubbleEls.set(key, el);
      }
      // only show when the speaker is in view
      let visible = true;
      if (rig.mode === 'room' && ctrl && ROOMS[rig.room].floor !== ctrl.floor) visible = false;
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
      el.classList.toggle('fade', state.now - b.at > 5800);
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
    if (!text || panel.view?.type !== 'chat') return;
    source.act('sendChat', { agent: panel.view.agent, text });
    panel.input.value = '';
    panel.typingUntil = Date.now() + 4000;
    render(true);
  });
  panel.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const { act, id } = t.dataset;
    if (act === 'approve' || act === 'reject') source.act('decide', { id, verdict: act === 'approve' ? 'approved' : 'rejected' });
    else if (act === 'doc') openPanel({ type: 'doc', id });
    else if (act === 'chat') openPanel({ type: 'chat', agent: id });
    else if (act === 'conv') openPanel({ type: 'conversation', id });
    else if (act === 'topup') {
      window.open(t.dataset.url, '_blank', 'noopener,noreferrer');
      source.act('topupOpened', { id });
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
    if (view.type === 'chat' && window.innerWidth > 700) setTimeout(() => panel.input.focus(), 350);
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
    const sig = JSON.stringify([view, s.ceo, s.balances.map((b) => b.balance.toFixed(0)), view.type === 'conversation' ? s.conversations.find((c) => c.id === view.id)?.messages.length : 0, panel.typingUntil > Date.now()]);
    if (!force && sig === panel.lastSig) return;
    const atBottom = panel.body.scrollHeight - panel.body.scrollTop - panel.body.clientHeight < 40;
    panel.lastSig = sig;
    panel.back.hidden = panel.history.length === 0;
    panel.compose.hidden = view.type !== 'chat';
    const r = VIEWS[view.type](s, view);
    panel.title.innerHTML = r.title;
    panel.body.innerHTML = r.body;
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
      if (names && !right && m.from !== lastFrom) html += `<div class="sender">${esc(NAMES[m.from])}</div>`;
      const first = m.from !== lastFrom ? ' first' : '';
      html += `<div class="msg ${right ? 'right' : 'left'}${first}">${esc(m.text)}</div>`;
      lastAt = m.at;
      lastFrom = m.from;
      if (i === messages.length - 1 && right && m.from === 'ceo') html += '<div class="delivered">Delivered</div>';
    });
    return html + '</div>';
  }

  const VIEWS = {
    conversation(s, v) {
      const c = s.conversations.find((x) => x.id === v.id);
      if (!c) return { title: '', body: '' };
      const names = c.participants.map((p) => NAMES[p]).join(c.participants.length > 2 ? ', ' : ' & ');
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
        .map(({ c, last }) => `<div class="card clickable" data-act="conv" data-id="${c.id}"><div class="pt-avatars" style="display:flex">${c.participants.map(avatar).join('')}</div><div style="min-width:0;flex:1"><div class="c-top"><span>${esc(c.participants.map((p) => NAMES[p]).join(', '))}</span><span>${last ? timeOf(last.at) : ''}</span></div><div class="c-detail" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(last ? `${NAMES[last.from]}: ${last.text}` : '')}</div></div></div>`)
        .join('');
      return { title: '<h2>Conversations</h2>', body: `<div class="convo-list">${items}</div>` };
    },
    chat(s, v) {
      const list = s.ceo.chats[v.agent] || [];
      const a = s.agents[v.agent];
      let body = thread(list, ['ceo']);
      if (panel.typingUntil > Date.now() && list[list.length - 1]?.from === 'ceo') body = body.replace(/<\/div>$/, '<div class="typing"><i></i><i></i><i></i></div></div>');
      return {
        title: `<div class="pt-avatars">${avatar(v.agent)}</div><div class="pt-name">${esc(NAMES[v.agent])}</div><div class="pt-sub">${esc(ROLES[v.agent])} · ${esc(cap(a?.activity || ''))}</div>`,
        body,
        scrollBottom: true,
      };
    },
    tray(s) {
      const docs = s.ceo.documents;
      const decisions = s.ceo.decisions;
      const topups = s.derived?.topups || [];
      const pending = decisions.filter((d) => d.status === 'pending');
      const done = decisions.filter((d) => d.status !== 'pending').slice(0, 3);
      let html = '';
      html += `<div class="section-title">Decisions <span>${pending.length} waiting</span></div>`;
      html += pending.length ? pending.map(decisionCard).join('') : '<div class="empty">Nothing needs you right now.</div>';
      html += done.map(decisionCard).join('');
      html += `<div class="section-title">Top-ups <span>${topups.length}</span></div>`;
      html += topups.length ? topups.map(topupCard).join('') : '<div class="empty">All balances are healthy.</div>';
      html += `<div class="section-title">Documents <span>${docs.filter((d) => !d.read).length} new</span></div>`;
      html += docs.length ? docs.slice(0, 12).map(docCard).join('') : '<div class="empty">No documents yet.</div>';
      html += `<div class="section-title">Talk to the team</div>`;
      html += ['scott', 'bob', 'tom'].map((id) => agentCard(s, id)).join('');
      html += `<div class="card clickable" data-act="convos"><div class="c-title">Agent conversations</div><div class="c-detail">Read what Scott, Bob and Tom are saying to each other.</div></div>`;
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
      return { title: '<h2>Call an agent</h2>', body: ['scott', 'bob', 'tom'].map((id) => agentCard(s, id)).join('') };
    },
    doc(s, v) {
      const d = s.ceo.documents.find((x) => x.id === v.id);
      if (!d) return { title: '', body: '' };
      return {
        title: `<h2>${esc(d.kind)}</h2>`,
        body: `<div class="c-title" style="font-family:var(--display);font-size:26px;line-height:1.15">${esc(d.title)}</div><div class="doc-meta">From ${esc(NAMES[d.from])} · ${esc(dayStamp(d.at))}</div><div class="doc">${esc(d.body)}</div>`,
      };
    },
    vault(s) {
      const rows = s.balances
        .map((b) => {
          const lvl = balanceLevel(b);
          const days = daysLeft(b);
          const t = (s.derived?.topups || []).find((x) => x.serviceId === b.id);
          return `<div class="card ${lvl === 'ok' ? '' : lvl}"><div class="c-top"><span class="lvl ${lvl}">${lvl === 'ok' ? 'Healthy' : lvl}</span><span>${money(b.perDay, b.currency)}/day</span></div><div class="c-title">${esc(b.service)}</div><div class="amount">${money(b.balance.toFixed(2), b.currency)}</div><div class="c-detail">Lasts about ${Math.max(0, Math.floor(days))} days</div>${t ? `<div class="c-actions"><button class="btn gold" data-act="topup" data-id="${t.id}" data-url="${esc(t.url)}">Top up ${money(t.amount, t.currency)} ↗</button></div>` : ''}</div>`;
        })
        .join('');
      return { title: '<h2>The Vault</h2>', body: `<div class="section-title">Agentium Balance Tracker</div>${rows}` };
    },
  };

  function decisionCard(d) {
    const amount = d.amount ? `<div class="amount">${money(d.amount, d.currency)}${d.period ? `<span style="font-size:15px;color:var(--muted)"> / ${esc(d.period)}</span>` : ''}</div>` : '';
    const actions = d.status === 'pending'
      ? `<div class="c-actions"><button class="btn approve" data-act="approve" data-id="${d.id}">Approve</button><button class="btn reject" data-act="reject" data-id="${d.id}">Reject</button></div>`
      : `<div class="c-actions"><span class="status-tag ${d.status}">${esc(d.status)}</span></div>`;
    return `<div class="card"><div class="c-top"><span>From ${esc(NAMES[d.from])}</span><span>${esc(dayStamp(d.at))}</span></div><div class="c-title">${esc(d.title)}</div><div class="c-detail">${esc(d.detail)}</div>${amount}${actions}</div>`;
  }
  function topupCard(t) {
    return `<div class="card ${t.level}"><div class="c-top"><span class="lvl ${t.level}">${t.level === 'urgent' ? 'Urgent' : 'Low balance'}</span><span>about ${Math.max(0, t.days)} days left</span></div><div class="c-title">Top up ${esc(t.service)}</div><div class="c-detail">Suggested amount for the next 30 days.</div><div class="amount">${money(t.amount, t.currency)}</div><div class="c-actions"><button class="btn gold" data-act="topup" data-id="${t.id}" data-url="${esc(t.url)}">Open ${esc(t.service)} payment page ↗</button></div></div>`;
  }
  function docCard(d) {
    return `<div class="card clickable ${d.read ? '' : 'unread'}" data-act="doc" data-id="${d.id}"><div class="c-top"><span>${esc(d.kind)} · from ${esc(NAMES[d.from])}</span><span>${esc(dayStamp(d.at))}</span></div><div class="c-title">${esc(d.title)}</div></div>`;
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
      $('clock').textContent = cyprusClock();
      $('date').textContent = cyprusDate();
      $('sky-icon').classList.toggle('night', env.daylight < 0.35);
      for (const chip of team.children) {
        const id = chip.dataset.agent;
        const a = state.agents[id];
        const moving = controllers[id]?.moving;
        chip.querySelector('.chip-act').textContent = moving ? `Taking the lift to the ${ROOMS[a.room].name}` : cap(a.activity);
        chip.querySelector('.dot').className = `dot ${moving ? 'moving' : state.derived.rooms[a.room]?.status === 'problem' ? 'problem' : a.status}`;
      }
      const d = state.derived;
      const count = state.ceo.documents.filter((x) => !x.read).length + state.ceo.decisions.filter((x) => x.status === 'pending').length + d.topups.length + d.unreadChats;
      $('desk-badge').hidden = count === 0;
      $('desk-badge').textContent = count;
      if (rig.room) $('room-activity').textContent = cap(d.rooms[rig.room]?.activity || '');
    }
    updateBubbles(state);
    render();
  }

  function finishLoading() {
    $('loader').classList.add('done');
  }

  return { update, openPanel, closePanel, roomTooltip, agentTooltip, objectTooltip, hideTooltip, finishLoading, setPointer: (on) => body.classList.toggle('pointer', on) };
}
