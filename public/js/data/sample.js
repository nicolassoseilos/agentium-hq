// Sample activity — a scripted, looping day at Agentium so the HQ feels alive
// before the real sessions are connected. Same shape as the future live feed.
import { derive } from './derive.js';
import { SERVICES } from './services.js';

const CYCLE = 270; // seconds per loop

const TASKS = [
  { id: 'T-142', title: 'Booking page', client: 'Smile Better', file: 'booking/BookingPage.tsx', activity: 'building the booking page', fix: 'fixing the date picker', suite: 'booking-page' },
  { id: 'T-148', title: 'Reminder emails', client: 'Smile Better', file: 'reminders/sendReminder.ts', activity: 'building the reminder emails', fix: 'fixing the time-zone bug', suite: 'reminders' },
  { id: 'T-151', title: 'Client portal login', client: 'Agentium', file: 'portal/LoginForm.tsx', activity: 'building the client portal login', fix: 'fixing the password reset link', suite: 'portal-login' },
];

const CODE = {
  'T-142': [
    "import { useState } from 'react';",
    "import { Calendar } from '@/components/Calendar';",
    "import { TimeSlots } from '@/components/TimeSlots';",
    '',
    '// Booking page for Smile Better patients',
    'export default function BookingPage() {',
    '  const [date, setDate] = useState<Date | null>(null);',
    '  const [slot, setSlot] = useState<string | null>(null);',
    '',
    '  async function confirm() {',
    "    await fetch('/api/bookings', {",
    "      method: 'POST',",
    '      body: JSON.stringify({ date, slot }),',
    '    });',
    '  }',
    '',
    '  return (',
    '    <main className="booking">',
    '      <h1>Book your visit</h1>',
    '      <Calendar value={date} onChange={setDate} />',
    '      <TimeSlots date={date} onPick={setSlot} />',
    '      <button disabled={!slot} onClick={confirm}>',
    '        Confirm booking',
    '      </button>',
    '    </main>',
    '  );',
    '}',
  ],
  'T-148': [
    "import { sendEmail } from '@/lib/email';",
    "import { formatInTimeZone } from 'date-fns-tz';",
    '',
    '// 24h reminder for tomorrow\'s appointments',
    'export async function sendReminder(booking) {',
    "  const tz = booking.clinic.timeZone ?? 'Asia/Nicosia';",
    "  const when = formatInTimeZone(booking.at, tz, 'EEEE HH:mm');",
    '  await sendEmail({',
    '    to: booking.patient.email,',
    "    subject: 'See you tomorrow',",
    '    text: `Your visit is on ${when}.`,',
    '  });',
    '}',
  ],
  'T-151': [
    "import { useForm } from 'react-hook-form';",
    "import { signIn } from '@/lib/auth';",
    '',
    'export function LoginForm() {',
    '  const { register, handleSubmit } = useForm();',
    '  return (',
    '    <form onSubmit={handleSubmit(signIn)}>',
    '      <input {...register("email")} type="email" />',
    '      <input {...register("password")} type="password" />',
    '      <button>Sign in</button>',
    '    </form>',
    '  );',
    '}',
  ],
};

const FIX_LINES = ['', '  // keep the chosen day when the month changes', '  useEffect(() => setSlot(null), [date]);'];

const TEST_NAMES = ['renders calendar', 'picks a date', 'shows free slots', 'hides taken slots', 'confirms booking', 'handles API error', 'keyboard navigation', 'mobile layout', 'month change keeps day', 'time zone Asia/Nicosia', 'sends confirmation', 'accessibility labels', 'disabled until slot', 'loading state', 'empty day message'];

export class SampleFeed {
  constructor() {
    const q = new URLSearchParams(location.search);
    this.clock = Number(q.get('demo') ?? 24);
    this.cycleIndex = Math.floor(this.clock / CYCLE);
    this.listeners = new Set();
    this.pending = new Set(); // agents currently writing a reply
    this.replyHandler = null;
    this.fired = new Set();
    this.typeAcc = 0;
    this.testAcc = 0;
    this.state = this.initialState();
    this.lastCyclePos = -1;
    // fast-forward silently to the starting point
    const target = this.clock;
    this.clock = this.cycleIndex * CYCLE;
    const startAt = Date.now() - (target - this.clock) * 1000;
    this.wallBase = startAt;
    while (this.clock < target) this.advance(0.25, true);
    this.state.now = Date.now();
    this.emit();
  }

  initialState() {
    const now = Date.now();
    const m = (from, text, ago) => ({ from, text, at: now - ago * 1000 });
    return {
      source: 'sample',
      now,
      session: { active: false, title: '' },
      agents: {
        scott: { id: 'scott', name: 'Scott', role: 'Supervisor', room: 'rooftop', status: 'idle', activity: 'relaxing by the pool' },
        bob: { id: 'bob', name: 'Bob', role: 'Builder', room: 'rooftop', status: 'idle', activity: 'relaxing by the pool' },
        tom: { id: 'tom', name: 'Tom', role: 'Tester', room: 'rooftop', status: 'idle', activity: 'at the bar' },
      },
      problems: [],
      tests: { suite: '', total: 0, passed: 0, failed: 0, left: 0, running: false, failures: [], log: [] },
      workshop: { task: null, file: '', lines: [], typing: '' },
      planning: {
        shifts: [
          { time: '09:00', who: 'Scott', what: 'Morning plan', done: true },
          { time: '09:15', who: 'Bob', what: 'Booking page' },
          { time: '11:30', who: 'Tom', what: 'Test booking page' },
          { time: '13:00', who: 'Bob', what: 'Reminder emails' },
          { time: '15:00', who: 'Tom', what: 'Test reminders' },
          { time: '17:30', who: 'Scott', what: 'Recap for Nicolas' },
        ],
        roadmap: [
          { when: 'Nov', title: 'Smile Better voice agent live', status: 'done' },
          { when: 'Dec', title: 'Booking + reminders', status: 'now' },
          { when: 'Jan', title: 'Agentium HQ goes live', status: 'next' },
          { when: 'Feb', title: 'Second clinic onboarded', status: 'next' },
          { when: 'Q2', title: 'Self-serve client portal', status: 'next' },
          { when: 'Q3', title: '10 clients on Agentium', status: 'next' },
        ],
      },
      conversations: [
        { id: 'bob-tom', participants: ['bob', 'tom'], messages: [m('tom', 'Last build passed, nice one.', 3600), m('bob', 'Cheers. Next one coming after lunch.', 3500)] },
        { id: 'scott-bob', participants: ['scott', 'bob'], messages: [m('scott', 'Plan for today is on the screen wall.', 4000), m('bob', 'Seen it. Starting with the booking page.', 3900)] },
        { id: 'scott-tom', participants: ['scott', 'tom'], messages: [m('scott', 'Keep an eye on the date picker, it broke last week.', 4200), m('tom', 'Added extra tests for it.', 4100)] },
        { id: 'team', participants: ['scott', 'bob', 'tom'], messages: [m('scott', 'Good work yesterday, team.', 9000)] },
      ],
      ceo: {
        documents: [
          { id: 'doc-1', title: 'Weekly recap', from: 'scott', kind: 'Recap', at: now - 86400000, read: false, body: 'This week: Smile Better voice agent handled 312 calls, booked 87 appointments, 0 missed calls after 18:00. Next week: booking page and reminder emails.' },
        ],
        decisions: [
          { id: 'dec-1', title: 'Upgrade the bot server', detail: 'Vultr 4 GB plan for faster calls during busy hours.', amount: 12, currency: 'USD', period: 'month', from: 'scott', at: now - 7200000, status: 'pending' },
        ],
        chats: {
          scott: [m('scott', 'Good morning, Nicolas. Everything is on track today.', 5000)],
          bob: [m('bob', 'Booking page is next on my list.', 6000)],
          tom: [m('tom', 'All tests from yesterday are green.', 7000)],
        },
      },
      balances: SERVICES.map((s) => ({ id: s.id, service: s.service, currency: s.currency, payUrl: s.payUrl, balance: s.sample.balance, perDay: s.sample.perDay })),
    };
  }

  // ------------------------------------------------------------ public API
  get() {
    return this.state;
  }

  isTyping(agent) {
    return this.pending.has(agent);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  tick(dt) {
    this.advance(dt, false);
    this.state.now = Date.now();
    this.state.derived = derive(this.state);
  }

  act(type, p = {}) {
    const s = this.state;
    if (type === 'decide') {
      const d = s.ceo.decisions.find((x) => x.id === p.id);
      if (!d || d.status !== 'pending') return;
      d.status = p.verdict;
      d.decidedAt = Date.now();
      this.say('team', d.from, p.verdict === 'approved' ? `Nicolas approved “${d.title}”. Going ahead.` : `Nicolas said no to “${d.title}”. Parking it.`);
    } else if (type === 'readDoc') {
      const d = s.ceo.documents.find((x) => x.id === p.id);
      if (d) d.read = true;
    } else if (type === 'readChat') {
      for (const msg of s.ceo.chats[p.agent] || []) msg.read = true;
    } else if (type === 'sendChat') {
      const list = s.ceo.chats[p.agent];
      list.push({ from: 'ceo', text: p.text, at: Date.now(), read: true, inPerson: !!p.inPerson });
      const reply = this.replyFor(p.agent, p.text);
      this.pending.add(p.agent);
      const deliver = () => {
        this.pending.delete(p.agent);
        list.push({ from: p.agent, text: reply, at: Date.now(), read: false, inPerson: !!p.inPerson });
        this.emit();
      };
      // the scene decides how the reply arrives (phone in hand, or said out loud)
      if (this.replyHandler) this.replyHandler(p.agent, reply, deliver, !!p.inPerson);
      else setTimeout(deliver, 2500);
    } else if (type === 'topupOpened') {
      // nothing to change in the sample; the live step will mark it as in progress
    }
    this.emit();
  }

  // ------------------------------------------------------------ internals
  emit() {
    this.state.derived = derive(this.state);
    for (const fn of this.listeners) fn(this.state);
  }

  say(convId, from, text, quiet = false) {
    const c = this.state.conversations.find((x) => x.id === convId);
    if (!c) return;
    c.messages.push({ from, text, at: quiet ? Date.now() - 60000 : Date.now() });
    if (c.messages.length > 60) c.messages.shift();
  }

  replyFor(agent, text) {
    const s = this.state;
    const a = s.agents[agent];
    const task = s.workshop.task;
    if (agent === 'scott') {
      if (!s.session.active) return 'The team is on a break by the pool. Next session starts shortly — anything you want me to put first?';
      return `On it. Right now Bob is ${s.agents.bob.activity} and Tom is ${s.agents.tom.activity}. I'll send you a recap when the session ends.`;
    }
    if (agent === 'bob') {
      if (!s.session.active) return 'Taking five on the roof. I’ll pick it up as soon as Scott starts the next session.';
      return task ? `Working on ${task.id} · ${task.title}. ${s.workshop.lines.length} lines in. I’ll ping Tom when it’s ready for testing.` : 'Got it, thanks Nicolas.';
    }
    if (agent === 'tom') {
      const t = s.tests;
      if (t.running) return `Suite is running: ${t.passed} passed, ${t.failed} failed, ${t.left} left.`;
      if (t.total) return t.failed ? `Last run had ${t.failed} failures. Bob is on it.` : `Last run: all ${t.total} tests green.`;
      return 'Waiting for Bob’s next build. I’ll let you know the results.';
    }
    void a;
    return 'Noted.';
  }

  setAgent(id, patch) {
    Object.assign(this.state.agents[id], patch);
  }

  once(key, fn) {
    const k = `${this.cycleIndex}:${key}`;
    if (this.fired.has(k)) return;
    this.fired.add(k);
    fn();
  }

  advance(dt, quiet) {
    this.clock += dt;
    const cyc = Math.floor(this.clock / CYCLE);
    if (cyc !== this.cycleIndex) {
      this.cycleIndex = cyc;
    }
    const t = this.clock - cyc * CYCLE;
    const task = TASKS[cyc % TASKS.length];
    const s = this.state;
    const say = (c, f, txt) => this.say(c, f, txt, quiet);

    // balances drain gently (sped up so the screen moves)
    for (const b of s.balances) b.balance = Math.max(0, b.balance - (b.perDay * dt * 40) / 86400);

    // 0s — session starts
    if (t >= 0) this.once('start', () => {
      s.session = { active: true, title: `${task.id} · ${task.title}` };
      s.problems = [];
      s.workshop = { task: { id: task.id, title: task.title }, file: task.file, lines: [], typing: '' };
      s.tests = { suite: task.suite, total: 0, passed: 0, failed: 0, left: 0, running: false, failures: [], log: s.tests.log || [] };
      for (const b of s.balances) b.balance = SERVICES.find((x) => x.id === b.id).sample.balance;
      this.setAgent('scott', { room: 'planning', status: 'working', activity: "planning today's shifts" });
      this.setAgent('bob', { room: 'workshop', status: 'working', activity: task.activity });
      this.setAgent('tom', { room: 'lab', status: 'working', activity: 'preparing test cases' });
      s.planning.shifts.forEach((x, i) => (x.now = i === 1));
      say('team', 'scott', `Morning, team. First up: ${task.title} for ${task.client}.`);
    });
    if (t >= 9) this.once('brief', () => say('scott-bob', 'scott', `Bob, ${task.title.toLowerCase()} first. Tom tests right after.`));
    if (t >= 12) this.once('brief2', () => say('scott-bob', 'bob', 'On it.'));
    if (t >= 40) this.once('plan', () => this.setAgent('scott', { activity: 'reading the future of Agentium plan' }));

    // Bob types until 64s
    if (t >= 10 && t < 64) this.type(dt, CODE[task.id], 0.55);
    if (t >= 64) this.once('ready', () => {
      this.flushTyping();
      say('bob-tom', 'bob', 'Tom, ready for testing.');
      this.setAgent('bob', { activity: 'waiting for test results', status: 'working' });
    });
    if (t >= 67) this.once('ack', () => {
      say('bob-tom', 'tom', 'Running the suite now.');
      this.setAgent('tom', { activity: 'running the test suite' });
      s.planning.shifts.forEach((x, i) => (x.now = i === 2));
      Object.assign(s.tests, { total: 148, passed: 0, failed: 0, left: 148, running: true, failures: [], log: [] });
    });
    // first run: 0.32s per test, two failures
    if (t >= 67 && s.tests.running && !this.fired.has(`${cyc}:run1done`)) {
      this.runTests(dt, 0.32, [61, 97]);
      if (s.tests.left === 0) this.once('run1done', () => {
        s.tests.running = false;
        s.problems = [{ room: 'lab', text: `${s.tests.failed} tests failing` }];
        this.setAgent('tom', { activity: `reporting ${s.tests.failed} failures` });
        say('bob-tom', 'tom', `${s.tests.failed} failures in ${task.suite}. Details are in the log.`);
        s.ceo.documents.unshift({ id: `fail-${cyc}`, title: `${task.title} — failed tests`, from: 'tom', kind: 'Test report', at: Date.now(), read: false, body: `First run of ${task.suite}: ${s.tests.passed} passed, ${s.tests.failed} failed.\n\n${s.tests.failures.map((f) => '✗ ' + f.name).join('\n')}\n\nBob is fixing them now.` });
      });
    }
    if (this.fired.has(`${cyc}:run1done`)) {
      this.once('fixing', () => {
        say('bob-tom', 'bob', 'Fixing now.');
        this.setAgent('bob', { activity: task.fix });
      });
      if (!this.fired.has(`${cyc}:fixed`)) {
        this.typeFix(dt);
      }
    }
    if (this.fixDone(cyc)) this.once('fixed', () => {
      this.flushTyping();
      say('bob-tom', 'bob', 'Fixed. Ready for testing again.');
      this.setAgent('bob', { activity: 'waiting for test results' });
      s.problems = [];
      Object.assign(s.tests, { passed: 0, failed: 0, left: 148, running: true, failures: [] });
      this.setAgent('tom', { activity: 'running the test suite again' });
    });
    if (this.fired.has(`${cyc}:fixed`) && s.tests.running && !this.fired.has(`${cyc}:run2done`)) {
      this.runTests(dt, 0.12, []);
      if (s.tests.left === 0) this.once('run2done', () => {
        s.tests.running = false;
        this.endAt = t;
        say('scott-tom', 'tom', `All ${s.tests.total} tests green.`);
        this.setAgent('tom', { activity: 'writing the test report' });
      });
    }
    if (this.fired.has(`${cyc}:run2done`)) {
      const e = this.endAt ?? t;
      if (t >= e + 3) this.once('great', () => {
        say('scott-tom', 'scott', 'Great work. Taking the report up to Nicolas.');
        this.setAgent('scott', { room: 'penthouse', activity: 'delivering the session report', status: 'working' });
      });
      if (t >= e + 20) this.once('report', () => {
        const now = Date.now();
        s.ceo.documents.unshift(
          { id: `rep-${cyc}`, title: `${task.title} — test report`, from: 'tom', kind: 'Test report', at: now, read: false, body: `${task.suite}: all 148 tests passed on the second run.\n\nFixed: ${task.fix.replace('fixing ', '')}.\nCoverage 91%.` },
          { id: `rec-${cyc}`, title: `Session recap · ${task.id}`, from: 'scott', kind: 'Recap', at: now, read: false, body: `${task.title} for ${task.client} is built and tested.\n\nBob: ${CODE[task.id].length} lines, one fix.\nTom: 2 runs, 148 tests, all green.\n\nNext: ${TASKS[(cyc + 1) % TASKS.length].title}.` },
        );
        if (cyc % 2 === 0) s.ceo.decisions.unshift({ id: `dec-${cyc}`, title: 'SMS reminders for patients', detail: 'Add SMS on top of email reminders. Expect ~400 messages a month.', amount: 19, currency: 'EUR', period: 'month', from: 'scott', at: now, status: 'pending' });
        s.ceo.chats.scott.push({ from: 'scott', text: `${task.title} is done and tested. Report and recap are on your desk.`, at: now, read: false });
        this.setAgent('scott', { activity: 'leaving the report on your desk' });
      });
      if (t >= e + 30) this.once('break', () => {
        say('team', 'scott', 'Session complete. Everyone up to the roof.');
        s.session.active = false;
        this.setAgent('scott', { room: 'rooftop', status: 'idle', activity: 'relaxing by the pool' });
        this.setAgent('bob', { room: 'rooftop', status: 'idle', activity: 'relaxing by the pool' });
        this.setAgent('tom', { room: 'rooftop', status: 'idle', activity: 'having a drink at the bar' });
        s.planning.shifts.forEach((x) => (x.now = false));
      });
    }
    if (t >= CYCLE - 8) this.once('next', () => say('team', 'scott', 'Break’s over in a minute. Next up: ' + TASKS[(cyc + 1) % TASKS.length].title + '.'));
  }

  type(dt, code, perLine) {
    const ws = this.state.workshop;
    this.typeAcc += dt;
    const next = code[ws.lines.length];
    if (next === undefined) return;
    const chars = Math.min(next.length, Math.floor((this.typeAcc / perLine) * Math.max(1, next.length)));
    ws.typing = next.slice(0, chars);
    if (this.typeAcc >= perLine) {
      ws.lines.push(next);
      ws.typing = '';
      this.typeAcc = 0;
    }
  }

  typeFix(dt) {
    this.fixProgress = (this.fixProgress || 0) + dt;
    const ws = this.state.workshop;
    const want = Math.min(FIX_LINES.length, Math.floor(this.fixProgress / 4));
    while ((this.fixAdded || 0) < want) {
      ws.lines.push(FIX_LINES[this.fixAdded || 0]);
      this.fixAdded = (this.fixAdded || 0) + 1;
    }
  }

  fixDone(cyc) {
    if (!this.fired.has(`${cyc}:run1done`)) {
      this.fixProgress = 0;
      this.fixAdded = 0;
      return false;
    }
    return (this.fixProgress || 0) >= 15;
  }

  flushTyping() {
    this.state.workshop.typing = '';
  }

  runTests(dt, per, failAt) {
    const s = this.state.tests;
    this.testAcc += dt;
    while (this.testAcc >= per && s.left > 0) {
      this.testAcc -= per;
      const idx = s.total - s.left;
      const name = `${TEST_NAMES[idx % TEST_NAMES.length]} #${idx + 1}`;
      const fail = failAt.includes(idx);
      if (fail) {
        s.failed++;
        s.failures.push({ name: idx === failAt[0] ? 'month change keeps day' : 'time zone Asia/Nicosia', msg: 'expected 14, received 1' });
      } else s.passed++;
      s.left--;
      s.log.push({ name: fail ? s.failures[s.failures.length - 1].name : name, ok: !fail });
      if (s.log.length > 30) s.log.shift();
    }
  }
}
