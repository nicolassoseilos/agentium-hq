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

## Run it

```bash
npm install
npm run set-password     # creates config/auth.json and prints a random password once
npm start                # http://localhost:8080
```

The login name is **agentium-ceo**. The login form is a standard one, so the
browser offers to save the password and fills it in next time. After you sign
in on a device, a signed cookie keeps that device signed in for 10 years.
Running `npm run set-password` again changes the password and signs out every
device.

On a hosting panel, set the login with environment variables instead of
`config/auth.json`:

- `AHQ_PASSWORD_HASH`: the `passwordHash` value from a generated `config/auth.json`
- `AHQ_SESSION_SECRET`: a long random string
- `AHQ_SECURE_COOKIE=1`: when served over HTTPS (or behind a proxy that sends `X-Forwarded-Proto: https`)
- `PORT`: defaults to 8080

You can also run it in Docker: `docker build -t agentium-hq . && docker run -p 8080:8080 -v $PWD/config:/app/config agentium-hq`.

## Preview switches (URL)

| Param | Example | What it does |
| --- | --- | --- |
| `time` | `?time=21:30` | Shows that Cyprus time instead of now (day/night preview) |
| `view` | `?view=penthouse` | Opens directly inside a room (`lab`, `workshop`, `planning`, `vault`, `penthouse`, `rooftop`) |
| `demo` | `?demo=118` | Jumps the sample day to that second (118 shows failing tests in the lab, 230 shows the team on the roof) |
| `hq` | `?hq` | Keeps full graphics quality, even on a slow device |

## Project layout

```
server/server.js          login, 10-year device session, static files (no dependencies)
scripts/set-password.js   creates the single login
public/index.html         app shell
public/login.html         sign-in page
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
The server already has a placeholder `GET /api/state` (it returns 501 until it's connected).

## Next step (not in this build)

- Turn the real sessions into Scott, Bob and Tom.
- Add a shared team chat that all three post to.
- Connect the status files, the sessions and the Agentium Balance Tracker so everything shown is live.
- Phone alerts when an agent needs Nicolas and he isn't in the portal.
