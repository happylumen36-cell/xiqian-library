/* 可见字形始终来自 Brush。笔顺中线只供 SVG 遮罩使用。 */
const NS = 'http://www.w3.org/2000/svg';
const cache = new Map();
let serial = 0;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function svg(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}
function strokeData(ch) {
  if (!/\p{Script=Han}/u.test(ch)) return Promise.resolve(null);
  if (!cache.has(ch)) cache.set(ch, fetch(`assets/strokes/${encodeURIComponent(ch)}.json`)
    .then(r => r.ok ? r.json() : null).catch(() => null));
  return cache.get(ch);
}
export function preloadStrokes(text) { return Promise.all([...text].map(strokeData)); }

/* Assign each small strip of ink to its nearest median. This stops the wide
   brush that reveals a stroke from lighting up an adjacent, later stroke. */
function strokeRegions(medians) {
  const size = 80, step = 1024 / size;
  const distance = new Float32Array(size * size).fill(Infinity);
  const owner = new Uint8Array(size * size);
  medians.forEach((points, index) => {
    for (let j = 1; j < points.length; j++) {
      const [x, y] = points[j - 1], dx = points[j][0] - x, dy = points[j][1] - y;
      const len = dx * dx + dy * dy || 1;
      for (let row = 0; row < size; row++) {
        const ry = (row + .5) * step - y;
        for (let col = 0; col < size; col++) {
          const rx = (col + .5) * step - x;
          const t = Math.min(1, Math.max(0, (rx * dx + ry * dy) / len));
          const d = (rx - t * dx) ** 2 + (ry - t * dy) ** 2, k = row * size + col;
          if (d < distance[k]) { distance[k] = d; owner[k] = index; }
        }
      }
    }
  });
  const regions = medians.map(() => '');
  for (let row = 0; row < size; row++) {
    for (let start = 0; start < size;) {
      const index = owner[row * size + start];
      let end = start + 1;
      while (end < size && owner[row * size + end] === index) end++;
      regions[index] += `M${start} ${row}h${end-start}v1h-${end-start}Z`;
      start = end;
    }
  }
  return regions.map(d => svg('path', { d, transform: `scale(${step})` }));
}
function makeGlyph(ch, data, color, instant) {
  const node = svg('svg', {viewBox:'0 0 1024 1024', class:'brush-char', 'aria-hidden':'true'});
  const ink = svg('text', {x:512, y:864, 'text-anchor':'middle', fill:color});
  ink.style.font = 'normal 1024px var(--brush)';
  ink.style.letterSpacing = 'normal';
  ink.textContent = ch;
  const steps = [];
  if (!instant) {
    ink.style.visibility = 'hidden';
    if (data?.medians?.length) {
      const prefix = 'brush-' + ++serial;
      const defs = svg('defs'), mask = svg('mask', {id:prefix,maskUnits:'userSpaceOnUse',x:0,y:0,width:1024,height:1024});
      const medians = data.medians.map(line => line.map(([x,y]) => [x, 900-y]));
      const regions = strokeRegions(medians);
      medians.forEach((line, i) => {
        const clip = svg('clipPath',{id:prefix+'-'+i});
        clip.append(regions[i]); defs.append(clip);
        const path = svg('path',{d:'M'+line.map(p=>p.join(' ')).join(' L'), fill:'none',stroke:'white','stroke-width':210,
          'stroke-linecap':'round','stroke-linejoin':'round','clip-path':`url(#${clip.id})`});
        const length = path.getTotalLength() + 211;
        path.style.strokeDasharray = `${length} ${length}`;
        path.style.strokeDashoffset = length;
        path.style.visibility = 'hidden';
        mask.append(path); steps.push({path,length});
      });
      ink.setAttribute('mask',`url(#${prefix})`);
      defs.append(mask); node.append(defs);
    }
  }
  node.append(ink);
  return {node, ink, steps};
}

export async function brushWrite(el, text, o = {}) {
  const instant = o.instant || reduced(), chars = [...text];
  el.classList.add('brush'); el.setAttribute('aria-label',text);
  const [data] = await Promise.all([instant ? [] : preloadStrokes(text),document.fonts.load('32px Brush',text)]);
  const jobs = chars.map((ch,i)=>makeGlyph(ch,data[i],o.color || 'currentColor',instant));
  el.replaceChildren(...jobs.map(job=>job.node));
  if (instant) return;
  const speed = o.speed || 1;
  const gap = (o.gap ?? 65) / speed;
  const units = jobs.reduce((n,j)=>n+(j.steps.length ? j.steps.reduce((s,p)=>s+p.length,0) : 900),0);
  const unitMs = Math.max(1, (o.duration ?? chars.length * 720 / speed) - gap * (chars.length - 1)) / units;
  // Use one clock for the whole inscription. A delayed frame can finish more
  // than one short stroke without adding a frame of latency to every stroke.
  const schedule = [];
  let time = 0;
  for (const job of jobs) {
    const steps = job.steps.length ? job.steps : [{length:900}];
    for (const [i,step] of steps.entries()) {
      const end = time + unitMs * step.length;
      schedule.push({job,step,start:time,end,last:i === steps.length-1});
      time = end;
    }
    time += gap;
  }
  await new Promise(resolve => {
    const first = performance.now();
    let index = 0;
    function frame(now) {
      if (!el.isConnected) return resolve();
      const elapsed = now-first;
      while (index < schedule.length) {
        const {job,step,start,end,last} = schedule[index];
        if (elapsed <= start) break;
        const t = Math.min(1,(elapsed-start)/(end-start));
        job.ink.style.visibility = 'visible';
        if (step.path) {
          step.path.style.visibility = 'visible';
          step.path.style.strokeDashoffset = step.length * (1-t);
        } else job.ink.style.opacity = t;
        if (t < 1) break;
        if (last) {
          job.ink.removeAttribute('mask');
          job.node.querySelector('defs')?.remove();
          o.onChar?.();
        }
        index++;
      }
      if (index === schedule.length) resolve();
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

/** 逐字墨迹渐显。返回 Promise，在最后一个字显出后 resolve。 */
export function inkText(el, text, o = {}) {
  const step = o.step ?? 55, delay = o.delay ?? 0;
  el.textContent = '';
  el.setAttribute('aria-label', text);
  const frag = document.createDocumentFragment();
  [...text].forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'ink-char'; s.textContent = ch; s.setAttribute('aria-hidden', 'true');
    s.style.animationDelay = `${delay + i * step}ms`;
    frag.appendChild(s);
  });
  el.appendChild(frag);
  return wait(reduced() ? 0 : delay + text.length * step + 600);
}
