// Who the agents are, as far as the looks go: six agents in two departments
// (Voice and Chat), each with a supervisor (Scott), a builder (Bob) and a tester
// (Tom). Suits show department and rank: Voice in navy (supervisor dark, the
// others a lighter blue), Chat in brown (supervisor dark, the others tan).
// Works from whatever the data gives (state.agents[id].dept/rank/name/role),
// falls back to the id ('voice-bob'), and still understands the three sample
// agents ('scott', 'bob', 'tom').

export const DEPTS = { voice: 'Voice', chat: 'Chat' };
export const RANKS = ['supervisor', 'builder', 'tester'];
const FIRST = { supervisor: 'Scott', builder: 'Bob', tester: 'Tom' };
// Nicolas's names (22 Nov): the Chat department are Simon, Bruno and Theo (the data carries the names too)
const NAMES = { voice: FIRST, chat: { supervisor: 'Simon', builder: 'Bruno', tester: 'Theo' } };
const BASE = { supervisor: 'scott', builder: 'bob', tester: 'tom' };
const LEGACY = { scott: 'supervisor', bob: 'builder', tom: 'tester' };

export const SUITS = {
  voice: { supervisor: '#141f3c', builder: '#46679c', tester: '#5579ad' },
  chat: { supervisor: '#3b2416', builder: '#a9814f', tester: '#b8915d' },
};
const TIES = {
  voice: { supervisor: '#7a1f2b', builder: '#16161a', tester: '#2f6b4a' },
  chat: { supervisor: '#c9a15e', builder: '#2a2a30', tester: '#6b1a24' },
};
// the two departments' versions of each character look like different people
const FACES = {
  voice: {
    supervisor: { hair: '#b9b6b0', skin: '#f0c8a4', iris: '#3a66a6', hairStyle: 'swept', prop: 'tablet', glasses: true },
    builder: { hair: '#2f221a', skin: '#f3cba6', iris: '#5a3b22', hairStyle: 'spiky', prop: 'pencil' },
    tester: { hair: '#9c4f2a', skin: '#f1c39c', iris: '#2f7a58', hairStyle: 'side', prop: 'clipboard' },
  },
  chat: {
    supervisor: { hair: '#3a2f2a', skin: '#e2b48c', iris: '#4a3322', hairStyle: 'swept', prop: 'tablet', glasses: true, beard: true },
    builder: { hair: '#c9a15e', skin: '#f2c9a3', iris: '#3a66a6', hairStyle: 'spiky', prop: 'pencil' },
    tester: { hair: '#1c1410', skin: '#c99670', iris: '#3a2a1a', hairStyle: 'side', prop: 'clipboard' },
  },
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Department, rank, name, role and colours for an agent. */
export function agentMeta(id, a = {}) {
  let dept = a?.dept, rank = a?.rank;
  const m = /^(voice|chat)-(scott|bob|tom)$/.exec(id);
  if (m) {
    dept ||= m[1];
    rank ||= LEGACY[m[2]];
  } else if (LEGACY[id]) {
    dept ||= 'voice';
    rank ||= LEGACY[id];
  }
  dept = DEPTS[dept] ? dept : 'voice';
  rank = FIRST[rank] ? rank : 'builder';
  const legacy = !!LEGACY[id] && !m;
  // the name comes from the data; no department in it (a small Voice/Chat tag shows that)
  const name = String(a?.name || NAMES[dept][rank]).replace(/\s+(Voice|Chat)$/i, '');
  const first = name.split(/\s+/)[0];
  return {
    id,
    dept,
    rank,
    name,
    first,
    role: a?.role || cap(rank),
    base: BASE[rank],
    suit: SUITS[dept][rank],
    // two letters, so Scott/Simon, Bob/Bruno and Tom/Theo stay apart
    initials: legacy ? first[0] : first.slice(0, 2),
    legacy,
  };
}

/** The character look for makeCharacter(). */
export function agentLook(meta) {
  return { outfit: 'suit', suit: meta.suit, tie: TIES[meta.dept][meta.rank], ...FACES[meta.dept][meta.rank] };
}

/** Agent ids in a stable order: Voice then Chat, supervisor → builder → tester. */
export function sortAgents(ids, agents = {}) {
  const key = (id) => {
    const m = agentMeta(id, agents[id]);
    return (m.dept === 'voice' ? 0 : 10) + RANKS.indexOf(m.rank);
  };
  return [...ids].sort((a, b) => key(a) - key(b) || a.localeCompare(b));
}
