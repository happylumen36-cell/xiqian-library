/*
 * 展厅 v3：一面沙龙式挂满展品的长墙。
 * ------------------------------------------------------------------
 * 空间：赭红灰泥墙（取文庙红墙之意）、人字拼木地板、顶上轨道灯；按章节分组挂画，章节名以金箔手书写在墙上。
 * 灯光：每章一盏洗墙射灯打底；每件展品上方一盏黄铜画灯——亮着的画灯发光（Bloom），墙上留一圈光斑。
 * 点亮：lightUp(id) —— 镜头推近 → 画灯闪两下亮起 → 光柱自上而下铺开 → 照片从空白银版“显影” → 浮尘升起。
 * 性能：只有章节洗墙灯是真实光源（7 盏）；画灯光斑、光柱、照片受光都在着色器里算，手机也能跑。
 * 改参数：下方 LOOK 常量（墙色、灯色、挂画尺寸、Bloom）。
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildArchitecture, buildBench } from './hall-architecture.js';

const LOOK = {
  wall: '#7a4636',           // 赭红墙
  wallLit: '#ffd9a8',        // 洗墙灯色
  floor: '#a0805e',
  gold: '#e7c98f',           // 金箔字
  lamp: '#ffe2b0',
  sizeH: { 1: 0.6, 2: 0.88, 3: 1.24 },
  eye: 1.68,                 // 挂画中线高度
  maxCol: 2.3,               // 一列最高
  colGap: 0.26, rowGap: 0.24, chapterGap: 1.5,
  bloom: { strength: 0.55, radius: 0.5, threshold: 0.9 }
};
const SERIF = '"Exhibit Serif", "Songti SC", serif', BRUSH = '"Brush", "Ma Shan Zheng", serif', PRINT = '"Print", "ZCOOL XiaoWei", serif', HAND = '"Hand", "Long Cang", cursive', KAI = '"Draft Kai", "Kaiti SC", serif';

/* ---------- 着色器 ---------- */
const photoShader = {
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D map; uniform float lit, develop, ambient, time, isText;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(map, vUv).rgb;
      float l = dot(c, vec3(.299,.587,.114));
      vec3 sepia = vec3(l*1.07, l*.95, l*.78);
      c = mix(c, sepia, .22 * (1. - isText));
      // 未显影：银版般的暗色空白，带颗粒
      float g = hash(floor(vUv * 380.) + floor(time*6.)) * .06;
      vec3 blank = vec3(.12, .105, .09) + g;
      // 显影：先出暗部，再出亮部——按亮度分层显出
      float d = step(.0001, develop) * smoothstep(l - .35, l + .05, develop * 1.35 - .1);
      vec3 col = mix(blank, c, d);
      // 显影时扫过的一道银光
      float band = exp(-pow((vUv.x*.6 + (1.-vUv.y)*.4) - develop*1.5 + .25, 2.) * 60.) * (1. - develop) * step(.001, develop);
      col += band * vec3(.9,.85,.7) * .6;
      // 画灯从上往下打：上亮下暗，中间最亮
      float pool = .55 + .45 * smoothstep(1.25, .1, length((vUv - vec2(.5, 1.08)) * vec2(1.1, 1.)));
      float light = ambient + lit * pool * .62;
      gl_FragColor = vec4(col * light, 1.);
      #include <colorspace_fragment>
    }`
};
const beamShader = {
  vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV;
    void main(){ vH = position.y; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float intensity, reveal, time, len; uniform vec3 color; varying float vH; varying vec3 vN; varying vec3 vV;
    void main(){
      float t = clamp(.5 - vH / len, 0., 1.);         // 0 灯口 → 1 末端
      if (t > reveal) discard;
      float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
      float fall = pow(1. - t, 1.4) * smoothstep(0., .08, t);
      float flow = .8 + .2 * sin(vH * 9. + time * 1.3) * sin(vH * 3.1 - time * .7);
      float a = intensity * edge * fall * flow * (1. - smoothstep(reveal - .12, reveal, t));
      gl_FragColor = vec4(color * a, a);
    }`
};

// Each grain belongs to one picture light. The same light level drives its beam and its dust.
function makeBeamDust(items, time) {
  const perLamp=28, positions=[], beams=[], seeds=[];
  for (const [index,it] of items.entries()) {
    const cone=it.beam.geometry.parameters, length=cone.height;
    const origin=it.beam.localToWorld(new THREE.Vector3(0,length/2,0));
    for(let i=0;i<perLamp;i++){
      positions.push(origin.x,origin.y,origin.z);
      beams.push(length,cone.radiusTop,cone.radiusBottom,index);
      seeds.push(Math.sqrt(Math.random())*.86,Math.random()*2*Math.PI,Math.random(),Math.random());
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('beamData',new THREE.Float32BufferAttribute(beams,4));
  geometry.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,4));
  const levels=new Float32Array(items.length);
  const uniforms={time,levels:{value:levels},pixelRatio:{value:1},viewHeight:{value:1},portrait:{value:0}};
  const material=new THREE.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec4 beamData, seed;
      uniform float time, pixelRatio, viewHeight, portrait;
      uniform float levels[${items.length}];
      varying float strength;
      void main(){
        float along = fract(seed.z - time * (.022 + .025 * seed.w) / beamData.x);
        float r = mix(beamData.y, beamData.z, along) * seed.x;
        float angle = seed.y + .19 * sin(.44*time+seed.z*6.283);
        float drop = along * beamData.x;
        vec3 p = position + vec3(cos(angle)*r,-.993*drop,.120*drop+sin(angle)*r);
        vec4 eye = modelViewMatrix * vec4(p,1.);
        float nearLight = 1.-smoothstep(mix(7.,6.,portrait),mix(16.,12.,portrait),length(eye.xyz));
        float edges = smoothstep(.015,.12,along)*(1.-smoothstep(.72,1.,along))*smoothstep(.06,.16,p.z);
        float density = mix(1.,.63*step(.27,seed.w),portrait);
        strength = min(levels[int(beamData.w)],1.) * nearLight * edges * density * (.30+.41*seed.w);
        gl_Position = projectionMatrix * eye;
        gl_PointSize = pixelRatio * clamp((.010+.012*seed.w)*viewHeight*.5*projectionMatrix[1][1]/max(.6,-eye.z),1.55,3.6);
      }`,
    fragmentShader:`varying float strength;
      void main(){
        float radius = length(gl_PointCoord-.5)*2.;
        float alpha = strength*(1.-smoothstep(.12,1.,radius));
        if(alpha<.005) discard;
        gl_FragColor=vec4(.76,.50,.28,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const points=new THREE.Points(geometry,material);
  points.name='picture-light-dust'; points.frustumCulled=false;
  return {points,levels,uniforms};
}

/* ---------- 画布贴图 ---------- */
function tex(canvas) { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function wrapText(g, text, x, y, maxW, lh, maxLines = 9) {
  let line = '', n = 0;
  for (const ch of text) { if (g.measureText(line + ch).width > maxW && line) { g.fillText(line, x, y); y += lh; line = ch; if (++n >= maxLines) return y; } else line += ch; }
  if (line) { g.fillText(line, x, y); y += lh; } return y;
}
function textPanel(ex, src, aspect) {
  const W = 900, H = Math.round(W / aspect), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, H);
  const im = g.getImageData(0, 0, W, H), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(im, 0, 0);
  g.textBaseline = 'top';
  const long = ex.title.length > 3;
  g.fillStyle = '#8a7a60'; g.font = `400 30px ${PRINT}`; g.fillText(ex.date, 70, 70);
  g.fillStyle = '#1c1915'; g.font = `400 ${long ? 120 : 150}px ${BRUSH}`; g.fillText(ex.title, 62, 116);
  g.fillStyle = '#b4391f'; g.fillRect(72, long ? 270 : 300, 70, 6);
  g.fillStyle = '#1c1915'; g.font = `500 50px ${SERIF}`;
  const y = wrapText(g, `“${ex.quote.replace(/。$/, '')}”`, 70, long ? 310 : 340, W - 140, 76, 4);
  g.fillStyle = '#4c453a'; g.font = `400 31px ${SERIF}`;
  wrapText(g, ex.caption, 70, y + 26, W - 140, 50, 6);
  g.fillStyle = '#8a7a60'; g.font = `400 24px ${PRINT}`; g.fillText('文献展板 · 原图待寻', 70, H - 74);
  return tex(c);
}
function plaque(lines, { w = 640, h = 300, done = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = done ? '#f6eedb' : '#efe6d2'; g.fillRect(0, 0, w, h);
  g.textBaseline = 'top';
  g.fillStyle = '#1c1915'; g.font = `400 54px ${PRINT}`; g.fillText(lines.title, 34, 30);
  g.fillStyle = '#8a7a60'; g.font = `400 30px ${PRINT}`; g.fillText(lines.date, 36, 100);
  g.fillStyle = done ? '#1c1915' : '#5a5246'; g.font = `400 ${done ? 34 : 28}px ${done ? KAI : SERIF}`;
  wrapText(g, lines.body || '', 36, 150, w - 72, done ? 44 : 38, 3);
  if (done) { g.fillStyle = '#b4391f'; g.font = `400 26px ${HAND}`; g.fillText('学生策展人 拟', w - 210, h - 48); }
  return tex(c);
}
function darkTag() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 380; const g = c.getContext('2d');
  g.fillStyle = '#e9dcc0'; g.beginPath(); g.moveTo(40, 0); g.lineTo(216, 0); g.lineTo(256, 40); g.lineTo(256, 380); g.lineTo(0, 380); g.lineTo(0, 40); g.closePath(); g.fill();
  g.fillStyle = '#7a6a50'; g.beginPath(); g.arc(128, 46, 14, 0, 6.28); g.fill();
  g.fillStyle = '#b4391f'; g.font = `400 96px ${HAND}`; g.textAlign = 'center';
  ['待', '调', '研'].forEach((ch, i) => g.fillText(ch, 128, 160 + i * 92));
  return tex(c);
}
function chapterTitle(ch, i) {
  const c = document.createElement('canvas'); c.width = 1400; c.height = 360; const g = c.getContext('2d');
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#fff'; g.font = `400 210px ${BRUSH}`; g.fillText(ch.name, 20, 230);
  const w = g.measureText(ch.name).width;
  g.font = `400 54px ${PRINT}`; g.fillText(`${['壹', '贰', '叁', '肆', '伍', '陆', '柒'][i] || ''}  ${ch.note}  ${ch.years}`, Math.max(40, w + 70), 200);
  return tex(c);
}
function gradientTex(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, inner); r.addColorStop(1, outer);
  g.fillStyle = r; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
}

/* ---------- 主体 ---------- */
export async function createHall({ renderer, exhibits, chapters, sources, status, revealed, labelFor = () => null }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a100c');
  scene.fog = new THREE.Fog('#1a100c', 14, 34);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;

  const texLoader = new THREE.TextureLoader();
  const loadTex = url => new Promise(r => texLoader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; r(t); }, undefined, () => r(null)));
  const pbr = async (name, rx, ry) => {
    const [map, nor, arm] = await Promise.all(['diff', 'nor', 'arm'].map(k => loadTex(`assets/textures/${name}/${k}.jpg`)));
    [map, nor, arm].forEach(t => { if (!t) return; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); });
    if (nor) nor.colorSpace = THREE.NoColorSpace; if (arm) arm.colorSpace = THREE.NoColorSpace;
    return { map, normalMap: nor, roughnessMap: arm };
  };

  // 预载照片，取得宽高比再排版
  const images = {};
  await Promise.all(exhibits.filter(e => e.kind === 'photo').map(async e => { images[e.id] = await loadTex(e.image); }));

  /* ---- 排版：章节内按列堆叠 ---- */
  const items = exhibits.map(ex => {
    const h = LOOK.sizeH[ex.size];
    const aspect = ex.kind === 'photo' && images[ex.id] ? images[ex.id].image.width / images[ex.id].image.height : (ex.size === 1 ? 0.95 : 0.8);
    const mat = ex.kind === 'photo' ? h * 0.1 : 0.03, mould = 0.05;
    return { ex, h, w: h * aspect, aspect, mat, mould, ow: h * aspect + 2 * (mat + mould), oh: h + 2 * (mat + mould) };
  });
  let cursor = 0;
  const chapterBlocks = chapters.map((ch, ci) => {
    const list = items.filter(it => it.ex.chapter === ch.id).sort((a, b) => b.oh * b.ow - a.oh * a.ow);
    const cols = [];
    for (const it of list) {
      let col = it.ex.size === 3 ? null : cols.find(c => !c.big && c.h + it.oh + LOOK.rowGap <= LOOK.maxCol && it.ow <= c.w * 1.4 && c.items.length < 3);
      if (!col) { col = { items: [], h: -LOOK.rowGap, w: 0, big: it.ex.size === 3 }; cols.push(col); }
      col.items.push(it); col.h += it.oh + LOOK.rowGap; col.w = Math.max(col.w, it.ow);
    }
    cols.sort((a, b) => b.h * b.w - a.h * a.w);
    const ordered = []; cols.forEach((c, i) => (i % 2 ? ordered.push(c) : ordered.unshift(c)));
    const width = ordered.reduce((s, c) => s + c.w, 0) + LOOK.colGap * (ordered.length - 1);
    let x = cursor;
    for (const col of ordered) {
      let y = LOOK.eye + col.h / 2;
      for (const it of col.items) { it.x = x + col.w / 2; it.y = y - it.oh / 2; y -= it.oh + LOOK.rowGap; }
      x += col.w + LOOK.colGap;
    }
    const top = Math.max(...ordered.map(c => LOOK.eye + c.h / 2));
    const block = { ch, ci, x0: cursor, x1: cursor + width, cx: cursor + width / 2, top };
    cursor += width + LOOK.chapterGap;
    return block;
  });
  const span = cursor - LOOK.chapterGap, shift = -span / 2;
  items.forEach(it => { it.x += shift; });
  chapterBlocks.forEach(b => { b.x0 += shift; b.x1 += shift; b.cx += shift; });

  /* ---- 建筑 ---- */
  const W = span + 20, depth = Math.max(28, span * 1.3);
  const wallSet = await pbr('painted_plaster_wall', W / 2.2, 6 / 2.2);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(W, 6), new THREE.MeshStandardMaterial({ color: LOOK.wall, ...wallSet, roughness: 0.95, normalScale: new THREE.Vector2(0.6, 0.6) }));
  wall.position.set(0, 3, 0); scene.add(wall);
  const floorSet = await pbr('herringbone_parquet', W / 2.6, depth / 2.6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, depth), new THREE.MeshStandardMaterial({ color: LOOK.floor, ...floorSet, roughness: 0.6, envMapIntensity: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, depth / 2); scene.add(floor);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(W, 0.16, 0.05), new THREE.MeshStandardMaterial({ color: '#2a1712', roughness: 0.5 }));
  skirt.position.set(0, 0.08, 0.025); scene.add(skirt);
  for (const side of [-1,1]) {
    const end = new THREE.Mesh(new THREE.PlaneGeometry(depth, 6), wall.material);
    end.rotation.y = -side*Math.PI/2; end.position.set(side*W/2, 3, depth/2); scene.add(end);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: '#0d0d0d', emissive:'#110f0b', metalness: 0.6, roughness: 0.4 }));
  rail.position.set(0, 4.5, 2.2); scene.add(rail);
  const arch = buildArchitecture(scene, { span, depth, rail: rail.position });
  arch.setGlow(0);
  chapterBlocks.filter((_, i) => i % 2 === 1).forEach(b => buildBench(scene, b.cx, 3.2));
  const roomLight = new THREE.HemisphereLight('#ffd8b0', '#2a140c', 0);
  scene.add(roomLight);

  /* ---- 章节：洗墙灯 + 金箔章名 + 轨道灯头 ---- */
  const goldMat = t => new THREE.MeshStandardMaterial({ map: t, transparent: true, color: LOOK.gold, metalness: 0.75, roughness: 0.32, emissive: '#3a2a10', emissiveMap: t, emissiveIntensity: 0.5 });
  const headMat = new THREE.MeshStandardMaterial({ color: '#111', emissive:'#0e0c0a', metalness: 0.7, roughness: 0.35 });
  const washes = chapterBlocks.map(b => {
    const s = new THREE.SpotLight(LOOK.wallLit, 0, 12, 0.62, 0.85, 1.3);
    s.position.set(b.cx, 4.4, 3.4); s.target.position.set(b.cx, 1.9, 0); scene.add(s, s.target);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 16), headMat); head.position.set(b.cx, 4.38, 2.2); head.rotation.x = 0.7; scene.add(head);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), new THREE.MeshBasicMaterial({ color: '#000' })); lens.position.set(b.cx, 4.3, 2.12); lens.rotation.x = -0.9; scene.add(lens);
    const H = 0.62, plane = new THREE.Mesh(new THREE.PlaneGeometry(H * 1400 / 360, H), goldMat(chapterTitle(b.ch, b.ci)));
    plane.position.set(b.x0 + (H * 1400 / 360) / 2 - 0.05, Math.min(b.top + 0.55, 3.95), 0.01); scene.add(plane);
    let rule = null;
    if (b.ci) { rule = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 3.2), new THREE.MeshBasicMaterial({ color: '#c9a56a', transparent: true, opacity: 0.35 })); rule.position.set(b.x0 - LOOK.chapterGap / 2, 2.1, 0.005); scene.add(rule); }
    return { s, b, level: 0, lens, heading: plane, rule };
  });

  /* ---- 展品 ---- */
  const poolTex = gradientTex('rgba(255,214,160,1)', 'rgba(255,214,160,0)');
  const tagTex = darkTag();
  const frameMats = [
    new THREE.MeshStandardMaterial({ color: '#1e1410', roughness: 0.35, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: '#7d6136', roughness: 0.42, metalness: 0.8, envMapIntensity: 0.35 }),
    new THREE.MeshStandardMaterial({ color: '#3a2216', roughness: 0.5 })
  ];
  const brass = new THREE.MeshStandardMaterial({ color: '#b08a4a', metalness: 0.9, roughness: 0.3 });
  const time = { value: 0 };
  const lampColor = new THREE.Color(LOOK.lamp), ember = new THREE.Color('#ff8a3c');

  for (const it of items) {
    const { ex } = it, g = new THREE.Group(); g.position.set(it.x, it.y, 0); scene.add(g); it.g = g;
    const fm = frameMats[ex.kind === 'text' ? 2 : (ex.size === 3 ? 1 : (ex.id.length % 2 ? 0 : 2))];
    const frame = new THREE.Mesh(new THREE.BoxGeometry(it.ow, it.oh, 0.06), fm); frame.position.z = 0.03; g.add(frame);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(it.ow - 2 * it.mould, it.oh - 2 * it.mould), new THREE.MeshStandardMaterial({ color: '#d9cfbb', roughness: 0.95, envMapIntensity: 0.3 }));
    inner.position.z = 0.061; g.add(inner);
    const map = ex.kind === 'photo' ? images[ex.id] : textPanel(ex, sources[ex.source], it.aspect);
    const st = status(ex.id);
    const uni = { map: { value: map }, lit: { value: 0 }, develop: { value: st === 'dark' ? 0 : 1 }, ambient: { value: 0.3 }, time, isText: { value: ex.kind === 'text' ? 1 : 0 } };
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(it.w, it.h), new THREE.ShaderMaterial({ uniforms: uni, ...photoShader }));
    pic.position.z = 0.063; g.add(pic);
    // 黄铜画灯
    const lampW = Math.min(it.ow * 0.55, 0.6);
    const lamp = new THREE.Group(); lamp.position.set(0, it.oh / 2 + 0.12, 0); g.add(lamp);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2), brass); arm.rotation.x = Math.PI / 2 - 0.5; arm.position.set(0, 0.02, 0.07); lamp.add(arm);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, lampW, 16, 1, false, 0, Math.PI), brass); hood.rotation.z = Math.PI / 2; hood.position.set(0, 0.06, 0.15); lamp.add(hood);
    const bulbMat = new THREE.MeshBasicMaterial({ color: LOOK.lamp, toneMapped: false });
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(lampW * 0.92, 0.012, 0.02), bulbMat); bulb.position.set(0, 0.035, 0.15); lamp.add(bulb);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(it.ow * 1.9, it.oh * 1.5), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, color: '#ffcf96' }));
    pool.position.set(0, it.oh * 0.15, 0.004); g.add(pool);
    let pilot=null;
    if(st==='dark'){
      pilot=new THREE.Sprite(new THREE.SpriteMaterial({map:poolTex,color:'#ffa04d',transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
      pilot.scale.set(.33,.15,1);pilot.position.set(0,.037,.185);lamp.add(pilot);
    }
    const bl = it.oh * 0.95 + 0.25;
    const beamU = { intensity: { value: 0 }, reveal: { value: 0 }, time, len: { value: bl }, color: { value: new THREE.Color('#ffdcae') } };
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(lampW * 0.42, it.ow * 0.62, bl, 32, 1, true), new THREE.ShaderMaterial({ uniforms: beamU, ...beamShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.set(0, it.oh / 2 + 0.17 - bl / 2, 0.24); beam.rotation.x = -0.12; g.add(beam);
    const R = revealed[ex.id], info = st === 'done' && R ? R : ex;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.15), new THREE.MeshStandardMaterial({ map: plaque({ title: info.title, date: info.date, body: st === 'dark' ? ex.darkHint : labelFor(ex.id)?.text || '' }, { done: st === 'done' }), roughness: 0.8, transparent: true, opacity: 0 }));
    pl.position.set(it.ow / 2 + 0.2, -it.oh / 2 + 0.08, 0.012); g.add(pl);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.165), new THREE.MeshStandardMaterial({ map: tagTex, transparent: true, roughness: 0.9, side: THREE.DoubleSide }));
    tag.position.set(it.ow / 2 - 0.02, it.oh / 2 - 0.12, 0.09); tag.rotation.z = -0.18; tag.visible = st === 'dark'; g.add(tag);
    Object.assign(it, { frame, inner, pic, uni, bulbMat, pool, pilot, beam, beamU, plaque: pl, tag, state: st, level: 0, target: 0, develop: st === 'dark' ? 0 : 1, flicker: 0, on: false });
  }

  /* ---- 空气中的浮尘 ---- */
  const dust = makeBeamDust(items,time);
  scene.add(dust.points);

  /* ---- 后期：Bloom ---- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), LOOK.bloom.strength, LOOK.bloom.radius, LOOK.bloom.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---- 镜头 ---- */
  const cam = { x: 0, z: 22, y: 2.1, tx: 0, tz: 22, ty: 2.1, vx: 0, yaw: 0, yawT: 0, tilt: new THREE.Vector2(), tiltT: new THREE.Vector2() };
  let focused = null, mode = 'overview';
  const vTan = () => Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const distFor = (width, height) => Math.max(width / 2 / (vTan() * camera.aspect), height / 2 / vTan());
  const clampX = x => THREE.MathUtils.clamp(x, -span / 2, span / 2);
  const wide = () => camera.aspect > 1.2;
  function aim() {
    if (focused) {
      const it = items.find(i => i.ex.id === focused);
      cam.tx = it.x + (wide() ? it.ow * 0.5 + 0.35 : 0); cam.ty = it.y - (wide() ? 0 : it.oh * 0.42);
      cam.tz = distFor(it.ow * (wide() ? 2.6 : 1.25), it.oh * (wide() ? 1.7 : 2.6));
    } else if (mode === 'overview') {
      cam.tz = Math.min(distFor(Math.min(span, wide() ? 17 : 7), 4.2), 22); cam.ty = 2.0;
    } else {
      cam.tz = distFor(wide() ? 10.5 : 3.6, 3.3); cam.ty = wide() ? 1.95 : 1.75;
    }
  }
  function chapterAt(x) { let best = 0, d = 1e9; chapterBlocks.forEach((b, i) => { const dd = Math.abs(b.cx - x); if (dd < d) { d = dd; best = i; } }); return best; }

  /* ---- 输入：拖动平移、双指/滚轮缩放、轻点拾取 ---- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let onSelect = () => {}, onEmpty = () => {}, onPan = () => {}, inputOn = false;
  const pts = new Map(); let pinch0 = 0, down = null;
  const el = renderer.domElement;
  const pickables = () => items.flatMap(i => [i.pic, i.frame, i.tag, i.plaque]);
  function pdown(e) { if (!inputOn) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now() }; if (pts.size === 2) { pinch0 = pinchD(); down = null; } }
  function pmove(e) {
    cam.tiltT.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
    if (!inputOn || !pts.has(e.pointerId)) return;
    const p = pts.get(e.pointerId), dx = e.clientX - p.x; p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1 && down) {
      if (Math.abs(e.clientX - down.x) > 8) {
        if (focused) { focused = null; onEmpty(); }
        if (mode === 'overview') mode = 'chapter';
        const z = cam.tz; aim(); cam.tz = Math.min(cam.tz, z);
        const perPx = (2 * cam.z * vTan() * camera.aspect) / innerWidth;
        cam.tx = clampX(cam.tx - dx * perPx); cam.vx = -dx * perPx; onPan(chapterAt(cam.tx));
      }
    } else if (pts.size === 2) {
      const d = pinchD();
      if (d / pinch0 > 1.18) { if (mode === 'overview') { mode = 'chapter'; aim(); } pinch0 = d; }
      else if (d / pinch0 < 0.85) { focused = null; mode = 'overview'; aim(); onEmpty(); pinch0 = d; }
    }
  }
  function pup(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), d0 = down; down = null;
    if (moved < 9 && performance.now() - d0.t < 700) {
      ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects([...pickables(), wall]);
      const hit = hits[0], it = hit && items.find(i => [i.pic, i.frame, i.tag, i.plaque].includes(hit.object));
      if (it) { api.focus(it.ex.id); onSelect(it.ex); }
      else { focused = null; if (mode === 'overview' && hit) { mode = 'chapter'; cam.tx = clampX(hit.point.x); onPan(chapterAt(cam.tx)); } aim(); onEmpty(); }
    }
  }
  function pinchD() { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
  function wheel(e) {
    if (!inputOn) return; e.preventDefault();
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
      cam.tx = clampX(cam.tx + (e.deltaX || e.deltaY) * 0.003 * cam.z / 5); if (focused) { focused = null; onEmpty(); aim(); } onPan(chapterAt(cam.tx));
    } else if (e.deltaY < -4) { if (!focused && mode === 'overview') { mode = 'chapter'; aim(); } }
    else if (e.deltaY > 4) { focused = null; mode = 'overview'; aim(); onEmpty(); }
  }
  el.addEventListener('pointerdown', pdown); addEventListener('pointermove', pmove); addEventListener('pointerup', pup); addEventListener('pointercancel', pup);
  el.addEventListener('wheel', wheel, { passive: false });

  /* ---- 每帧 ---- */
  const v3 = new THREE.Vector3(), tmp = new THREE.Color();
  // Every entrance channel samples the same monotonic clock. Skipping therefore
  // has no pending per-lamp timers that could turn a finished light off again.
  let cursorTime = .50;
  const sweep = [];
  for (const w of washes) {
    const bay = items.filter(i => i.ex.chapter === w.b.ch.id).sort((a,b) => a.x-b.x || b.y-a.y);
    let count = 0;
    for (const it of bay) {
      it.start = cursorTime + count * .185;
      if (it.state !== 'dark') count++;
    }
    w.start = cursorTime + Math.max(0,count-1)*.185 + .95;
    sweep.push({t:cursorTime, x:bay[0].x}, {t:w.start, x:bay[bay.length-1].x});
    cursorTime = w.start + .29;
  }
  const duration = washes[washes.length-1].start + 1.18;
  const ramp = (age, span) => THREE.MathUtils.smoothstep(age, 0, span);
  const out = (age, span) => 1 - (1 - THREE.MathUtils.clamp(age/span,0,1)) ** 2;
  let intro = null, opened = false, entranceSeconds = 10.7;
  let panorama = null;
  const shotEye = new THREE.Vector3(), shotLook = new THREE.Vector3(), normalLook = new THREE.Vector3();
  function finishPanorama() {
    if (!panorama || panorama.phase !== 'showing') return;
    panorama.phase = 'held'; panorama.resolve();
  }
  function framePanorama(now) {
    const shot = panorama;
    if (!shot) return;
    // Frame both ends of the real hanging wall. Portrait looks down the gallery
    // from its left end so the nearest paintings retain their scale.
    const halfAngle = Math.atan(vTan()*camera.aspect)*.89;
    const format = THREE.MathUtils.clamp((camera.aspect-.5)/1.1,0,1);
    const farAngle = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(86,67,format));
    const bearing = farAngle-halfAngle, extent = span/2+.75;
    const z = 2*extent/(Math.tan(farAngle)-Math.tan(bearing-halfAngle));
    shotEye.set(-extent-z*Math.tan(bearing-halfAngle),1.68,z);
    shotLook.set(shotEye.x+z*Math.tan(bearing),2.04,0);
    // Step behind the benches in portrait. Frame the two ends of the wall
    // from inside the end bay, widening the lens only during the panorama.
    const portrait = THREE.MathUtils.clamp((.88-camera.aspect)/.36,0,1);
    let panoramaZoom = 1;
    if (portrait) {
      const aisleZ = 7.8, eyeX = -extent-8.2;
      const near = Math.atan2(-extent-eyeX,aisleZ), far = Math.atan2(extent-eyeX,aisleZ);
      const center = (near+far)/2 + .018, halfView = (center-near)*1.06;
      const aisleZoom = Math.min(1,vTan()*camera.aspect/Math.tan(halfView));
      shotEye.x = THREE.MathUtils.lerp(shotEye.x,eyeX,portrait);
      shotEye.z = THREE.MathUtils.lerp(shotEye.z,aisleZ,portrait);
      shotLook.x = THREE.MathUtils.lerp(shotLook.x,eyeX+aisleZ*Math.tan(center),portrait);
      panoramaZoom = THREE.MathUtils.lerp(1,aisleZoom,portrait);
    }
    const age = now-shot.start, leaving = shot.phase==='leaving';
    const k = leaving ? 1-ramp(age,shot.reduced?1:1050) :
      shot.phase==='held' || shot.reduced ? 1 : ramp(age,shot.move);
    const zoom = THREE.MathUtils.lerp(leaving ? 1 : shot.fromZoom, panoramaZoom, k);
    if (camera.zoom !== zoom) { camera.zoom = zoom; camera.updateProjectionMatrix(); }
    if (leaving) {
      camera.position.lerp(shotEye,k); normalLook.lerp(shotLook,k);
    } else {
      camera.position.lerpVectors(shot.fromEye,shotEye,k);
      normalLook.lerpVectors(shot.fromLook,shotLook,k);
    }
    camera.lookAt(normalLook);
    const distance = Math.hypot(extent-shotEye.x,shotEye.z);
    scene.fog.near = 14+k*Math.max(0,distance-14);
    scene.fog.far = 34+k*Math.max(0,distance+16-34);
    if (leaving && k===0) panorama=null;
    if (shot.phase==='showing' && age>=shot.move+shot.hold) finishPanorama();
  }
  const endBay = chapterBlocks[Math.floor(chapterBlocks.length/2)];
  const firstPilot = [...items].filter(it=>it.state==='dark').sort((a,b)=>a.x-b.x)[0];
  const finalDistance = () => Math.min(distFor(wide()?17:4.8,4.2),22);
  function finishEntrance() {
    if (opened) return;
    opened = true;
    for (const w of washes) w.level = 1;
    for (const it of items) if (it.state !== 'dark') it.target = it.level = 1;
    cam.yaw = cam.yawT = 0; cam.tx = endBay.cx;
    mode = 'overview'; aim(); cam.tz = finalDistance(); cam.x = cam.tx; cam.z = cam.tz; cam.y = cam.ty;
    if (intro) { const done = intro.resolve; intro = null; done(); }
  }
  function followWave(sec) {
    const behind = sec-.57;
    const next = sweep.findIndex(p => p.t > behind);
    const a = sweep[next < 0 ? sweep.length-1 : Math.max(0,next-1)], b = next < 0 ? a : sweep[next];
    const x = a === b ? a.x : THREE.MathUtils.lerp(a.x,b.x,ramp(behind-a.t,b.t-a.t));
    const straighten = ramp(sec-(duration-1.35),1.3);
    const z = Math.min(distFor(wide()?10.3:3.9,3.7),12);
    const opening = 1-ramp(sec-.32,1.18);
    const yaw = ((wide()?.44:.32)+(wide()?.7:1.36)*opening)*(1-straighten);
    const waveCenter = THREE.MathUtils.lerp(x-.42,firstPilot?.x ?? x,opening);
    // Aim at the paintings already emerging, with the coming lamps on the right.
    cam.x = cam.tx = THREE.MathUtils.lerp(waveCenter,endBay.cx,straighten)-yaw*4;
    cam.z = cam.tz = THREE.MathUtils.lerp(z,finalDistance(),straighten);
    cam.y = cam.ty = 1.98; cam.yaw = cam.yawT = yaw;
  }
  function update(dt, t) {
    time.value = t;
    let sec = opened ? duration : -1;
    if (intro) {
      sec = (performance.now()-intro.start)/1000*intro.speed;
      if (sec >= duration) finishEntrance(); else followWave(sec);
    }
    const house = opened ? 1 : ramp(sec-washes[0].start,duration-2);
    roomLight.intensity = .55*house; scene.environmentIntensity = .0015 + .2185*house;
    scene.background.setRGB(.0004+.009*house,.0002+.004*house,.0001+.002*house);
    scene.fog.color.copy(scene.background);
    const k = 1 - Math.pow(0.004, dt);
    if (!down && Math.abs(cam.vx) > 1e-4) { cam.tx = clampX(cam.tx + cam.vx * 0.9); cam.vx *= 0.86; }
    cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k; cam.z += (cam.tz - cam.z) * k * 0.7;
    cam.tilt.lerp(cam.tiltT, 0.04);
    cam.yaw += (cam.yawT - cam.yaw) * k * 0.6;     // 进场镜头：沿墙斜看，再转正
    camera.position.set(cam.x + cam.tilt.x * 0.3 - cam.yaw * cam.z * 0.9, cam.y - cam.tilt.y * 0.15, cam.z);
    normalLook.set(cam.x - cam.tilt.x * 0.12 + cam.yaw * 4, cam.y - 0.05, 0);
    camera.lookAt(normalLook);
    framePanorama(performance.now());
    for (const w of washes) {
      w.level = opened ? 1 : ramp(sec-w.start,1);
      w.s.intensity = 28*w.level; w.lens.material.color.setScalar(3*w.level);
      w.heading.material.opacity = w.level; if (w.rule) w.rule.material.opacity = .35*w.level;
    }
    for (const [index,it] of items.entries()) {
      const age = sec-it.start;
      const dark = it.state === 'dark';
      const tube = opened ? 1 : out(age,.5), pool = opened ? 1 : out(age-.13,.78);
      if (opened) it.level += (it.target-it.level)*(1-Math.pow(.03,dt));
      else it.level = dark ? 0 : ramp(age-.33,.48);
      let f = 1;
      if (it.flicker > 0) { it.flicker -= dt; const p = it.flicker; f = p > 1 ? (Math.sin(t*70)>.2?1:.1) : p>.8?.15:p>.65?1:p>.55?.3:1; }
      const light = it.level*f, crest = it.waveLight || 0;
      it.uni.lit.value = dark ? 0 : light + .44*crest;
      dust.levels[index] = it.uni.lit.value;
      it.uni.ambient.value = dark ? .11*house : .30*(opened?1:it.level);
      it.inner.material.color.setScalar(dark ? .16*house : .001+.72*(opened?1:ramp(age-.22,.63)));
      it.plaque.material.opacity = dark ? house : opened ? 1 : ramp(age-.68,.27);
      if (dark) {
        const pulse = opened ? .15*(1+Math.sin(t*2.2+it.x)) : Math.exp(-((age-.28)**2)/.07);
        it.bulbMat.color.copy(ember).multiplyScalar(.34+3*pulse);
        it.tag.rotation.z = -.18+Math.sin(t*1.3+it.x)*.05;
        it.pool.material.opacity = (opened?.015:0)+.09*pulse;
        if(it.pilot)it.pilot.material.opacity=.46+.54*pulse;
      } else {
        if(it.pilot)it.pilot.visible=false;
        it.bulbMat.color.copy(lampColor).multiplyScalar(3.28*(opened?light:tube) + 1.6*crest);
        it.pool.material.opacity = .33*(opened?light:pool) + .46*crest;
        const spread = .25+.75*pool + .20*crest;
        it.pool.scale.set(spread,spread,1); it.pool.position.y = it.oh*(.15+.37*(1-spread));
      }
    }
  }
  function render() { composer.render(); }
  function resize(w, h) {
    camera.aspect = w / h; camera.updateProjectionMatrix();
    dust.uniforms.portrait.value = 1-THREE.MathUtils.smoothstep(camera.aspect,.62,1.18);
    dust.uniforms.viewHeight.value = h;
    dust.uniforms.pixelRatio.value = renderer.getPixelRatio();
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
    aim();
  }

  /* ---- 对外接口 ---- */
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const api = {
    scene, camera, arch, update, render, resize, chapters: chapterBlocks, items,
    set onSelect(f) { onSelect = f; }, set onEmpty(f) { onEmpty = f; }, set onPan(f) { onPan = f; },
    set input(v) { inputOn = v; },
    get focused() { return focused; },
    /** 进场：先看全墙，各章洗墙灯与画灯由左到右逐一亮起 */
    lightsOn(short = false) {
      if (opened) return Promise.resolve();
      mode = 'chapter'; entranceSeconds = short ? 2.85 : 10.7;
      return new Promise(resolve => { intro = { start: performance.now(), speed: duration/entranceSeconds, resolve }; });
    },
    get entrance() { return { elapsed: intro ? (performance.now()-intro.start)/1000 : opened ? entranceSeconds : -1, duration:entranceSeconds, opened, washes: washes.map(w=>w.level) }; },
    instantOn: finishEntrance,
    showPanorama(short) {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const fromLook = camera.getWorldDirection(new THREE.Vector3());
      fromLook.multiplyScalar(camera.position.z/Math.max(.08,-fromLook.z)).add(camera.position);
      return new Promise(resolve => {
        panorama={phase:'showing',fromEye:camera.position.clone(),fromLook,fromZoom:camera.zoom,reduced,
          start:performance.now(),move:reduced?1:short?850:2050,hold:short?1300:2650,resolve};
      });
    },
    skipPanorama() {
      if (panorama?.phase!=='showing') return;
      panorama.start=performance.now()-panorama.move-panorama.hold;
    },
    leavePanorama() {
      if (panorama) {
        if (panorama.phase==='showing') panorama.resolve();
        panorama.phase='leaving'; panorama.start=performance.now();
      }
    },
    get panoramaPhase() {return panorama?.phase ?? null;},
    overview() { focused = null; mode = 'overview'; aim(); },
    goChapter(i) { focused = null; mode = 'chapter'; cam.tx = chapterBlocks[i].cx; aim(); },
    focus(id) { const it = items.find(i => i.ex.id === id); focused = id; mode = 'chapter'; aim(); return it; },
    unfocus() { focused = null; aim(); },
    screenPos(id) {
      const it = items.find(i => i.ex.id === id); if (!it) return null;
      v3.set(it.x, it.y + it.oh / 2 + 0.2, 0.1).project(camera);
      return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight, on: v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05 };
    },
    darkItems() { return items.filter(i => i.state === 'dark'); },
    /** 点亮：镜头推近 → 画灯闪亮 → 光柱 → 显影；显影过半时 resolve */
    async lightUp(id, result) {
      const it = items.find(i => i.ex.id === id); if (!it) return;
      const R = revealed[id] || it.ex;
      api.focus(id); await wait(1300);
      it.state = 'done'; it.tag.visible = false;
      it.plaque.material.map = plaque({ title: R.title, date: R.date, body: result.text }, { done: true }); it.plaque.material.needsUpdate = true;
      it.target = 1; it.level = 0.001; it.flicker = 1.35;
      await wait(700);
      const t0 = performance.now();
      return new Promise(res => {
        let done = false;
        const step = () => {
          const s = (performance.now() - t0) / 1000;
          it.beamU.intensity.value = 0.38 * Math.min(1, s / 0.5) * (s > 4.5 ? Math.max(0.25, 1 - (s - 4.5) / 2.5) : 1);
          it.beamU.reveal.value = Math.min(1, s / 1.0);
          it.uni.develop.value = Math.min(1, Math.max(0, (s - 0.7) / 2.8));
          if (s > 3.4 && !done) { done = true; res(); }
          if (s < 7.2) requestAnimationFrame(step);
        };
        step();
      });
    },
    allLitPreview() { items.forEach(it => { if (it.state === 'dark') { it.state = 'done'; it.tag.visible = false; it.target = 1; it.uni.develop.value = 1; it.flicker = 1 + Math.random(); it.beamU.reveal.value = 1; it.beamU.intensity.value = 0.25; } }); },
    dispose() { el.removeEventListener('pointerdown', pdown); removeEventListener('pointermove', pmove); removeEventListener('pointerup', pup); removeEventListener('pointercancel', pup); el.removeEventListener('wheel', wheel); }
  };
  aim();
  return api;
}
