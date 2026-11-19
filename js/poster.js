/*
 * 入口海报：纸、照片、路线、手书标题、印章、光。
 * ------------------------------------------------------------------
 * 全部用 DOM/SVG/Canvas 现场生成，没有一张预先渲染的大图，改字、换照片只改 HALL / POSTER 常量。
 * 结构（从下到上）：纸纹 canvas → 墨晕山影 → 档案照片拼贴（视差）→ 西迁路线墨线 → 竖排手书标题 + 求是印
 *                  → 引言渐显 → “推门入馆” → 扫过的暖光与浮尘。
 * 路线套合自然资源部标准地图的西迁沿线局部；地名与年份来自韩松涛 2017 文。
 */
import { brushWrite, inkText } from './brush.js';

const PHOTOS = [
  { src: 'assets/photos/meitan-library-1945.jpg', cap: '湄潭文庙 · 浙大图书馆 · 1945', x: 2, y: 6, w: 27, r: -4, d: 0.9 },
  { src: 'assets/photos/zunyi-gate-1940s.jpg', cap: '遵义校本部大门 · 1940年代', x: 27, y: 2, w: 40, r: 2, d: 0.7 },
  { src: 'assets/photos/yishan-biaoying-1939.jpg', cap: '宜山标营教室 · 1939', x: 66, y: 10, w: 24, r: 4, d: 0.55 },
  { src: 'assets/photos/guizhou-zhu-1939.jpg', cap: '考察新校址 · 1939', x: 30, y: 52, w: 33, r: -2, d: 0.8 },
  { src: 'assets/photos/yongxing-huiguan-1940s.jpg', cap: '永兴 · 江西会馆', x: 64, y: 50, w: 19, r: -5, d: 0.5 }
];
// 经纬度 → 路线图坐标（仅示意相对位置）
const CITIES = [
  { name: '杭州', lon: 120.15, lat: 30.27 },
  { name: '建德', lon: 119.28, lat: 29.48 },
  { name: '泰和', lon: 114.9, lat: 26.79 },
  { name: '宜山', lon: 108.65, lat: 24.49 },
  { name: '遵义', lon: 106.93, lat: 27.73 },
  { name: '湄潭', lon: 107.47, lat: 27.75 }
];
// The printed graticule of the regional crop. Values are pixels on the same
// source sheet, in the 1330 × 735 viewBox. Interpolate between the printed
// meridians on each parallel, then between parallels (never stretch the dots).
const MERIDIANS = [105,110,115,120,125];
const GRATICULE = [
  {lat:25, pts:[[45,591],[452,603],[853,591],[1241,562],[1640,515]]},
  {lat:30, pts:[[76,148],[449,158],[825,147],[1196,118],[1565,73]]},
  {lat:35, pts:[[104,-298],[445,-287],[792,-298],[1140,-325],[1480,-370]]}
];
function proj(city) {
  const i = Math.max(0,Math.min(3,Math.floor((city.lon-105)/5)));
  const t = (city.lon - MERIDIANS[i])/5;
  const row = city.lat < 30 ? 0 : 1;
  const v = (city.lat-GRATICULE[row].lat)/5;
  function at(k, axis) {
    const pts=GRATICULE[k].pts;
    return pts[i][axis]*(1-t)+pts[i+1][axis]*t;
  }
  return {x:at(row,0)*(1-v)+at(row+1,0)*v,y:at(row,1)*(1-v)+at(row+1,1)*v};
}
const LABELS = [[4,-33],[-70,40],[70,-10],[68,32],[-66,-16],[55,47]];
// Scenic watercolours sit beside their stops. Only the dots use the map projection.
const VIGNETTES = [
  ['hangzhou', 915, 0, 270, 173], ['jiande', 1065, 224, 260, 213],
  ['taihe', 706, 472, 290, 242], ['yishan', 30, 475, 285, 235],
  ['zunyi', 8, 118, 229, 184], ['meitan', 285, 104, 260, 205]
];


function paperTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 768;
  const g = c.getContext('2d');
  g.fillStyle = '#ece2cd'; g.fillRect(0, 0, 768, 768);
  const img = g.getImageData(0, 0, 768, 768), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8; }
  g.putImageData(img, 0, 0);
  // 纸纤维
  g.globalAlpha = 0.08; g.strokeStyle = '#6b5a3e';
  for (let i = 0; i < 900; i++) { const x = Math.random() * 768, y = Math.random() * 768, a = Math.random() * 6.28, l = 4 + Math.random() * 16; g.lineWidth = Math.random() * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  // 水渍
  g.globalAlpha = 1;
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * 768, y = Math.random() * 768, r = 30 + Math.random() * 140;
    const gr = g.createRadialGradient(x, y, r * 0.6, x, y, r);
    gr.addColorStop(0, 'rgba(150,120,70,0)'); gr.addColorStop(0.92, 'rgba(150,120,70,.07)'); gr.addColorStop(1, 'rgba(150,120,70,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c.toDataURL('image/jpeg', 0.85);
}

export function createPoster(root, HALL, { onEnter, subtitle }) {
  const pts = CITIES.map(proj);
  const pathD = pts.reduce((s, p, i) => {
    if (!i) return `M${p.x},${p.y}`;
    const q = pts[i - 1], mx = (q.x + p.x) / 2, my = (q.y + p.y) / 2 - 26 + (i % 2) * 40;
    return s + ` Q${mx},${my} ${p.x},${p.y}`;
  }, '');

  root.innerHTML = `
    <div class="pz-paper"></div>
    <svg class="pz-mount" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><filter id="pzWash"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="4" seed="3"/><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .2  0 0 0 0 .14  0 0 0 -2.2 1.35"/></filter></defs>
      <rect width="1000" height="600" filter="url(#pzWash)" opacity=".55"/>
    </svg>
    <div class="pz-collage">${PHOTOS.map((p, i) => `
      <figure class="pz-photo" style="--x:${p.x}%;--y:${p.y}%;--w:${p.w}%;--r:${p.r}deg;--d:${p.d};--i:${i}">
        <img src="${p.src}" alt="${p.cap}"><i class="corner a"></i><i class="corner b"></i><i class="corner c"></i><i class="corner d"></i>
        <figcaption>${p.cap}</figcaption>
      </figure>`).join('')}
    </div>
    <figure class="pz-atlas">
    <svg class="pz-route" viewBox="0 0 1330 735" aria-label="西迁路线局部：杭州、建德、泰和、宜山、遵义、湄潭">
      <defs><linearGradient id="mapX"><stop stop-color="black"/><stop offset=".07" stop-color="white"/><stop offset=".94" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
        <linearGradient id="mapY" x2="0" y2="1"><stop stop-color="black"/><stop offset=".06" stop-color="white"/><stop offset=".94" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
        <mask id="mapMargin"><rect width="1330" height="735" fill="url(#mapX)"/></mask><mask id="mapEnds"><rect width="1330" height="735" fill="url(#mapY)"/></mask></defs>
      <g mask="url(#mapMargin)"><image mask="url(#mapEnds)" class="pz-basemap" href="assets/poster/migration-region.webp" width="1330" height="735"/></g>
      <g class="pz-sketches" aria-hidden="true">${VIGNETTES.map(([name,x,y,w,h]) =>
        `<image data-scenery="${name}" href="assets/poster/watercolor-${name}.webp" x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('')}</g>
      <path class="pz-route-shadow" d="${pathD}"/>
      <path class="pz-route-line" d="${pathD}"/>
      ${pts.map((p,i) => {
        const [x,y] = LABELS[i];
        return `<g transform="translate(${p.x},${p.y})"><g class="pz-city" style="--i:${i}">
          <path class="pz-leader" d="M0 0L${x*.76} ${y*.76}"/><circle r="6"/><circle class="halo" r="6"/>
          <text x="${x}" y="${y}">${CITIES[i].name}</text>
        </g></g>`;}).join('')}
      <g class="pz-book" aria-hidden="true"><circle r="14"/><text y="6">书</text></g>
    </svg><figcaption><button type="button" class="atlas-open">放大路线图</button><span>地标彩绘示意 · 底图审图号 GS(2021)5448号</span></figcaption>
    </figure>
    <dialog class="atlas-dialog" aria-label="西迁路线图"><header><h2>西迁沿线</h2><button type="button" class="atlas-close">收起地图 ×</button></header>
      <div class="atlas-scroll" tabindex="0" aria-label="西迁路线，可左右滚动"></div>
      <footer><span class="atlas-pan-hint">左右滑动看全图</span><span>地标彩绘示意 · 底图审图号 GS(2021)5448号</span></footer></dialog>
    <header class="pz-head">
      <h1 class="pz-title" data-ref="title"></h1>
      <div class="pz-side"><p class="pz-kicker"><span>${HALL.kicker}</span><span>${HALL.years}</span></p>
      <img class="pz-seal" src="assets/poster/qiushi.svg" alt="求是印，右起读"></div>
    </header>
    <div class="pz-foot">
      <p class="pz-intro" data-ref="intro"></p>
      <button class="pz-enter" data-ref="enter" type="button" disabled><span>推门入馆</span><i aria-hidden="true">→</i></button>
      <p class="pz-sub">${HALL.subtitle} · 部分展品以文献展板或示意重建呈现，均已标注</p>
    </div>
    <div class="pz-light" aria-hidden="true"></div>
    <canvas class="pz-dust" aria-hidden="true"></canvas>`;

  const $ = s => root.querySelector(`[data-ref="${s}"]`);
  const subtitleParent = subtitle?.parentNode;
  if (subtitle) $('intro').after(subtitle);
  root.querySelector('.pz-paper').style.backgroundImage = `url(${paperTexture()})`;
  const atlas = root.querySelector('.pz-atlas'), route = atlas.querySelector('svg');
  const dialog = root.querySelector('.atlas-dialog'), mapScroll = dialog.querySelector('.atlas-scroll');
  atlas.querySelector('button').onclick = () => {
    mapScroll.append(route); dialog.showModal();
    mapScroll.scrollLeft = mapScroll.scrollWidth - mapScroll.clientWidth;
  };
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('close', () => atlas.prepend(route));

  // 视差
  const collage = root.querySelector('.pz-collage');
  const onMove = e => {
    const x = (e.clientX / innerWidth - 0.5), y = (e.clientY / innerHeight - 0.5);
    collage.style.setProperty('--px', x.toFixed(3)); collage.style.setProperty('--py', y.toFixed(3));
  };
  addEventListener('pointermove', onMove);

  // 路线上走动的“书”
  const line = root.querySelector('.pz-route-line'), book = root.querySelector('.pz-book');
  const L = line.getTotalLength();
  const routeInk = [line, root.querySelector('.pz-route-shadow')];
  for (const stroke of routeInk) {
    stroke.style.strokeDasharray = L;
    stroke.style.strokeDashoffset = L;
  }

  // 浮尘
  const dust = root.querySelector('.pz-dust'), dg = dust.getContext('2d');
  const motes = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.3, v: Math.random() * 0.02 + 0.005, p: Math.random() * 6 }));
  let raf = 0, t0 = performance.now(), bookStart = 0, alive = true;
  function frame(now) {
    if (!alive) return;
    const t = (now - t0) / 1000;
    if (dust.width !== innerWidth) { dust.width = innerWidth; dust.height = innerHeight; }
    dg.clearRect(0, 0, dust.width, dust.height);
    for (const m of motes) {
      m.y -= m.v * 0.016; if (m.y < -0.02) m.y = 1.02;
      const x = (m.x + Math.sin(t * 0.3 + m.p) * 0.01) * dust.width, y = m.y * dust.height;
      dg.fillStyle = `rgba(255,236,200,${0.25 + 0.25 * Math.sin(t + m.p)})`;
      dg.beginPath(); dg.arc(x, y, m.r, 0, 6.283); dg.fill();
    }
    if (bookStart) {
      const k = ((now - bookStart) / 9000) % 1, p = line.getPointAtLength(k * L);
      book.setAttribute('transform', `translate(${p.x},${p.y})`);
      book.style.opacity = Math.min(1, k * 8, (1 - k) * 8);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  async function start() {
    root.classList.add('play');
    // 路线墨线
    setTimeout(() => {
      for (const stroke of routeInk) {
        stroke.style.transition = 'stroke-dashoffset 4.2s cubic-bezier(.5,0,.3,1)';
        stroke.style.strokeDashoffset = 0;
      }
    }, 1500);
    setTimeout(() => { bookStart = performance.now(); }, 5700);
    // 手书标题
    await new Promise(r => setTimeout(r, 500));
    await brushWrite($('title'), HALL.title, { duration: 4500, gap: 45 });
    root.classList.add('sealed');
    await inkText($('intro'), HALL.intro, { step: 45, delay: 300 });
    root.classList.add('ready');
  }
  $('enter').addEventListener('click', () => {
    root.classList.add('leaving');
    setTimeout(() => onEnter(), 650);
  });

  return {
    start,
    enableEntry() { $('enter').disabled=false; },
    dispose() {
      alive = false; cancelAnimationFrame(raf); removeEventListener('pointermove', onMove);
      if (subtitleParent) subtitleParent.append(subtitle);
    }
  };
}
