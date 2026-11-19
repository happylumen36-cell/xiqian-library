/*
 * 展厅建筑：藻井式格栅天花、檐口与暗槽灯带、吊杆轨道、皮面长凳。
 * ------------------------------------------------------------------
 * 由 hall.js 调用：buildArchitecture(scene, { span, depth, wallH, rail }) → { group, ceilH, setGlow(k) }
 * 设计：
 *  - 墙高 6 m 处起三级叠涩檐口（深胡桃色），檐口背后藏一条暖光灯带，向上洗亮天花边缘；
 *  - 6.6 m 天花以 2.4 m 井字梁分格，梁底嵌细铜线，格内的斜面向上收进木芯板。
 *  - 原有轨道灯改为由吊杆从天花垂下，不再悬空；
 *  - 长凳用牛血红皮垫、胡桃木榫接框和收分腿，铜套只包住四脚底端。
 * 全部是程序几何与 canvas 贴图，不新增外部素材；灯带与格心光是自发光，不是真实光源，手机也能跑。
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const C = {
  walnut: '#4a2f22', walnutLit: '#584033', brass: '#b8924f', coffer: '#403025', cove: '#ffac65',
  ceilH: 6.6, cell: 2.4
};

function radial(inner, outer, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, inner); r.addColorStop(1, outer); g.fillStyle = r; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
function linear(stops, w = 8, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const l = g.createLinearGradient(0, 0, 0, h); stops.forEach(([o, col]) => l.addColorStop(o, col));
  g.fillStyle = l; g.fillRect(0, 0, w, h); return new THREE.CanvasTexture(c);
}

// A coffer has a narrow lip, a sloped return, a second step and a recessed flat panel.
function cofferPanel(half) {
  const positions = [], uvs = [];
  const corners = [[-1,-1], [1,-1], [1,1], [-1,1]];
  const profiles = [[half,-.21], [half-.065,-.21], [half-.15,-.12], [half-.19,-.12], [half-.25,-.045]];
  const rings = profiles.map(([r,y]) => corners.map(([x,z]) => [x*r,y,z*r]));
  function triangle(a, b, c) {
    for (const v of [a,b,c]) { positions.push(...v); uvs.push(.5+v[0]/(2*half),.5+v[2]/(2*half)); }
  }
  for (let step=1; step<rings.length; step++) {
    const outer=rings[step-1], inner=rings[step];
    for (let side=0; side<4; side++) {
      const next=(side+1)%4;
      triangle(outer[side],outer[next],inner[next]); triangle(outer[side],inner[next],inner[side]);
    }
  }
  const face=rings[rings.length-1];
  triangle(face[0],face[1],face[2]); triangle(face[0],face[2],face[3]);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.computeVertexNormals();
  return geometry;
}

export function buildArchitecture(scene, { span, depth, wallH = 6, rail = null }) {
  const group = new THREE.Group(); group.name = 'architecture'; scene.add(group);
  const W = span + 20, D = depth, H = C.ceilH;
  const walnut = new THREE.MeshStandardMaterial({ color: C.walnut, roughness: 0.5, metalness: 0.05 });
  const walnutLit = new THREE.MeshStandardMaterial({ color: C.walnutLit, roughness: 0.45 });
  const brass = new THREE.MeshStandardMaterial({ color: C.brass, roughness: 0.3, metalness: 0.9 });

  /* —— 墙顶与天花之间的过渡：上段墙（深色）+ 三级叠涩檐口 —— */
  const upper = new THREE.Mesh(new THREE.PlaneGeometry(W, H - wallH + 0.2), new THREE.MeshStandardMaterial({ color: '#4a2219', roughness: 0.9 }));
  upper.position.set(0, wallH + (H - wallH) / 2 - 0.1, -0.01); group.add(upper);
  // 两侧端墙原高 6 m，天花抬高后补齐上段，避免露缝
  for (const side of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.PlaneGeometry(D, H - wallH + 0.2), upper.material);
    e.rotation.y = -side * Math.PI / 2; e.position.set(side * W / 2, wallH + (H - wallH) / 2 - 0.1, D / 2); group.add(e);
  }
  [[0.10, 0.12, 5.42], [0.18, 0.10, 5.56], [0.30, 0.16, 5.72]].forEach(([d, h, y], i) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(W, h, d, 1, .009), i===1 ? walnutLit : walnut);
    m.name='cornice-'+(i+1); m.position.set(0, y, d / 2); group.add(m);
  });
  const lip = new THREE.Mesh(new THREE.BoxGeometry(W, 0.009, 0.31), walnutLit); lip.position.set(0, 5.807, 0.155); group.add(lip);
  // 暗槽灯带：藏在檐口上沿，向上洗亮上段墙与天花边
  const coveStrip = new THREE.Mesh(new THREE.BoxGeometry(W, 0.014, 0.024), new THREE.MeshBasicMaterial({ color: C.cove }));
  coveStrip.name='cove-strip'; coveStrip.position.set(0, 5.838, 0.303); group.add(coveStrip);
  const washTex = linear([[0,'rgba(255,255,255,.03)'], [.55,'rgba(255,255,255,.10)'], [.82,'rgba(255,255,255,.28)'], [1,'rgba(255,255,255,.75)']]);
  const coveWash = new THREE.Mesh(new THREE.PlaneGeometry(W, H - 5.84), new THREE.MeshBasicMaterial({ color:'#cf8344', map: washTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  coveWash.name='cove-wash';
  coveWash.position.set(0, 5.84 + (H - 5.84) / 2, 0.005); group.add(coveWash);

  /* —— 天花：底板 + 井字梁 + 格心暖光 —— */
  const ceilTex = radial('rgba(70,34,22,1)', 'rgba(26,13,9,1)', 128);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: C.coffer, roughness: 0.95, map: ceilTex }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, D / 2); group.add(ceil);
  const cols = Math.ceil(W / C.cell), rows = Math.ceil(D / C.cell), beamD = 0.34, beamW = 0.26;
  const beamGeoX = new THREE.BoxGeometry(W, beamD, beamW), beamGeoZ = new THREE.BoxGeometry(beamW, beamD, D);
  const inlayGeoX = new THREE.BoxGeometry(W, 0.012, 0.03), inlayGeoZ = new THREE.BoxGeometry(0.03, 0.012, D);
  for (let r = 0; r <= rows; r++) {
    const z = r * C.cell;
    const b = new THREE.Mesh(beamGeoX, walnutLit); b.position.set(0, H - beamD / 2, z); group.add(b);
    const s = new THREE.Mesh(inlayGeoX, brass); s.position.set(0, H - beamD - 0.006, z); group.add(s);
  }
  for (let c = 0; c <= cols; c++) {
    const x = -W / 2 + c * C.cell;
    const b = new THREE.Mesh(beamGeoZ, walnutLit); b.position.set(x, H - beamD / 2, D / 2); group.add(b);
    const s = new THREE.Mesh(inlayGeoZ, brass); s.position.set(x, H - beamD - 0.006, D / 2); group.add(s);
  }
  const cofferGlow = { value:0 };
  const panelMat = new THREE.MeshStandardMaterial({color:'#e8d6c4',map:benchMaterials().wood.map,roughness:.81,envMapIntensity:.7});
  panelMat.onBeforeCompile = shader => {
    shader.uniforms.cofferGlow = cofferGlow;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 panelUV; varying float warmth;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        panelUV = uv * 2.0 - 1.0;
        float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
        warmth = mix(0.35, 1.0, smoothstep(0.60, 1.20, aspect))
               * mix(0.18, 1.0, smoothstep(4.0, 12.0, length(mvPosition.xyz)));`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float cofferGlow; varying vec2 panelUV; varying float warmth;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float center = exp(-12.0 * dot(panelUV,panelUV));
        totalEmissiveRadiance += vec3(0.052,0.018,0.004) * cofferGlow * warmth * center;`);
  };
  const panels = new THREE.InstancedMesh(cofferPanel((C.cell-beamW)/2+.004), panelMat, cols*rows);
  panels.name='coffer-panels';
  const placement = new THREE.Matrix4(); let i = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
    const x = -W / 2 + (c + 0.5) * C.cell, z = (r + 0.5) * C.cell;
    panels.setMatrixAt(i,placement.makeTranslation(x,H,z));
  }
  group.add(panels);

  /* —— 吊杆：把原有轨道挂到天花上 —— */
  if (rail) {
    const rodGeo = new THREE.CylinderGeometry(0.008, 0.008, H - rail.y, 6);
    for (let x = -W / 2 + 1.2; x < W / 2; x += 3.6) {
      const rod = new THREE.Mesh(rodGeo, brass); rod.position.set(x, rail.y + (H - rail.y) / 2, rail.z); group.add(rod);
    }
  }

  return {
    group, ceilH: H,
    /** 整体辉光 0–1：进场随光浪升起，终场推满 */
    setGlow(k) {
      coveWash.material.opacity = .31 * k;
      cofferGlow.value = k;
      coveStrip.material.color.set(C.cove).multiplyScalar(.012 + .61 * k);
    }
  };
}

/* —— 长凳：牛血红皮垫、胡桃木框架与四枚铜脚套 —— */
let benchFinish;
function benchMaterials() {
  if (benchFinish) return benchFinish;
  let seed=1911;
  const random=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  function surface(width,height,sample,color=true) {
    const c=document.createElement('canvas'); c.width=width; c.height=height;
    const ctx=c.getContext('2d'), image=ctx.createImageData(width,height);
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      const i=(y*width+x)*4, rgb=sample(x,y);
      image.data[i]=rgb[0]; image.data[i+1]=rgb[1]; image.data[i+2]=rgb[2]; image.data[i+3]=255;
    }
    ctx.putImageData(image,0,0);
    const map=new THREE.CanvasTexture(c);
    if(color) map.colorSpace=THREE.SRGBColorSpace;
    map.anisotropy=4;
    return map;
  }
  // Unevenly spaced fibres wander slightly along the board. Contrast stays low even at arm's length.
  const fibres=Array.from({length:193},()=>random()-.5);
  const walnut=surface(768,192,(x,y)=>{
    const grain=y+2.1*Math.sin(x*.006+y*.039)+.8*Math.sin(x*.017-y*.055);
    const lo=Math.floor(grain), mix=grain-lo, at=i=>fibres[(i+193)%193];
    const fibre=at(lo)*(1-mix)+at(lo+1)*mix;
    const tone=1+.065*fibre+.019*Math.sin(grain*.14+x*.002)+.018*(random()-.5);
    return [116*tone,77*tone,53*tone];
  });
  const leather=surface(512,256,(x,y)=>{
    const dye=.97+.055*random()+.019*Math.sin(x*.031+1.7*Math.sin(y*.043));
    return [112*dye,49*dye,43*dye];
  });
  const grain=surface(512,256,(x,y)=>{
    const v=175+44*(random()-.5)+12*Math.sin(.035*x+.8*Math.sin(.07*y));
    return [v,v,v];
  },false);
  benchFinish={
    leather:new THREE.MeshPhysicalMaterial({map:leather,roughness:.83,roughnessMap:grain,bumpMap:grain,bumpScale:.00045,
      sheen:.18,sheenColor:'#a86f5d',sheenRoughness:.74,clearcoat:.07,clearcoatRoughness:.58}),
    welt:new THREE.MeshStandardMaterial({color:'#70372e',roughness:.63}),
    thread:new THREE.MeshStandardMaterial({color:'#a2745d',roughness:.88}),
    wood:new THREE.MeshStandardMaterial({map:walnut,roughness:.49}),
    brass:new THREE.MeshStandardMaterial({color:'#9b7951',roughness:.5,metalness:.65}),
    shadow:radial('rgba(0,0,0,.72)','rgba(0,0,0,0)')
  };
  return benchFinish;
}

function cushionEdge(len, depth, inset, height) {
  const x=len/2-inset, z=depth/2-inset, r=.044-inset, path=new THREE.Path();
  path.moveTo(-x+r,-z); path.lineTo(x-r,-z);
  path.absarc(x-r,-z+r,r,-Math.PI/2,0,false); path.lineTo(x,z-r);
  path.absarc(x-r,z-r,r,0,Math.PI/2,false); path.lineTo(-x+r,z);
  path.absarc(-x+r,z-r,r,Math.PI/2,Math.PI,false); path.lineTo(-x,-z+r);
  path.absarc(-x+r,-z+r,r,Math.PI,Math.PI*1.5,false);
  // The piping and stitches both follow the cushion's rounded shoulder.
  const y=height-.044+Math.sqrt(.044**2-(.044-inset)**2);
  return {path,y};
}
export function buildBench(scene, x, z, { len=1.9, rotY=0 }={}) {
  const g=new THREE.Group(); g.name='gallery-bench'; g.position.set(x,0,z); g.rotation.y=rotY; scene.add(g);
  const m=benchMaterials();
  function part(name,geometry,material,px,py,pz) {
    const mesh=new THREE.Mesh(geometry,material); mesh.name=name; mesh.position.set(px,py,pz); g.add(mesh);return mesh;
  }
  const depth=.515,thickness=.118,seatY=.452,underside=seatY-thickness/2,top=seatY+thickness/2;
  part('leather-cushion',new RoundedBoxGeometry(len,thickness,depth,4,.044),m.leather,0,seatY,0);
  const welt=cushionEdge(len,depth,.010,top);
  const curve=new THREE.Curve();
  curve.getPoint=(t,out=new THREE.Vector3())=>{const p=welt.path.getPoint(t);return out.set(p.x,welt.y,p.y);};
  part('rolled-welt',new THREE.TubeGeometry(curve,256,.0024,6,true),m.welt,0,0,0);
  const seam=cushionEdge(len,depth,.024,top), count=Math.floor(seam.path.getLength()/.012);
  const thread=new THREE.InstancedMesh(new THREE.BoxGeometry(.006,.0014,.0015),m.thread,count);
  const transform=new THREE.Matrix4();
  for(let i=0;i<count;i++){
    const t=(i+.5)/count,p=seam.path.getPoint(t),tangent=seam.path.getTangent(t);
    transform.makeRotationY(-Math.atan2(tangent.y,tangent.x)); transform.setPosition(p.x,seam.y+.0006,p.y);
    thread.setMatrixAt(i,transform);
  }
  thread.name='perimeter-stitches';g.add(thread);

  const endX=len/2-.13, sideZ=depth/2-.063, stock=.052, foot=.039;
  const railH=.066, railY=underside-railH/2;
  const longRail=new RoundedBoxGeometry(2*endX-stock,railH,.032,1,.003);
  const endRail=new RoundedBoxGeometry(2*sideZ-stock,railH,.032,1,.003);
  const stretcher=new RoundedBoxGeometry(2*sideZ-.042,.033,.028,1,.003);
  for(const sign of [-1,1]){
    part('side-rail',longRail,m.wood,0,railY,sign*sideZ);
    part('end-rail',endRail,m.wood,sign*endX,railY,0).rotation.y=Math.PI/2;
    part('end-stretcher',stretcher,m.wood,sign*endX,.119,0).rotation.y=Math.PI/2;
  }
  // Rotate the stock's long UV axis upright. The leg tapers from 52 to 39 mm.
  const legGeo=new RoundedBoxGeometry(underside,stock,stock,2,.003);
  const vertices=legGeo.attributes.position;
  for(let i=0;i<vertices.count;i++){
    const t=vertices.getX(i)/underside+.5, taper=THREE.MathUtils.lerp(foot/stock,1,t);
    vertices.setXYZ(i,vertices.getX(i),vertices.getY(i)*taper,vertices.getZ(i)*taper);
  }
  const sock=new RoundedBoxGeometry(.042,.026,.042,1,.002);
  const contactMaterial=new THREE.MeshBasicMaterial({map:m.shadow,transparent:true,depthWrite:false,opacity:.61});
  const footShadow=new THREE.PlaneGeometry(.15,.14);
  for(const px of [-endX,endX]) for(const pz of [-sideZ,sideZ]){
    part('walnut-leg',legGeo,m.wood,px,underside/2,pz).rotation.z=Math.PI/2;
    part('brass-foot',sock,m.brass,px,.013,pz);
    part('foot-contact',footShadow,contactMaterial,px,.002,pz).rotation.x=-Math.PI/2;
  }
  const shadow=new THREE.MeshBasicMaterial({map:m.shadow,transparent:true,depthWrite:false,opacity:.25});
  part('seat-shadow',new THREE.PlaneGeometry(len+.24,depth+.31),shadow,0,.001,0).rotation.x=-Math.PI/2;
  return g;
}
