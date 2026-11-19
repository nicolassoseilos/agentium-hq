// Pure functions that turn raw HQ state into what the visuals need.
// Shared by the sample feed now and the live feed later.

export const LOW_DAYS = 10;
export const URGENT_DAYS = 3;

export const daysLeft = (b) => (b.perDay > 0 ? b.balance / b.perDay : Infinity);

export function balanceLevel(b) {
  const d = daysLeft(b);
  if (d <= URGENT_DAYS) return 'urgent';
  if (d <= LOW_DAYS) return 'low';
  return 'ok';
}

/** Enough for about 30 days, rounded up to the next 10. */
export function suggestedTopUp(b) {
  const need = Math.max(10, b.perDay * 30 - b.balance);
  return Math.ceil(need / 10) * 10;
}

export const ROOM_IDS = ['lab', 'workshop', 'planning', 'vault', 'penthouse', 'rooftop'];
const ROOM_NAMES = { lab: 'Testing Lab', workshop: 'Workshop', planning: 'Planning Room', vault: 'The Vault', penthouse: 'CEO Penthouse', rooftop: 'Rooftop Lounge' };

export function derive(state) {
  const agents = Object.values(state.agents || {});
  const topups = (state.balances || [])
    .filter((b) => balanceLevel(b) !== 'ok')
    .map((b) => ({
      id: `topup-${b.id}`,
      serviceId: b.id,
      service: b.service,
      amount: suggestedTopUp(b),
      currency: b.currency,
      url: b.payUrl,
      level: balanceLevel(b),
      days: Math.floor(daysLeft(b)),
    }));

  const rooms = {};
  for (const id of ROOM_IDS) {
    const here = agents.filter((a) => a.room === id);
    const problem = (state.problems || []).find((p) => p.room === id);
    let status = 'idle';
    if (problem) status = 'problem';
    else if (here.some((a) => a.status === 'working')) status = 'working';
    else if (id === 'rooftop' && here.length) status = 'working';
    else if (id === 'vault' && topups.some((t) => t.level === 'urgent')) status = 'problem';

    let activity;
    if (here.length) activity = here.map((a) => `${a.name} ${a.activity}`).join(' · ');
    else if (id === 'vault') activity = topups.length ? `${topups.length} balance${topups.length > 1 ? 's' : ''} running low` : 'All balances healthy';
    else if (id === 'penthouse') {
      const pending = (state.ceo?.decisions || []).filter((d) => d.status === 'pending').length;
      const docs = (state.ceo?.documents || []).filter((d) => !d.read).length;
      activity = pending || docs ? `${docs} new document${docs === 1 ? '' : 's'} · ${pending} decision${pending === 1 ? '' : 's'} waiting` : 'Your desk is clear';
    } else activity = 'Empty';
    if (problem) activity = `${problem.text}${here.length ? ' · ' + activity : ''}`;
    rooms[id] = { id, name: ROOM_NAMES[id], status, activity, agents: here.map((a) => a.id) };
  }

  const now = state.now || Date.now();
  const bubbles = [];
  for (const c of state.conversations || []) {
    const last = c.messages[c.messages.length - 1];
    if (last && now - last.at < 6500 && last.from !== 'ceo') bubbles.push({ convId: c.id, from: last.from, text: last.text, at: last.at });
  }

  const unreadChats = Object.values(state.ceo?.chats || {}).reduce((n, list) => n + list.filter((m) => m.from !== 'ceo' && !m.read).length, 0);

  return { topups, rooms, bubbles, unreadChats };
}
