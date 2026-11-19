/*
 * 宜山调研现场 v3：依照片透视推测重建的文庙大门一角。
 * ------------------------------------------------------------------
 * 视觉：Poly Haven CC0 PBR 材质（灰泥、条石、乱石、泥地）；花窗是真实挖孔的几何体，
 *       低角度的阳光从墙后穿过花窗，在台阶上投下十字形光斑；树用叶片面片拼成；
 *       后期：环境光遮蔽 GTAO（仅桌面）+ 轻 Bloom + 暖调颗粒。照片底片在后期之后单独叠加，不被调色污染。
 * 玩法：①重返机位 ②现场取证（四条线索）③去档案台写展签。
 * 几何估算依据（米，相机位于原点、朝 -z）：人物身高约占画面 0.63 → 人距相机约 3.7 m；
 *   门柱宽约占 0.116 → 门约 5.7–6 m；相机离地约 1.28 m；门洞中心在画面 0.44 处。均为推测，界面处处标注“非实测”。
 * 接口：createSite({ renderer, ui, data, guide, onArchive, onExit }) → { scene, camera, update, render, resize, dispose, test }
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { brushWrite, inkText } from '../brush.js';

import { weatherMaterials, dressLandscape, addAir } from './yishan-landscape.js';

const PHOTO_VFOV = 40;
const CAM = new THREE.Vector3(0.31, 1.28, 0);
const TARGET = new THREE.Vector3(0.31, 1.28, -4.5);
const R0 = CAM.distanceTo(TARGET);
const SUN = { pos: new THREE.Vector3(-5.5, 10.5, -15), color: '#ffead2', intensity: 3.1 };

const Grade = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: 0.08 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, amount; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(.299,.587,.114));
      c = mix(c, vec3(l*1.08, l*.96, l*.8), amount);
      c *= mix(1., .62, smoothstep(.45, 1.05, length(vUv - .5) * 1.25));
      c += (h(vUv * 900. + time) - .5) * .014;
      gl_FragColor = vec4(c, 1.);
    }`
};

export function createSite({ renderer, ui, data, guide, narrate, onArchive, onExit }) {
  const desktop = !matchMedia('(pointer: coarse)').matches && innerWidth >= 720;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 120);
  const overlay = new THREE.Scene(); overlay.add(camera);

  /* ================= 天空与环境 ================= */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#c9d3d6') }, mid: { value: new THREE.Color('#efe3cc') }, sun: { value: SUN.pos.clone().normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, mid, sun; varying vec3 vD;
      void main(){ float h = clamp(vD.y, 0., 1.); vec3 c = mix(mid, top, pow(h, .6));
        c += vec3(1., .85, .6) * pow(max(dot(vD, sun), 0.), 40.) * .8; gl_FragColor = vec4(c, 1.); }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(94,32,16),skyMat); sky.userData.noAO = true; sky.renderOrder = -10; scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), skyMat));
  scene.environment = pmrem.fromScene(envScene, 0.02).texture; scene.environmentIntensity = 0.55;
  scene.fog = new THREE.Fog('#e9dcc4', 16, 55);

  /* ================= 材质 ================= */
  const loader = new THREE.TextureLoader();
  const pbr = (name, opts = {}) => {
    const t = k => { const x = loader.load(`assets/textures/${name}/${k}.jpg`); x.wrapS = x.wrapT = THREE.RepeatWrapping; if (k === 'diff') x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 8; return x; };
    return new THREE.MeshStandardMaterial({ map: t('diff'), normalMap: t('nor'), roughnessMap: t('arm'), roughness: 1, ...opts });
  };
  const M = {
    plaster: pbr('painted_plaster_wall', { color: '#efe6d4' }),
    stone: pbr('monastery_stone_floor', { color: '#d4cbbb' }),
    rubble: pbr('rustic_stone_wall', { color: '#bdb3a2' }),
    ground: pbr('dirt_floor', { color: '#c8baa2' })
  };
  weatherMaterials(M);
  function uvBox(geo, w, h, d, s) {
    const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / s, uv.getY(k) * dims[f][1] / s); }
    return geo;
  }
  const box = (w, h, d, mat, x, y, z, s = 2) => {
    const m = new THREE.Mesh(uvBox(new THREE.BoxGeometry(w, h, d), w, h, d, s), mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
  };

  /* ================= 重建 ================= */
  const LAND = 1.162, STEPS = 7, RISE = LAND / STEPS, TREAD = 0.3, Z0 = -3.3, ZL = Z0 - STEPS * TREAD;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), M.ground);
  { const uv = ground.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 33, uv.getY(i) * 33); }
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, Z0 + 12); ground.receiveShadow = true; scene.add(ground);
  for (let i = 0; i < STEPS; i++) { const h = (i + 1) * RISE, zf = Z0 - i * TREAD, d = zf - ZL; box(2.8, h, d, M.stone, 0.1, h / 2, (zf + ZL) / 2, 1.4); }
  box(18, LAND, 12, M.stone, 0, LAND / 2, ZL - 6, 2.2);
  const slope = Math.atan2(LAND, Z0 - ZL), len = Math.hypot(LAND, Z0 - ZL) + 0.25;
  for (const [x,outer] of [[-1.42,-7.8],[1.62,8]]) {
    const edge=x+Math.sign(x)*.16, midZ=(Z0+ZL)/2;
    box(Math.abs(outer-edge),LAND,Z0-ZL,M.rubble,(outer+edge)/2,LAND/2,midZ,1.6);
    // The stair coping follows the original incline. Give it a continuous
    // stone cheek; otherwise the terrace swallows the slope and only its toe shows.
    const cheek=new THREE.BoxGeometry(.32,1,Z0-ZL), pos=cheek.attributes.position;
    for(let i=0;i<pos.count;i++) {
      const rise=(.5-pos.getZ(i)/(Z0-ZL))*LAND;
      pos.setY(i,pos.getY(i)>0?rise+.08:0);
    }
    cheek.computeVertexNormals();
    const support=new THREE.Mesh(cheek,M.stone);support.position.set(x,0,midZ);
    support.receiveShadow=support.castShadow=true;scene.add(support);
    const p=box(.32,.24,len,M.stone,x,LAND/2+.13,midZ,1);p.rotation.x=slope;
  }
  for (const x of [-1.2, 1.2]) box(0.62, 4.8, 0.64, M.plaster, x, LAND + 2.4, -5.95, 1.8);
  function latticeGeo(W, H, cell) {
    const s = new THREE.Shape(); s.moveTo(-W / 2, -H / 2); s.lineTo(W / 2, -H / 2); s.lineTo(W / 2, H / 2); s.lineTo(-W / 2, H / 2); s.closePath();
    const cols = Math.floor(W / cell), rows = Math.floor(H / cell), ox = -cols * cell / 2, oy = -rows * cell / 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const cx = ox + (c + 0.5) * cell, cy = oy + (r + 0.5) * cell, a = cell * 0.36, b = cell * 0.13;
      const p = new THREE.Path();
      [[-b, -a], [b, -a], [b, -b], [a, -b], [a, b], [b, b], [b, a], [-b, a], [-b, b], [-a, b], [-a, -b], [-b, -b]].forEach(([x, y], i) => (i ? p.lineTo(cx + x, cy + y) : p.moveTo(cx + x, cy + y)));
      p.closePath(); s.holes.push(p);
      if (r < rows - 1 && c < cols - 1) {
        const dx = ox + (c + 1) * cell, dy = oy + (r + 1) * cell, q = cell * 0.09, d = new THREE.Path();
        d.moveTo(dx, dy - q); d.lineTo(dx + q, dy); d.lineTo(dx, dy + q); d.lineTo(dx - q, dy); d.closePath(); s.holes.push(d);
      }
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.26, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -0.13);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.8, uv.getY(i) / 1.8);
    return g;
  }
  const latG = latticeGeo(5.5, 1.36, 0.34);
  for (const sgn of [-1, 1]) {
    const cx = sgn * (1.5 + 2.75);
    box(5.5, 2.6 - LAND, 0.32, M.plaster, cx, LAND + (2.6 - LAND) / 2, -6.06, 1.8);
    box(5.5, 1.5, 0.32, M.plaster, cx, 3.96 + 0.75, -6.06, 1.8);
    const lat = new THREE.Mesh(latG, M.plaster); lat.position.set(cx, 3.28, -6.06); lat.castShadow = lat.receiveShadow = true; scene.add(lat);
    box(5.7, 0.14, 0.46, M.stone, cx, 5.5, -6.06, 1);
  }
  // Beyond the surviving frame: restrained masses, all dimensions conjectural.
  const courtyard = new THREE.MeshStandardMaterial({ color: '#686453', roughness: 1 });
  const roofs = new THREE.MeshStandardMaterial({ color: '#535448', roughness: 1, flatShading: true });
  function shelter(x, floor, z, width, depth, height) {
    box(width, height, depth, courtyard, x, floor + height/2, z);
    const length = width * .56, ridge = width * .36, halfDepth = depth * .63;
    const eave = floor + height, peak = eave + depth * .32;
    const vertices = [-length,eave,halfDepth, length,eave,halfDepth, length,eave,-halfDepth,
      -length,eave,-halfDepth, -ridge,peak,0, ridge,peak,0];
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geom.setIndex([0,1,5,0,5,4,1,2,5,2,3,4,2,4,5,3,0,4]);
    geom.computeVertexNormals();
    const roof = new THREE.Mesh(geom, roofs); roof.position.set(x,0,z); scene.add(roof);
  }
  for (const sign of [-1,1]) {
    const x = sign * 12;
    // Continue the existing window band for another bay, then turn the wall.
    const bay = sign * 9.75;
    box(5.5,2.6-LAND,.32,M.plaster,bay,(LAND+2.6)/2,-6.06);
    const panel = new THREE.Mesh(latG,M.plaster);
    panel.position.set(bay,3.28,-6.06); panel.castShadow = panel.receiveShadow = true; scene.add(panel);
    box(5.5,LAND+3.55-3.96,.32,M.plaster,bay,(LAND+3.55+3.96)/2,-6.06);
    box(4.5,3.55,.38,M.plaster,sign*14.75,LAND+1.775,-6.06);
    box(10.04,.16,.58,M.stone,x,LAND+3.63,-6.06);
    box(.44,3.55,6,M.plaster,sign*16.82,LAND+1.775,-9.2);
    box(.62,.16,6.1,M.stone,sign*16.82,LAND+3.63,-9.2);
    const edge = sign < 0 ? 7.8 : 8;
    box(17.3-edge,LAND,2.1,M.rubble,sign*(17.3+edge)/2,LAND/2,(Z0+ZL)/2);
    box(8.3,LAND,12,M.stone,sign*13.15,LAND/2,ZL-6);
    // Buttresses finish the joints; worn stones mark the edges of the forecourt.
    for (const offset of [7.2,12.5,16.8]) box(.48,3.68,.52,M.plaster,sign*offset,LAND+1.84,-6);
    shelter(sign*20,0,-12,5.3,3.5,2.6);
  }
  box(18,LAND,11,M.ground,0,LAND/2,-22.9,3);
  shelter(-1.7,LAND,-23,9.4,4,2.8);
  // A shallow bank rounds off each end of the terrace.
  for (const sign of [-1, 1]) {
    const slope = new THREE.BufferGeometry();
    const inner = sign * 17.25, outer = sign * 23;
    const corners = [inner,LAND,-3.3, outer,0,-2.6, inner,LAND,-17.4, outer,0,-18];
    slope.setAttribute('position',new THREE.Float32BufferAttribute(corners,3));
    slope.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,2,0,0,5,2,5],2));
    slope.setIndex(sign>0?[0,1,2,1,3,2]:[0,2,1,1,2,3]);
    slope.computeVertexNormals();scene.add(new THREE.Mesh(slope,M.ground));
  }
  const leafTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    for (let i = 0; i < 26; i++) { const x = 20 + Math.random() * 88, y = 20 + Math.random() * 88, r = 7 + Math.random() * 10, l = 60 + Math.random() * 50;
      g.fillStyle = `rgb(${l * 0.75 | 0},${l * 0.85 | 0},${l * 0.55 | 0})`; g.beginPath(); g.ellipse(x, y, r, r * 0.55, Math.random() * 3, 0, 6.28); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, color: '#9aa085' });
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a4236', roughness: 1 });
  const dummy = new THREE.Object3D();
  [[-1.6, 4.6, -10, 2.1], [0.4, 5.4, -12.5, 2.8], [2.3, 4.2, -9.6, 1.8], [-0.6, 3.8, -8.8, 1.5], [3.9, 5.2, -13, 2.5], [-3.6, 4.8, -12, 2.2]].forEach(([x, y, z, r]) => {
    const n = Math.round((desktop ? 150 : 50) * r), inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.9), leafMat, n);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 6.28, vv = Math.acos(2 * Math.random() - 1), rr = r * Math.cbrt(Math.random());
      dummy.position.set(x + rr * Math.sin(vv) * Math.cos(u), y + rr * Math.cos(vv) * 1.2, z + rr * Math.sin(vv) * Math.sin(u));
      dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); dummy.scale.setScalar(0.7 + Math.random() * 0.6);
      dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
    }
    inst.castShadow = true; scene.add(inst);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, y - LAND, 8), trunkMat); tr.position.set(x, LAND + (y - LAND) / 2 - r * 0.5, z); tr.castShadow = true; scene.add(tr);
  });
  const treeAudit = dressLandscape({scene,materials:M,desktop,cameraAtPhoto:CAM,aspect:data.photo.aspect,vfov:PHOTO_VFOV,target:TARGET});
  addAir(scene, desktop);

  /* ================= 光 ================= */
  scene.add(new THREE.HemisphereLight('#e9eef0', '#8a7a62', 1.5));
  const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity);
  sun.position.copy(SUN.pos); sun.target.position.set(0, 0, -4); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(desktop ? 2048 : 512, desktop ? 2048 : 512);
  sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  const fill = new THREE.DirectionalLight('#fff1dc', 0.55); fill.position.set(3, 4, 8); scene.add(fill);

  /* ================= 后期 ================= */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (desktop) { gtao = new GTAOPass(scene, camera, 640, 480); gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.1 }); gtao.blendIntensity = .48;
    const hide = gtao.overrideVisibility.bind(gtao);
    gtao.overrideVisibility = () => { hide(); scene.traverse(o=>{ if (o.userData.noAO || o.material?.alphaTest || o.material?.transparent) o.visible=false; }); };
    composer.addPass(gtao); }
  if (desktop) composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.6, 0.92));
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(Grade); composer.addPass(grade);

  /* ================= 照片底片（在后期之后叠加） ================= */
  const photoTex = loader.load(data.photo.src); photoTex.colorSpace = THREE.SRGBColorSpace;
  const plateMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: photoTex }, opacity: { value: 0 }, wipe: { value: 1 }, edge: { value: new THREE.Color('#b4391f') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float opacity; uniform float wipe; uniform vec3 edge; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(map, vUv);
        float line = smoothstep(0.004, 0.0, abs(vUv.x - wipe)) * step(0.001, wipe) * step(wipe, 0.999);
        if (vUv.x > wipe && line < 0.01) discard;
        gl_FragColor = vec4(mix(c.rgb, edge, line), opacity);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: false, depthWrite: false
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), plateMat); plate.position.z = -1; camera.add(plate);

  /* ================= 界面 ================= */
  ui.innerHTML = `
    <div class="site-top">
      <button class="ghost-btn" data-act="exit" aria-label="回到展厅">← 展厅</button>
      <div class="site-title"><b>${data.place}</b><span>${data.gone} · ${data.reconstructionNote}</span></div>
    </div>
    <button class="site-conjecture" data-ref="court" type="button">院内与远景 · 推测·示意</button>
    <div class="steps" data-ref="steps">${guide.steps.map((s, i) => `<span data-i="${i}"><b>${i + 1}</b>${s}</span>`).join('')}</div>
    <div class="site-intro" data-ref="intro"></div>
    <img class="photo-guide" data-ref="ghost" src="${data.photo.src}" alt="">
    <div class="photo-cap" data-ref="cap"><span>${data.photo.caption}</span><small>${data.photo.credit}</small></div>
    <div class="markers" data-ref="markers"></div>
    <div class="drag-hint" data-ref="drag"><i></i></div>
    <div class="site-note" data-ref="note"></div>
    <div class="site-bottom" data-ref="bottom">
      <div class="meter" data-ref="meter"><i></i><span data-ref="meterText">${data.align.hint}</span></div>
      <div class="wipe-label"><span>← 重建</span><span>${data.align.compare}</span><span>照片 <output data-ref="wipeValue">100%</output> →</span></div>
      <input class="wipe" data-ref="wipe" type="range" min="0" max="1000" value="1000" aria-label="${data.align.compare}">
      <div class="notebook" data-ref="notebook"></div>
    </div>
    <div class="clue-card" data-ref="card" role="dialog" aria-live="polite"></div>`;
  const $ = s => ui.querySelector(`[data-ref="${s}"]`);
  ui.querySelector('[data-act="exit"]').onclick = () => onExit();
  const setStep = n => $('steps').querySelectorAll('span').forEach((s, i) => { s.classList.toggle('on', i === n); s.classList.toggle('done', i < n); });
  let noteT = 0;
  const say = (text, ms = 6000) => { const n = $('note'); clearTimeout(noteT); n.classList.add('show'); inkText(n, text, { step: 26 }); if (ms) noteT = setTimeout(() => n.classList.remove('show'), ms); };

  $('court').onclick = () => say('甲②记载，宜山文庙没有留下当时的全景照片。院内殿影、门外民居、远山、阔叶树、竹丛和来路均为环境推测示意，未经实测。',9000);
  /* ================= 状态 ================= */
  let phase = 'intro', idle = 0, hinted = 0, opened = 0;
  const sph = { az: 0.66, el: 0.25, r: 13.5 }, goal = { ...sph };
  let good = 0, snapT = 0, plateOpacity = 0, wipe = 1;
  const found = new Set();
  const view = { w: 1, h: 1, k: 0.86, pw: 1, ph: 1, cy: 0 };

  const intro = $('intro');
  intro.innerHTML = `<article class="intro-card">
      <figure class="ic-photo"><img src="${data.photo.src}" alt=""></figure>
      <p class="ic-k">调研现场 · 第一件</p>
      <h2 data-ref="ictitle"></h2>
      <span class="stamp">${data.gone}</span>
      <div class="lines">${data.intro.map(() => '<p></p>').join('')}</div>
      <button class="btn red big" type="button" data-act="begin">开始寻找机位</button>
    </article>`;
  ui.dataset.phase = 'intro'; setStep(0);
  (async () => {
    const card = intro.querySelector('.intro-card');
    await brushWrite(card.querySelector('[data-ref="ictitle"]'), '宜山文庙', { speed: 1.3, rough: 1.1 });
    card.classList.add('stamped');
    const ps = card.querySelectorAll('.lines p');
    for (let i = 0; i < ps.length; i++) await inkText(ps[i], data.intro[i], { step: 36 });
    card.classList.add('ready');
  })();
  intro.querySelector('[data-act="begin"]').onclick = () => {
    intro.classList.add('out'); phase = 'align'; ui.dataset.phase = 'align'; idle = 0;
    narrate?.('yishan', { cue: 'align', once: false, whileVisible: () => phase === 'align' });
  };

  /* ================= 输入 ================= */
  const pointers = new Map(); let pinch0 = 0;
  const el = renderer.domElement;
  function down(e) { if (phase !== 'align') return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.size === 2) pinch0 = pinchDist(); }
  function move(e) {
    if (!pointers.has(e.pointerId) || phase !== 'align') return;
    const p = pointers.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) { goal.az = THREE.MathUtils.clamp(goal.az - dx * 0.005, -1.48, 1.48); goal.el = THREE.MathUtils.clamp(goal.el + dy * 0.004, -0.05, 0.95); }
    else if (pointers.size === 2) { const d = pinchDist(); goal.r = THREE.MathUtils.clamp(goal.r * pinch0 / d, 3, 15); pinch0 = d; }
    $('drag').classList.remove('show');
  }
  function up(e) { pointers.delete(e.pointerId); }
  function wheel(e) { if (phase !== 'align') return; e.preventDefault(); goal.r = THREE.MathUtils.clamp(goal.r * (1 + e.deltaY * 0.001), 3, 15); }
  function pinchDist() { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
  el.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  el.addEventListener('wheel', wheel, { passive: false });
  const wipeInput = $('wipe');
  function setWipe(fraction) {
    wipe = THREE.MathUtils.clamp(fraction, 0, 1);
    wipeInput.value = Math.round(wipe * 1000); $('wipeValue').textContent = Math.round(wipe * 100) + '%';
    idle = 0;
  }
  wipeInput.addEventListener('input', () => setWipe(wipeInput.valueAsNumber / 1000));

  /* ================= 线索 ================= */
  data.clues.forEach((c, i) => {
    const b = document.createElement('button'); b.className = 'marker'; b.dataset.id = c.id; b.style.animationDelay = `${0.3 + i * 0.25}s`;
    b.innerHTML = `<i></i><span>${c.title}</span>`; b.onclick = () => openClue(c);
    $('markers').appendChild(b); c.el = b;
  });
  function openClue(c) {
    idle = 0; opened++;
    const card = $('card');
    card.innerHTML = `<p class="k">线索 · ${c.title}${c.honesty ? ' · <em>关于重建</em>' : ''}</p><p class="t"></p>` +
      (c.source ? `<blockquote><b>${c.source.mark}</b>${c.source.text}</blockquote>` : '') +
      `<div class="row"><button class="btn red" data-act="keep">${found.has(c.id) ? '已记入笔记' : '记入调研笔记'}</button><button class="btn ghost" data-act="close">再看看</button></div>`;
    card.classList.add('show'); inkText(card.querySelector('.t'), c.text, { step: 22 });
    card.querySelector('[data-act="keep"]').onclick = () => { found.add(c.id); c.el.classList.add('done'); card.classList.remove('show'); renderNotebook(); if (found.size === data.clues.length) { say(guide.collectDone, 0); setStep(2); } };
    card.querySelector('[data-act="close"]').onclick = () => card.classList.remove('show');
  }
  function renderNotebook() {
    const nb = $('notebook'), all = data.clues.length;
    nb.innerHTML = `<span class="nb-k">调研笔记</span>` + data.clues.map(c => `<span class="nb-dot ${found.has(c.id) ? 'on' : ''}">${c.title}</span>`).join('') +
      `<button class="btn ${found.size === all ? '' : 'wait'}" data-act="archive" ${found.size === all ? '' : 'disabled'}>${found.size === all ? '去档案台写展签 →' : `还差 ${all - found.size} 条线索`}</button>`;
    nb.querySelector('[data-act="archive"]').onclick = () => onArchive([...found]);
  }
  renderNotebook();

  /* ================= 每帧 ================= */
  const v = new THREE.Vector3();
  const score = () => Math.max(0, 1 - Math.hypot(sph.az / 0.32, sph.el / 0.22, (sph.r - R0) / 2.2));
  function update(dt, t) {
    const k = 1 - Math.pow(0.002, dt);
    sph.az += (goal.az - sph.az) * k; sph.el += (goal.el - sph.el) * k; sph.r += (goal.r - sph.r) * k;
    camera.position.set(TARGET.x + sph.r * Math.sin(sph.az) * Math.cos(sph.el), TARGET.y + sph.r * Math.sin(sph.el), TARGET.z + sph.r * Math.cos(sph.az) * Math.cos(sph.el));
    camera.lookAt(TARGET); camera.updateMatrixWorld();
    grade.uniforms.time.value = t;
    idle += dt;
    if (phase === 'align') {
      const s = score();
      $('meter').style.setProperty('--s', s.toFixed(3));
      $('meterText').textContent = s > 0.82 ? data.align.near : s > 0.4 ? '方向对了，再靠近一点' : data.align.hint;
      if (s > 0.5) idle = 0;
      good = s > 0.82 ? good + dt : 0;
      $('ghost').style.opacity = (0.085 + s * 0.45).toFixed(3);
      if (good > 0.35) snap();
      if (idle > 6 && hinted === 0) { hinted = 1; say(guide.alignIdle); $('drag').classList.add('show'); }
      if (idle > 16 && hinted === 1) { hinted = 2; say(guide.alignIdle2); }
    }
    if (phase === 'snapping') {
      snapT += dt;
      if (snapT > 0.9 || performance.now() - snapAt > 1400) {
        phase = 'aligned'; ui.dataset.phase = 'aligned'; setStep(1); idle = 0;
        say(data.align.found, 5000);
        narrate?.('yishan-found', { once: false, whileVisible: () => phase === 'aligned' && opened === 0 });
      }
    }
    if (phase === 'aligned' && idle > 12 && opened === 0 && hinted < 3) { hinted = 3; say(guide.collectIdle); }
    if (phase === 'snapping' || phase === 'aligned') plateOpacity = Math.min(1, Math.max(plateOpacity + dt * 0.8, (performance.now() - snapAt) / 1800));
    plateMat.uniforms.opacity.value = plateOpacity * (phase === 'aligned' || phase === 'snapping' ? 1 : 0);
    plateMat.uniforms.wipe.value = wipe;
    if (phase === 'aligned') for (const c of data.clues) {
      let x, y;
      if (c.onPhoto) { x = view.w / 2 + (c.onPhoto[0] - 0.5) * view.pw; y = view.cy + (c.onPhoto[1] - 0.5) * view.ph; c.el.classList.toggle('hidden', wipe < c.onPhoto[0]); }
      else { v.fromArray(c.anchor).project(camera); x = (v.x + 1) / 2 * view.w; y = (1 - v.y) / 2 * view.h; }
      c.el.style.left = x + 'px'; c.el.style.top = y + 'px';
    }
  }
  function render() {
    composer.render();
    renderer.autoClear = false; renderer.clearDepth();
    renderer.render(overlay, camera);
    renderer.autoClear = true;
  }
  let snapAt = 0;
  function snap() { phase = 'snapping'; snapT = 0; snapAt = performance.now(); goal.az = 0; goal.el = 0; goal.r = R0; ui.dataset.phase = 'snapping'; $('meterText').textContent = data.align.found; $('drag').classList.remove('show'); $('note').classList.remove('show'); }

  /* ================= 尺寸：让照片底片与相机视角严格对应 ================= */
  function resize(w, h) {
    const aspect = w / h, pa = data.photo.aspect;
    const top = Math.min(130, h * 0.15), bottom = Math.min(290, h * 0.33);
    view.k = Math.min((h - top - bottom) / h, 0.94 * aspect / pa);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(PHOTO_VFOV / 2));
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalf / view.k)); camera.aspect = aspect;
    const shift = (bottom - top) / 2 / h;
    camera.setViewOffset(w, h, 0, shift * h, w, h); camera.updateProjectionMatrix();
    plate.scale.set(2 * tanHalf * pa, 2 * tanHalf, 1);
    view.w = w; view.h = h; view.ph = view.k * h; view.pw = view.ph * pa; view.cy = h / 2 - shift * h;
    const g = $('ghost'); Object.assign(g.style, { width: view.pw + 'px', height: view.ph + 'px', left: (w - view.pw) / 2 + 'px', top: view.cy - view.ph / 2 + 'px' });
    const cap=$('cap'), note=$('note'), bottomPanel=$('bottom'), photoEnd=view.cy+view.ph/2+8;
    if(w<960 && cap.parentNode!==bottomPanel) bottomPanel.prepend(cap,note);
    if(w>=960 && cap.parentNode===bottomPanel) bottomPanel.before(cap,note);
    ui.style.setProperty('--photo-end',photoEnd+'px');
    Object.assign(cap.style, {top:photoEnd+'px',left:(w-view.pw)/2+'px',width:view.pw+'px'});
    composer.setPixelRatio(Math.min(renderer.getPixelRatio(), desktop ? 1.25 : 1)); composer.setSize(w, h);
    if (gtao) gtao.setSize(Math.round(w * .55), Math.round(h * .55));
  }

  function dispose() {
    el.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel);
    camera.clearViewOffset(); composer.dispose?.();
    scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose?.()); });
    ui.innerHTML = '';
  }
  const test = { treeAudit, desktop, alignment: () => ({...sph,score:score()}), begin: () => intro.querySelector('[data-act="begin"]').click(), snap: () => { if (phase === 'align') snap(); }, collectAll: () => { data.clues.forEach(c => { found.add(c.id); c.el.classList.add('done'); }); renderNotebook(); }, setWipe };
  return { scene, camera, update, render, resize, dispose, test };
}
