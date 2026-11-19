/*
 * 全亮终场的三维部分：光浪、天花辉光、金尘、讲解
 * ------------------------------------------------------------------
 * 卡片（毛笔“可以开幕了”、展览部落款、四盏任务灯）由 app.js 的 openingNight() 负责；这里只管展厅本身。
 * createFinale({ hall, arch }) → { entrance(), play(), end(), rest() }
 *  - entrance()：进场开灯时，天花暗槽与格心随洗墙灯一起升到“常亮”（0.45）。
 *  - play()：全景镜头就位后调用。所有画灯的光柱由左到右涌起一次，天花辉光推满，金尘从地面缓缓升起。卡片上的四盏灯亮起时由 app.js 播放终场讲解。
 *    返回的 Promise 在光浪扫过中段时 resolve，卡片此时开始落笔。
 *  - end()：关掉卡片、回到展厅时调用。辉光回落到常亮，金尘散去，光柱留在稳定亮度。
 *  - rest()：直接设为常亮（再访、跳过进场时）。
 * 不闪烁：负责人否决过“开灯闪烁”，这里的光浪只做平滑的起落。
 */
import * as THREE from 'three';

const REST = 0.45, BEAM_REST = 0.26, BEAM_PEAK = 1.16;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

function moteTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,230,180,1)'); r.addColorStop(0.35, 'rgba(255,214,150,.45)'); r.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

export function createFinale({ hall, arch }) {
  let glow = 0, glowFrom = 0, glowTo = 0, glowT0 = 0, glowDur = 1, raf = 0, motes = null, moteK = 0, moteTo = 0;
  const items = [...hall.items].sort((a, b) => a.x - b.x);
  const minX = items[0]?.x ?? 0, maxX = items[items.length - 1]?.x ?? 1;

  function glowTowards(k, ms) { glowFrom = glow; glowTo = k; glowT0 = performance.now(); glowDur = Math.max(1, ms); kick(); }

  /* 金尘：沿整面墙前方缓缓上升的细小光点，只在终场出现 */
  function makeMotes() {
    const n = 320, span = maxX - minX + 6, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = minX - 3 + Math.random() * span; pos[i * 3 + 1] = Math.random() * 5.5; pos[i * 3 + 2] = 0.3 + Math.random() * 3.5;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: moteTexture(), size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: '#ffd9a0' });
    const p = new THREE.Points(geo, mat); p.userData.seed = seed; p.frustumCulled = false; hall.scene.add(p); return p;
  }
  function stepMotes(dt, t) {
    if (!motes) return;
    moteK += Math.sign(moteTo - moteK) * Math.min(Math.abs(moteTo - moteK), dt / 2.2);
    motes.material.opacity = 0.75 * moteK;
    const a = motes.geometry.attributes.position, s = motes.userData.seed;
    for (let i = 0; i < s.length; i++) {
      let y = a.array[i * 3 + 1] + dt * (0.12 + 0.18 * s[i]);
      if (y > 5.6) y = 0.05;
      a.array[i * 3 + 1] = y; a.array[i * 3] += Math.sin(t * 0.6 + s[i] * 40) * dt * 0.05;
    }
    a.needsUpdate = true;
    if (moteK === 0 && moteTo === 0) { hall.scene.remove(motes); motes.geometry.dispose(); motes.material.map.dispose(); motes.material.dispose(); motes = null; }
  }

  let last = 0, entranceOn = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (entranceOn) {
      const e = hall.entrance;
      if (e.opened) { entranceOn = false; glowTowards(REST, 600); }
      else if (e.elapsed >= 0) glow = REST * ease(e.elapsed / e.duration);
    } else {
      glow = glowFrom + (glowTo - glowFrom) * ease((now - glowT0) / glowDur);
    }
    arch.setGlow(glow);
    stepMotes(dt, now / 1000);
    const busy = entranceOn || now - glowT0 < glowDur || motes;
    raf = busy ? requestAnimationFrame(frame) : 0;
    if (!raf) last = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  return {
    entrance() { entranceOn = true; kick(); },
    rest() { entranceOn = false; glow = glowFrom = glowTo = REST; arch.setGlow(REST); },
    play() {
      if (reducedMotion()) {
        items.forEach(it => { it.beamU.reveal.value = 1; it.beamU.intensity.value = Math.max(it.beamU.intensity.value, BEAM_REST); });
        glowTowards(1, 1); return Promise.resolve();
      }
      glowTowards(1, 2600);
      if (!motes) motes = makeMotes(); moteTo = 1; kick();
      const t0 = performance.now(), sweep = 2.2, pulse = 1.7;
      const from = items.map(it => it.beamU.intensity.value);
      return new Promise(resolve => {
        let half = false;
        const step = () => {
          const s = (performance.now() - t0) / 1000;
          items.forEach((it, i) => {
            const u = maxX > minX ? (it.x - minX) / (maxX - minX) : 0, p = (s - u * sweep) / pulse;
            if (p < 0) return;
            it.beamU.reveal.value = Math.max(it.beamU.reveal.value, Math.min(1, p * 2));
            const base = from[i] + (BEAM_REST - from[i]) * ease(p);
            const crest = p < 1 ? Math.sin(Math.PI * p) : 0;
            it.waveLight = crest;
            it.beamU.intensity.value = base + (BEAM_PEAK - BEAM_REST) * crest;
          });
          if (!half && s > sweep * 0.55) { half = true; resolve(); }
          if (s < sweep + pulse + 0.1) requestAnimationFrame(step);
        };
        step();
      });
    },
    end() { moteTo = 0; glowTowards(REST, 1500); }
  };
}
