/* Agentium HQ -- the rooftop DJ plays real music from Nicolas's Spotify (team-build session, 20 Nov 2026).
 *
 * Loaded by the gate page before the HQ itself (like hq-live.js); only defines window.AHQ_MUSIC.
 * Spotify login: Authorization Code with PKCE (browser only, no secret): only the app's Client ID is in here.
 * Sound: the Spotify Web Playback SDK makes this browser tab a Spotify device called "Agentium HQ" (computers only;
 * Spotify needs Premium). If that device cannot start (phones, or Spotify's player not starting), the DJ plays on
 * Nicolas's active Spotify device instead (his phone or computer app).
 *
 * window.AHQ_MUSIC = {
 *   configured()      true once the Client ID is set
 *   connected()       true once Nicolas has logged in to Spotify (tokens kept in this browser)
 *   connect()         open the Spotify login (call it straight from a click: it opens a small window)
 *   disconnect()      forget the login on this browser
 *   gesture()         call on any click/send in the DJ chat: lets the browser start the sound
 *   request(text)     -> Promise<{ text, action, track? }>  the DJ's answer to what Nicolas typed; plays / pauses /
 *                     skips / changes the volume as asked. action: play | pause | resume | next | previous | volume |
 *                     what | chat | connect | error.  When action is 'connect', show a "Connect Spotify" button
 *                     that calls connect().
 *   nowPlaying()      { name, artists, image, uri, paused } or null
 *   subscribe(fn)     fn(nowPlaying) whenever the song or pause state changes; returns an unsubscribe function
 * }
 */
(function () {
  'use strict';

  const CLIENT_ID = '3f76a0dc20a24f13ad890cc46ba3ca0b';  // Nicolas's Spotify app (public by design: PKCE, no secret) (developer dashboard -> Agentium HQ DJ -> Settings -> Client ID)
  const REDIRECT_URI = 'https://nicolassoseilos.github.io/agentium-hq/';
  const SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state';
  const TOKEN_KEY = 'agentium-hq-spotify';
  const PKCE_KEY = 'agentium-hq-spotify-pkce';
  const API = 'https://api.spotify.com/v1';
  const ACCOUNTS = 'https://accounts.spotify.com';
  const isPhone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // ------------------------------------------------------------------ login (PKCE)
  function randomText(n) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[b % 66]).join('');
  }
  async function challengeOf(verifier) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function authUrl() {
    const verifier = randomText(96);
    const state = 'ahq-' + randomText(16);
    store.set(PKCE_KEY, { verifier, state, at: Date.now() });
    const q = new URLSearchParams({ response_type: 'code', client_id: CLIENT_ID, scope: SCOPES, redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256', code_challenge: await challengeOf(verifier), state });
    return `${ACCOUNTS}/authorize?${q}`;
  }
  async function tokenRequest(params) {
    const r = await fetch(`${ACCOUNTS}/api/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, ...params }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw Object.assign(new Error(j.error_description || j.error || `login failed (${r.status})`), { status: r.status });
    return j;
  }
  function keep(j, old) {
    const t = { access_token: j.access_token, refresh_token: j.refresh_token || (old && old.refresh_token),
      expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
    store.set(TOKEN_KEY, t);
    return t;
  }

  // Spotify sends the browser back to REDIRECT_URI (the gate page) with ?code=...&state=ahq-...  -- usually inside the
  // small login window opened by connect(): finish the login there, tell HQ, close the window.
  async function finishLogin() {
    const qs = new URLSearchParams(location.search);
    const state = qs.get('state') || '';
    if (!state.startsWith('ahq-') || !(qs.get('code') || qs.get('error'))) return;
    history.replaceState(null, '', location.pathname + location.hash);
    const pk = store.get(PKCE_KEY);
    let ok = false;
    if (qs.get('code') && pk && pk.state === state) {
      try {
        keep(await tokenRequest({ grant_type: 'authorization_code', code: qs.get('code'), redirect_uri: REDIRECT_URI, code_verifier: pk.verifier }));
        ok = true;
      } catch (e) { console.warn('Spotify login:', e.message); }
    }
    store.set(PKCE_KEY, null);
    if (pk && pk.popup) {  // the small login window: tell HQ, close (Spotify's pages may cut the link back to HQ)
      try { if (window.opener) window.opener.postMessage({ type: 'ahq-spotify', ok }, location.origin); } catch {}
      setTimeout(() => {
        window.close();
        setTimeout(() => {  // still open (the browser would not let it close itself): say so instead of showing the gate
          document.documentElement.innerHTML = '<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0b0b0d;' +
            'color:#eee;font:16px system-ui,sans-serif"><p>' + (ok ? 'Spotify is connected. You can close this window.'
            : 'Spotify did not connect. Close this window and try again.') + '</p></body>';
        }, 400);
      }, 150);
    }
  }

  let refreshing = null;
  async function accessToken() {
    let t = store.get(TOKEN_KEY);
    if (!t) return null;
    if (Date.now() > t.expires_at - 60000) {
      if (!t.refresh_token) { store.set(TOKEN_KEY, null); return null; }
      refreshing = refreshing || tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token })
        .then((j) => keep(j, t))
        .catch((e) => { if (e.status === 400 || e.status === 401) store.set(TOKEN_KEY, null); return null; })
        .finally(() => { refreshing = null; });
      t = await refreshing;
    }
    return t && t.access_token;
  }

  async function api(method, path, body, retry = true) {
    const tk = await accessToken();
    if (!tk) throw Object.assign(new Error('not connected'), { code: 'login' });
    const r = await fetch(API + path, { method, headers: { Authorization: `Bearer ${tk}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401 && retry) {
      const t = store.get(TOKEN_KEY);
      if (t) store.set(TOKEN_KEY, { ...t, expires_at: 0 });  // force a refresh, then try once more
      return api(method, path, body, false);
    }
    if (r.status === 204 || r.status === 202) return null;
    const text = await r.text();
    let j = null;
    try { j = text ? JSON.parse(text) : null; } catch {}
    if (!r.ok) {
      const err = (j && j.error) || {};
      throw Object.assign(new Error(err.message || `Spotify error ${r.status}`), { status: r.status, reason: err.reason || '' });
    }
    return j;
  }

  // ------------------------------------------------------------------ the player in this tab
  let sdk = null, player = null, deviceId = null, deviceFailed = false, volume = 0.7, current = null;
  const listeners = new Set();
  const emit = () => { for (const fn of listeners) { try { fn(current); } catch (e) { console.error(e); } } };

  function loadSdk() {
    sdk = sdk || new Promise((resolve, reject) => {
      window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
      const s = document.createElement('script');
      s.src = 'https://sdk.scdn.co/spotify-player.js';
      s.async = true;
      s.onerror = () => reject(new Error('the Spotify player could not load'));
      document.head.appendChild(s);
    });
    return sdk;
  }
  const within = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  async function hqDevice() {
    if (deviceId) return deviceId;
    if (isPhone || deviceFailed) return null;
    try {
      const Spotify = await within(loadSdk(), 10000);
      if (!player) {
        player = new Spotify.Player({ name: 'Agentium HQ', volume, getOAuthToken: (cb) => { accessToken().then((t) => t && cb(t)); } });
        player.addListener('ready', ({ device_id }) => { deviceId = device_id; });
        player.addListener('not_ready', () => { deviceId = null; });
        player.addListener('player_state_changed', (s) => {
          const tr = s && s.track_window && s.track_window.current_track;
          current = tr ? { name: tr.name, artists: (tr.artists || []).map((a) => a.name).join(', '), uri: tr.uri,
            image: (tr.album && tr.album.images && tr.album.images[0] && tr.album.images[0].url) || '', paused: !!s.paused } : null;
          emit();
        });
        for (const ev of ['initialization_error', 'authentication_error', 'account_error', 'playback_error']) {
          player.addListener(ev, ({ message }) => { console.warn(`Spotify ${ev}:`, message); if (ev !== 'playback_error') deviceFailed = true; });
        }
        within(player.connect(), 10000).catch(() => {});
      }
      const t0 = Date.now();
      while (!deviceId && !deviceFailed && Date.now() - t0 < 10000) await new Promise((r) => setTimeout(r, 250));
      if (!deviceId) deviceFailed = true;
    } catch (e) {
      console.warn('Spotify player in HQ:', e.message);
      deviceFailed = true;
    }
    return deviceId;
  }

  async function playUri(uri) {
    const id = await hqDevice();
    if (id) {
      try {
        await api('PUT', `/me/player/play?device_id=${encodeURIComponent(id)}`, { uris: [uri] });
      } catch (e) {
        if (e.status !== 404) throw e;
        await api('PUT', '/me/player', { device_ids: [id], play: false });
        await api('PUT', `/me/player/play?device_id=${encodeURIComponent(id)}`, { uris: [uri] });
      }
      return null;
    }
    const list = ((await api('GET', '/me/player/devices')) || {}).devices || [];
    const d = list.find((x) => x.is_active) || list[0];
    if (!d) throw Object.assign(new Error('no Spotify device'), { code: 'nodevice' });
    await api('PUT', `/me/player/play?device_id=${encodeURIComponent(d.id)}`, { uris: [uri] });
    return d.name || 'Spotify';
  }

  async function control(kind, delta) {
    const local = player && deviceId;
    if (kind === 'pause') return local ? player.pause() : api('PUT', '/me/player/pause');
    if (kind === 'resume') return local ? player.resume() : api('PUT', '/me/player/play');
    if (kind === 'next') return local ? player.nextTrack() : api('POST', '/me/player/next');
    if (kind === 'previous') return local ? player.previousTrack() : api('POST', '/me/player/previous');
    if (kind === 'volume') {
      volume = Math.min(1, Math.max(0.05, volume + delta));
      return local ? player.setVolume(volume) : api('PUT', `/me/player/volume?volume_percent=${Math.round(volume * 100)}`);
    }
  }

  // ------------------------------------------------------------------ what Nicolas asks the DJ
  function parse(raw) {
    const t = String(raw || '').toLowerCase().replace(/[“”"’']/g, '').replace(/[!?.,]+$/g, '').replace(/\s+/g, ' ').trim();
    if (!t) return { type: 'chat' };
    if (/^(pause|stop|silence|quiet|enough|mute)\b/.test(t) || /\b(pause|stop|turn off|kill) (it|the music|this|the song)\b/.test(t)) return { type: 'pause' };
    if (/^(resume|continue|unpause|keep (it )?going|play( it)?( again)?|back on|music on)$/.test(t)) return { type: 'resume' };
    if (/\b(louder|turn it up|volume up|crank it|pump it up|turn up)\b/.test(t)) return { type: 'volume', delta: 0.15 };
    if (/\b(quieter|softer|turn it down|volume down|turn down|too loud)\b/.test(t)) return { type: 'volume', delta: -0.15 };
    if (/\b(what(s| is) (this|playing|this song)|which song|what song|song name|whos this)\b/.test(t)) return { type: 'what' };
    const m = t.match(/\b(?:can|could|would|will) you (?:please )?(?:play|put on|spin|throw on|drop) (.+)/) ||
              t.match(/^(?:please |dj )?(?:play|put on|spin|throw on|drop|i want to hear|i wanna hear|lets hear|let me hear|id love to hear) (.+)/);
    if (m) {
      const q = m[1].replace(/\b(please|for me|for us|right now|now|dj|boss)\b/g, ' ')
        .replace(/^\s*(the song|the track|song|track|some|a bit of|a song called)\s+/, '').replace(/\s+/g, ' ').trim();
      if (q && !/^(something|anything|music|a song|some music)$/.test(q)) return { type: 'play', query: q };
      return { type: 'pick' };
    }
    if (/\b(next|skip|another one|change (the )?song)\b/.test(t)) return { type: 'next' };
    if (/\b(previous|go back|last song|play that again)\b/.test(t)) return { type: 'previous' };
    return { type: 'chat' };
  }

  function explain(e) {
    if (e.code === 'login' || e.status === 401) { store.set(TOKEN_KEY, null); return { text: 'Spotify logged us out, boss. Tap Connect Spotify and I’ll pick it back up.', action: 'connect' }; }
    if (e.status === 403 && /PREMIUM/i.test(e.reason || e.message)) return { text: 'Spotify says this needs Premium on the account.', action: 'error' };
    if (e.status === 403) return { text: 'Spotify won’t let the decks do that one (it said: ' + e.message + ').', action: 'error' };
    if (e.code === 'nodevice') return { text: 'This browser can’t play Spotify itself. Open Spotify on your phone or computer, then ask me again and I’ll play it there.', action: 'error' };
    if (e.status === 429) return { text: 'Spotify asked me to slow down a second. Try again in a moment.', action: 'error' };
    return { text: 'The decks glitched (Spotify said: ' + e.message + '). Try again?', action: 'error' };
  }

  async function request(text) {
    if (!CLIENT_ID) return { text: 'The decks aren’t hooked up to Spotify yet, boss. Soon.', action: 'chat' };
    const cmd = parse(text);
    if (!store.get(TOKEN_KEY)) {
      return { text: cmd.type === 'chat' ? 'I can play anything from your Spotify. Tap Connect Spotify and tell me a song.'
        : 'Happy to! Tap Connect Spotify first, then ask me again.', action: 'connect' };
    }
    try {
      if (cmd.type === 'play') {
        const find = async (q) => { const r = await api('GET', `/search?type=track&limit=5&q=${encodeURIComponent(q)}`); return r && r.tracks && r.tracks.items && r.tracks.items[0]; };
        const by = cmd.query.match(/^(.+?) by (.+)$/);  // "sweet disposition by the temper trap" -> track + artist
        const tr = (by && await find(`track:${by[1]} artist:${by[2]}`)) || await find(cmd.query);
        if (!tr) return { text: `I can’t find “${cmd.query}”. Try the artist as well?`, action: 'chat' };
        const where = await playUri(tr.uri);
        const label = `${tr.name} by ${(tr.artists || []).map((a) => a.name).join(', ')}`;
        const track = { name: tr.name, artists: (tr.artists || []).map((a) => a.name).join(', '), uri: tr.uri,
          image: (tr.album && tr.album.images && tr.album.images[0] && tr.album.images[0].url) || '', paused: false };
        if (where) { current = track; emit(); }
        return { text: where ? `Coming up: ${label}, on your ${where}.` : `Coming up: ${label}.`, action: 'play', track };
      }
      if (cmd.type === 'pick') return { text: 'Give me a song or an artist and it’s on.', action: 'chat' };
      if (cmd.type === 'what') {
        return { text: current ? `This is ${current.name} by ${current.artists}.` : 'Nothing on from Spotify right now. Give me a song!', action: 'what', track: current || undefined };
      }
      if (cmd.type === 'chat') return { text: 'Requests are welcome, boss. Just say “play” and the song.', action: 'chat' };
      await control(cmd.type, cmd.delta);
      const said = { pause: 'Paused.', resume: 'Back on.', next: 'Skipping to the next one.', previous: 'Going back one.',
        volume: cmd.delta > 0 ? 'Turning it up.' : 'Bringing it down a little.' };
      return { text: said[cmd.type], action: cmd.type };
    } catch (e) {
      return explain(e);
    }
  }

  function connect() {
    if (!CLIENT_ID) return;
    // open the window first (still inside the click), then point it at Spotify once the login link is ready
    const w = window.open('', 'ahq-spotify-login', 'width=480,height=720');
    authUrl().then((url) => {
      const popup = !!(w && !w.closed);
      store.set(PKCE_KEY, { ...store.get(PKCE_KEY), popup });
      if (popup) w.location.href = url; else location.assign(url);  // no window allowed: log in in this tab instead
    });
  }

  window.addEventListener('message', (e) => {
    if (e.origin === location.origin && e.data && e.data.type === 'ahq-spotify' && e.data.ok) { deviceFailed = false; hqDevice(); }
  });
  window.addEventListener('storage', (e) => { if (e.key === TOKEN_KEY && e.newValue && !deviceId) { deviceFailed = false; hqDevice(); } });

  finishLogin();

  window.AHQ_MUSIC = {
    version: '2026-11-20b',
    configured: () => !!CLIENT_ID,
    connected: () => !!store.get(TOKEN_KEY),
    connect,
    disconnect() { store.set(TOKEN_KEY, null); try { player && player.disconnect(); } catch {} player = null; deviceId = null; current = null; emit(); },
    gesture() { try { player && player.activateElement && player.activateElement(); } catch {} },
    request,
    nowPlaying: () => current,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    _parse: parse,  // for tests
  };
})();
