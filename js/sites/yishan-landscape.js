// The calibrated gate is built separately. All landscape geometry here is conjectural.
import * as THREE from 'three';

function seeded(seed) {
  return () => { seed = (Math.imul(1664525,seed)+1013904223)>>>0; return seed/4294967296; };
}
const noiseGL = `
  float hd(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float field(vec2 p){vec2 i=floor(p),u=fract(p);u=u*u*(3.-2.*u);
    return mix(mix(hd(i),hd(i+vec2(1.,0.)),u.x),mix(hd(i+vec2(0.,1.)),hd(i+1.),u.x),u.y);}
`;

// Pigment, wheel-worn earth and damp patches follow world metres, including the
// terrace returns. The source PBR maps stay byte-for-byte intact.
export function weatherMaterials(materials) {
  const dapple = `
    float canopy=1.-smoothstep(.32,1.,length((landPos.xz-vec2(-3.5,3.4))/vec2(5.6,3.5)));
    float twigs=field(landPos.xz*vec2(5.1,3.7))*.65+field(landPos.xz*vec2(15.,10.))*.35;
    diffuseColor.rgb*=1.-.46*canopy*smoothstep(.34,.57,twigs)*(1.-step(.10,landPos.y));
  `;
  const tint = (material, code) => {
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 landPos;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvec4 surfacePoint=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nsurfacePoint=instanceMatrix*surfacePoint;\n#endif\nlandPos=(modelMatrix*surfacePoint).xyz;');
      shader.fragmentShader = 'varying vec3 landPos;\n'+noiseGL+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+code);
    };
    material.customProgramCacheKey = () => code;
  };
  tint(materials.ground,`
    vec2 q=landPos.xz; float l=dot(diffuseColor.rgb,vec3(.21,.71,.08));
    float mott=field(q*.84)*.55+field(q*2.9)*.30+field(q*10.)*.15;
    float axis=.065*q.y*q.y+.35*sin(q.y*.54);
    float road=1.-smoothstep(1.05,2.1,abs(q.x-axis)+(mott-.5)*1.8);
    float verge=smoothstep(.28,.72,mott)*(1.-road);
    vec3 turf=mix(vec3(.148,.147,.127),vec3(.067,.084,.051),verge);
    vec3 soil=mix(turf,vec3(.26,.223,.183),road);
    diffuseColor.rgb=soil*(.42+1.65*sqrt(l))*(.81+.35*mott);
  `+dapple);
  tint(materials.stone,`
    float grain=dot(diffuseColor.rgb,vec3(.21,.71,.08));
    diffuseColor.rgb=vec3(.93,.95,.94)*(.066+sqrt(grain)*.54);
  `+dapple);
  tint(materials.rubble,`
    float l=dot(diffuseColor.rgb,vec3(.21,.71,.08));
    diffuseColor.rgb=mix(vec3(l*1.02,l,l*.92),diffuseColor.rgb,.16);
  `);
  tint(materials.plaster,`
    vec2 q=vec2(landPos.x+.8*landPos.z,landPos.y);
    float drip=field(vec2(q.x*7.,q.y*.46))*.55+field(vec2(q.x*19.,q.y*.68))*.45;
    float run=smoothstep(.52,.84,drip)*(.30+.7*field(q*.55));
    float salt=(1.-smoothstep(1.17,2.13+field(q*1.4)*.48,q.y));
    diffuseColor.rgb*=vec3(.95,.98,.98)*(1.-run*.50);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.36,.37,.32),salt*.38);
  `);
}

function peaks(scene, random, desktop) {
  const vertices=[],shade=[],indices=[];
  const profiles=[[0,1.40],[.12,1.12],[.30,.98],[.55,.88],[.76,.80],[.89,.66],[.96,.48],[1,.19]];
  for (const [layer,radius,count,baseHeight] of [[0,71,56,22],[1,54,49,17],[2,37,40,11]]) {
    for(let i=0;i<count;i++) {
      const a=(i+.48*random())*Math.PI*2/count, r=radius+random()*4, w=1.9+random()*3.4;
      const h=baseHeight*(.71+.66*random()) + 2.3*Math.sin(a*5+layer);
      const ox=Math.sin(a)*r, oz=-7+Math.cos(a)*r, phase=random()*6, lean=(random()-.5)*1.6;
      const n=desktop?15:11, first=vertices.length/3;
      for (let j=0;j<profiles.length;j++) for(let k=0;k<n;k++) {
        const th=k*Math.PI*2/n, [y,rad]=profiles[j];
        const groove=.91+.12*Math.sin(th*3+phase)+.10*Math.sin(th*5-phase+y*2)+.035*random();
        vertices.push(ox+Math.cos(th)*w*rad*groove+lean*y,-.8+h*y+.35*Math.sin(th*2+phase)*y,
          oz+Math.sin(th)*w*.87*rad*groove);
        shade.push(layer,.62+.30*Math.cos(th+1.4)+.07*random(),y);
        if(j){const p=first+j*n+k, next=first+j*n+(k+1)%n;indices.push(p-n,p,next,next,next-n,p-n);}
      }
      const top=first+(profiles.length-1)*n; for(let k=1;k<n-1;k++)indices.push(top,top+k+1,top+k);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('tone',new THREE.Float32BufferAttribute(shade,3)); geo.setIndex(indices);
  const mat=new THREE.ShaderMaterial({side:THREE.DoubleSide,vertexShader:`
    attribute vec3 tone; varying vec3 p,t; void main(){p=position;t=tone;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:noiseGL+`varying vec3 p,t; void main(){
      vec3 rock=mix(vec3(.58,.66,.69),vec3(.34,.48,.48),t.x*.5);
      vec3 moss=mix(vec3(.50,.59,.63),vec3(.16,.28,.23),t.x*.5);
      vec2 q=vec2(p.x+p.z*.71,p.y);
      float blot=field(q*.87)*.5+field(q*2.9)*.29+field(q*7.3)*.21;
      float seam=field(q*vec2(3.,.43));
      vec3 c=mix(rock,moss,smoothstep(.35,.70,blot+.12*(seam-.5)))*(.80+.22*t.y);
      c=mix(c,vec3(.68,.73,.72),.48*(1.-smoothstep(.12,.68,t.z)));
      gl_FragColor=vec4(c,1.);}`});
  const ridge=new THREE.Mesh(geo,mat);ridge.userData.noAO=true;scene.add(ridge);
}
function leafTexture(random) {
  const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
  const twig=(x,y,dx,dy,depth)=>{
    g.strokeStyle=depth?'#655e46':'#756e51';g.lineWidth=depth?2:.9;g.beginPath();g.moveTo(x,y);g.lineTo(x+dx,y+dy);g.stroke();
    for(let k=1;k<=6;k++) {
      const f=k/6, px=x+dx*f,py=y+dy*f, sign=k%2?1:-1;
      if(depth&&k>1) twig(px,py,dx*.15+sign*(14+random()*10),dy*(.20+random()*.15),0);
      g.save();g.translate(px,py);g.rotate(Math.atan2(dy,dx)+sign*.85);
      const l=(7+random()*7)*(depth?.9:1), v=42+random()*31;
      g.fillStyle='hsl('+(72+random()*19)+',20%,'+v+'%)';
      g.beginPath();g.moveTo(0,0);g.bezierCurveTo(l*.24,-l*.36,l*.81,-l*.22,l,0);
      g.bezierCurveTo(l*.60,l*.29,l*.23,l*.22,0,0);g.fill();g.restore();
    }
  };
  for(let k=0;k<5;k++) twig(61,108,(k-2)*19+random()*10,-65-random()*23,1);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

// One curled leaf shared by all the small clusters at the foot of the wall.
function fallenLeaf() {
  const c=document.createElement('canvas');c.width=192;c.height=96;
  const g=c.getContext('2d');
  const wash=g.createLinearGradient(0,10,0,86);
  wash.addColorStop(0,'#73644b');wash.addColorStop(.44,'#b6a078');wash.addColorStop(.54,'#897455');wash.addColorStop(1,'#655a46');
  g.fillStyle=wash;g.beginPath();g.moveTo(26,53);g.bezierCurveTo(58,7,121,6,182,35);
  g.bezierCurveTo(140,43,105,92,58,73);g.quadraticCurveTo(37,66,26,53);g.fill();
  g.strokeStyle='#c8b48c';g.lineWidth=1.8;g.beginPath();g.moveTo(7,61);g.quadraticCurveTo(73,37,173,36);g.stroke();
  g.strokeStyle='#8c795d';g.lineWidth=1.1;
  for(let i=0;i<6;i++){
    const x=45+i*17, y=49-i*1.8, v=Math.sin((i+1)*Math.PI/8);
    g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+8,y-6,x+14,y-23*v);
    g.moveTo(x,y+1);g.quadraticCurveTo(x+12,y+3,x+24,y+24*v);g.stroke();
  }
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  const geo=new THREE.PlaneGeometry(1,1,6,4), pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i);
    pos.setZ(i,.025*(1-Math.abs(2*y))+.16*(x+.5)**2+.05*y*y);
  }
  geo.computeVertexNormals();
  return {geo,mat:new THREE.MeshStandardMaterial({map,alphaTest:.33,roughness:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1})};
}
export function dressLandscape({scene, materials, desktop, cameraAtPhoto, aspect, vfov, target}) {
  const random=seeded(93261), dummy=new THREE.Object3D();
  const instances=(geometry,material,transforms,shadow=false)=>{
    const batch=new THREE.InstancedMesh(geometry,material,transforms.length);
    transforms.forEach((t,i)=>{dummy.position.fromArray(t[0]);dummy.rotation.set(...t[1]);dummy.scale.fromArray(t[2]);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);if(t[3])batch.setColorAt(i,new THREE.Color(t[3]));});
    batch.castShadow=shadow;batch.receiveShadow=true;scene.add(batch);return batch;
  };
  peaks(scene,random,desktop);
  // Irregular ashlar courses finish flush with the foot of the calibrated stairs.
  const flags=[];
  for(let row=0;row<9;row++) {
    const z=-3.27+(row+.5)*.55; let x=-5.9+(row%2)*.43+random()*.12;
    while(x<5.45) {
      const w=.85+random()*.85;
      flags.push([[x+w/2,.008+random()*.009,z+(random()-.5)*.018],[0,(random()-.5)*.011,0],[w-.018,.055,.532],['#a5a698','#bab8a8','#b1afa0','#a3a89a'][Math.floor(random()*4)]]);x+=w;
    }
  }
  instances(new THREE.BoxGeometry(1,1,1),materials.stone,flags);
  const leafMat=new THREE.MeshStandardMaterial({map:leafTexture(random),alphaTest:.40,side:THREE.DoubleSide,roughness:1,color:'#949b73'});
  leafMat.shadowSide=THREE.DoubleSide;
  const foliage=[],branches=[],treeBoxes=[];
  const branch=(p,q,w)=>{
    const v=new THREE.Vector3(...q).sub(new THREE.Vector3(...p));
    const rot=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));
    branches.push([p.map((x,i)=>(x+q[i])/2),[rot.x,rot.y,rot.z],[w,v.length(),w]]);
  };
  function crown(x,y,z,r,count,hero) {
    for(let i=0;i<count;i++) {
      const theta=random()*Math.PI*2, t=random()*2-1, radius=r*Math.cbrt(random()), side=Math.sqrt(1-t*t);
      const px=x+radius*side*Math.cos(theta),py=y+radius*t*.63,pz=z+radius*side*Math.sin(theta);
      const s=.8+random()*.9;
      foliage.push([[px,py,pz],[random()*2-.6,random()*6,random()*3],[s,s,1]]);
      if(hero) treeBoxes.push([px,py,pz,s*.73]);
    }
  }
  // All hero-tree branches and leaf cards are behind the original photographer.
  // Keep their bounds too, so a future layout edit can be checked against the actual photo.
  const trunk=[-3.9,0,5.0];let stem=trunk;
  for(const p of [[-3.86,2.3,4.9],[-3.54,4.26,4.72],[-3.98,6.05,4.8]]) {branch(stem,p,.35-(stem[1]*.033));treeBoxes.push([...stem,.43],[...p,.43]);stem=p;}
  for(let i=0;i<14;i++) {
    const a=random()*6.28, span=1.9+random()*2.65, start=[-3.65,3.45+random()*2.1,4.82];
    const mid=[start[0]+Math.cos(a)*span*.53,start[1]+.87,start[2]+Math.sin(a)*span*.45];
    const end=[start[0]+Math.cos(a)*span,start[1]+1.15+random()*1.2,Math.max(2.1,start[2]+Math.sin(a)*span*.68)];
    branch(start,mid,.14); branch(mid,end,.087);treeBoxes.push([...mid,.16],[...end,.11]);
    crown(...end,1.35+random()*.62,desktop?40:19,true);
  }
  for(const side of [-1,1]) {
    for(let i=0;i<29;i++){
      const x=side*(14.5+random()*7.8),z=-5.6-random()*5.7, y=3+random()*3.5;
      branch([x,.05,z],[x+side*.20,y,z+.13],.034+random()*.045);
      crown(x,y-.32,z,1.4,desktop?14:7,false);
    }
  }
  const leaves=instances(new THREE.PlaneGeometry(1,1),leafMat,foliage,true);leaves.userData.noAO=true;
  const bark=new THREE.MeshStandardMaterial({color:'#524d40',roughness:1});
  bark.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 barkPos;\n'+shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nbarkPos=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader='varying vec3 barkPos;\n'+noiseGL+shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat barkNoise=field(vec2((barkPos.x+barkPos.z)*31.,barkPos.y*2.2)); diffuseColor.rgb*=.59+.83*barkNoise;');
  };
  for(let i=0;i<7;i++){const a=i*.898;branch([-3.9, .42,5],[-3.9+.68*Math.cos(a),-.035,5+.52*Math.sin(a)],.16);}
  instances(new THREE.CylinderGeometry(.78,1,1,13),bark,branches,true);
  const photoCamera=new THREE.PerspectiveCamera(vfov,aspect,.05,120);photoCamera.position.copy(cameraAtPhoto);photoCamera.lookAt(target);photoCamera.updateMatrixWorld();
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(photoCamera.projectionMatrix,photoCamera.matrixWorldInverse));
  const intrusions=treeBoxes.filter(([x,y,z,r])=>frustum.intersectsSphere(new THREE.Sphere(new THREE.Vector3(x,y,z),r))).length;

  // Low broken mats of leaves and moss trace the wall base and the path margins.
  const litter=[],tufts=[];
  for(let patch=0;patch<100;patch++){
    const z=-3.2+random()**1.45*21, side=random()<.5?-1:1, road=.065*z*z+.35*Math.sin(z*.54);
    const x=z<1.8?side*(6.3+random()*12):road+side*(2.1+random()*8);
    for(let i=0;i<(desktop?13:6);i++){
      const px=x+(random()-.5)*2.8,pz=z+(random()-.5)*1.9;
      if(Math.abs(px)<6.3 && pz<1.72)continue;
      const h=.18+random()*.35;tufts.push([[px,h*.49,pz],[.1,random()*6,random()*.22],[h*2.2,h*1.8,1]]);
    }
  }
  const grassCanvas=document.createElement('canvas');grassCanvas.width=128;grassCanvas.height=96;
  const ctx=grassCanvas.getContext('2d');
  for(let i=0;i<72;i++){
    const x=32+random()*64,y=78-random()*74,tip=x+(x-64)*1.12+(random()-.5)*28;
    ctx.fillStyle='hsl('+(52+random()*26)+',22%,'+(26+random()*28)+'%)';
    ctx.beginPath();ctx.moveTo(x-1.8,95);ctx.quadraticCurveTo(x-2,70,tip,y);
    ctx.quadraticCurveTo(x+2,66,x+2,95);ctx.fill();
  }
  const grassMap=new THREE.CanvasTexture(grassCanvas);grassMap.colorSpace=THREE.SRGBColorSpace;
  const grassMat=new THREE.MeshStandardMaterial({map:grassMap,alphaTest:.31,side:THREE.DoubleSide,roughness:1});
  instances(new THREE.PlaneGeometry(1,1),grassMat,tufts).userData.noAO=true;
  for(const side of [-1,1]) for(const center of [2.65,4.85,8.3,12.5,15.6]){
    const onPaving=center<5;
    for(let i=0;i<(desktop?11:6);i++){
      const x=side*(center+(random()-.5)*1.1),z=-3.21+.52*random()**2;
      const size=.105+.065*random(),y=onPaving?.047:.004;
      litter.push([[x,y,z],[-Math.PI/2,0,random()*Math.PI*2],[size,size*.74,size],
        ['#d6c7ae','#c6b396','#b7b29a','#baa687'][i%4]]);
    }
  }
  const fallen=fallenLeaf();
  instances(fallen.geo,fallen.mat,litter).userData.noAO=true;
  return {testedVolumes:treeBoxes.length,intrusions};
}

// Layered, low horizontal banks in the distance. The local light shafts sit at
// individual apertures, with a tapered, soft cross-section and no shadow maps.
export function addAir(scene,desktop) {
  const mist=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:noiseGL+`varying vec2 v;void main(){
      float w=sin(v.x*3.14159)*sin(v.y*3.14159);
      float a=w*(1.-smoothstep(.18,1.,v.y))*(.085+.13*field(v*vec2(17.,3.)));
      gl_FragColor=vec4(.64,.69,.66,a);}`});
  for(let j=0;j<3;j++){const m=new THREE.Mesh(new THREE.CylinderGeometry(24+j*13,24+j*13,4+j*1.5,64,1,true),mist);
    m.position.set(0,1.5+j*.6,-7);m.userData.noAO=true;scene.add(m);}
  if(!desktop)return;
  const pos=[],uv=[];
  for(const side of [-1,1])for(const direction of [-1,1])for(let k=0;k<7;k++){
    const x=side*(1.71+.34*k),y=2.95+.34*(k%3),z=-6.06, l=direction===1?1.0:.57;
    const end=[x+.80*l*direction,y-1.95*l*direction,z+2.35*l*direction],w=.055;
    const a=[x-w,y,z],b=[x+w,y,z],c=[end[0]+.20,end[1],end[2]],d=[end[0]-.20,end[1],end[2]];
    pos.push(...a,...b,...d,...b,...c,...d);uv.push(0,1,1,1,0,0,1,1,1,0,0,0);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const beam=new THREE.Mesh(g,new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 v;void main(){float a=sin(3.14159*v.x)*smoothstep(0.,.6,v.y)*.19;gl_FragColor=vec4(.92,.71,.42,a);}'}));
  beam.userData.noAO=true;scene.add(beam);
}
