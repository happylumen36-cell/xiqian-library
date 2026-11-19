/*
 * 总控 v3：海报入口 → 灯光由左到右亮起 → 展览部的任务信 → 在墙上找暗着的展品
 *        → 调研现场 → 档案台 → 回到展厅，亲手点亮。
 * 一个 WebGL 渲染器在“展厅”与“现场”之间切换；文字界面都是叠在上面的 HTML。
 * 进度存在 localStorage（读写都包了 try/catch）。网址参数：?fresh 从头开始，?alllit 预览全部点亮。
 */
import * as THREE from 'three';
import { HALL, CHAPTERS, EXHIBITS, SRC, REVEALED } from './data/exhibits.js';
import { GUIDE } from './data/guide.js';
import { CASE as YISHAN } from './data/yishan-case.js';
import { createHall } from './hall.js';
import { createPoster } from './poster.js';
import { createSite as createYishan } from './sites/yishan.js';
import { createArchive } from './archive.js';
import { PIECE as BOMBS } from './pieces/bombs/index.js';
import { PIECE as JIANGGONGCI } from './pieces/jianggongci/index.js';
import { PIECE as LONGQUAN } from './pieces/longquan/index.js';
import { brushWrite, inkText } from './brush.js';
import { createNarrator } from './narration.js';
import { createFinale } from './finale.js';
import { loading } from './loading.js';
import { openCredits } from './credits.js';
import { createSound } from './music.js';

// A package enters the registry only after its integration handoff is marked ready.
const SITES = {
  yishan: { createSite: createYishan, data: YISHAN },
  [BOMBS.key]: BOMBS,
  [JIANGGONGCI.key]: JIANGGONGCI,
  [LONGQUAN.key]: LONGQUAN
};
const KEY = 'xiqian-museum-v3';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const q = new URLSearchParams(location.search);
loading.set(.35, '正在取出展品……');
const narrator = createNarrator();
const sound = createSound({ narrator });
// 各模式的底乐；现场按调研包键名取 site-<键>
const BGM = { loading: 'cover-theme', entry: 'cover-theme', 'hall-intro': 'hall-bed', 'hall-panorama': 'hall-bed', hall: 'hall-bed', ceremony: 'hall-bed', archive: 'archive' };
let siteKey = null;
let finale;

/* ---------- 进度 ---------- */
let progress = { done: {}, briefed: false };
try { progress = { ...progress, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) {}
if (q.has('fresh')) progress = { done: {}, briefed: false };
const previewOnly = q.has('alllit');
progress.done = Object.fromEntries(Object.entries(progress.done || {}).filter(([id, record]) =>
  EXHIBITS.some(ex => ex.id === id && ex.status === 'dark') && typeof record?.text === 'string'
).map(([id, record]) => [id, { ...record, notes: Array.isArray(record.notes) ? record.notes : [] }]));
// Older saved labels retain the player's own choice of time and place.
const savedLabel = progress.done?.['yishan-photo'];
if (savedLabel) {
  for (const field of ['text', 'draft']) {
    if (typeof savedLabel[field] === 'string') savedLabel[field] = savedLabel[field].replace(/四(?:个)?人在/, '四位教授在');
  }
  const fixed = YISHAN.archive.fixedNote;
  savedLabel.notes ??= [];
  if (!savedLabel.notes.some(n => n.includes('教授') && n.includes('甲③'))) {
    savedLabel.notes.push(`甲③ “${fixed.word}”据韩松涛（2017）：“${fixed.quote}”。`);
  }
}
const save = () => { if (!previewOnly) try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) {} };
const statusOf = id => { const ex = EXHIBITS.find(e => e.id === id); return progress.done[id] ? 'done' : ex.status; };
const DARK = EXHIBITS.filter(e => e.status === 'dark');
const litCount = () => DARK.filter(e => progress.done[e.id]).length;
const ready = ex => !!SITES[ex.investigation];
const nextTask = () => DARK.find(ex => ready(ex) && !progress.done[ex.id]);
const remainingHint = () => GUIDE.hall.afterLight(DARK.length - litCount(), nextTask()?.title);

/* ---------- 渲染器 ---------- */
const mobile = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.6 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('stage').appendChild(renderer.domElement);

let view = null, hall = null, site = null, archive = null, mode = 'entry';
const clock = new THREE.Clock();
function resize() { renderer.setSize(innerWidth, innerHeight); view && view.resize(innerWidth, innerHeight); }
addEventListener('resize', resize);
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (!view || mode === 'archive') return;
  view.update(dt, t);
  view.render ? view.render(dt) : renderer.render(view.scene, view.camera);
  if (mode === 'hall') placeMarkers();
});
function setMode(m) {
  mode = m; document.body.dataset.mode = m;
  if (m === 'site') sound.scene('site-' + siteKey); else if (BGM[m]) sound.scene(BGM[m]);
  if (hall) hall.input = m === 'hall';
  if (m === 'hall' || m === 'ceremony') $('tracker').before(sound.controls);
  else if (sound.controls.parentElement !== document.body) document.body.append(sound.controls);
}
function fade(fn, ms = 700) {
  const f = $('fade'); f.classList.add('on');
  return new Promise(r => setTimeout(async () => { await fn(); requestAnimationFrame(() => f.classList.remove('on')); r(); }, ms));
}

/* ---------- 便签：展览部的手写提示 ---------- */
let noteTimer = 0;
function note(text, { ms = 6500, at = null } = {}) {
  const n = $('note'); clearTimeout(noteTimer);
  n.classList.remove('show'); void n.offsetWidth;
  n.innerHTML = `<span class="pin"></span><p></p>`;
  inkText(n.querySelector('p'), text, { step: 28 });
  n.classList.toggle('pointing', !!at);
  n.classList.add('show');
  if (ms) noteTimer = setTimeout(() => n.classList.remove('show'), ms);
}

/* ---------- 启动 ---------- */
async function boot() {
  try { await Promise.all(['400 40px "Brush"', '400 40px "Hand"', '400 40px "Print"', '600 40px "Exhibit Serif"', '400 40px "Exhibit Serif"', '400 40px "Draft Kai"'].map(f => document.fonts.load(f, '一路相随图书馆'))); } catch (e) {}
  loading.set(.8, '正在挂上照片……');
  setMode('entry');
  const cover = $('entry');
  const poster = createPoster(cover, HALL, { subtitle: narrator.subtitle, onEnter: () => enter(poster) });
  const posterReady = poster.start();
  loading.done();
  const viewingPoster = () => mode === 'entry' && !cover.classList.contains('leaving') && !cover.querySelector('dialog[open]');
  let coverGesture = 0;
  // A first touch grants audio playback when the tap completes.
  cover.addEventListener('click', async event => {
    const gesture = ++coverGesture;
    narrator.unlock();
    const control = event.target.closest('button, a, dialog');
    if (control) {
      if (control.matches('.pz-enter, .atlas-open')) narrator.stop();
      return;
    }
    await posterReady;
    if (gesture === coverGesture) narrator.play('poster', { whileVisible: viewingPoster });
  }, { capture: true });
  // 海报播放时在后台搭好展厅；推门按钮底边的细光随贴图加载走满
  THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => loading.hall(loaded / total);
  hall = await createHall({ renderer, exhibits: EXHIBITS, chapters: CHAPTERS, sources: SRC, status: statusOf, revealed: REVEALED, labelFor: id => progress.done[id] });
  finale = createFinale({ hall, arch: hall.arch });
  hall.onSelect = ex => { closeTaskList(); showCard(ex); };
  hall.onEmpty = () => { closeTaskList(); hideCard(); };
  hall.onPan = i => markChapter(i);
  view = hall; resize();
  buildHud();
  THREE.DefaultLoadingManager.onProgress = () => {};
  loading.hall(1);
  poster.enableEntry();
  document.body.classList.add('ready');
  if (q.has('skip')) enter(poster);
  if (q.has('credits')) showCredits();
}
function showCredits() {
  narrator.stop(); closeTaskList();
  return openCredits({ sites: SITES });
}

async function enter(poster) {
  if (mode !== 'entry') return;
  const firstVisit = !progress.briefed;
  let entranceNarration;
  narrator.unlock(); narrator.stop();
  sound.sfx('door');
  finale.entrance();
  $('entry').querySelector('dialog[open]')?.close();
  $('entry').inert = true;
  setMode('hall-intro');
  await wait(progress.briefed ? 240 : 850); poster.dispose();
  const skip = document.createElement('button');
  skip.className = 'skip-wave'; skip.textContent = '跳过亮灯 ›';
  document.body.append(skip);
  const fastForward = event => {
    if (event.target.closest?.('.narration-toggle, .narration-sub')) return;
    narrator.stop(); hall.instantOn();
  };
  window.addEventListener('click', fastForward, true);
  window.addEventListener('keydown', fastForward, true);
  const lighting = hall.lightsOn(progress.briefed);
  const switched = [], clicks = setInterval(() => {   // 每一章洗墙灯亮起时“咔”一声；快进时只响一声
    const fresh = hall.entrance.washes.map((v, i) => v > 0.02 && !switched[i] ? (switched[i] = true) : false).filter(Boolean).length;
    if (fresh) sound.sfx('switch', { gain: fresh > 1 ? 0.8 : 0.55 });
  }, 50);
  lighting.then(() => clearInterval(clicks));
  if (firstVisit && !previewOnly) entranceNarration = narrator.play('enter');
  await lighting;
  window.removeEventListener('click',fastForward,true); window.removeEventListener('keydown',fastForward,true);
  if (q.has('alllit')) { hall.allLitPreview(); }
  setMode('hall-panorama');
  const caption = document.createElement('div');
  caption.className = 'panorama-caption';
  const darkCount = hall.darkItems().length;
  caption.innerHTML = `<strong>展厅全景</strong><small>${CHAPTERS.length} 章 · ${hall.items.length-darkCount} 件已布展 · ${darkCount} 件待查</small>`;
  document.body.append(caption);
  skip.textContent = '继续 ›';
  skip.onclick = () => { narrator.stop(); hall.skipPanorama(); };
  await hall.showPanorama(progress.briefed);
  // Let the historical reader finish the place names before the letter starts.
  if (entranceNarration) await Promise.race([entranceNarration, wait(5000)]);
  skip.remove(); caption.remove();
  if (!progress.briefed && !q.has('alllit')) await showBrief();
  if (previewOnly) { await openingNight(true); return; }
  progress.briefed = true; save();
  hall.leavePanorama();
  setMode('hall');
  const target = nextTask();
  if (target) {
    hall.goChapter(CHAPTERS.findIndex(c => c.id === target.chapter)); markChapter(CHAPTERS.findIndex(c => c.id === target.chapter));
    await wait(1400);
    if (mode === 'hall' && $('taskList').hidden && !$('card').classList.contains('show')) {
      note(GUIDE.hall.afterBrief(DARK.length-litCount(),target.title), { ms: 9000 });
      if (firstVisit) narrator.play('hall', { whileVisible: () => mode === 'hall' && $('taskList').hidden && !$('card').classList.contains('show') });
    }
  } else note(litCount() === DARK.length ? GUIDE.hall.allLit : remainingHint(), { ms: 9000 });
}

/* ---------- 任务信 ---------- */
async function showBrief() {
  const b = $('brief'), B = HALL.brief;
  b.innerHTML = `<article class="letter">
      <p class="from">${esc(B.from)}</p>
      <div class="body">${B.lines.map(() => '<p></p>').join('')}</div>
      <p class="sign"></p>
      <div class="lamps">${DARK.map(() => '<i></i>').join('')}<span>待点亮 ${DARK.length} 件</span></div>
      <button class="btn ink" type="button">${esc(B.accept)}</button>
    </article>`;
  b.classList.add('show');
  sound.sfx('paper');
  narrator.play('brief', { whileVisible: () => b.classList.contains('show') });
  const ps = b.querySelectorAll('.body p');
  for (let i = 0; i < ps.length; i++) await inkText(ps[i], B.lines[i], { step: 40 });
  sound.sfx('brush', { gain: 0.8 });
  await brushWrite(b.querySelector('.sign'), B.sign, { speed: 1.6, rough: 0.8 });
  b.querySelector('.letter').classList.add('done');
  await new Promise(r => b.querySelector('button').addEventListener('click', r, { once: true }));
  narrator.stop();
  b.classList.remove('show');
  await wait(500);
}

/* ---------- HUD ---------- */
function buildHud() {
  $('hudTitle').textContent = HALL.title;
  $('chapters').innerHTML = CHAPTERS.map((c, i) => `<button type="button" data-i="${i}"><b>${esc(c.name)}</b><small>${esc(c.years)}</small></button>`).join('') + `<button type="button" class="all" data-all>全景</button>`;
  $('chapters').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    closeTaskList(); hideCard();
    if (b.dataset.all != null) { hall.overview(); markChapter(-1); } else { hall.goChapter(+b.dataset.i); markChapter(+b.dataset.i); }
  });
  $('markers').innerHTML = DARK.map(e => `<button class="marker" type="button" data-id="${e.id}" aria-label="${esc(e.title)} · ${esc(e.darkHint)}"><i></i><span>${ready(e) ? '可调研' : '待调研'}</span></button>`).join('');
  $('markers').addEventListener('click', e => { const b = e.target.closest('.marker'); if (!b) return; const ex = EXHIBITS.find(x => x.id === b.dataset.id); closeTaskList(); focusExhibit(ex); });
  $('tracker').addEventListener('click', () => {
    if (mode !== 'hall') return;
    if (!$('taskList').hidden) { closeTaskList(); return; }
    narrator.stop();
    hideCard(); $('note').classList.remove('show');
    const list = $('taskList');
    list.innerHTML = '<h2>展品任务灯</h2>' + DARK.map(ex => {
      const done = !!progress.done[ex.id] || previewOnly;
      const status = done ? (previewOnly ? '已亮 · 预览' : '展签已定稿') : ex.darkHint;
      return `<button type="button" data-task="${ex.id}" data-state="${done?'done':ready(ex)?'ready':'pending'}"><i></i><span>${esc(done ? REVEALED[ex.id]?.title || ex.title : ex.title)}</span><small>${esc(status)}</small></button>`;
    }).join('') + '<button type="button" class="tl-credits" data-credits>参考来源与致谢</button>';
    list.hidden = false; $('tracker').setAttribute('aria-expanded','true');
    hall.unfocus(); hall.showPanorama(true);
  });
  $('taskList').onclick = event => {
    if (event.target.closest('[data-credits]')) { showCredits(); return; }
    const b = event.target.closest('[data-task]'); if (!b) return;
    closeTaskList(); focusExhibit(DARK.find(ex => ex.id === b.dataset.task));
  };
  document.addEventListener('keydown',event=>{
    if (event.key === 'Escape' && !$('taskList').hidden) {closeTaskList(); $('tracker').focus();}
  });
  renderTracker();
}
function focusExhibit(ex) {
  hall.focus(ex.id); markChapter(CHAPTERS.findIndex(ch => ch.id === ex.chapter)); showCard(ex);
}
function closeTaskList() {
  if ($('taskList').hidden) return;
  $('taskList').hidden=true; $('tracker').setAttribute('aria-expanded','false'); hall.leavePanorama();
}
function renderTracker(flash) {
  const n = previewOnly ? DARK.length : litCount();
  $('tracker').setAttribute('aria-label',`展品任务灯，已点亮 ${n} 件，共 ${DARK.length} 件`);
  $('tracker').innerHTML = `<span class="t-k">${n===DARK.length?'展品已点亮':'开幕前 · 待点亮'}</span><span class="t-lamps">${DARK.map(e => `<i class="${progress.done[e.id] || previewOnly ? 'on' : ''} ${flash === e.id ? 'flash' : ''}" title="${esc(e.title)}"></i>`).join('')}</span><span class="t-n"><b>${n}</b>/${DARK.length}</span>`;
}
function markChapter(i) { $('chapters').querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', j === i)); }
function placeMarkers() {
  const visible = [];
  for (const b of $('markers').children) {
    const id = b.dataset.id, p = hall.screenPos(id);
    const show = !previewOnly && statusOf(id) === 'dark' && p?.on && hall.focused !== id;
    b.classList.toggle('ready', ready(EXHIBITS.find(e => e.id === id)));
    b.classList.toggle('show', !!show);
    if (show) visible.push({b,p});
  }
  // Oblique portrait views bring nearby frames together. Keep the controls
  // separate and leave a fine leader back to any displaced wall marker.
  const occupied = $('taskList').hidden ? [] : [$('taskList').getBoundingClientRect()];
  for (const row of visible) {
    row.width=row.b.offsetWidth; row.height=row.b.offsetHeight;
  }
  for (const {b,p,width,height} of visible) {
    const x=Math.max(width/2+3,Math.min(innerWidth-width/2-3,p.x));
    const left=x-width/2, right=left+width, min=54+height, max=innerHeight-76;
    const preferred=Math.max(min,Math.min(max,p.y));
    const neighbors=occupied.filter(r=>left<r.right+6 && right>r.left-6);
    const positions=[preferred,...neighbors.map(r=>r.top-6).sort((a,b)=>b-a),
      ...neighbors.map(r=>r.bottom+height+6).sort((a,b)=>a-b)];
    const y=positions.find(v=>v>=min && v<=max && neighbors.every(r=>v<=r.top-6 || v-height>=r.bottom+6)) ?? preferred;
    occupied.push({left,right,top:y-height,bottom:y});
    b.style.left=x+'px'; b.style.top=y+'px';
    const stem=p.y>y ? p.y-y : Math.max(0,y-height-p.y);
    b.dataset.leader=stem>2 ? (p.y>y?'down':'up') : '';
    b.style.setProperty('--marker-stem',stem+'px');
  }
}

/* ---------- 展品卡 ---------- */
function showCard(ex) {
  if (mode === 'hall') narrator.stop();
  const card = $('card'), st = statusOf(ex.id), src = SRC[ex.source], done = progress.done[ex.id], R = REVEALED[ex.id];
  const info = (st === 'done' || previewOnly) && R ? { ...ex, ...R } : ex;
  let html = `<p class="c-k">${esc(CHAPTERS.find(c => c.id === ex.chapter).name)} · ${esc(info.date)}</p><h2>${esc(info.title)}</h2>`;
  if (previewOnly && ex.status === 'dark' && !done) {
    html += `<p class="c-cap">${esc(info.caption)}</p><p class="c-src">全亮预览</p>`;
  } else if (st === 'done') {
    html += `<p class="c-cap">${esc(info.caption)}</p>
      <div class="c-label"><span class="c-lk">学生策展人的展签</span><p>${esc(done.text)}</p><ul>${done.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>
      <p class="c-src">${esc(src.name)} · ${esc(src.license)}</p>
      <div class="btn-row"><button class="btn ghost" data-act="redo" type="button">重新调研</button></div>`;
  } else if (st === 'lit') {
    html += (ex.quote ? `<blockquote>“${esc(ex.quote.replace(/。$/, ''))}”</blockquote>` : '') + `<p class="c-cap">${esc(ex.caption)}</p>
      <p class="c-src">出处：<a href="${src.url}" target="_blank" rel="noopener">${esc(src.name)}</a> · ${esc(src.license)}</p>`;
  } else {
    html += `<p class="c-cap dim">${esc(ex.caption)}</p>` + (ready(ex)
      ? `<p class="c-steps">${(SITES[ex.investigation].data.steps || GUIDE.site.pieceSteps[ex.investigation] || GUIDE.site.steps).map((s, i) => `<span><b>${i + 1}</b>${esc(s)}</span>`).join('<i>→</i>')}</p><div class="btn-row"><button class="btn red big" data-act="go" type="button">开始调研</button></div>`
      : `<p class="c-src">${esc(ex.darkHint)}</p>`);
  }
  card.innerHTML = html; card.dataset.state = previewOnly && R ? 'done' : st; card.dataset.exhibit = ex.id; card.classList.add('show');
  card.querySelector('[data-act="go"]')?.addEventListener('click', () => openSite(ex.investigation, ex.id));
  card.querySelector('[data-act="redo"]')?.addEventListener('click', () => openSite(ex.investigation, ex.id));
  if (!previewOnly && st === 'dark' && !ready(ex)) note(GUIDE.hall.pending, { ms: 5000 });
}
function hideCard() { $('card').classList.remove('show'); }

/* ---------- 调研现场 ---------- */
function openSite(key, exId) {
  const S = SITES[key];
  if (!S || mode !== 'hall') return;
  narrator.stop();
  closeTaskList(); hideCard(); $('note').classList.remove('show'); setMode('transition');
  fade(() => {
    siteKey = key;
    setMode('site');
    site = S.createSite({ renderer, ui: $('siteUI'), data: S.data, guide: GUIDE.site,
      narrate: narrator.play, sfx: sound.sfx, onExit: () => closeSite(), onArchive: field => openArchive(S, exId, field) });
    view = site; resize();
  }, 800);
}
function closeSite(after) {
  narrator.stop();
  setMode('transition');
  return fade(async () => {
    archive?.dispose(); archive = null; site?.dispose(); site = null;
    setMode('hall'); view = hall; resize();
    after && after();
  }, 800);
}

/* ---------- 档案台 → 点亮 ---------- */
function openArchive(S, exId, field) {
  if (mode !== 'site') return;
  narrator.stop();
  setMode('archive');
  sound.sfx('paper');
  const makeArchive = S.createArchive || createArchive;
  archive = makeArchive($('archive'), S.data.archive, {
    photo: S.data.photo, field, sfx: sound.sfx,
    readSource: options => narrator.play(S.data.id, { ...options, cue: 'source', once: false }),
    onBack: () => { narrator.stop(); archive.dispose(); archive = null; setMode('site'); },
    onDone: result => {
      if (mode !== 'archive') return;
      const newlyLit = !progress.done[exId];
      progress.done[exId] = result; save();
      closeSite(() => ceremony(exId, result, newlyLit));
    }
  });
  const desk = $('archive');
  narrator.play('archive', { whileVisible: () => mode === 'archive' && desk.dataset.phase === 'draft' &&
    !desk.querySelector('dialog[open], .desk-reader:not([hidden])') });
}
async function ceremony(exId, result, newlyLit) {
  setMode('ceremony');
  hideCard();
  setTimeout(() => sound.sfx('switch'), 1300);          // lightUp 推近 1.3 秒后画灯亮起
  await hall.lightUp(exId, result);
  renderTracker(exId);
  const ov = $('ceremony'), R = REVEALED[exId];
  ov.innerHTML = `<div class="cer-card" data-exhibit="${esc(exId)}"><p class="cer-k">${newlyLit ? '第 '+litCount()+' 盏灯' : '展签已更新'} · ${esc(R?.title || '')}</p><h3 class="cer-title"></h3><p class="cer-label"></p><p class="cer-sign">学生策展人 拟</p></div>`;
  ov.classList.add('show');
  sound.sting('lit-sting');
  sound.sfx('brush', { gain: 0.8 });
  await brushWrite(ov.querySelector('.cer-title'), newlyLit ? '点亮' : '改签', { speed: 1.4, rough: 1.1 });
  const litSpeech = newlyLit && narrator.play('lit', { once: false, whileVisible: () => ov.classList.contains('show') });
  await inkText(ov.querySelector('.cer-label'), result.text, { step: 70 });
  ov.querySelector('.cer-card').classList.add('signed');
  sound.sfx('stamp');
  await Promise.all([wait(2400), litSpeech && Promise.race([litSpeech, wait(7500)])]);
  ov.classList.remove('show');
  if (newlyLit && litCount() === DARK.length) { await openingNight(false, exId); return; }
  setMode('hall');
  showCard(EXHIBITS.find(e => e.id === exId));
  note(litCount() === DARK.length ? GUIDE.hall.allLit : remainingHint(), { ms: 10000 });
}

async function openingNight(alreadyWide, lastId) {
  hideCard(); $('note').classList.remove('show'); setMode('finale');
  if (!alreadyWide) await hall.showPanorama(false);
  await finale.play();
  const ending = document.createElement('section'); ending.className = 'opening-night';
  ending.setAttribute('aria-label', GUIDE.hall.finaleTitle);
  ending.innerHTML = `<article><p class="night-k">${previewOnly ? '全亮预览 · ' : ''}四件展品已点亮</p>
    <div class="night-lamps" aria-label="四盏任务灯">${DARK.map(()=>'<i></i>').join('')}</div>
    <h2></h2><p class="night-sign"></p><button type="button" class="night-go" disabled>继续看展</button><button type="button" class="night-credits">参考来源与致谢</button></article>`;
  document.body.append(ending);
  const close = ending.querySelector('.night-go');
  ending.querySelector('.night-credits').onclick = () => openCredits({ sites: SITES, onClose: () => close.focus({ preventScroll: true }) });
  const dismissed = new Promise(resolve => close.onclick = resolve);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  ending.classList.add('lit');
  sound.sting('finale', { exclusive: true });
  narrator.play('finale', { once: false, whileVisible: () => ending.isConnected && mode === 'finale' });
  sound.sfx('brush', { gain: 0.8 });
  await brushWrite(ending.querySelector('h2'), GUIDE.hall.finaleTitle, {duration:1700});
  ending.querySelector('.night-sign').textContent = GUIDE.hall.signature;
  sound.sfx('stamp'); ending.classList.add('signed'); close.disabled=false; close.focus({preventScroll:true});
  await dismissed;
  finale.end(); narrator.stop(); sound.scene('hall-bed');
  ending.remove(); hall.leavePanorama(); setMode('hall');
  if (lastId) focusExhibit(DARK.find(ex=>ex.id===lastId));
  note(GUIDE.hall.allLit,{ms:6500});
}
window.__museum = { get site() { return site; }, get archive() { return archive; }, get hall() { return hall; }, progress, showCard, openSite, waitForNarration: narrator.waitFor };
boot();
