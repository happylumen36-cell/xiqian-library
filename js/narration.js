/* The two voices share one audio element so a user gesture unlocks later clips on mobile. */
const KEY = 'xiqian-narration-muted';
const SILENCE = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==';

export function createNarrator({ root = document.body, base = 'assets/audio/' } = {}) {
  const timings = fetch(base + 'narration-timing.json', {cache: 'no-cache'}).then(r => r.json()).catch(() => ({}));
  const audio = new Audio();
  audio.preload = 'auto';
  let muted = false, unlocked = false, active = null, request = 0, lastCue = null;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (_) {}
  const played = new Set();
  const sub = document.createElement('aside');
  sub.className = 'narration-sub'; sub.setAttribute('aria-label', '讲解字幕');
  sub.innerHTML = '<div aria-live="polite" aria-atomic="true"><p class="ns-line"></p><small class="ns-src"></small></div><button type="button" class="ns-skip" aria-label="跳过这段讲解">跳过</button>';
  const line = sub.querySelector('.ns-line'), source = sub.querySelector('.ns-src');
  const button = document.createElement('button'); button.type = 'button'; button.className = 'narration-toggle';
  root.append(sub, button); sub.inert = true;
  function measure() {
    root.style.setProperty('--narration-height', sub.classList.contains('show') ? sub.offsetHeight + 'px' : '0px');
  }
  new ResizeObserver(measure).observe(sub);
  function paint() {
    button.textContent = muted ? '讲解 · 关' : '讲解 · 开';
    button.setAttribute('aria-pressed', String(!muted)); button.classList.toggle('off', muted);
    audio.muted = muted;
  }
  function show(cue) {
    if (cue === lastCue) return;
    lastCue = cue; sub.inert = !cue;
    sub.classList.toggle('show', !!cue); sub.classList.toggle('quote', cue?.v === 'q');
    line.textContent = cue ? (cue.v === 'q' ? '“' + cue.t + '”' : cue.t) : '';
    source.textContent = cue?.src ? '原文 · ' + cue.src : '';
    measure();
  }
  function finish() {
    const clip = active; active = null;
    sub.classList.remove('playing');
    if (clip) { cancelAnimationFrame(clip.frame); clip.resolve(); }
    audio.onended = audio.onerror = null; audio.pause(); show(null);
  }
  function stop() { request++; finish(); }
  function toggle() {
    muted = !muted; paint();
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (_) {}
  }
  function unlock() {
    if (unlocked || !navigator.userActivation?.isActive) return;
    unlocked = true;
    if (!active) { audio.src = SILENCE; audio.muted = muted; audio.play().catch(() => {}); }
  }
  async function play(id, { cue, once = true, whileVisible } = {}) {
    const key = cue ? id + '-' + cue : id;
    if ((once && played.has(key)) || (whileVisible && !whileVisible())) return;
    const ticket = ++request;
    finish();
    const segment = (await timings)[id];
    if (ticket !== request || !segment || (whileVisible && !whileVisible())) return;
    const part = cue && segment.cues.find(c => c.clip === cue);
    // A split track is for standalone listening. The game plays its individual scene cues.
    if (cue ? !part : segment.cues.some(c => c.clip)) return;
    const duration = part ? part.end - part.start : segment.duration;
    played.add(key);
    const clip = { key, duration, frame: 0 };
    clip.finished = new Promise(resolve => { clip.resolve = resolve; });
    active = clip;
    sub.classList.add('playing');
    sub.dataset.segment = id;
    sub.dataset.cue = cue || '';
    let started = false, fallbackAt = null;
    const frame = () => {
      if (active !== clip) return;
      if (whileVisible && !whileVisible()) { finish(); return; }
      if (started || fallbackAt !== null) {
        const t = fallbackAt === null ? audio.currentTime : (performance.now() - fallbackAt) / 1000;
        if (t >= duration) { finish(); return; }
        show(part || segment.cues.find(c => t >= c.start && t < c.end) || null);
      }
      clip.frame = requestAnimationFrame(frame);
    };
    const subtitlesOnly = () => {
      if (active === clip && fallbackAt === null) {
        fallbackAt = performance.now() - (started ? audio.currentTime * 1000 : 0);
      }
    };
    const revision = (part || segment).revision;
    const version = revision ? '?v=' + encodeURIComponent(revision) : '';
    audio.src = base + key + '.mp3' + version; audio.muted = muted;
    audio.onended = () => { if (active === clip) finish(); };
    audio.onerror = subtitlesOnly;
    audio.play().then(() => { started = true; }).catch(subtitlesOnly);
    frame();
    return clip.finished;
  }
  function waitFor(id, cue) {
    const clip = active;
    if (clip?.key !== (cue ? id + '-' + cue : id)) return;
    // Automatic tours give a slow or unavailable media file time to yield to the next screen.
    return Promise.race([clip.finished, new Promise(resolve => setTimeout(resolve, (clip.duration + 2) * 1000))]);
  }
  paint(); button.onclick = () => { unlock(); toggle(); }; sub.querySelector('.ns-skip').onclick = stop;
  return { button, subtitle: sub, play, waitFor, stop, unlock, toggle, get muted() { return muted; } };
}
