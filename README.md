# Agentium HQ

The CEO's private portal into the Agentium headquarters tower. The whole
building is shown as a cutaway, and the AI team does its work inside it: six
agents in two departments, Voice and Chat, each with a supervisor (Scott), a
builder (Bob) and a tester (Tom). Click a floor and the camera flies in like a drone.

This first build is **visual only**: the building, rooms, agents, navigation
and a scripted day of **sample activity**. Live data from the real sessions
comes in the next step. The data lives in its own layer
(`public/js/data/`), so it can be swapped in without touching the visuals.

## What's inside

| Floor | Rooms | Who |
| --- | --- | --- |
| Rooftop | Lounge with infinity pool, sunbeds, cabanas, bar (right), silent DJ | Idle agents relax by the pool |
| Top floor | CEO Penthouse (command desk) · The Vault (billing + Claude plan) | Supervisors drop off reports |
| Work floor | Workshop (a desk per builder + a spare, spare seats, the project-file bookshelf) · Planning Room (the team's meeting room) | Bob Voice, Bob Chat · Scott Voice, Scott Chat |
| Basement | Testing Lab (a bench and monitor per tester, both suites on the wall) | Tom Voice, Tom Chat |

- **Six agents:** the suits show department and rank. Voice is navy (the supervisor dark, the builder and tester a lighter blue) and Chat is brown (the supervisor dark, the builder and tester tan). Avatars and the top-bar chips use the same colours. HQ builds the people from whatever agents the data lists (`public/js/scene/roster.js`), so it works with the sample trio as well as the live six.
- **Everyone has their own spot:** builders at their desks, testers at their benches, supervisors at the head of the planning table. Anyone else takes whatever seat or standing spot is free. The lift queue has room for the whole team.
- **Desk screens:** each agent's own screen shows their live note (task, note, step k of n, status). Builders see the code they are writing underneath, and testers see their department's test run.
- **Bookshelf:** each compartment holds a real project folder, with a brass label showing its name and file count. Hover the shelf to see which files exist, and click it for the full list.
- **Vault:** the balance wall also shows the Claude plan (this week and this session, with reset times), and so does the vault panel.
- **Team meeting:** the planning room phone has **Invite everyone**.

- **Cutaway tower:** hovering a room shows its name and what's happening there. Rooms with someone working are lit warm, empty ones are dimmed, and a room with a problem glows red.
- **Drone flights:** clicking a room flies the camera inside, and you always stand inside the room, behind the glass. **‹ Tower** (or Esc) flies back out. Inside a room, tap the open floor of the room next door (seen through the glass, or through the walkway opening) to go there; ▴ ▾ change floor; drag to look around.
- **Lift:** a real enclosed elevator with brushed-steel sliding doors, a call button on every floor and floor indicators.
  - People walk to the button and press it, and it lights up until the lift arrives.
  - It holds up to 4, stops on the way for anyone waiting in the same direction, and holds its doors for someone walking up to it.
- **Rooftop life:** the guests are realistic adult women built from the MakeHuman model (CC0), from four body/face variants with different hair colours and styles, skin tones and bikini colours, all at the same height as everyone else (see `tools/woman/README.md`). On the published site their model files are encrypted with the HQ key. They wade in the pool, sit on the pool edge, sunbathe, lounge in the cabanas and walk to the bar for drinks that they then carry around. They never leave the rooftop.
  - Where everyone goes, the agents included, is random rather than a routine.
  - Guests and staff enjoy the music (head nods, never dancing). The agents stay nonchalant.
- **Barman:** he hands over the menu and waits for the order. Then he makes the drink on the bar top right across from that customer, so you always see who he is serving:
  - the right clean glass from the back counter
  - ice from the bucket (a big rock for whisky, cubes or crushed ice for cocktails)
  - the spirit from the backlit back bar, poured over it
  - for cocktails the mixer (and grenadine for a Sunset), a stir with the bar spoon, and the garnish
  - he slides it across and puts the bottles back. Nothing happens under the counter.
- **Bar seating:** the agents sit on the stools; the end of the bar holds one standing guest at a time.
- **Cigars at the bar:** order a Cohiba from the menu. Marco takes it from the humidor and brings an ashtray (shared between neighbours). In front of you he cuts it with his pocket cutter and lights it with a jet lighter. Agents sitting with you get one too.
- **Real glassware:** whisky and cognac come in a short cut-crystal tumbler, wine, rosé and champagne in a stemmed wine glass, and every cocktail (Agentium Sunset, Gin & Tonic, Vodka Martini) in a tall hurricane glass with ice and a citrus wheel.
- **Whisky in your office (first-person):** click the decanter (or **Pour a whisky**).
  - You get up and walk to the cabinet. You take crystal tumblers, lift the decanter, pour each glass and put the decanter back.
  - Everything goes back to the desk in one trip: your glass in your hand, or all the glasses on the silver tray. Each guest's glass goes in front of them. You sit down and set yours on the desk.
  - **Refills:** click anyone's glass on the desk (or yours). You take it back to the cabinet and pour again.
- **Cigars in your office:** click the humidor (or **Have a cigar**).
  - The lid opens. Click a cigar to take it, and it is cut with the guillotine. Click the jet lighter to light it, holding the cigar in one hand and the lighter in the other.
  - It goes into the big ashtray. **Cigars for the guests** cuts and lights theirs too. **Back to my desk** carries the ashtrays over: one near you, and a second between the armchairs when your guests smoke.
- **Sipping and smoking:** you and whoever drinks with you pick up the glass every so often, take a sip and put it back (about ten sips to finish). A lit cigar smoulders in the ashtray. Now and then it is picked up and drawn on: the tip glows and the smoke is blown out. It burns down puff by puff.
- **Sit down anywhere you're allowed:** on the rooftop a bar stool, a sunbed, the white sofa, the cabana seats or the view couch (front and centre: bar on your right, pool ahead, sunbeds on your left); any planning room chair; the stool in the testing lab facing Tom; or your own chair in the penthouse. Nobody else ever takes the seat you're in.
  - The view turns first-person when you sit.
  - At the bar you can ask for the menu or order straight away.
- **Invite an agent to join you:** in your office and at the planning table, use the phone (**Call an agent** → **Invite**). On the rooftop, sit down and use **Invite someone**.
  - They stop what they are doing and come by lift: to an armchair across your desk, a chair across the planning table from you (beside you only once that side is full), the stool next to you at the bar (a guest sitting there swaps out for them, and they get a drink), or the seat next to you by the pool.
  - They stay until you say **That's all** (room bar, phone or chat), even if you stand up or step out for a moment.
- **Bar stools are kept for you** and whoever you invite. Guests and agents order standing at the end of the bar, and any guest gives up her seat when you take it. You can't chat with the guests.
- **Talk in person or by phone:** click anyone in the room with you to talk in person, and they answer out loud in a speech bubble. Agents elsewhere get your message on their phone. They stop what they are doing, take the phone out of their pocket, read, type, and the reply arrives when they hit send.
- **Look around:** drag to turn a full 360° in the tower view and in every room. Click a screen (the vault balances, the test suite, Bob's monitor, the plan wall) for a sharp close-up.
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
public/js/scene/          layout, sky & city, tower shell & lift, agents, camera,
                          drinks & glassware, cigars & smoke (smoking.js), your hands (fp-hands.js),
                          sipping & smoking at tables (leisure.js), the office rituals (ceo-office.js)
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
