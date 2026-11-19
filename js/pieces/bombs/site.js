import { Scene, OrthographicCamera, Color } from 'three';
import { createPlate, cropHTML } from './plate.js';

const steps = ['读题记','核点','量一段'];
const phases = {lightbox:0, search:0, inscription:0, marks:1, find:1, found:1, scale:2, measured:2};
const pad = n => String(n).padStart(3,'0');

export function createSite({renderer,ui,data,onArchive,onExit,narrate,sfx}) {
  const {map,photo} = data;
  const scene=new Scene(), camera=new OrthographicCamera(-1,1,1,-1,.1,2);
  scene.background=new Color('#211b17');camera.position.z=1;
  // This light table is a flat archival image. Only its background needs a WebGL pass.
  let backgroundDirty=true, running=false, elapsed=0, disposed=false;
  const state={phase:'lightbox',lens:[790,230],dated:false,count:0,overview:false,startPlaced:false,probe:null,wrongPoint:null};
  ui.innerHTML=`
    <section class="bm-room" aria-label="宜山落弹图调研现场">
      <header class="bm-mast"><span class="bm-brand">一路相随的图书馆</span>
        <button type="button" data-act="exit">← 回到展厅</button></header>
      <main class="bm-workbench">
        <div class="bm-heading"><div><p class="bm-kicker">广西宜山 <i></i> 图版调研</p><h1>${data.title}</h1></div>
          <ol class="bm-steps" aria-label="现场步骤">${steps.map((s,i)=>'<li><b>'+('〇一二三'[i+1])+'</b>'+s+'</li>').join('')}</ol></div>
        <div class="bm-layout">
          <figure class="bm-figure"><div class="bm-box">
            <i class="bm-screw nw"></i><i class="bm-screw ne"></i>
            <div class="bm-glass"><canvas class="bm-map" tabindex="0" aria-label="原图灯箱，可移动放大镜或按步骤点选图上位置"></canvas></div>
            <div class="bm-box-foot"><span class="bm-pilot"><i></i>透射灯箱</span><div class="bm-etch" aria-hidden="true"></div>
              <button type="button" class="bm-view" data-act="overview" hidden>看全图</button><span class="bm-view-name">全幅</span></div>
          </div><figcaption><span>《浙江大学图史》第57页</span><span>Wikimedia Commons · 公有领域</span><span class="bm-method">${data.reconstructionNote}</span></figcaption></figure>
          <aside class="bm-docket" aria-label="读图记录"><div class="bm-docket-head"><span>调研笔记</span><span class="bm-folio"></span></div>
            <div class="bm-record"></div><p class="bm-response" role="status"></p><div class="bm-controls"></div></aside>
        </div>
      </main>
    </section>`;
  const root=ui.firstElementChild;
  const $=s=>root.querySelector(s);
  const canvas=$('.bm-map'), plate=createPlate(canvas,data);
  const record=$('.bm-record'), controls=$('.bm-controls'), response=$('.bm-response');
  const box=$('.bm-box'), overview=$('[data-act="overview"]');
  const copy=(title,body='')=>'<h2>'+title+'</h2>'+(body?'<p class="bm-body">'+body+'</p>':'');
  const crop=(key,alt,cls)=>cropHTML(photo.src,map,map.crops[key],alt,cls);
  const slip=(label,content)=>'<figure class="bm-slip"><figcaption>'+label+'</figcaption>'+content+'</figure>';
  const button=(act,label,quiet=false)=>'<button type="button" class="bm-action'+(quiet?' secondary':'')+'" data-act="'+act+'">'+label+'</button>';
  function feedback(text) { response.textContent=text; }
  function viewLabel() {
    const detail=!['lightbox','marks'].includes(state.phase);
    overview.hidden=!detail;
    overview.textContent=state.overview?'返回局部':'看全图';
    $('.bm-view-name').textContent=detail && !state.overview?'局部':'全幅';
    $('.bm-method').textContent=phases[state.phase]===2?'量距按原图示意 / 非实测':data.reconstructionNote;
  }
  function show(phase,announce='') {
    state.phase=phase;state.overview=false;state.wrongPoint=null;
    running=false;elapsed=0;
    root.dataset.phase=ui.dataset.phase=phase;
    const step=phases[phase];
    [...root.querySelectorAll('.bm-steps li')].forEach((li,i)=>{
      if(i===step)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');
      li.classList.toggle('done',i<step);
    });
    $('.bm-folio').textContent=['题记','编号','比例尺'][step];
    feedback(announce);viewLabel();record.replaceChildren();controls.replaceChildren();
    switch(phase) {
      case 'lightbox':
        record.innerHTML=slip('图顶总记 · 原迹',crop('title','图顶完整总记原迹','bm-opening-ink'))+
          '<h2>一百十八彈</h2><p class="bm-body">图上每一个小圈都有自己的编号。把放大镜移到图顶，先读画图人留下的日期。</p>';
        controls.innerHTML=button('begin','<i class="bm-loupe-icon"></i> 拿起放大镜');break;
      case 'search':
        record.innerHTML=copy('找到日期那一行','在图上移动或拖动放大镜。图顶有三处题记，找出写着“日期”的一行。')+
          slip('图顶原迹',crop('heading','图顶三处题记'));
        controls.innerHTML=button('to-date','把镜头移到日期行',true);break;
      case 'inscription':
        record.innerHTML=slip('日期行 · 原迹',crop('date','手写日期'))+
          '<p class="bm-transcript">中華民國二十八年二月五日</p>'+copy('换成公元哪一年？')+
          '<p class="bm-formula">民国纪年 <b>＋</b> 1911 <b>＝</b> 公元纪年</p>';
        controls.innerHTML='<div class="bm-years" role="group" aria-label="选出公元年份">'+[1938,1939,1940].map(y=>'<button data-year="'+y+'">'+y+'</button>').join('')+'</div>';
        if(state.dated) confirmDate();break;
      case 'marks':
        record.innerHTML='<div class="bm-number"><b data-value>000</b><span> / 118</span></div><h2>逐号核点</h2>'+
          slip('当前编号 · 原图局部',cropHTML(photo.src,map,[663,786,130,59],'当前编号附近的原图','bm-live-crop'))+
          '<p class="bm-body bm-mark-note">按编号点亮圆圈。可暂停细看，也可拖动滑尺逐号翻查。</p>';
        controls.innerHTML='<div class="bm-slider-row"><button data-act="prev" aria-label="上一个编号">−</button><input type="range" min="0" max="118" step="1" value="0" aria-label="已核编号"><button data-act="next" aria-label="下一个编号">＋</button></div>'+
          button('play','开始逐号核点')+button('find','找出“未炸”的一枚 →');
        syncCount();break;
      case 'find':
        record.innerHTML=copy('哪一枚标了“未炸”？','沿大路上缘读。先找到括号里的两个字，再点紧邻它的编号圆圈。')+
          '<p class="bm-aside-note">118 枚已核。括注写在原图上。</p>';
        controls.innerHTML='<fieldset class="bm-candidates"><legend>也可按图选编号</legend>'+[23,26,27].map(n=>'<button data-candidate="'+n+'">'+n+' 号</button>').join('')+'</fieldset>';break;
      case 'found':
        record.innerHTML=slip('括注与圈心 · 原迹',crop('note','括注（未炸）与26号'))+
          copy('26号 · 未炸','括注紧邻26号。再看图顶总记，画图人把这一枚单独记了下来。');
        controls.innerHTML=button('scale','取比例尺，量一段 →');break;
      case 'scale':
        record.innerHTML=slip('原图比例尺 · 1∶3000',crop('ruler','一比三千，0至150公尺','bm-scale-ink'))+
          copy('从宿舍屋沿起量','取“宿”“舍”两字之间长条屋形的上沿中点 A，量到最近的编号圈心。')+
          '<p class="bm-aside-note">原尺每格50公尺。点两端，也可从 A 拖到圈心。</p>';
        controls.innerHTML=button('start-scale','在 A 放下尺端',true)+
          '<fieldset class="bm-candidates" hidden><legend>也可对照图面选终点</legend>'+[37,38,61].map(n=>'<button data-end="'+n+'">'+n+' 号</button>').join('')+'</fieldset>';
        if(state.startPlaced) placeStart();break;
      case 'measured':
        record.innerHTML=slip('原图比例尺 · 1∶3000',crop('ruler','原图的0至150公尺比例尺','bm-scale-ink'))+
          '<div class="bm-reading"><small>图上估读</small><strong>约 '+plate.estimate+'</strong><span> 公尺</span></div>'+
          '<p class="bm-body">从 A 到 '+plate.target+' 号圈心，约为原尺半格。屋沿和圈线都有宽度，读数只存入这次练习。</p>';
        controls.innerHTML=button('archive','去档案台写展签 →')+button('again','重新量取',true);break;
    }
    plate.set(state);
  }
  function confirmDate() {
    state.dated=true;
    record.querySelector('h2').textContent='1939年2月5日';
    record.querySelector('.bm-formula').textContent='民国二十八年　28 ＋ 1911 ＝ 1939';
    controls.innerHTML=button('marks','按编号核点 →');
    feedback('');
  }
  function syncCount() {
    const n=state.count;
    $('[data-value]').textContent=pad(n);
    const range=$('input[type="range"]');range.value=n;
    range.setAttribute('aria-valuetext','已核到'+n+'号');
    $('[data-act="prev"]').disabled=n===0;$('[data-act="next"]').disabled=n===118;
    const play=$('[data-act="play"]'),find=$('[data-act="find"]');
    play.hidden=n===118;find.hidden=n!==118;
    play.textContent=running?'暂停核点':n?'继续逐号核点':'开始逐号核点';
    play.setAttribute('aria-pressed',String(running));
    const i=Math.max(1,n), [x,y]=map.marks[i-1];
    const sx=Math.max(0,Math.min(map.width-164,x-82)), sy=Math.max(0,Math.min(map.height-65,y-29));
    $('.bm-live-crop').setAttribute('viewBox',[sx,sy,164,65].join(' '));
    $('.bm-live-crop').setAttribute('aria-label',i+'号附近的原图');
    $('.bm-slip figcaption').textContent=n?'第 '+n+' 号 · 原图局部':'从 1 号开始 · 原图局部';
    $('.bm-mark-note').textContent=map.uncertain.includes(n)?'这处小号字与屋形墨线粘连，编号辨读存疑。':n===118?'原图的编号已核至118号。回到大路边，再找那一处特别的括注。':'按编号点亮圆圈。可暂停细看，也可拖动滑尺逐号翻查。';
    plate.set(state);
  }
  function countTo(value,manual=true) {
    if(manual) { running=false;elapsed=0; }
    state.count=Math.max(0,Math.min(118,Math.round(value)));
    if(state.count===118) running=false;
    syncCount();
  }
  function inspect(p) {
    state.lens=p;
    if(state.phase==='search' && p[0]>=548 && p[0]<=1015 && p[1]>=57 && p[1]<=137) {
      show('inscription');return;
    }
    plate.set(state);
  }
  function chooseUnexploded(n) {
    if(n===map.unexploded) {sfx?.('switch',{gain:0.5});show('found');return;}
    state.wrongPoint=n;feedback(n?'再看 '+n+' 号旁。找出和“（未炸）”紧邻的圆圈。':'点在括注右侧的圆圈上。');plate.set(state);
  }
  function placeStart() {
    state.startPlaced=true;
    $('[data-act="start-scale"]').hidden=true;$('.bm-candidates').hidden=false;
    feedback('A 已就位。点离它最近的圈心，落下另一端。');plate.set(state);
  }
  function placeEnd(n) {
    if(n!==plate.target) { feedback('从 A 出发，还有更近的圈心。对照长条屋形上方的空地。');return; }
    state.probe=null;show('measured');
  }
  function pointAt(p) {
    if(state.phase==='lightbox')show('search');
    if(state.phase==='search'||state.phase==='inscription') {inspect(p);return;}
    const nearest=plate.nearest(p),tol=plate.hitRadius(20);
    if(state.phase==='find') {
      const onNote=p[0]>=750 && p[0]<=859 && p[1]>=701 && p[1]<=741;
      chooseUnexploded(onNote?map.unexploded:nearest.distance<tol?nearest.id:null);return;
    }
    if(state.phase==='scale') {
      if(!state.startPlaced) {
        if(Math.hypot(p[0]-map.scale.start[0],p[1]-map.scale.start[1])<tol*1.5)placeStart();
        else feedback('先点 A。起点在“宿”“舍”两字之间的长条屋形上沿。');
      } else if(nearest.distance<tol)placeEnd(nearest.id);
      else feedback('把尺端放在编号的小圈中心。');
    }
  }
  let pointer=null, downPhase=null;
  canvas.onpointerdown=e=>{
    if(e.button!==0||pointer!==null)return;
    pointer=e.pointerId;downPhase=state.phase;canvas.setPointerCapture(e.pointerId);
    pointAt(plate.chartPoint(e.clientX,e.clientY));
  };
  canvas.onpointermove=e=>{
    if(pointer!==null && e.pointerId!==pointer)return;
    const p=plate.chartPoint(e.clientX,e.clientY);
    if(state.phase==='search' || (state.phase==='inscription' && pointer!==null))inspect(p);
    if(state.phase==='scale' && state.startPlaced && pointer!==null) {state.probe=p;plate.set(state);}
  };
  canvas.onpointerup=e=>{
    if(pointer!==e.pointerId)return;pointer=null;
    if(downPhase==='scale'&&state.phase==='scale'&&state.startPlaced) {
      const p=plate.chartPoint(e.clientX,e.clientY);
      if(Math.hypot(p[0]-map.scale.start[0],p[1]-map.scale.start[1])>plate.hitRadius(13))pointAt(p);
    }
  };
  canvas.onpointercancel=()=>{pointer=null;state.probe=null;plate.set(state);};
  canvas.onkeydown=e=>{
    if(['lightbox','search','inscription'].includes(state.phase)) {
      if(e.key==='Enter'||e.key===' ') {e.preventDefault();if(state.phase==='lightbox')show('search');inspect([787,94]);}
      else if(e.key.startsWith('Arrow')) {
        e.preventDefault();if(state.phase==='lightbox')show('search');
        const [x,y]=state.lens,delta=20;
        inspect([Math.max(0,Math.min(map.width,x+({ArrowLeft:-delta,ArrowRight:delta}[e.key]||0))),
          Math.max(0,Math.min(map.height,y+({ArrowUp:-delta,ArrowDown:delta}[e.key]||0)))]);
      }
    }
  };
  root.addEventListener('input',e=>{if(e.target.matches('input[type="range"]'))countTo(e.target.valueAsNumber);});
  root.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b||b.disabled)return;
    if(b.dataset.year) {
      if(b.dataset.year==='1939')confirmDate();else feedback('再算一次：1911 加 28，月和日照录。');
      return;
    }
    if(b.dataset.candidate){chooseUnexploded(Number(b.dataset.candidate));return;}
    if(b.dataset.end){placeEnd(Number(b.dataset.end));return;}
    switch(b.dataset.act) {
      case 'exit': onExit();break;
      case 'overview': state.overview=!state.overview;viewLabel();plate.set(state);break;
      case 'begin': show('search');canvas.focus({preventScroll:true});break;
      case 'to-date': inspect([788,94]);break;
      case 'marks': show('marks');break;
      case 'play': running=!running;elapsed=0;syncCount();break;
      case 'prev': countTo(state.count-1);break;
      case 'next': countTo(state.count+1);break;
      case 'find': if(state.count===118)show('find');break;
      case 'scale': case 'again': state.startPlaced=false;state.probe=null;show('scale');break;
      case 'start-scale': placeStart();break;
      case 'archive': onArchive(['date','marks','unexploded','scale']);break;
    }
  });
  function update(dt,_t) {
    if(!running||disposed)return;
    elapsed+=dt;
    if(elapsed>=.14){const steps=Math.floor(elapsed/.14);elapsed-=steps*.14;countTo(state.count+steps,false);}
  }
  function resize(w,h) {
    const aspect=w/Math.max(1,h);
    camera.left=-aspect;camera.right=aspect;camera.updateProjectionMatrix();
    backgroundDirty=true;plate.resize();
  }
  const fit=()=>resize(ui.clientWidth,ui.clientHeight);
  const observer=new ResizeObserver(fit);observer.observe(box);
  show('lightbox');fit();
  narrate?.('bombs', { once: false, whileVisible: () => !disposed && state.phase === 'lightbox' });
  return {scene,camera,update,resize,
    render(){if(backgroundDirty && renderer){renderer.render(scene,camera);backgroundDirty=false;}},
    dispose(){disposed=true;running=false;observer.disconnect();plate.dispose();root.remove();delete ui.dataset.phase;},
    test:{get state(){return {...state,running};},screenPoint:plate.screenPoint,measureTarget:plate.target,estimate:plate.estimate}
  };
}
