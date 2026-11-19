/*
 * 结尾页：参考来源与致谢
 * ------------------------------------------------------------------
 * openCredits({ sites, onClose }) 打开一张满屏的“展览图录末页”，返回关闭函数。
 *  - “史料与图像”运行时汇总：展墙用到的 SRC，加上各调研包数据里所有带 url 的出处条目（按网址去重，并注明用在哪一件）。
 *  - 其余文案在 js/data/credits.js。
 * 入口：终场卡片、任务灯面板底部，以及网址参数 ?credits。
 */
import { EXHIBITS, SRC } from './data/exhibits.js';
import { CREDITS } from './data/credits.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const keyOf = url => url.replace(/^https?:\/\/(www\.|m\.)?/, '').replace(/\/+$/, '').toLowerCase();
const host = url => { try { return new URL(url).hostname.replace(/^(www\.|m\.)/, ''); } catch (e) { return ''; } };
const GROUPS = [
  { id: 'zju', name: '浙江大学刊文与通知', test: h => /(^|\.)zju\.edu\.cn$/.test(h) },
  { id: 'image', name: '图像档案', test: h => /wikimedia\.org$/.test(h) },
  { id: 'press', name: '报刊与网络', test: () => true }
];

function collect(sites) {
  const map = new Map();
  const add = (s, where) => {
    if (!s.url || !/^https?:/.test(s.url)) return;
    const k = keyOf(s.url);
    const e = map.get(k) || { url: s.url, title: '', byline: '', note: '', where: new Set(), fromSrc: true };
    // 调研包里的规范题名优先；SRC 的 name 是“作者《题》，发布方，年”的合写，只在没有别的题名时用
    if (s.title && (!e.title || (e.fromSrc && !s.fromSrc))) { e.title = s.title; e.fromSrc = !!s.fromSrc; }
    if (s.byline && !e.byline) e.byline = s.byline;
    if (s.note && !e.note) e.note = s.note;
    e.where.add(where); map.set(k, e);
  };
  // Commons 文件页：题名取文件名；署名只保留指向原书的那种（含《》），否则写“文件页”
  const tidyCommons = e => {
    const m = decodeURIComponent(e.url).match(/\/wiki\/(?:File|文件):(.+?)(?:\.\w{3,4})?$/);
    if (!m) return e;
    e.title = m[1].replace(/_/g, ' ');
    if (!/《/.test(e.byline)) e.byline = 'Wikimedia Commons 文件页';
    return e;
  };
  for (const ex of EXHIBITS) {
    const s = SRC[ex.source]; if (!s) continue;
    add({ url: s.url, title: s.name, note: /公有领域|CC/.test(s.license) ? s.license : '', fromSrc: true }, '展墙');
  }
  const seen = new WeakSet();
  const walk = (o, where, depth) => {
    if (!o || typeof o !== 'object' || seen.has(o) || depth > 7) return; seen.add(o);
    if (typeof o.url === 'string' && (o.title || o.name) && (o.byline || o.publisher || o.kind)) {
      add({ url: o.url, title: o.title || o.name, byline: o.byline || o.publisher }, where);
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, where, depth + 1);
  };
  for (const [key, S] of Object.entries(sites || {})) {
    const ex = EXHIBITS.find(e => e.investigation === key);
    walk(S.data, ex ? ex.title : key, 0);   // 用调研前的题名，未完成时打开也不剧透
  }
  const list = [...map.values()].map(tidyCommons);
  return GROUPS.map(g => {
    const items = list.filter(e => !e.done && g.test(host(e.url)));
    items.forEach(e => (e.done = true));
    return { ...g, items };
  }).filter(g => g.items.length);
}


export function openCredits({ sites, onClose } = {}) {
  const C = CREDITS, groups = collect(sites);
  const before = document.activeElement;
  const el = document.createElement('section');
  el.className = 'credits'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', C.title);
  let n = 0;
  const sec = (title, body) => `<section class="cr-sec"><h3><b>${++n}</b>${esc(title)}</h3>${body}</section>`;
  const sources = groups.map(g => `<h4>${esc(g.name)}</h4><ol class="cr-src">${g.items.map(e => `
      <li><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer"><cite>${esc(e.title)}</cite></a>
        ${e.byline ? `<span class="cr-by">${esc(e.byline)}</span>` : ''}
        <span class="cr-meta">${esc(host(e.url))}${e.note ? ' · ' + esc(e.note) : ''} · 用于 ${[...e.where].map(esc).join('、')}</span></li>`).join('')}</ol>`).join('');
  const people = [C.advisor, ...(C.team || [])].filter(Boolean);
  el.innerHTML = `
    <div class="cr-scroll">
      <article class="cr-page">
        <header class="cr-head">
          <p class="cr-k">${esc(C.kicker)}</p>
          <h2>${esc(C.title)}</h2>
          ${C.lead.map(p => `<p class="cr-lead">${esc(p)}</p>`).join('')}
        </header>
        ${sec('史料与图像', `<p class="cr-note">检索日期 2026 年 11 月。展签原句与出处的逐条对照，见项目的摘录核对表。</p>${sources}`)}
        ${sec(C.open.heading, `<p class="cr-note">${esc(C.open.note)}</p><dl class="cr-open">${C.open.items.map(i => `<dt>${esc(i.piece)}</dt><dd>${esc(i.text)}</dd>`).join('')}</dl>`)}
        ${sec(C.materials.heading, `<table class="cr-mat"><tbody>${C.materials.items.map(m => `<tr><th scope="row">${esc(m.name)}</th><td>${esc(m.use)}</td><td>${esc(m.license)}</td></tr>`).join('')}</tbody></table>`)}
        ${sec(C.thanks.heading, C.thanks.lines.map(l => `<p class="cr-thanks">${esc(l)}</p>`).join('') + (people.length ? `<p class="cr-people">${people.map(esc).join('<br>')}</p>` : ''))}
        <footer class="cr-foot"><p>${esc(C.colophon)}</p><p class="cr-sign">展览部</p></footer>
      </article>
    </div>
    <button type="button" class="cr-close">返回展厅</button>`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const btn = el.querySelector('.cr-close');
  btn.focus({ preventScroll: true });
  const key = e => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', key);
  let closed = false;
  function close() {
    if (closed) return; closed = true;
    removeEventListener('keydown', key);
    el.classList.remove('show');
    setTimeout(() => el.remove(), 500);
    before?.focus?.({ preventScroll: true });
    onClose && onClose();
  }
  btn.onclick = close;
  return close;
}
