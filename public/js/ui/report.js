// Desk documents as proper reports: Markdown body, key facts as number cards,
// evidence you can hear and see (audio players, images, video, files) and the
// Yes/No questions the agent needs answered. Used on the desk, in decisions and
// beside the meeting chat. Everything is escaped first; only a small, safe
// subset of Markdown becomes HTML.
import { fmt } from '../core/time.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (u) => (/^https:\/\//i.test(String(u || '')) ? esc(u) : '');

function inline(s) {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  t = t.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  t = t.replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, (m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  return t;
}

/** A small, safe Markdown renderer: headings, lists, tables, quotes, bold/italic/code/links, paragraphs. */
export function markdown(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  let html = '', i = 0;
  const isTable = (l) => /^\s*\|.*\|\s*$/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { const n = Math.min(4, m[1].length + 1); html += `<h${n}>${inline(m[2])}</h${n}>`; i++; continue; }
    if (/^\s*(---|\*\*\*)\s*$/.test(l)) { html += '<hr>'; i++; continue; }
    if (isTable(l)) {
      const rows = [];
      while (i < lines.length && isTable(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const sep = rows[1] && /^\s*\|?\s*:?-{2,}/.test(rows[1]);
      const head = sep ? cells(rows[0]) : null;
      const body = (sep ? rows.slice(2) : rows).map(cells);
      html += `<div class="md-table"><table>${head ? `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
      const ordered = /^\s*\d/.test(l);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
      html += `<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`;
      continue;
    }
    if (/^>\s?/.test(l)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      html += `<blockquote>${inline(q.join(' '))}</blockquote>`;
      continue;
    }
    const p = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*([-*+]|\d+[.)])\s|>|\s*\|)/.test(lines[i])) p.push(lines[i++]);
    if (!p.length) p.push(lines[i++]);
    html += `<p>${inline(p.join(' '))}</p>`;
  }
  return html;
}

const size = (n) => (!n ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** The evidence block for a document or decision (facts, body, attachments, asks). */
export function report(d, { body = true } = {}) {
  let html = '';
  if (d.facts?.length) html += `<div class="facts">${d.facts.map((f) => `<div class="fact"><div class="fact-v">${esc(f.value)}</div><div class="fact-l">${esc(f.label)}</div></div>`).join('')}</div>`;
  const text = d.body ?? d.detail ?? '';
  if (body && text) html += d.format === 'markdown' ? `<div class="doc md">${markdown(text)}</div>` : `<div class="doc">${esc(text)}</div>`;
  const att = d.attachments || [];
  if (att.length) {
    const audio = att.filter((a) => a.kind === 'audio' && safeUrl(a.url));
    const rest = att.filter((a) => !audio.includes(a));
    html += '<div class="evidence">';
    if (audio.length) html += `<div class="ev-audio ${audio.length === 2 ? 'pair' : ''}">${audio.map((a) => `<div class="ev-card"><div class="ev-label">🔊 ${esc(a.label || a.name || 'Recording')}</div><audio controls preload="none" src="${safeUrl(a.url)}"></audio></div>`).join('')}</div>`;
    for (const a of rest) {
      const u = safeUrl(a.url);
      if (!u) continue;
      const label = esc(a.label || a.name || 'Attachment');
      if (a.kind === 'image') html += `<figure class="ev-img"><a href="${u}" target="_blank" rel="noopener noreferrer" title="Open full size"><img src="${u}" alt="${label}" loading="lazy"></a><figcaption>${label}</figcaption></figure>`;
      else if (a.kind === 'video') html += `<figure class="ev-vid"><video controls preload="none" src="${u}"></video><figcaption>${label}</figcaption></figure>`;
      else html += `<a class="ev-file" href="${u}" target="_blank" rel="noopener noreferrer"><span>${a.kind === 'pdf' ? 'PDF' : a.kind === 'page' ? 'Page' : 'File'}</span>${label}${a.size ? ` <i>${size(a.size)}</i>` : ''} <b>Open ↗</b></a>`;
    }
    html += '</div>';
  }
  if (d.asks?.length) {
    html += `<div class="asks">${d.asks.map((q) => {
      const a = q.answer;
      const done = a ? `<div class="ask-done ${a.verdict}">You said ${a.verdict === 'yes' ? 'Yes' : 'No'}${a.at ? ` · ${esc(fmt(typeof a.at === 'number' ? a.at : Date.parse(a.at), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }))}` : ''}</div>` : `<div class="ask-btns"><button class="btn approve" data-act="ask" data-id="${esc(d.id)}" data-ask="${esc(q.id)}" data-v="yes">Yes</button><button class="btn reject" data-act="ask" data-id="${esc(d.id)}" data-ask="${esc(q.id)}" data-v="no">No</button></div>`;
      return `<div class="ask"><div class="ask-q">${esc(q.q)}</div>${done}</div>`;
    }).join('')}</div>`;
  }
  return html;
}
