import * as THREE from 'three';

const { Vector3: V, MathUtils: math } = THREE;
const CAMERA_Z = 9, EYE = 3.04, PIXEL = .0048;
const CENTRE = new V(0, .17, -5.67);
const ROOM_BOXES = {
  stage:  [ 0,    -9.75, 3.0, 1.35, .75],
  office: [-3.05, -6.55, 1.5, 4.15, 1.03],
  reading:[ 3.05, -6.55, 1.5, 4.15, 1.03],
  stacks: [ 0,    -6.03, 2.6, 1.95, 2.04]
};

export function createModel(data) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, .045, 125);
  const gate = new THREE.Group(), yard = new THREE.Group(), rooms = new Map();
  scene.add(gate, yard);
  scene.background = new THREE.Color('#655f52');
  scene.fog = new THREE.FogExp2('#655f52', .032);
  const loader = new THREE.TextureLoader(), textures = new Set(), materials = new Set();
  const material = args => {
    const m = new THREE.MeshStandardMaterial({ roughness: .96, ...args });
    materials.add(m); return m;
  };
  function loadMap(path, color = false) {
    const t = loader.load(path);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4; textures.add(t); return t;
  }
  function stoneSurface(name, tint) {
    const dir = 'assets/textures/' + name + '/';
    return material({ color: tint, map: loadMap(dir+'diff.jpg', true), normalMap: loadMap(dir+'nor.jpg'), normalScale: new THREE.Vector2(.55, .55) });
  }
  const fibre = loadMap('assets/pieces/jianggongci/wood-fibre.webp', true);
  const plaster = stoneSurface('painted_plaster_wall', '#c8c8bb');
  const stone = stoneSurface('monastery_stone_floor', '#b3aea4');
  const timber = material({color:'#554238',map:fibre});
  const darkWood = material({color:'#332d27',map:fibre});
  const lip = material({color:'#6e6b61'});
  const clay = material({color:'#ddd4bd',map:fibre}), topSheet = material({color:'#e9e2cb',map:fibre});
  const boardEdge = material({color:'#997857',map:fibre}), binder = material({color:'#453d32',map:fibre});
  const pencil = material({color:'#8a8370'}), ochre = material({color:'#9b5944'});
  const types = [material({color:'#cdbb96',map:fibre}),material({color:'#e1d5b6',map:fibre})];
  const original=loadMap(data.photo.src,true);
  const photographedWood=material({map:original,color:'#e6e2d8'});
  const photographedTile=material({map:original,color:'#bcc1be'});

  function mesh(group, geometry, mat) {
    const m = new THREE.Mesh(geometry, mat);
    m.castShadow = m.receiveShadow = true; group.add(m); return m;
  }
  function block(group, x, bottom, z, w, h, d, mat) {
    const g = new THREE.BoxGeometry(w,h,d);
    const uv=g.attributes.uv, dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
    for(let face=0; face<6; face++) for(let corner=0; corner<4; corner++) {
      const i=face*4+corner;
      uv.setXY(i, uv.getX(i)*dims[face][0]/2.5, uv.getY(i)*dims[face][1]/2.5);
    }
    const m=mesh(group,g,mat); m.position.set(x,bottom+h/2,z); return m;
  }
  // The photograph is a measuring surface in image coordinates, never an architectural survey.
  // At the reference camera each front vertex projects back to its original pixel.
  function fromPhoto(x,y,z) {
    const s=PIXEL*(CAMERA_Z-z)/CAMERA_Z;
    return new V((x-490.5)*s, EYE+(700-y)*s, z);
  }
  function photoUV(vertices) {
    return vertices.flatMap(p=>{
      const s=PIXEL*(CAMERA_Z-p.z)/CAMERA_Z;
      return [.5+p.x/(981*s),.5+(p.y-EYE)/(1400*s)];
    });
  }
  function face(group, vertices, mat, uvs) {
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flatMap(p=>p.toArray()),3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs || [0,0,1,0,1,1,0,1],2));
    g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
    return mesh(group,g,mat);
  }
  // Pass corners counterclockwise, beginning at the lower left.
  function photoSolid(corners, front, depth, mat, usePlate=false) {
    const a=corners.map(([x,y])=>fromPhoto(x,y,front));
    const b=a.map(p=>new V(p.x,p.y,p.z-depth));
    face(gate,a,usePlate?photographedWood:mat,usePlate?photoUV(a):undefined);
    face(gate,[b[3],b[2],b[1],b[0]],mat);
    for(let i=0;i<4;i++){const j=(i+1)%4;face(gate,[a[j],a[i],b[i],b[j]],mat);}
  }
  function band(l,r,lowerL,lowerR,upperL,upperR,z,d,mat) {
    photoSolid([[l,lowerL],[r,lowerR],[r,upperR],[l,upperL]],z,d,mat,true);
  }
  // Only the visible piers, beam profiles, inscribed board and cropped eave are modelled.
  photoSolid([[30,1333],[346,1333],[351,792],[33,807]],0,.60,plaster);
  photoSolid([[756,1333],[956,1333],[953,750],[753,776]],0,.60,plaster);
  band(31,960,803,765,470,426,.018,.66,darkWood);
  band(32,959,488,445,449,407,.08,.71,timber);
  band(32,960,453,409,252,212,-.04,.56,darkWood);
  band(32,960,284,231,242,192,.22,.95,timber);
  band(26,964,254,203,215,163,.27,.84,timber);
  band(124,872,788,766,756,736,.10,.28,timber);
  band(143,864,757,731,507,478,.065,.16,darkWood);
  for(const [x,y] of [[378,756],[664,747]]) {
    const end=mesh(gate,new THREE.CylinderGeometry(.069,.074,.15,12),lip);
    end.rotation.x=Math.PI/2;end.position.copy(fromPhoto(x,y,.18));
  }
  // Short, overlapping rows of the roof stop at the edge of the source image.
  const roofPoint=(u,v,raise=0)=>{
    const px=25+942*u, py=225-52*u-v*(200-50*u);
    return fromPhoto(px,py,.37-.94*v+raise);
  };
  const roofFace=vertices=>face(gate,vertices,photographedTile,photoUV(vertices));
  for(let row=0;row<3;row++){
    const a=row/3,b=(row+1)/3;
    roofFace([roofPoint(0,a),roofPoint(1,a),roofPoint(1,b),roofPoint(0,b)]);
    const count=19;
    for(let i=0;i<count;i++){
      const center=(i+.5+.11*row)/count;
      for(let side=0;side<5;side++){
        const at=(v,s)=>{
          const t=s*Math.PI/5;
          const p=roofPoint(center+.019*Math.cos(t),v,.018);
          p.y+=.054*Math.sin(t); return p;
        };
        roofFace([at(a,side+1),at(a,side),at(b,side),at(b,side+1)]);
      }
    }
  }
  block(gate,0,-.11,.05,4.76,.10,1.55,stone);
  block(gate,.32,-.025,-.11,2.0,.034,.67,stone);
  // A neutral ground plane meets the photographed threshold; the model has open sides.
  const earth=stoneSurface('dirt_floor','#bcb9b1');
  earth.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\nfloat soil=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)); diffuseColor.rgb=vec3(.98,.97,.91)*(.062+.47*sqrt(soil));');
  };
  const apron=block(gate,0,-.18,-10,150,.065,148,earth);
  apron.castShadow=false;

  const table=block(scene,0,-.67,-6,125,.2,125,material({color:'#5e5142',map:fibre}));
  table.castShadow=false;
  block(yard,0,-.42,-6.6,9.85,.22,9.55,binder);
  block(yard,0,-.20,-6.6,9.68,.16,9.40,boardEdge);
  block(yard,0,-.04,-6.6,9.62,.04,9.34,topSheet);
  // Pencil lines and the gap at the near edge describe a diagram, not an enclosing wall.
  const line=(x,z,w,d,mat=pencil)=>{const l=block(yard,x,.003,z,w,.009,d,mat);l.castShadow=false;};
  for(const x of [-4.40,4.40])line(x,-6.6,.027,8.43);
  line(0,-10.81,8.83,.027);
  for(const x of [-2.65,2.65])line(x,-2.39,3.52,.027);
  for(const x of [-.85,.85])line(x,-2.41,.075,.35,ochre);
  for(const side of [-1,1]){
    const stroke=block(yard,side*.086,.015,-2.92,.025,.012,.27,ochre);
    stroke.rotation.y=side*.69;
  }
  line(0,-2.68,.026,.65,ochre);

  function dashedOutline(x,z,w,d) {
    const long=Math.max(3,Math.round(w/.26)),short=Math.max(3,Math.round(d/.26));
    for(const side of [-1,1]){
      for(let i=0;i<long;i++)line(x-w/2+(i+.5)*w/long,z+side*d/2,w/long*.67,.018);
      for(let i=0;i<short;i++)line(x+side*w/2,z-d/2+(i+.5)*d/short,.018,d/short*.67);
    }
  }
  for(const [id,[x,z,w,d,h]] of Object.entries(ROOM_BOXES)){
    dashedOutline(x,z,w+.13,d+.13);
    const group=new THREE.Group();group.position.set(x,.017,z);yard.add(group);
    const slab=(b,W,H,D,mat)=>block(group,0,b,0,W,H,D,mat);
    slab(0,w+.08,.056,d+.08,boardEdge);
    if(id==='stacks'){
      slab(.056,w,.78,d,types[0]);slab(.836,w+.08,.13,d+.08,clay);
      slab(.966,w-.13,.13,d-.13,binder);
      slab(1.096,w-.045,.84,d-.045,types[1]);slab(1.936,w+.05,.105,d+.05,topSheet);
    }else{
      slab(.056,w,h-.13,d,id==='stage'?types[0]:clay);
      slab(h-.074,w+.045,.075,d+.045,types[1]);
    }
    group.visible=false;rooms.set(id,group);
  }

  // The many fixed roof segments and pencil dashes share a handful of draw calls.
  // Moving room groups retain their own transforms for the assembly animation.
  function batchFixed(group) {
    const batches=new Map();
    for(const obj of [...group.children].filter(o=>o.isMesh)) {
      const mat=obj.material;
      if(!batches.has(mat)) batches.set(mat,{position:[],normal:[],uv:[],shadow:false});
      const dest=batches.get(mat);
      obj.updateMatrix();
      const src=obj.geometry.index?obj.geometry.toNonIndexed():obj.geometry.clone();
      src.applyMatrix4(obj.matrix);
      for(const name of ['position','normal','uv'])dest[name].push(...src.attributes[name].array);
      dest.shadow ||= obj.castShadow;
      group.remove(obj);src.dispose();obj.geometry.dispose();
    }
    for(const [mat,attrs] of batches){
      const g=new THREE.BufferGeometry();
      for(const name of ['position','normal','uv'])g.setAttribute(name,new THREE.Float32BufferAttribute(attrs[name],name==='uv'?2:3));
      mesh(group,g,mat).castShadow=attrs.shadow;
    }
  }
  batchFixed(gate);batchFixed(yard);rooms.forEach(batchFixed);

  const sky=new THREE.HemisphereLight('#f2f1e6','#776e60',1.6);
  const sun=new THREE.DirectionalLight('#fff0dc',3.0);
  sun.position.set(-5,10,4);sun.target.position.set(0,0,-5);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.2,far:36});
  sun.shadow.normalBias=.019;sun.shadow.bias=-.00018;
  const fill=new THREE.DirectionalLight('#b4c2c0',.65);fill.position.set(7,5,-9);
  scene.add(sky,sun,sun.target,fill);
  const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{horizon:{value:new THREE.Color('#c4c3b6')},high:{value:new THREE.Color('#748985')}},
    vertexShader:'varying vec3 dir; void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 dir; uniform vec3 horizon,high; void main(){vec3 d=normalize(dir);gl_FragColor=vec4(mix(horizon,high,smoothstep(-.13,.75,d.y)),1.);\n#include <colorspace_fragment>\n}'});
  materials.add(skyMat);
  const skyMesh=new THREE.Mesh(new THREE.SphereGeometry(87,32,20),skyMat);skyMesh.renderOrder=-10;scene.add(skyMesh);

  function gateCamera(yaw, fit) {
    table.visible=false;scene.fog.color.set('#b9b9ad');scene.fog.density=.037;
    const angle=math.degToRad(yaw);
    camera.fov=math.radToDeg(2*Math.atan(700*PIXEL/CAMERA_Z/fit));
    camera.position.set(CAMERA_Z*Math.sin(angle),EYE,CAMERA_Z*Math.cos(angle));
    camera.lookAt(-Math.sin(angle)*.72,EYE,0);
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
  }
  function yardView(aspect,angle) {
    const distance=Math.max(16.5,18.8/aspect);
    const pitch=.76;
    return new V(Math.sin(angle)*Math.cos(pitch),Math.sin(pitch),Math.cos(angle)*Math.cos(pitch))
      .multiplyScalar(distance).add(CENTRE);
  }
  function yardCamera(yaw) {
    gate.visible=false;yard.visible=true;table.visible=true;camera.fov=38;
    scene.fog.color.set('#655f52');scene.fog.density=.022;
    camera.position.copy(yardView(camera.aspect,yaw)); camera.lookAt(CENTRE);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const smooth=x=>x*x*(3-2*x);
  function walk(p,fit,yaw) {
    const atDoor=new V(.32,1.45,-1.12), lookThrough=new V(.32,1.22,-7);
    const gateFov=math.radToDeg(2*Math.atan(700*PIXEL/CAMERA_Z/fit));
    yard.visible=true;gate.visible=p<.63;table.visible=p>=.56;
    if(p<.56){
      const t=smooth(p/.56);
      camera.position.lerpVectors(new V(0,EYE,CAMERA_Z),atDoor,t);
      camera.lookAt(new V().lerpVectors(new V(0,EYE,0),lookThrough,t));
      camera.fov=math.lerp(gateFov,46,t);
    }else{
      const t=smooth((p-.56)/.44);
      camera.position.lerpVectors(atDoor,yardView(camera.aspect,yaw),t);
      camera.position.y+=Math.sin(t*Math.PI)*2.4;
      camera.lookAt(new V().lerpVectors(lookThrough,CENTRE,t));camera.fov=math.lerp(46,38,t);
    }
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
  }
  function build(amount) {
    let i=0;
    for(const group of rooms.values()){
      const t=math.clamp(amount*1.45-i++*.15,0,1);
      group.visible=t>0;group.scale.y=Math.max(.001,smooth(t));
    }
  }
  function projectRoom(id) {
    const [x,z,,depth,h]=ROOM_BOXES[id];
    // Print the front legend on the near face of the two-storey block.
    const dz=id==='stacks'?depth*.63:id==='stage'?-depth*.55:0;
    return new V(x,id==='stacks'?.84:h+.17,z+dz).project(camera);
  }
  function dispose() {
    scene.traverse(o=>o.geometry?.dispose());
    materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());sun.shadow.dispose();
  }
  return {scene,camera,gate,yard,gateCamera,yardCamera,walk,build,projectRoom,dispose};
}
