# Agentium HQ

The CEO's private portal into the Agentium headquarters tower. The whole
building is shown as a cutaway, and the AI workers (Scott, Bob and Tom) do
their jobs inside it. Click a floor and the camera flies in like a drone.

This first build is **visual only**: the building, rooms, agents, navigation
and a scripted day of **sample activity**. Live data from the real sessions
comes in the next step. The data lives in its own layer
(`public/js/data/`), so it can be swapped in without touching the visuals.

## What's inside

| Floor | Rooms | Who |
| --- | --- | --- |
| Rooftop | Lounge with infinity pool, sunbeds, cabanas, bar (right), silent DJ | Everyone, when no session is running |
| Top floor | CEO Penthouse (command desk) · The Vault (billing) | Scott drops off reports |
| Work floor | Workshop (architect studio) · Planning Room (screen wall) | Bob · Scott |
| Basement | Testing Lab (neon, hexagon lights, robot arm) | Tom |

- **Cutaway tower:** hovering a room shows its name and what's happening there. Rooms with someone working are lit warm, empty ones are dimmed, and a room with a problem glows red.
- **Drone flights:** clicking a room flies the camera inside. **‹ Tower** (or Esc) flies back out. Inside a room, use the room switcher and the ▴ ▾ buttons to move around, and drag to look around.
- **Glass lift:** agents always take it between floors, one trip at a time.
- **Speech bubbles:** when agents talk, a bubble appears over the speaker's head. Clicking it opens the full conversation in an iMessage-style side panel.
- **CEO desk:** the documents tray, the decisions folder (with approve and reject buttons) and the phone (chat with Scott, Bob or Tom). Clicking an agent also opens a chat. The **Desk** button in the top right opens the same tray from anywhere.
- **Vault:** a balance wall lists each service with its balance and roughly how many days it will last. Low balances show amber and urgent ones red. A low balance also puts a top-up card in the tray with a suggested amount. The card's button opens the service's payment page in a new tab.
- **Real Cyprus time:** the sky, sun, moon and city lights follow the actual sun position over Nicosia, and they change live without a reload.
- **No sound** anywhere.

## Access and hosting

The HQ is published on **GitHub Pages**, like the client portal:
`https://nicolassoseilos.github.io/agentium-hq/` (Settings → Pages → *Deploy from a branch* → `main` / `/docs`).

Pages can only serve static files, so the build **encrypts the whole HQ**.
`docs/` contains just a login gate and `app.bin`, which is the app bundle (code, styling and
three.js), gzipped and encrypted with AES-256-GCM. The key is derived from the name
`agentium-ceo` plus the password (PBKDF2-SHA256, 600,000 rounds). Without the password,
there is nothing to see.

The login is a standard form, so the browser offers to save the password and fills it in.
After the first sign-in, the key is kept on that device (localStorage), so it never asks
again. Visit `…/agentium-hq/#signout` to forget it on a device.

## Work on it

```bash
npm install
npm run dev      # local preview, no login: http://localhost:8080  (built site: /docs/)
npm run build    # rebuilds docs/ with the same password — signed-in devices stay signed in
```

- `npm run build -- --new-password` makes a new random password and signs out every device.
- `npm run build -- --password "…"` sets a password you choose and signs out every device.

The password lives only in `.hq-password`, which is never committed. Keep a copy somewhere
safe, because rebuilding later needs it: set `AHQ_PASSWORD=…` or restore the file. The salt in
`scripts/gate.json` is not secret.

## Preview switches (URL)

| Param | Example | What it does |
| --- | --- | --- |
| `time` | `?time=21:30` | Shows that Cyprus time instead of now (day/night preview) |
| `view` | `?view=penthouse` | Opens directly inside a room (`lab`, `workshop`, `planning`, `vault`, `penthouse`, `rooftop`) |
| `demo` | `?demo=118` | Jumps the sample day to that second (118 shows failing tests in the lab, 230 shows the team on the roof) |
| `hq` | `?hq` | Keeps full graphics quality, even on a slow device |

These switches work on the published site too.

## Project layout

```
server/dev.js             local preview server (no login)
scripts/build.js          bundles + encrypts the HQ into docs/
scripts/gate.html         the login gate published as docs/index.html
docs/                     the published GitHub Pages site (generated)
public/index.html         app shell
public/css/app.css        interface styling
public/js/main.js         boot, render loop, picking
public/js/core/           time & sun, procedural textures, materials, build helpers
public/js/scene/          layout, sky & city, tower shell & lift, agents, camera
public/js/rooms/          lab, workshop + planning, penthouse + vault, rooftop
public/js/ui/ui.js        top bar, tooltips, bubbles, room bar, side panel
public/js/data/           ← the data layer (sample now, live later)
```

Everything in the 3D scene is built from code. There are no downloaded models or images.

## Data contract (for the live step)

The visuals only talk to `public/js/data/source.js`. A feed implements:

- `get()`: the current state
- `subscribe(fn)`
- `tick(dt)`
- `act(type, payload)`: `decide {id, verdict}`, `readDoc {id}`, `readChat {agent}`, `sendChat {agent, text}`, `topupOpened {id}`

The state shape is in `public/js/data/sample.js` (`initialState`): agents (room, status, activity), problems, tests, workshop (task, file, lines), planning (shifts, roadmap), conversations, ceo (documents, decisions, chats) and balances.
`derive.js` turns that state into room status, top-ups and speech bubbles, and both feeds use it.
The live feed will need its own sign-in to a backend (for example Supabase, like the
balance tracker), because the page itself is static.

## Next step (not in this build)

- Turn the real sessions into Scott, Bob and Tom.
- Add a shared team chat that all three post to.
- Connect the status files, the sessions and the Agentium Balance Tracker so everything shown is live.
- Phone alerts when an agent needs Nicolas and he isn't in the portal.
