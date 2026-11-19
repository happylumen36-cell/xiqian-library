import * as THREE from 'three';
import { citation } from './case.js';
import { openFolderDesk } from './reader.js';
import { routeMap, bindMap } from './route.js';

const steps = ['读题字','看远景','查馆址','定龙泉'];
const sections = { look:0, read:0, date:0, depth:1, point:2, check:2, map:3 };
const button = (id, text, cls='') => '<button type="button" class="lq-button '+cls+'" data-lq="'+id+'">'+text+'</button>';

export function createSite({ ui, data, onArchive, onExit, narrate, sfx }) {
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,2);
  // The optical print and its continuous displacement field share one SVG surface.
  const root = document.createElement('main'); root.className='lq-site'; ui.replaceChildren(root);
  root.innerHTML = `<header class="lq-top"><button type="button" class="lq-return" data-lq="exit">‹ 回到展厅</button><span>现场调研 · 浙江龙泉</span></header>
    <div class="lq-work"><div class="lq-heading"><div><p>浙江大学西迁校史展</p><h1 tabindex="-1"></h1></div><nav aria-label="现场进度"></nav></div>
    <div class="lq-spread"><figure class="lq-mount"><div class="lq-window"></div><figcaption></figcaption></figure>
    <aside class="lq-notebook" aria-label="现场手记"></aside></div>
    <footer class="lq-foot"><a href="${data.photo.url}" target="_blank" rel="noopener">《浙江大学图史》 · 公有领域 ↗</a><span>依照片示意 · 非实测</span></footer></div>`;
  const get=s=>root.querySelector(s), windowEl=get('.lq-window'), side=get('.lq-notebook'), title=get('h1');
  const src=data.photo.src, detail=data.photo.detail;
  let phase='look', count=0, dateKnown=false, moved=false, dx=0,dy=0, point=null, pinned=false, blank=false, placed=false, reader=null;
  get('[data-lq="exit"]').onclick=onExit;
  function go(next) {
    phase=next; draw(); title.focus({preventScroll:true}); root.scrollTop=0;
    if (next === 'point') narrate?.('longquan', { cue: 'point', once: false, whileVisible: () => phase === 'point' && !point && !reader });
    if (next === 'check') narrate?.('longquan', { cue: 'source', once: false, whileVisible: () => phase === 'check' });
  }
  function caption(a,b) { get('.lq-mount figcaption').innerHTML='<span>'+a+'</span><small>'+b+'</small>'; }
  function note(kicker,heading,body,actions='') {
    side.innerHTML='<p class="lq-note-k">'+kicker+'</p><h2>'+heading+'</h2>'+body+'<div class="lq-actions">'+actions+'</div><p class="lq-feedback" role="status"></p>';
  }
  function feedback(msg){get('.lq-feedback').textContent=msg;}
  function bind(id,fn) { get('[data-lq="'+id+'"]')?.addEventListener('click',fn); }
  function fullPhoto() { return '<img class="lq-photo" src="'+src+'" alt="'+data.photo.alt+'" draggable="false">'; }
  function placePin() {
    windowEl.querySelector('.lq-photo-pin')?.remove();
    const marker=document.createElement('span'); marker.className='lq-photo-pin'; marker.style.left=point.x+'%';marker.style.top=point.y+'%';
    marker.setAttribute('aria-label','候选屋舍');windowEl.append(marker);
  }
  function readColumn(i) {
    if (i!==count) return;
    count++; draw();
    (get('[data-col="'+count+'"]') || get('[data-lq="date"]'))?.focus({preventScroll:true});
  }
  function fieldFolder() {
    reader=openFolderDesk(root,data.archive.sources,{sfx,query:'曾宅图书馆的楼层',target:'a2',
      onPin:()=>{reader=null;pinned=true;go('check');},onClose:()=>{reader=null;}});
  }
  function draw() {
    root.dataset.phase=ui.dataset.phase=phase;
    title.textContent=data.stages[phase].title;
    get('nav').innerHTML=steps.map((s,i)=>'<span '+(i===sections[phase]?'aria-current="step"':'')+'>'+s+'</span>').join('');
    windowEl.className='lq-window';windowEl.replaceChildren();
    if(phase==='look') {
      windowEl.innerHTML=fullPhoto()+'<span class="lq-develop" aria-hidden="true"></span><button class="lq-inspect" data-lq="spot" aria-label="放大左下题字"></button>';
      caption('龙泉分校远景','原照 · 全幅');
      note('观察手记','从左下角读起','<p>山雾里，几排屋舍沿着坡地展开。照片左下角，有人用白字留下了它的名字。</p><figure class="lq-sample"><img src="'+detail+'" alt="左下题字局部"><figcaption>左下题字 · 局部</figcaption></figure>',button('read','放大题字'));
      bind('spot',()=>go('read')); bind('read',()=>go('read'));
    } else if(phase==='read' || phase==='date') {
      windowEl.classList.add('lq-detail-window');
      windowEl.innerHTML='<div class="lq-detail-plate"><img src="'+detail+'" alt="右起五列白色竖排题字，点击逐列释读">'+
        data.columns.map((s,i)=>'<button type="button" data-col="'+i+'" aria-label="读第'+(i+1)+'列" class="lq-column '+(i<count?'read ':'')+(i===count?'next':'')+'" style="--cx:'+([84.7,67.3,49.2,31.4,13.6][i])+'%;--len:'+([90,91,70,93,39][i])+'%" '+(phase==='date'||i!==count?'disabled':'')+'></button>').join('')+'</div>';
      caption('照片左下 · 原字放大','自右向左读列');
      if(phase==='read') {
        note('题字释读　'+count+' / 5',count===0?'先读最右一列':count===5?'五列题字已读完':'沿原字向左读','<p>每列从上往下读。点亮原图上的白字，再向左移一列。</p><div class="lq-transcript">'+data.columns.map((s,i)=>'<span class="'+(i<count?'lit':'')+'">'+(i<count?s:'·')+'</span>').join('')+'</div>',
          count<5?button('next-col','读第'+['一','二','三','四','五'][count]+'列'):button('date','换算题字日期'));
        root.querySelectorAll('[data-col]').forEach(b=>b.onclick=()=>readColumn(+b.dataset.col));
        bind('next-col',()=>readColumn(count));bind('date',()=>go('date'));
      } else {
        note('纪年换算','民国三十年拾月','<p>“拾”就是“十”。民国元年是 1912 年，公历年份等于民国年数加 1911。</p>'+
          (dateKnown?'<div class="lq-equation"><small>1911 ＋ 30 ＝ 1941</small><strong>1941 年 10 月</strong></div><p>题字写到月，具体拍摄日留白。</p>':'<p class="lq-prompt">这张照片题的是哪一月？</p>'),
          dateKnown?button('depth','走进远景'):[['wrong-year','1930 年 10 月'],['right','1941 年 10 月'],['wrong-month','1941 年 1 月']].map(([k,t])=>button(k,t,'secondary')).join(''));
        bind('wrong-year',()=>feedback('民国三十年要加 1911，再算一遍。'));bind('wrong-month',()=>feedback('左起第一列是“拾月”，读作十月。'));
        bind('right',()=>{dateKnown=true;draw();get('[data-lq="depth"]').focus({preventScroll:true});});bind('depth',()=>go('depth'));
      }
    } else if(phase==='depth') {
      windowEl.classList.add('lq-depth-window');
      windowEl.innerHTML=`<svg class="lq-optics" viewBox="392 18 977 655" preserveAspectRatio="xMidYMid slice" role="img" aria-label="可拖动的景深观察窗，树丛、屋舍和远山随视点分层移动">
        <defs><filter id="lq-relief" x="0" y="0" width="1400" height="760" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feImage href="assets/pieces/longquan/relief.png" width="1400" height="760" preserveAspectRatio="none" result="z"/>
        <feColorMatrix in="z" type="matrix" class="lq-depth-matrix" result="offset"/>
        <feDisplacementMap in="SourceGraphic" in2="offset" scale="82" xChannelSelector="R" yChannelSelector="G"/></filter></defs>
        <image href="${src}" width="1400" height="760" filter="url(#lq-relief)"/></svg>
        <span class="lq-layer far">远山</span><span class="lq-layer middle">中景屋舍</span><span class="lq-layer near">前景树丛</span>`;
      caption('远景观察窗','依照片示意 · 非实测');
      note('景深观察','移动你的视点','<p>按住照片左右拖动。留意近处的树丛和远山，哪一层移动得更多？</p><label class="lq-range">左右移步<input type="range" min="-100" max="100" value="'+Math.round(dx*100)+'" aria-label="左右移步"></label><p class="lq-prompt" data-depth-hint></p>',button('point','在原照上找图书馆'));
      const slider=get('input'), next=get('[data-lq="point"]'), hint=get('[data-depth-hint]'), matrix=get('.lq-depth-matrix');
      function offset(x,y) {
        dx=Math.max(-1,Math.min(1,x));dy=Math.max(-1,Math.min(1,y));
        matrix.setAttribute('values',[dx*.5,0,0,0,.5, dy*.28,0,0,0,.5, 0,0,0,0,0, 0,0,0,1,0].join(' '));
        slider.value=Math.round(dx*100);
        if(Math.abs(dx)>.13||Math.abs(dy)>.17)moved=true;
        next.disabled=!moved;hint.textContent=moved?'近树移得多，远山移得少。':'也可以用滑杆移步。';
      }
      offset(dx,dy); slider.oninput=()=>offset(+slider.value/100,0);
      let drag;windowEl.onpointerdown=e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,dx,dy};windowEl.setPointerCapture(e.pointerId);};
      windowEl.onpointermove=e=>{if(drag)offset(drag.dx+(e.clientX-drag.x)/(windowEl.clientWidth*.35),drag.dy+(e.clientY-drag.y)/(windowEl.clientHeight*.45));};
      windowEl.onpointerup=windowEl.onpointercancel=()=>{drag=null;};
      bind('point',()=>{windowEl.onpointerdown=windowEl.onpointermove=windowEl.onpointerup=windowEl.onpointercancel=null;go('point');});
    } else if(phase==='point' || phase==='check') {
      windowEl.innerHTML=fullPhoto();
      if(point&&!blank)placePin();
      caption('新建校舍全景',blank?'馆址指认已留白':'原照 · 全幅');
      if(phase==='point') {
        const hit=document.createElement('button');hit.className='lq-pick';hit.type='button';hit.setAttribute('aria-label','在照片上标出你猜测的图书馆，键盘可选画面中心');windowEl.append(hit);
        hit.onclick=e=>{const r=hit.getBoundingClientRect();point=e.detail?{x:(e.clientX-r.x)/r.width*100,y:(e.clientY-r.y)/r.height*100}:{x:50,y:50};draw();get('[data-lq="folder"]')?.focus({preventScroll:true});};
        note('现场指认',point?'这处屋舍只是猜测':'哪一处是图书馆？',point?'<p>你已在原照上落下一枚临时标记。到档案袋里找馆址记载，再决定它能否留下。</p>':'<p>点一处你想核对的屋舍。先留下你的猜测，再翻材料。</p>',point?button('folder','打开档案袋核对'):button('uncertain','我看不出来','secondary'));
        bind('uncertain',()=>{point=null;fieldFolder();});bind('folder',fieldFolder);
      } else {
        const a=citation('a2');
        note('馆址核验 · 证据不足',blank?'把位置留给将来的证据':'这张照片无法指认图书馆','<blockquote><small>甲①、甲② · 韩松涛</small>'+citation('a1').text+'<br>'+a.text+'</blockquote><p>照片题的是“新建校舍”。甲文记下曾宅的楼层，未将曾宅对应到画中任何一幢。</p>',
          blank?button('map','在路线图上定位'):button('blank',point?'撤下标记，馆址留白':'把馆址留白'));
        bind('blank',()=>{blank=true;draw();get('[data-lq="map"]').focus({preventScroll:true});});bind('map',()=>go('map'));
      }
    } else if(phase==='map') {
      windowEl.classList.add('lq-map-window');windowEl.innerHTML=routeMap(placed);
      caption(placed?'西迁主线与龙泉分校':'浙江西南 · 定位窗口','底图审图号 GS(2021)5448号');
      note('路线定位',placed?'龙泉在浙江西南':'在建德以南落针','<p>'+(placed?'把视线从西迁主线移向浙江西南，圈中的龙泉是分校所在城市。':'龙泉约在东经 119.14°、北纬 28.07°。它与建德经度接近，在建德以南。点图上相应的位置。')+'</p>'+
        (placed?'<blockquote><small>为何设分校 · 浙大校方报道</small>“'+data.reason.text+'”<a href="'+data.reason.url+'" target="_blank" rel="noopener">'+data.reason.title+' ↗</a></blockquote>':'<div class="lq-coordinates"><span>东经 <b>119.14°</b></span><span>北纬 <b>28.07°</b></span></div>'),
        placed?button('archive','到档案台写展签'):'');
      if(!placed)bindMap(get('svg'),ok=>{if(!ok){feedback('沿着建德的经线再向南找。');return;}placed=true;sfx?.('switch',{gain:0.5});draw();get('[data-lq="archive"]').focus({preventScroll:true});});
      bind('archive',()=>onArchive({pins:pinned?['a2']:[],blank,placed}));
    }
  }
  draw();
  narrate?.('longquan', { cue: 'look', once: false, whileVisible: () => phase === 'look' || phase === 'read' });
  return { scene,camera,update(){},render(){},resize(){},dispose(){reader?.dispose();root.remove();delete ui.dataset.phase;},
    test:{get phase(){return phase;},get offset(){return [dx,dy];}} };
}
