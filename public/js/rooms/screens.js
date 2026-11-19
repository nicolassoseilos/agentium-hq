// Desk screens: each agent's own screen shows who they are, what they are on
// and their live note (state.agents[id].note, step/of, task). Builders get the
// code they are writing underneath, testers their department's test run.
import { UI, rr, wrapText } from './common.js';
import { agentMeta, SUITS } from '../scene/roster.js';

const ago = (at) => {
  if (!at) return '';
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
};

/**
 * Draw an agent's desk screen. `a` is state.agents[id] (or null when the desk
 * is free), `extra(g, x, y, w, h, k)` can draw more underneath the note.
 */
export function drawAgentNote(s, id, a, t, { extra = null, extraSig = '' } = {}) {
  const blink = Math.floor(t * 2) % 2;
  const sig = id ? `${id}|${a?.status}|${a?.activity}|${a?.note}|${a?.step}|${a?.of}|${a?.task}|${Math.floor((Date.now() - (a?.at || 0)) / 60000)}|${extraSig}|${a?.status === 'working' ? blink : ''}` : 'free';
  if (s.userData === sig) return;
  s.userData = sig;
  const g = s.ctx, w = s.w, h = s.h;
  const k = w / 1024;
  g.fillStyle = UI.bg;
  g.fillRect(0, 0, w, h);
  if (!id) {
    g.fillStyle = '#3a4656';
    g.font = `500 ${30 * k}px Manrope, sans-serif`;
    g.textAlign = 'center';
    g.fillText('AGENTIUM', w / 2, h / 2 + 10 * k);
    g.textAlign = 'left';
    s.tex.needsUpdate = true;
    return;
  }
  const m = agentMeta(id, a || {});
  const pad = 28 * k;
  // header: suit-coloured badge, name, department and role, status
  g.fillStyle = m.suit;
  g.beginPath();
  g.arc(pad + 26 * k, pad + 26 * k, 26 * k, 0, 7);
  g.fill();
  g.fillStyle = '#fff';
  g.font = `700 ${20 * k}px Manrope, sans-serif`;
  g.textAlign = 'center';
  g.fillText(m.initials, pad + 26 * k, pad + 33 * k);
  g.textAlign = 'left';
  g.fillStyle = UI.text;
  g.font = `600 ${30 * k}px Manrope, sans-serif`;
  g.fillText(m.name, pad + 66 * k, pad + 24 * k);
  g.fillStyle = UI.dim;
  g.font = `500 ${19 * k}px Manrope, sans-serif`;
  g.fillText(`${m.dept === 'voice' ? 'Voice' : 'Chat'} department · ${m.role}`, pad + 66 * k, pad + 52 * k);
  const working = a?.status === 'working';
  g.fillStyle = working ? UI.amber : UI.dim;
  g.beginPath();
  g.arc(w - pad - 8 * k, pad + 16 * k, 8 * k, 0, 7);
  g.fill();
  g.font = `600 ${17 * k}px Manrope, sans-serif`;
  g.textAlign = 'right';
  g.fillText(working ? 'WORKING' : 'IDLE', w - pad - 24 * k, pad + 22 * k);
  g.fillStyle = UI.dim;
  g.font = `500 ${15 * k}px Manrope, sans-serif`;
  g.fillText(ago(a?.at), w - pad, pad + 50 * k);
  g.textAlign = 'left';
  // task + activity
  let y = pad + 98 * k;
  if (a?.task) {
    g.fillStyle = UI.gold;
    g.font = `600 ${15 * k}px Manrope, sans-serif`;
    if ('letterSpacing' in g) g.letterSpacing = '0.2em';
    g.fillText('TASK', pad, y);
    if ('letterSpacing' in g) g.letterSpacing = '0em';
    g.fillStyle = UI.text;
    g.font = `500 ${21 * k}px Manrope, sans-serif`;
    g.fillText(String(a.task).slice(0, 70), pad + 64 * k, y);
    y += 36 * k;
  }
  // the live note
  const noteH = extra ? h * 0.3 : h - y - pad - 40 * k;
  rr(g, pad, y, w - pad * 2, noteH, 12 * k);
  g.fillStyle = UI.panel;
  g.fill();
  g.fillStyle = UI.text;
  g.font = `500 ${22 * k}px Manrope, sans-serif`;
  const note = a?.note || (a?.activity ? a.activity.charAt(0).toUpperCase() + a.activity.slice(1) : 'No note yet.');
  const lines = Math.max(1, Math.floor((noteH - 24 * k) / (30 * k)));
  wrapText(g, note, pad + 18 * k, y + 36 * k, w - pad * 2 - 36 * k, 30 * k, lines);
  if (working && blink) g.fillRect(pad + 18 * k, y + noteH - 22 * k, 12 * k, 3 * k);
  y += noteH + 16 * k;
  // step k of n
  if (a?.of) {
    const pw = w - pad * 2 - 140 * k;
    rr(g, pad, y, pw, 10 * k, 5 * k);
    g.fillStyle = '#1b2430';
    g.fill();
    rr(g, pad, y, pw * Math.min(1, (a.step || 0) / a.of), 10 * k, 5 * k);
    g.fillStyle = m.dept === 'voice' ? '#6f9be0' : '#d2a46a';
    g.fill();
    g.fillStyle = UI.dim;
    g.font = `600 ${16 * k}px Manrope, sans-serif`;
    g.fillText(`Step ${a.step || 0} of ${a.of}`, pad + pw + 16 * k, y + 10 * k);
    y += 30 * k;
  }
  if (extra) extra(g, pad, y, w - pad * 2, h - y - pad, k);
  s.tex.needsUpdate = true;
}

export { SUITS };
