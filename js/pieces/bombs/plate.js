// All crops, the loupe, the measuring endpoints and picking use the same scan coordinates.
export function createPlate(canvas, data) {
  const {map, photo} = data;
  const ctx = canvas.getContext('2d');
  const scan = new Image();
  let loaded = false, disposed = false, state;
  let width = 0, height = 0, dpr = 1;
  let view = [0, 0, map.width, map.height];
  const numberPoint = n => map.marks[n - 1];
  const scaleLength = Math.hypot(map.scale.right[0] - map.scale.left[0], map.scale.right[1] - map.scale.left[1]);
  const metres = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]) * map.scale.metres / scaleLength;

  function nearest(point) {
    let id = 1, distance = Infinity;
    map.marks.forEach(([x,y],i) => {
      const d = Math.hypot(x-point[0],y-point[1]);
      if (d < distance) { distance = d; id = i+1; }
    });
    return {id, distance};
  }
  const target = nearest(map.scale.start).id;
  const estimate = Math.round(metres(map.scale.start,numberPoint(target))/5)*5;
  scan.onload = () => { loaded = true; if (!disposed) draw(); };
  scan.onerror = () => { scan.onerror = null; scan.src = 'assets/photos/yishan-bombmap-1939.jpg'; };
  scan.src = photo.src;

  function resize() {
    const r = canvas.getBoundingClientRect();
    width = r.width; height = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.round(width*dpr), h = Math.round(height*dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    draw();
  }
  function set(stateNow) { state = stateNow; draw(); }
  function region() {
    if (state.overview) return [0,0,map.width,map.height];
    switch (state.phase) {
      case 'search': case 'inscription': return [385,0,1230,833];
      case 'find': case 'found': return [555,510,650,440];
      case 'scale': case 'measured': return [573,766,500,339];
      default: return [0,0,map.width,map.height];
    }
  }
  function xy([x,y]) { return [(x-view[0])*width/view[2], (y-view[1])*height/view[3]]; }
  function chartPoint(clientX,clientY) {
    const r = canvas.getBoundingClientRect();
    return [view[0]+(clientX-r.left)*view[2]/r.width,view[1]+(clientY-r.top)*view[3]/r.height];
  }
  function source(x,y,w,h,dx,dy,dw,dh) {
    const kx=scan.naturalWidth/map.width, ky=scan.naturalHeight/map.height;
    ctx.drawImage(scan,x*kx,y*ky,w*kx,h*ky,dx,dy,dw,dh);
  }
  function ring(x,y,r,color,weight) {
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.strokeStyle=color; ctx.lineWidth=weight; ctx.stroke();
  }
  function tag(x,y,text,align='left') {
    ctx.save(); ctx.font='600 '+(width<480?12:14)+'px Georgia, "Songti SC", serif';
    const w=ctx.measureText(text).width+14, h=23;
    const left=Math.max(2,Math.min(width-w-2,align==='right'?x-w:x));
    const top=Math.max(2,Math.min(height-h-2,y-h/2));
    ctx.fillStyle='#403b2f';ctx.fillRect(left,top,w,h);
    ctx.strokeStyle='#c5ae72';ctx.lineWidth=1;ctx.strokeRect(left+.5,top+.5,w-1,h-1);
    ctx.fillStyle='#fff1d1';ctx.textBaseline='middle';ctx.fillText(text,left+7,top+h/2+.5);ctx.restore();
  }
  function active(n) {
    const [x,y]=xy(numberPoint(n)), r=width<500?7:10;
    ring(x,y,r+1,'#fff0bf',3); ring(x,y,r,'#943d26',2.5);
    tag(x>width*.82?x-r-7:x+r+7,y-10,String(n).padStart(3,'0'),x>width*.82?'right':'left');
  }
  function marked(count) {
    const r=width<500?2.2:3.5;
    for (let i=0;i<count;i++) {
      const [x,y]=xy(map.marks[i]);
      ctx.fillStyle='#245d57';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
      ring(x,y,r+.6,'#fff1c3',width<500?.7:1.15);
    }
    if(count) active(count);
  }
  function lens(point) {
    const [x,y]=xy(point);
    const radius=Math.min(width<500?46:68,height*.20);
    const lx=Math.max(radius+9,Math.min(width-radius-12,x+radius*.86));
    const ly=Math.max(radius+9,Math.min(height-radius-15,y+radius*1.18+4));
    ctx.save();ctx.strokeStyle='#735c37';ctx.lineWidth=1;ctx.beginPath();
    ctx.moveTo(x-6,y);ctx.lineTo(x+6,y);ctx.moveTo(x,y-6);ctx.lineTo(x,y+6);ctx.stroke();
    // The handle and rim sit above the paper. The area inside the rim is a fresh crop of the scan.
    ctx.lineCap='round';ctx.strokeStyle='#3a3023';ctx.lineWidth=radius*.18;ctx.shadowColor='#31221699';ctx.shadowBlur=5;
    ctx.beginPath();ctx.moveTo(lx+radius*.64,ly+radius*.66);ctx.lineTo(lx+radius*1.22,ly+radius*1.28);ctx.stroke();
    ctx.lineWidth=radius*.07;ctx.strokeStyle='#b29665';ctx.stroke();ctx.shadowBlur=0;
    ctx.save();ctx.beginPath();ctx.arc(lx,ly,radius,0,Math.PI*2);ctx.clip();ctx.fillStyle='#e6d4a3';ctx.fill();
    const mag=Math.max(1,width/view[2]*2.55), spread=radius/mag;
    source(point[0]-spread,point[1]-spread,spread*2,spread*2,lx-radius,ly-radius,radius*2,radius*2);
    const glass=ctx.createRadialGradient(lx-radius*.4,ly-radius*.45,0,lx,ly,radius);
    glass.addColorStop(0,'#fffbde18');glass.addColorStop(.82,'#fff3d300');glass.addColorStop(1,'#4a36294a');
    ctx.fillStyle=glass;ctx.fillRect(lx-radius,ly-radius,radius*2,radius*2);ctx.restore();
    ring(lx,ly,radius+3,'#3c3224',4); ring(lx,ly,radius+1,'#bfa979',3);ring(lx,ly,radius-2,'#78633e',1.7);ctx.restore();
  }
  function endpoint(p,label,side) {
    const [x,y]=xy(p);
    ring(x,y,7,'#fff1ce',3.2);ring(x,y,7,'#964632',1.7);
    ctx.fillStyle='#893e2e';ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();
    tag(side==='right'?x-10:x+11,y+(side==='right'?-12:12),label,side);
  }
  function scaleKey() {
    // One division of the printed bar, projected at exactly the same scale as A–B.
    const len=scaleLength/3*width/view[2], x=12, y=height-45;
    ctx.save();
    ctx.fillStyle='#f7e8cbe8';
    ctx.fillRect(x,y,Math.max(112,len+20),36);
    ctx.fillStyle='#494435';
    ctx.font='12px "Songti SC", serif';
    ctx.fillText('同倍率 · 50 公尺',x+8,y+14);
    ctx.fillRect(x+8,y+23,len/2,5);
    ctx.strokeStyle='#494435';ctx.lineWidth=1;
    ctx.strokeRect(x+8,y+23,len,5);
    ctx.restore();
  }
  function rule(a,b,complete) {
    const [x,y]=xy(a),[bx,by]=xy(b);
    const dx=bx-x,dy=by-y,len=Math.hypot(dx,dy);
    if(len>1) {
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(dy,dx));ctx.strokeStyle=complete?'#51402c':'#785535';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(len,0);ctx.stroke();
      const step=len*5/metres(a,b);
      ctx.lineWidth=1;for(let s=step;s<len-.1;s+=step){ctx.beginPath();ctx.moveTo(s,0);ctx.lineTo(s,-5);ctx.stroke();}ctx.restore();
    }
  }
  function draw() {
    if(!state || !loaded || !width || !height || disposed)return;
    view=region();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    source(...view,0,0,width,height);
    if(state.phase==='marks') marked(state.count);
    if(state.phase==='lightbox') lens([1010,48]);
    if(state.phase==='search'||state.phase==='inscription') lens(state.lens);
    if(state.phase==='found') active(map.unexploded);
    if(state.phase==='find' && state.wrongPoint) active(state.wrongPoint);
    if(state.phase==='scale'||state.phase==='measured') {
      const end=state.phase==='measured'?numberPoint(target):state.probe;
      if(end&&state.startPlaced) rule(map.scale.start,end,state.phase==='measured');
      endpoint(map.scale.start,state.startPlaced?'A · 起点':'A · 屋沿','left');
      if(state.phase==='measured') endpoint(numberPoint(target),'B · '+target+'号','right');
      if(!state.overview) scaleKey();
    }
  }
  function dispose() { disposed=true;scan.onload=scan.onerror=null; }
  return {set,resize,dispose,chartPoint,nearest,metres,target,estimate,
    hitRadius:screenPixels=>screenPixels*view[2]/width,
    screenPoint:p=>{const [x,y]=xy(p),r=canvas.getBoundingClientRect();return [x+r.left,y+r.top];} };
}

// A close reading window always shows the unretouched pixels, including their original ink and paper.
export function cropHTML(src, map, box, alt, cls='') {
  const [x,y,w,h]=box;
  return '<svg class="bm-crop '+cls+'" role="img" preserveAspectRatio="xMidYMid slice" aria-label="'+alt+'" viewBox="'+[x,y,w,h].join(' ')+'" width="'+w+'" height="'+h+'"><image href="'+src+'" x="0" y="0" width="'+map.width+'" height="'+map.height+'"/></svg>';
}
