/*
 * 背景音乐与音效
 * ------------------------------------------------------------------
 * createSound({ narrator }) → { scene(id), sting(id, {exclusive}), sfx(name), button, muted, toggle() }
 *  - scene(id)：切换场景底乐（循环，2.5 秒交叉淡化）；id 为 null 时淡出。
 *  - sting(id)：一次性的乐句（lit-sting、finale）。exclusive 时先淡出底乐，乐句结束后不自动恢复，由调用方再调 scene()。
 *  - sfx(name)：door / switch / paper / brush / stamp。
 *  - 讲解播放时（narrator.subtitle 带 .playing 且讲解未静音），音乐自动压低约 9 dB。
 *  - “音乐 · 开/关”按钮跟在“讲解”按钮左侧，开关音乐与音效，偏好存 localStorage。
 *  - 浏览器要求手势后才能出声：首次有效点按或按键时解锁；之前请求的场景会在解锁后开始。
 * 用 Web Audio 的 AudioBuffer 循环，接缝无缝；内存里最多保留 3 段已解码的音乐。
 * 曲目清单在 assets/music/music.json，由 tools/make_music.py 生成。
 * ?sounddebug 在后台记录状态，?sounddebug=proof 才显示验收读数。
 */
const KEY = 'xiqian-music-muted';
const FADE = 2.5, DUCK = 0.35;

export function createSound({ narrator = null, base = 'assets/' } = {}) {
  const manifest = fetch(base + 'music/music.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({ tracks: {} }));
  let ctx = null, master = null, musicBus = null, duckGain = null, sfxBus = null, resuming = null;
  let muted = false, want = null, current = null, ducked = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (_) {}
  const decoded = new Map();           // id → Promise<AudioBuffer>（音乐，LRU）
  const lastRequest = new Map(), lastSound = new Map();
  let exclusiveNode = null, exclusiveVersion = 0, deferredFinale = null;
  const sfxBuf = new Map();            // name → Promise<AudioBuffer>

  /* —— 音频图：曲目 → 淡入淡出 → 压低 → 音乐总线 → 总输出；音效 → 音效总线 → 总输出 —— */
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.8;
    duckGain = ctx.createGain(); duckGain.gain.value = ducked ? DUCK : 1; duckGain.connect(musicBus); musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
    return ctx;
  }
  function syncScene() {
    if (ctx?.state !== 'running' || document.hidden) return;
    if (deferredFinale) {
      const id = deferredFinale;
      deferredFinale = null;
      api.sting(id, {exclusive:true});
    } else if ((current?.id ?? null) !== want) start(want);
  }
  function resume() {
    if (!resuming) resuming = ctx.resume().then(syncScene).catch(() => {}).finally(() => { resuming = null; });
    return resuming;
  }
  function unlock(event) {
    if (!event.isTrusted || document.hidden || (navigator.userActivation && !navigator.userActivation.isActive)) return;
    if (!ensure()) return;
    if (ctx.state === 'running') syncScene();
    else resume();
  }
  for (const event of ['pointerdown','click','keydown']) addEventListener(event, unlock, {capture:true});
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else resume();
  });

  async function load(id) {
    if (decoded.has(id)) { const p = decoded.get(id); decoded.delete(id); decoded.set(id, p); return p; }
    const m = await manifest, t = m.tracks?.[id]; if (!t) return null;
    const p = fetch(base + 'music/' + t.file).then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej))).catch(() => null);
    decoded.set(id, p);
    while (decoded.size > 3) decoded.delete(decoded.keys().next().value);
    return p;
  }

  function fadeOut(node, sec = FADE) {
    if (!node?.gain) return;
    const g = node.gain.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + sec);
    try { node.src.stop(now + sec + 0.05); } catch (_) {}
  }

  async function start(id, { loop = true, fade = FADE, bus = duckGain } = {}) {
    if (!ctx || ctx.state === 'closed') return null;
    if (loop) { if (current) fadeOut(current, fade); current = id ? { id, pending: true } : null; }
    if (!id) return null;
    const ticket = current;
    const exclusiveTicket = exclusiveVersion;
    const buf = await load(id);
    if (!buf) {
      if (loop && current === ticket) current = null;
      return null;
    }
    if ((loop && current !== ticket) || (!loop && exclusiveTicket !== exclusiveVersion)) return null;          // 期间又切了场景
    const m = await manifest, t = m.tracks[id];
    const src = ctx.createBufferSource(); src.buffer = buf;
    if (loop) { src.loop = true; src.loopStart = 0; src.loopEnd = Math.min(buf.duration, t.loopEnd || buf.duration); }
    const gain = ctx.createGain(), level = t.gain ?? 1, now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(level, now + Math.max(0.01, fade));
    src.connect(gain); gain.connect(bus); src.start(now);
    const node = { id, src, gain };
    if (loop) current = node;
    return node;
  }

  /* —— 讲解时压低音乐 —— */
  function setDuck(on) {
    if (on === ducked || !ctx) { ducked = on; return; }
    ducked = on;
    const g = duckGain.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(on ? DUCK : 1, now + (on ? 0.4 : 1.2));
  }
  if (narrator?.subtitle) {
    const check = () => setDuck(narrator.subtitle.classList.contains('playing') && !narrator.muted);
    const observer = new MutationObserver(check);
    observer.observe(narrator.subtitle, { attributes: true, attributeFilter: ['class'] });
    if (narrator.button) observer.observe(narrator.button, { attributes: true, attributeFilter: ['aria-pressed'] });
  }

  /* —— “音乐”开关：跟在“讲解”按钮左侧 —— */
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'narration-toggle music-toggle';
  const controls = document.createElement('div');
  controls.className = 'sound-controls'; controls.setAttribute('role','group'); controls.setAttribute('aria-label','声音开关');
  controls.append(button);
  if (narrator?.button) controls.append(narrator.button);
  document.body.append(controls);
  function paint() {
    button.textContent = muted ? '音乐 · 关' : '音乐 · 开';
    button.setAttribute('aria-pressed', String(!muted)); button.classList.toggle('off', muted);
  }
  button.onclick = () => api.toggle();
  paint();

  /* 仅在显式验收视图显示读数。 */
  const log = [];
  function remember(name) { log.push(name); if (log.length > 4) log.shift(); }
  const debug = new URLSearchParams(location.search);
  if (debug.has('sounddebug')) {
    const d = document.createElement('pre');
    d.id = 'sound-debug';
    d.hidden = debug.get('sounddebug') !== 'proof';
    document.body.append(d);
    setInterval(() => {
      d.textContent = `audio  ${ctx ? ctx.state : '未解锁'}${muted ? ' · 音乐关' : ''}\nscene  ${current ? current.id + (current.pending ? '（载入中）' : '') : '—'}\nduck   ${ducked ? '讲解中，已压低' : '—'}\nsfx    ${log.join(' ') || '—'}`;
    }, 200);
  }

  const api = {
    button, controls,
    get muted() { return muted; },
    toggle() {
      muted = !muted; paint();
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (_) {}
      if (ctx) { const g = master.gain, now = ctx.currentTime; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(muted ? 0 : 1, now + 0.4); }
    },
    /** 切换场景底乐 */
    scene(id) {
      if (id && (exclusiveNode || deferredFinale || want === null)) {
        exclusiveVersion++; deferredFinale = null;
        fadeOut(exclusiveNode, 0.4); exclusiveNode = null;
      }
      want = id ?? null;
      if (!ctx || ctx.state !== 'running') return;          // 解锁后自动开始
      if (current && current.id === want) return;
      start(want);
    },
    /** 一次性乐句；exclusive 时先淡出底乐 */
    async sting(id, { exclusive = false } = {}) {
      if (exclusive) {
        want = null; exclusiveVersion++;
        if (ctx) start(null, {fade:1.5});
        fadeOut(exclusiveNode, 0.4); exclusiveNode = null;
        if (!ctx || ctx.state !== 'running') { deferredFinale = id; return; }
      }
      if (!ctx || ctx.state !== 'running') return;
      const node = await start(id, { loop: false, fade: 0.02 });
      if (!node) return;
      if (exclusive) exclusiveNode = node;
      remember('♪' + id);
      return new Promise(resolve => { node.src.onended = () => {
        if (exclusiveNode === node) exclusiveNode = null;
        node.src.disconnect(); node.gain.disconnect(); resolve();
      }; });
    },
    /** 音效 */
    async sfx(name, { gain = 1 } = {}) {
      if (!ctx || document.hidden) return;
      const requested = performance.now();
      if (requested - (lastRequest.get(name) ?? -Infinity) < 250) return;
      lastRequest.set(name, requested);
      // A first tap on the door can arrive while the browser is still unlocking its output.
      if (ctx.state !== 'running' && resuming) await resuming;
      if (ctx.state !== 'running' || document.hidden) return;
      if (!sfxBuf.has(name)) sfxBuf.set(name, fetch(base + 'sfx/' + name + '.mp3').then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej))).catch(() => null));
      const buf = await sfxBuf.get(name);
      if (!buf || ctx.state !== 'running' || document.hidden) return;
      if (ctx.currentTime - (lastSound.get(name) ?? -Infinity) < 0.25) return;
      lastSound.set(name, ctx.currentTime); remember(name);
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf; src.playbackRate.value = 1 + (Math.random() - 0.5) * 0.06;    // 每次略有不同
      g.gain.value = gain; src.connect(g); g.connect(sfxBus); src.start();
    }
  };
  return api;
}
