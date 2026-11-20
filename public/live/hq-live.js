// Agentium HQ -- LIVE DATA (19 Nov 2026, written by the team-build session; the design session owns the looks).
//
// Loaded as a plain script by the login gate (docs/index.html) BEFORE the HQ bundle starts. It only defines
// window.AHQ_LIVE; nothing runs until public/js/data/source.js calls AHQ_LIVE.createFeed({ derive }).
//
// Where the data comes from: Supabase (EU), through four password-checked database functions -- no table can
// be read with the public key below (it is Supabase's publishable key, safe in a page):
//   hq_login(user, pass)  the SAME email + password as the balance page -> a long random token kept on this device
//   hq_feed(token)        everything HQ shows: the six agents' live notes, test counts, team chat, CEO desk items,
//                         planning wall, project files, Claude plan usage and the real balances
//   hq_answer(token, id, verdict, note)   approve / reject a decision (or mark a document read) -> the right Scott
//   hq_send(token, agent, text)           a message from Nicolas to one agent (read at that agent's next run)
// The agents write the data from the bot box (/srv/agentium-ops/team/bin/team). HQ never shows sample activity
// in this mode: an agent with no news is idle on the rooftop.
(function () {
  'use strict';
  const SUPABASE_URL = 'https://dlxplhhsjmwilgwwjryx.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_7G5H8UEOUuRb0Q4rZnebeA_zyBidQeW';
  const TOKEN_KEY = 'agentium-hq-feed-token';
  const POLL_MS = 15000;
  const IDLE_AFTER_MS = 30 * 60 * 1000; // a "working" note older than this counts as idle (the run ended)

  const AGENTS = {
    'voice-scott': { name: 'Scott Voice', role: 'Supervisor', dept: 'voice', rank: 'supervisor', alias: 'scott' },
    'voice-bob': { name: 'Bob Voice', role: 'Builder', dept: 'voice', rank: 'builder', alias: 'bob' },
    'voice-tom': { name: 'Tom Voice', role: 'Tester', dept: 'voice', rank: 'tester', alias: 'tom' },
    'chat-scott': { name: 'Scott Chat', role: 'Supervisor', dept: 'chat', rank: 'supervisor', alias: 'scott' },
    'chat-bob': { name: 'Bob Chat', role: 'Builder', dept: 'chat', rank: 'builder', alias: 'bob' },
    'chat-tom': { name: 'Tom Chat', role: 'Tester', dept: 'chat', rank: 'tester', alias: 'tom' },
  };
  const REAL_IDS = Object.keys(AGENTS);
  const PAY_URLS = {
    openai: 'https://platform.openai.com/settings/organization/billing/overview',
    gemini: 'https://aistudio.google.com/',
    soniox: 'https://console.soniox.com/',
    zadarma: 'https://my.zadarma.com/',
    vultr: 'https://my.vultr.com/billing/',
  };
  const CURRENCY = { '$': 'USD', '€': 'EUR', '£': 'GBP' };

  // ------------------------------------------------------------------ database calls
  async function rpc(fn, body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${PUBLIC_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${fn}: HTTP ${r.status}`);
    return r.json();
  }
  const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
  const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} };

  // ------------------------------------------------------------------ the sign-in card (plain; the design session may restyle it)
  function showLogin(onDone, message) {
    if (document.getElementById('ahq-live-login')) return;
    const wrap = document.createElement('div');
    wrap.id = 'ahq-live-login';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Sign in for live data');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(8,10,16,.55);font:15px/1.4 system-ui,-apple-system,Segoe UI,sans-serif';
    wrap.innerHTML = `
      <form style="background:#fff;color:#111;border-radius:14px;padding:22px 22px 18px;width:min(92vw,340px);box-shadow:0 20px 60px rgba(0,0,0,.35)">
        <div style="font-weight:700;font-size:18px;margin-bottom:4px">Live data</div>
        <div style="color:#555;margin-bottom:14px">Sign in once with your balance page email and password. This device then stays signed in.</div>
        <div id="ahq-live-err" style="color:#b00020;margin-bottom:10px;display:none"></div>
        <label style="display:block;font-size:13px;color:#444">Email</label>
        <input name="u" type="email" autocomplete="username" required style="width:100%;box-sizing:border-box;margin:4px 0 10px;padding:9px 10px;border:1px solid #ccc;border-radius:8px;font:inherit">
        <label style="display:block;font-size:13px;color:#444">Password</label>
        <input name="p" type="password" autocomplete="current-password" required style="width:100%;box-sizing:border-box;margin:4px 0 14px;padding:9px 10px;border:1px solid #ccc;border-radius:8px;font:inherit">
        <button type="submit" style="width:100%;padding:10px;border:0;border-radius:8px;background:#1e2a44;color:#fff;font:inherit;font-weight:600;cursor:pointer">Show live data</button>
      </form>`;
    document.body.appendChild(wrap);
    const err = wrap.querySelector('#ahq-live-err');
    if (message) { err.textContent = message; err.style.display = 'block'; }
    wrap.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const btn = f.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Checking…';
      try {
        const res = await rpc('hq_login', { p_user: f.u.value, p_pass: f.p.value });
        if (res && res.ok && res.token) {
          setToken(res.token);
          wrap.remove();
          onDone();
          return;
        }
        err.textContent = (res && res.error) || 'Sign-in failed.';
      } catch (ex) {
        err.textContent = 'Could not reach the database. Check the connection and try again.';
      }
      err.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Show live data';
    });
  }

  // One-time set-up for live conversations: the "HQ Meeting" routine's address and key, pasted here (never in a chat).
  // Opens with HQ's address + #connect-meetings (or feed.showMeetingSetup()); the key goes straight to the database.
  function showMeetingSetup(save) {
    if (document.getElementById('ahq-live-setup')) return;
    const wrap = document.createElement('div');
    wrap.id = 'ahq-live-setup';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Connect live meetings');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(8,10,16,.55);font:15px/1.4 system-ui,-apple-system,Segoe UI,sans-serif';
    const field = 'width:100%;box-sizing:border-box;margin:4px 0 10px;padding:9px 10px;border:1px solid #ccc;border-radius:8px;font:13px ui-monospace,Menlo,Consolas,monospace';
    wrap.innerHTML = `
      <form style="background:#fff;color:#111;border-radius:14px;padding:22px 22px 18px;width:min(92vw,420px);box-shadow:0 20px 60px rgba(0,0,0,.35)">
        <div style="font-weight:700;font-size:18px;margin-bottom:4px">Connect live meetings</div>
        <div style="color:#555;margin-bottom:14px">Paste the address and key from the "HQ Meeting" task's API trigger. They go straight to HQ's database, nowhere else.</div>
        <div id="ahq-setup-msg" style="margin-bottom:10px;display:none"></div>
        <label style="display:block;font-size:13px;color:#444">Address (ends in /fire)</label>
        <input name="url" autocomplete="off" spellcheck="false" required style="${field}">
        <label style="display:block;font-size:13px;color:#444">Key (starts with sk-ant-oat01-)</label>
        <input name="key" type="password" autocomplete="off" spellcheck="false" required style="${field};margin-bottom:14px">
        <div style="display:flex;gap:8px">
          <button type="button" name="cancel" style="flex:1;padding:10px;border:1px solid #ccc;border-radius:8px;background:#fff;color:#111;font:inherit;cursor:pointer">Later</button>
          <button type="submit" style="flex:2;padding:10px;border:0;border-radius:8px;background:#1e2a44;color:#fff;font:inherit;font-weight:600;cursor:pointer">Connect</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);
    const msg = wrap.querySelector('#ahq-setup-msg');
    const say = (text, ok) => { msg.textContent = text; msg.style.color = ok ? '#0a7a3d' : '#b00020'; msg.style.display = 'block'; };
    const close = () => { wrap.remove(); if (location.hash === '#connect-meetings') history.replaceState(null, '', location.pathname + location.search); };
    wrap.querySelector('[name=cancel]').addEventListener('click', close);
    wrap.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, btn = f.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Saving…';
      const r = await save({ url: f.url.value, token: f.key.value });
      if (r && r.ok) { say('Connected. Chats and meetings now start a real session.', true); setTimeout(close, 1800); return; }
      say((r && r.error) || 'Not saved. Try again.', false);
      btn.disabled = false; btn.textContent = 'Connect';
    });
  }

  // ------------------------------------------------------------------ helpers
  const ms = (iso) => (iso ? Date.parse(iso) : 0);
  const realName = (id) => (id === 'ceo' ? 'Nicolas' : (AGENTS[id] && AGENTS[id].name) || id);

  function emptyState() {
    // exactly the six agents: the scene creates one person per agent in state.agents
    const agents = {};
    for (const id of REAL_IDS) agents[id] = { id, name: AGENTS[id].name, role: AGENTS[id].role, dept: AGENTS[id].dept, rank: AGENTS[id].rank, room: 'rooftop', status: 'idle', activity: 'waiting for live data', note: '' };
    return {
      source: 'live', live: true, liveStatus: 'loading', now: Date.now(),
      session: { active: false, title: '' },
      agents,
      problems: [],
      tests: { suite: '', total: 0, passed: 0, failed: 0, left: 0, running: false, failures: [], log: [] },
      testsByDept: { voice: null, chat: null },
      workshop: { task: null, file: '', lines: [], typing: '' },
      planning: { shifts: [], roadmap: [] },
      conversations: [],
      ceo: { documents: [], decisions: [], chats: {}, meetingChats: {} },
      meetings: [],        // live conversations / meetings (real Claude sessions): newest first
      setup: { meetings: false },  // true once the HQ Meeting routine's address + key are saved
      balances: [],
      claudeUsage: null,
      files: null,
    };
  }

  // ------------------------------------------------------------------ the Vault = the balance page (portal/balances)
  // The same wording and rules as the balance tracker page, so both always agree. Dates in the viewer's own time zone.
  const RED_LINE_DAYS = 2, SOON_DAYS = 14;
  const STATUS_LABEL = { ok: 'Fine', soon: 'Soon', urgent: 'Today', card: 'Card', info: '—' };
  const fmtMoney = (x, u) => (x == null || isNaN(x) ? '—' : u + Number(x).toFixed(2));
  const fmtDay = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  function agoText(iso) {
    if (!iso) return 'never';
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60);
    return h < 48 ? h + ' h ago' : Math.round(h / 24) + ' days ago';
  }
  function nextDayOf(day) {  // the next date with this day of the month (today counts)
    const t = new Date(); t.setHours(0, 0, 0, 0);
    let d = new Date(t.getFullYear(), t.getMonth(), day || 1);
    if (d < t) d = new Date(t.getFullYear(), t.getMonth() + 1, day || 1);
    return d;
  }
  function portalView(a) {
    const u = a.unit;
    const v = { status: 'info', big: '—', lines: [], step: '', suggest: null, days: null, nextCharge: null };
    if (a.card) {
      const d = nextDayOf(a.day);
      v.status = 'card'; v.big = fmtMoney(a.monthly, u) + ' a month'; v.nextCharge = d.getTime();
      v.lines.push('Taken from the card on ' + fmtDay(d));
      v.step = 'Nothing to top up.';
    } else if (a.to_card) {
      const d = nextDayOf(a.day), pend = a.pending != null ? Number(a.pending) : null;
      const due = Math.max(0, (pend != null ? pend : Number(a.monthly)) - (Number(a.left) || 0));
      v.status = 'card'; v.big = fmtMoney(pend != null ? pend : a.monthly, u) + ' so far'; v.nextCharge = d.getTime();
      v.lines.push('About ' + fmtMoney(due, u) + ' from the card', 'Due ' + fmtDay(d));
      v.step = 'No credit on the account; the month’s bill comes off the card.';
    } else if (a.usage) {
      const perDay = Number(a.per_day || 0), left = Number(a.left);
      v.big = a.left == null ? '—' : fmtMoney(Math.abs(left), u) + (left < 0 ? ' owed' : ' left');
      if (a.left == null) v.step = 'No reading yet.';
      else {
        const days = perDay > 0 ? Math.max(0, left / perDay) : Infinity;
        v.days = isFinite(days) ? days : null;
        v.status = left <= Number(a.floor || 0) || days <= RED_LINE_DAYS ? 'urgent' : days <= SOON_DAYS ? 'soon' : 'ok';
        if (isFinite(days)) {
          const n = Math.floor(days);
          v.lines.push('About ' + (days > 99 ? '99+' : n) + (n === 1 ? ' day left' : ' days left'),
            'Runs out around ' + fmtDay(new Date(Date.now() + days * 86400000)));
        } else v.lines.push('Nothing used lately');
        v.step = v.status === 'ok' ? 'Nothing to do.' : v.status === 'soon' ? 'Top up within the week' : 'Top up today';
        if (v.status !== 'ok' && perDay > 0) {
          const amt = Math.max(5, Math.round((perDay * 7) / 5) * 5);
          v.suggest = { amount: u + amt, value: amt, why: 'about a week at today’s pace' };
        }
      }
    } else if (Number(a.monthly)) {
      const d = nextDayOf(a.day), left = Number(a.left);
      const short = Number(a.monthly) - (isNaN(left) ? 0 : left);
      const days = Math.max(0, (d - Date.now()) / 86400000);
      v.days = days; v.nextCharge = d.getTime();
      v.big = fmtMoney(a.left, u) + ' left';
      v.status = short <= 0 ? 'ok' : days <= RED_LINE_DAYS ? 'urgent' : days <= 7 ? 'soon' : 'ok';
      const n = Math.floor(days);
      v.lines.push('About ' + n + (n === 1 ? ' day' : ' days') + ' to the monthly charge',
        'Charged on ' + fmtDay(d) + ' (' + fmtMoney(a.monthly, u) + ')');
      v.step = short <= 0 ? 'Covered: nothing to do.' : 'Needs ' + fmtMoney(short, u) + ' more before ' + fmtDay(d) + '.';
      if (short > 0) v.suggest = { amount: fmtMoney(Math.ceil(short), u), value: Math.ceil(short), why: 'covers the monthly charge' };
    }
    if ((v.status === 'urgent' || v.status === 'soon') && a.how_to_top_up) {
      v.how = a.how_to_top_up;
      v.step = (v.step + '. How: ' + a.how_to_top_up + '.').replace(/\.\./g, '.');
    }
    v.label = STATUS_LABEL[v.status];
    v.read = a.read_at ? 'Real balance ' + fmtMoney(a.read_amount, u) + ', ' + (a.read_how || 'read') + ', ' + agoText(a.read_at) + '.' : '';
    return v;
  }

  // ------------------------------------------------------------------ the feed
  function createFeed(opts) {
    const derive = (opts && opts.derive) || (() => ({ topups: [], rooms: {}, bubbles: [], unreadChats: 0 }));
    const listeners = new Set();
    const firstSeen = new Map(); // chat id -> when this page first saw it (bubbles show for 6.5 s from then)
    const localRead = new Set(); // documents / chat messages read on this device
    const pendingDecisions = new Map(); // id -> verdict, until the database confirms
    const balanceEntries = new Map(); // account -> { amount, at } typed in the Vault, until the new reading arrives
    let loadedOnce = false;
    let timer = null;
    let state = emptyState();
    let lastFeed = null;
    let lastSendAt = 0;
    const ACTIVE = ['requested', 'starting', 'live', 'ending'];
    const activeMeetingFor = (agent) => (state.meetings || []).find((m) => ACTIVE.includes(m.status) && m.agents.includes(realOf(agent)));
    const meetingBusy = (m) => !!m && (m.status === 'requested' || m.status === 'starting' ||
      (m.status === 'live' && (m.lastCeoAt || 0) > (m.lastAgentAt || 0)));
    const pollDelay = () => {
      const live = (state.meetings || []).some((m) => ACTIVE.includes(m.status)) || Date.now() - lastSendAt < 60000;
      return live ? (document.hidden ? 4000 : 2000) : (document.hidden ? POLL_MS * 4 : POLL_MS);
    };

    const feed = {
      replyHandler: null,
      get: () => state,
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      isTyping: (agent) => meetingBusy(activeMeetingFor(agent)),
      meetingTyping: (id) => meetingBusy((state.meetings || []).find((m) => m.id === id)),
      activeMeeting: (agent) => activeMeetingFor(agent) || null,
      startMeeting: (p) => startMeeting(p || {}),
      saveMeetingSetup: (p) => saveMeetingSetup(p || {}),
      showMeetingSetup: () => showMeetingSetup(saveMeetingSetup),
      tick() { state.now = Date.now(); state.derived = derive(state); },
      act(type, p) { act(type, p || {}); },
    };

    function emit() {
      state.now = Date.now();
      state.derived = derive(state);
      for (const fn of listeners) { try { fn(state); } catch (e) { console.error(e); } }
    }

    async function poll() {
      clearTimeout(timer);
      const token = getToken();
      if (!token) {
        state.liveStatus = 'login';
        emit();
        showLogin(() => poll());
        return;
      }
      try {
        const f = await rpc('hq_feed', { p_token: token, p_chat_after: 0 });
        if (!f || !f.ok) {
          if (f && f.error === 'login') {
            setToken('');
            state.liveStatus = 'login';
            emit();
            showLogin(() => poll(), 'Please sign in again.');
            return;
          }
          throw new Error((f && f.error) || 'feed failed');
        }
        lastFeed = f;
        state = build(f);
        state.liveStatus = 'ok';
        loadedOnce = true;
        if (typeof location !== 'undefined' && location.hash === '#connect-meetings') showMeetingSetup(saveMeetingSetup);
        emit();
      } catch (e) {
        console.warn('HQ live data:', e.message || e);
        state.liveStatus = 'error';
        emit();
      }
      timer = setTimeout(poll, pollDelay());
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

    // -------------------------------------------------------------- feed -> scene state
    function build(f) {
      const s = emptyState();
      const now = Date.now();
      const sceneId = (id) => id;
      const st = f.state || {};
      const val = (k) => (st[k] && st[k].value) || null;

      // the six agents
      for (const id of REAL_IDS) {
        const v = val(`agent:${id}`) || {};
        const stale = v.status === 'working' && now - ms(v.at) > IDLE_AFTER_MS;
        const working = v.status === 'working' && !stale;
        const a = s.agents[id];
        a.status = working ? 'working' : 'idle';
        a.room = working && v.room ? v.room : 'rooftop';
        a.activity = working ? (v.activity || 'working') : (stale ? 'finished for now' : (v.activity || 'relaxing by the pool'));
        a.note = v.activity || '';
        a.task = v.task || '';
        a.step = v.step || null;
        a.of = v.of || null;
        a.tests = v.tests || '';
        a.at = ms(v.at) || null;
      }
      const working = REAL_IDS.map((id) => s.agents[id]).filter((a) => a.status === 'working');
      const lead = working.find((a) => a.rank === 'supervisor') || working[0];
      s.session = { active: working.length > 0, title: lead ? (lead.task || lead.activity) : '' };

      // tests (the lab)
      const tv = val('tests:voice');
      const tc = val('tests:chat');
      s.testsByDept = { voice: tv, chat: tc };
      const latest = [tv, tc].filter(Boolean).sort((x, y) => ms(y.at) - ms(x.at))[0];
      if (latest) {
        s.tests = { suite: latest.suite || '', total: latest.total || 0, passed: latest.passed || 0, failed: latest.failed || 0,
          left: latest.left || 0, running: !!latest.running && now - ms(latest.at) < IDLE_AFTER_MS, failures: latest.failures || [],
          log: (latest.failures || []).map((x) => ({ name: x.name, ok: false })) };
      }
      for (const [dept, t] of [['voice', tv], ['chat', tc]]) {
        if (t && t.failed > 0 && now - ms(t.at) < 12 * 3600 * 1000) s.problems.push({ room: 'lab', text: `${t.failed} ${dept} test${t.failed > 1 ? 's' : ''} failing` });
      }

      // workshop screen: the builders' live notes (not code)
      const builders = ['voice-bob', 'chat-bob'].map((id) => s.agents[id]);
      const busy = builders.find((b) => b.status === 'working');
      s.workshop = {
        task: busy && busy.task ? { id: busy.name, title: busy.task } : null,
        file: busy ? busy.name : '',
        lines: builders.flatMap((b) => [
          `// ${b.name} -- ${b.status === 'working' ? 'working' : 'idle'}`,
          b.task ? `task: ${b.task}` : '',
          b.note ? `${b.status === 'working' ? 'now: ' : 'last:'} ${b.note}` : '',
          b.step && b.of ? `step ${b.step} of ${b.of}` : '',
          b.tests ? `tests: ${b.tests}` : '',
          '',
        ]).filter((x, i, arr) => x !== '' || (i > 0 && arr[i - 1] !== '')),
        typing: '',
      };

      // planning wall
      const pl = val('planning') || {};
      s.planning = {
        shifts: (pl.shifts || []).map((x) => ({ time: x.time, who: x.who ? realName(x.who) : '', what: x.what, done: !!x.done, now: !!x.now })),
        roadmap: (pl.roadmap || []).map((r) => ({ when: r.when, title: r.title, status: r.status === 'built' ? 'done' : r.status === 'in progress' ? 'now' : 'next' })),
      };

      // project files (workshop bookshelf) and Claude plan usage (vault)
      s.files = val('files');
      const u = val('claude_usage');
      s.claudeUsage = u ? { week: u.week, session: u.session, at: u.at } : null;

      // team chat -> conversations (+ speech bubbles from when this page first saw a message)
      const msgs = (f.chat || []).map((m) => {
        if (!firstSeen.has(m.id)) firstSeen.set(m.id, loadedOnce ? now : ms(m.at));
        return m;
      });
      const toMsg = (m) => ({
        from: sceneId(m.sender),
        text: m.body,
        at: firstSeen.get(m.id),
        realAt: ms(m.at),
      });
      const teamMsgs = msgs.filter((m) => !String(m.thread).startsWith('ceo:') && !String(m.thread).startsWith('meeting:'));
      const conv = (id, participants, filter) => ({ id, participants, messages: teamMsgs.filter(filter).map(toMsg) });
      s.conversations = [
        conv('team', REAL_IDS, (m) => m.thread === 'team'),
        conv('voice', ['voice-scott', 'voice-bob', 'voice-tom'], (m) => m.thread === 'voice'),
        conv('chat', ['chat-scott', 'chat-bob', 'chat-tom'], (m) => m.thread === 'chat'),
        conv('scotts', ['voice-scott', 'chat-scott'], (m) => m.thread === 'scotts'),
      ].filter((c) => c.messages.length || c.id === 'team');

      // CEO desk: decisions, documents/recaps, chats with each agent
      for (const it of f.ceo || []) {
        const from = sceneId(it.from_agent);
        if (it.kind === 'decision') {
          const local = pendingDecisions.get(it.id);
          s.ceo.decisions.push({ id: it.id, title: it.title, detail: it.body, amount: it.amount, currency: it.currency, period: it.period,
            from, realFrom: it.from_agent, at: ms(it.created_at), status: it.status === 'open' ? (local || 'pending') : it.status });
          if (it.status !== 'open') pendingDecisions.delete(it.id);
        } else {
          s.ceo.documents.push({ id: it.id, title: it.title, from, realFrom: it.from_agent, kind: it.kind === 'recap' ? 'Recap' : 'Document',
            at: ms(it.created_at), read: it.status === 'read' || localRead.has(`doc:${it.id}`), body: it.body });
        }
      }
      for (const m of msgs.filter((x) => String(x.thread).startsWith('ceo:'))) {
        const agent = sceneId(String(m.thread).slice(4));
        const meta = m.meta || {};
        (s.ceo.chats[agent] = s.ceo.chats[agent] || []).push({ id: m.id, from: m.sender === 'ceo' ? 'ceo' : agent,
          text: m.body, at: ms(m.at), read: m.sender === 'ceo' || localRead.has(`chat:${m.id}`), inPerson: false,
          meeting: meta.meeting || null, live: !!meta.live, quick: !!meta.auto && !meta.ack, ack: !!meta.ack, voice: !!meta.voice });
      }
      // meetings with several agents (conference room): their own threads
      for (const m of msgs.filter((x) => String(x.thread).startsWith('meeting:'))) {
        const id = String(m.thread).slice(8), meta = m.meta || {};
        (s.ceo.meetingChats[id] = s.ceo.meetingChats[id] || []).push({ id: m.id, from: m.sender === 'ceo' ? 'ceo' : sceneId(m.sender),
          text: m.body, at: ms(m.at), read: m.sender === 'ceo' || localRead.has(`chat:${m.id}`), live: !!meta.live, ack: !!meta.ack,
          voice: !!meta.voice });
      }
      s.meetings = (f.meetings || []).map((x) => ({ id: x.id, kind: x.kind, room: x.room, agents: x.agents || [], topic: x.topic || '',
        itemId: x.item_id || null, thread: x.thread, status: x.status, startedAt: ms(x.created_at), liveAt: ms(x.live_at),
        endedAt: ms(x.ended_at), lastCeoAt: ms(x.last_ceo_at), lastAgentAt: ms(x.last_agent_at), summary: x.summary || '',
        error: x.error || '', sessionUrl: x.session_url || '' }));
      s.setup = { meetings: !!(f.setup && f.setup.meetings) };

      // vault: the balance tracker's real numbers, read the way the balance page reads them (portal/balances):
      //  - card subscriptions (Supabase, Airtable) and card-billed accounts (Vultr) have no credit to top up -> left out;
      //  - 'usage' accounts (OpenAI, Gemini, Soniox) run down day by day: perDay from the tracker;
      //  - 'monthly' accounts (Zadarma) pay a fixed charge on a day of the month from the credit: nextCharge + needs.
      //  suggest = the balance page's top-up: about a week at today's pace / what the next monthly charge still needs.
      s.bills = (f.balances || []).filter((b) => b.card || b.to_card).map((b) => ({ id: b.account, service: b.label,
        currency: CURRENCY[b.unit] || b.unit, payUrl: PAY_URLS[b.account] || '', monthly: Number(b.monthly) || 0, day: b.day,
        purpose: b.purpose, kind: 'card', view: portalView(b) }));
      s.balances = (f.balances || [])
        .filter((b) => b.left !== null && b.left !== undefined && !b.card && !b.to_card)
        .map((b) => {
          const left = Number(b.left), perDay = Number(b.per_day) || 0, monthly = Number(b.monthly) || 0;
          const kind = b.usage ? 'usage' : monthly ? 'monthly' : 'usage';
          const out = { id: b.account, service: b.label, currency: CURRENCY[b.unit] || b.unit, payUrl: PAY_URLS[b.account] || '',
            balance: left, perDay, purpose: b.purpose, readAt: ms(b.read_at), monthly, day: b.day, kind, floor: Number(b.floor) || 0 };
          if (kind === 'monthly') {
            const t = new Date(); t.setHours(0, 0, 0, 0);
            let d = new Date(t.getFullYear(), t.getMonth(), Number(b.day) || 1);
            if (d < t) d = new Date(t.getFullYear(), t.getMonth() + 1, Number(b.day) || 1);
            out.nextCharge = d.getTime();
            out.needs = Math.max(0, Math.round((monthly - left) * 100) / 100);
            out.suggest = out.needs > 0 ? Math.ceil(out.needs) : 0;
            out.suggestWhy = 'covers the next monthly charge';
          } else {
            out.suggest = perDay > 0 ? Math.max(5, Math.round((perDay * 7) / 5) * 5) : 0;
            out.suggestWhy = "about a week at today's pace";
          }
          out.view = portalView(b);
          out.canEnter = b.account === 'openai' || b.account === 'gemini';  // no balance API: Nicolas types what the console shows
          const e = balanceEntries.get(b.account);
          if (e && ms(b.read_at) >= e.at - 5000) balanceEntries.delete(b.account);  // the new reading has arrived
          out.entering = balanceEntries.has(b.account);
          return out;
        });
      return s;
    }

    // ---------------------------------------------------------------- live conversations (real Claude sessions)
    async function startMeeting(p) {
      const token = getToken();
      const agents = (p.agents || (p.agent ? [p.agent] : [])).map(realOf).filter(Boolean);
      if (!token || !agents.length) return { ok: false, error: 'login or agents' };
      lastSendAt = Date.now();
      const r = await rpc('hq_meeting_start', { p_token: token, p_agents: agents, p_room: p.room || 'office',
        p_topic: p.topic || null, p_item: p.itemId || null }).catch((e) => ({ ok: false, error: String(e) }));
      setTimeout(poll, 300);
      return r || { ok: false, error: 'no answer' };
    }
    async function saveMeetingSetup(p) {
      const token = getToken();
      const url = String(p.url || '').trim(), key = String(p.token || '').trim();
      if (!/^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/trig_[A-Za-z0-9]+\/fire$/.test(url)) {
        return { ok: false, error: 'That address does not look right. It ends in /fire.' };
      }
      if (!/^sk-ant-oat01-/.test(key)) return { ok: false, error: 'That key does not look right. It starts with sk-ant-oat01-.' };
      const a = await rpc('hq_set_secret', { p_token: token, p_name: 'meeting_routine_url', p_value: url }).catch(() => null);
      const b = await rpc('hq_set_secret', { p_token: token, p_name: 'meeting_routine_token', p_value: key }).catch(() => null);
      setTimeout(poll, 300);
      return a && a.ok && b && b.ok ? { ok: true } : { ok: false, error: (a && a.error) || (b && b.error) || 'not saved' };
    }

    // -------------------------------------------------------------- actions from the scene
    const realOf = (id) => {
      if (AGENTS[id]) return id;
      // alias in the three-person scene: the working agent of that rank, else the voice one
      const cands = REAL_IDS.filter((x) => AGENTS[x].alias === id);
      return cands.find((x) => state.agents[x] && state.agents[x].status === 'working') || cands[0];
    };

    function act(type, p) {
      const token = getToken();
      if (type === 'decide') {
        const d = state.ceo.decisions.find((x) => x.id === p.id);
        if (!d || d.status !== 'pending') return;
        d.status = p.verdict;
        pendingDecisions.set(p.id, p.verdict);
        emit();
        rpc('hq_answer', { p_token: token, p_item: p.id, p_verdict: p.verdict, p_note: p.note || null })
          .then((r) => { if (!r || !r.ok) { pendingDecisions.delete(p.id); d.status = 'pending'; emit(); } else poll(); })
          .catch(() => { pendingDecisions.delete(p.id); d.status = 'pending'; emit(); });
      } else if (type === 'readDoc') {
        const d = state.ceo.documents.find((x) => x.id === p.id);
        if (d && !d.read) {
          d.read = true;
          localRead.add(`doc:${p.id}`);
          rpc('hq_answer', { p_token: token, p_item: p.id, p_verdict: 'read' }).catch(() => {});
        }
      } else if (type === 'readChat') {
        for (const m of state.ceo.chats[p.agent] || []) { m.read = true; if (m.id) localRead.add(`chat:${m.id}`); }
        return; // fires on every panel render: no emit
      } else if (type === 'setBalance') {
        const amount = Number(String(p.amount == null ? '' : p.amount).replace(/[^0-9.]/g, ''));
        if (!(p.id === 'openai' || p.id === 'gemini') || !isFinite(amount) || amount < 0 || String(p.amount).trim() === '') return;
        balanceEntries.set(p.id, { amount, at: Date.now() });
        const b = state.balances.find((x) => x.id === p.id);
        if (b) b.entering = true;
        rpc('hq_set_balance', { p_token: token, p_account: p.id, p_amount: amount }).then((r) => {
          if (!r || !r.ok) { balanceEntries.delete(p.id); if (b) b.entering = false; console.warn('HQ balance entry:', r && r.error); emit(); }
        }).catch(() => { balanceEntries.delete(p.id); if (b) b.entering = false; emit(); });
      } else if (type === 'startMeeting') {
        startMeeting(p);
      } else if (type === 'endMeeting') {
        const m = (state.meetings || []).find((x) => x.id === p.id);
        if (m && ACTIVE.includes(m.status)) m.status = m.status === 'requested' ? 'ended' : 'ending';
        rpc('hq_meeting_end', { p_token: token, p_id: p.id }).then(() => poll()).catch(() => {});
      } else if (type === 'sendMeeting') {
        const list = (state.ceo.meetingChats[p.meeting] = state.ceo.meetingChats[p.meeting] || []);
        list.push({ from: 'ceo', text: p.text, at: Date.now(), read: true, voice: !!p.voice });
        lastSendAt = Date.now();
        rpc('hq_send', { p_token: token, p_to: null, p_text: p.text, p_meeting: p.meeting, p_voice: !!p.voice })
          .then(() => setTimeout(poll, 300)).catch(() => {});
      } else if (type === 'sendChat') {
        const list = (state.ceo.chats[p.agent] = state.ceo.chats[p.agent] || []);
        list.push({ from: 'ceo', text: p.text, at: Date.now(), read: true, inPerson: !!p.inPerson });
        emit();
        lastSendAt = Date.now();
        rpc('hq_send', { p_token: token, p_to: realOf(p.agent), p_text: p.text, p_meeting: p.meeting || null, p_voice: !!p.voice })
          .then(() => setTimeout(poll, 300)).catch(() => {});
        // no instant answer: the agent reads it at its next run and answers in this chat
      }
      emit();
    }

    // replies from agents to Nicolas: let the scene animate them (phone in hand) as they arrive
    const seenReplies = new Set();
    listeners.add((s) => {
      for (const [agent, list] of Object.entries(s.ceo.chats || {})) {
        for (const m of list) {
          if (m.from === 'ceo' || !m.id || seenReplies.has(m.id)) continue;
          seenReplies.add(m.id);
          if (loadedOnce && firstSeen.get(m.id) && Date.now() - firstSeen.get(m.id) < POLL_MS * 2 && feed.replyHandler) {
            try { feed.replyHandler(agent, m.text, () => {}, false); } catch (e) { /* the scene may not know this agent yet */ }
          }
        }
      }
    });

    emit();
    poll();
    return feed;
  }

  window.AHQ_LIVE = { createFeed, version: '2026-11-20d' };
})();
