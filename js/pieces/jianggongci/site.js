import * as THREE from 'three';
import { brushWrite } from '../../brush.js';
import { createModel } from './model.js';
import { openPlan } from './plan.js';
import { esc, masthead, photoCredit, sourceIndex } from './ui.js';

const clamp=THREE.MathUtils.clamp;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createSite({renderer, ui, data, onArchive, onExit, narrate, sfx}) {
  const model=createModel(data), {scene,camera}=model;
  const shell=document.createElement('div');
  shell.className='jg-shell';ui.replaceChildren(shell);
  const sources=sourceIndex(data.archive.sources), placed=new Set();
  let phase='', read=0, yaw=-24, spread=51, yardYaw=.16, drag=null;
  let height=innerHeight, view=null, viewBox=null, fit=.86, walkStart=0, buildStart=0;
  const sizeObserver=new ResizeObserver(measure);
  const $=s=>shell.querySelector(s);
  const act=k=>$('[data-j="'+k+'"]');
  function state(next) {phase=next;ui.dataset.phase=next;shell.dataset.phase=next;}
  function mount(step,html) {
    sizeObserver.disconnect();view=viewBox=drag=null;
    shell.innerHTML=masthead(step)+'<main class="jg-main">'+html+'</main>';
    act('back').onclick=onExit;
    shell.scrollTop=0;
  }

  function plaqueButtons(detail=false) {
    return data.plaque.map(({char,x,y},i)=>{
      const left=detail?(981*x/100-225)/590*100:x;
      const top=detail?(1400*y/100-540)/205*100:y;
      return `<button class="jg-letter-hit" type="button" data-glyph="${i}" aria-label="匾上${['右','中','左'][i]}字，${char}" style="left:${left}%;top:${top}%"></button>`;
    }).join('');
  }
  function gateReader() {
    state('plaque');mount(0,`<div class="jg-plaque-layout jg-layout">
      <figure class="jg-original">
        <div class="jg-mount"><div class="jg-plate">
          <img src="${data.photo.src}" alt="祠门旧照，门楣横匾有三字，门右站着两人" draggable="false">
          <img class="jg-gleam" src="${data.photo.src}" alt="" draggable="false">
          <div class="jg-reticle" aria-hidden="true"></div>${plaqueButtons()}
        </div></div>
        ${photoCredit(data.photo)}
      </figure>
      <section class="jg-reading-note">
        <p class="jg-kicker">照片辨读 <i></i> 图四</p>
        <h1>门楣上的三个字</h1>
        <p class="jg-instruction">按你认为的阅读顺序，依次轻点匾上的字。</p>
        <div class="jg-detail" aria-label="原照门匾局部，可点字" style="background-image:url('${data.photo.src}')">${plaqueButtons(true)}</div>
        <p class="jg-detail-cap">门匾局部放大</p>
        <div class="jg-transcription"><span>我的释读</span><div aria-live="polite">${data.plaque.map(()=>'<b>·</b>').join('')}</div></div>
        <p class="jg-feedback" role="status">从哪一边起读？</p>
        <button type="button" class="jg-primary" data-j="align" hidden>重返机位 <span>→</span></button>
      </section></div>`);
    for(const button of shell.querySelectorAll('[data-glyph]')) button.onclick=()=>{
      const index=Number(button.dataset.glyph);
      if(read===3)return;
      if(index!==read){
        $('.jg-feedback').textContent=read===0?'旧匾横书，试试从最右边起读。':'这个字还没轮到。从右往左接着读。';
        return;
      }
      read++;
      const field=$('.jg-transcription div').children[read-1];
      field.textContent='';field.classList.add('written');
      brushWrite(field,data.plaque[index].char,{duration:380,gap:0});
      shell.querySelectorAll('[data-glyph="'+index+'"]').forEach(b=>{b.classList.add('found');b.disabled=true;});
      $('.jg-feedback').textContent=read===3?'从右往左，门名读作“江公祠”。':'已读“'+data.plaque.slice(0,read).map(x=>x.char).join('')+'”，再向左读。';
      if(read===3){state('plaque-read');act('align').hidden=false;}
    };
    act('align').onclick=alignment;
    narrate?.('jianggongci', { cue: 'plaque', once: false, whileVisible: () => phase === 'plaque' });
  }

  function world(step,caption,side) {
    mount(step,`<div class="jg-world jg-layout">
      <div class="jg-window"><div class="jg-view" data-j="viewport">
        <span class="jg-world-note">${caption}</span><div class="jg-annotations"></div>
      </div></div>
      <section class="jg-side">${side}</section></div>`);
    view=act('viewport');sizeObserver.observe(view);measure();
  }
  function alignment() {
    state('align');model.gate.visible=true;model.yard.visible=false;
    world(1,'门面依照片推测 · 非实测',`
      <p class="jg-kicker">江公祠 <i></i> 桃源山</p><h1>重返机位</h1>
      <p class="jg-instruction">左右拖动视角，让门柱与原照底片的边缘重合。</p>
      <label class="jg-slider"><span>左右移动机位 <output data-j="score"></output></span>
        <input data-j="station" type="range" min="-34" max="34" step=".1" value="${yaw}" aria-label="左右移动机位">
      </label>
      <p class="jg-field-note">留意门楣下沿和门洞左边线。照片框始终留在原机位。</p>`);
    view.insertAdjacentHTML('beforeend',`<div class="jg-film"><img alt="与祠门立面对齐的原照" draggable="false" src="${data.photo.src}"><i class="jg-seam"></i></div>`);
    const input=act('station');input.oninput=()=>setStation(input.valueAsNumber);
    installDrag();measure();setStation(yaw);
  }
  function setStation(angle) {
    if(phase!=='align')return;
    yaw=clamp(angle,-34,34);act('station').value=yaw;
    const score=Math.round(100*(1-Math.abs(yaw)/40));
    act('score').textContent='吻合 '+score+'%';
    if(Math.abs(yaw)<1.35){yaw=0;aligned();}
    else model.gateCamera(yaw,fit);
  }
  function installDrag() {
    view.onpointerdown=e=>{
      if(e.button!==0||drag)return;
      if(!['align','built'].includes(phase))return;
      drag={x:e.clientX,start:phase==='align'?yaw:yardYaw,id:e.pointerId};
      e.currentTarget.setPointerCapture(e.pointerId);
    };
    view.onpointermove=e=>{
      if(!drag||e.pointerId!==drag.id)return;
      const dx=(e.clientX-drag.x)/view.clientWidth;
      if(phase==='align')setStation(drag.start+dx*82);
      if(phase==='built'){yardYaw=clamp(drag.start-dx*.86,-.46,.47);model.yardCamera(yardYaw);annotations();}
    };
    view.onpointerup=view.onpointercancel=view.onlostpointercapture=()=>{drag=null;};
  }
  function setSpread(value) {
    spread=clamp(value,0,100);
    const film=$('.jg-film');
    film.style.setProperty('--split',spread+'%');
    act('compare').value=spread;act('fraction').textContent=Math.round(spread)+'%';
  }
  function aligned() {
    state('aligned');drag=null;model.gateCamera(0,fit);
    $('.jg-side').innerHTML=`<p class="jg-kicker">原照与立面 <i></i> 机位已对齐</p>
      <h1>走进祠门</h1><p class="jg-instruction">门内的张贴物、门右的两个人，都留在原照里。</p>
      <label class="jg-slider"><span>原照占比 <output data-j="fraction"></output></span>
        <input type="range" min="0" max="100" data-j="compare" aria-label="原照占比"></label>
      <div class="jg-source-slip"><small>丙①　图四原注</small><blockquote>${esc(data.photo.caption)}</blockquote><cite>刘凡供稿 · 遵义网，2025 · 使用许可待核</cite></div>
      <button class="jg-primary" type="button" data-j="enter">穿过门洞 <span>→</span></button>`;
    act('compare').oninput=e=>setSpread(e.target.valueAsNumber);setSpread(spread);measure();
    act('enter').onclick=()=>{
      if(phase!=='aligned')return;
      state('entering');walkStart=performance.now();act('enter').disabled=true;
      $('.jg-world-note').textContent=data.reconstructionNote;
      if(reduced())interior(false);
    };
  }
  function interior(built) {
    state(built?'built':'inside-empty');
    const title=built?'文字里的图书馆':'进门以后的院落';
    const contents=built
      ? `<dl class="jg-room-list">${data.rooms.map(r=>`<div><dt>${r.position}</dt><dd>${r.name}${r.detail?' · '+r.detail:''}</dd></div>`).join('')}</dl>`
      : `<div class="jg-source-slip"><small>甲①　韩松涛记馆址</small><blockquote>${esc(sources.get('a1').text)}</blockquote><cite>《浙江大学西迁时的图书馆》，2017</cite></div>`;
    world(2,data.reconstructionNote,`<p class="jg-kicker">江公祠 <i></i> ${built?'四处已就位':'院门以内'}</p>
      <h1>${title}</h1>
      <p class="jg-instruction">${built?'一段记述搭起四处空间。拖动模型，可以看清中间书库的两层。':'照片只留下门前这一角。摊开韩松涛的记述，为院子里的四处空间找到位置。'}</p>
      ${contents}
      <button class="jg-primary" data-j="${built?'archive':'plan'}" type="button">${built?'去档案台写展签':'摊开甲文与平面图'} <span>→</span></button>
      ${built?'<button class="jg-secondary" type="button" data-j="plan">回看院落平面</button>':''}`);
    model.yardCamera(yardYaw);model.build(built?(reduced()?1:0):0);
    const labels=$('.jg-annotations');
    labels.innerHTML=(built?data.rooms.map(r=>`<span class="jg-model-tag" data-room="${r.id}">${r.name}${r.detail?'<small>'+r.detail+'</small>':''}</span>`).join(''):'')
      +'<span class="jg-entrance-tag">↑ 进门</span>';
    if(built){buildStart=performance.now();installDrag();act('archive').onclick=()=>onArchive([...placed]);}
    act('plan').onclick=planning;annotations();
    if (!built) narrate?.('jianggongci', { cue: 'inside', once: false, whileVisible: () => phase === 'inside-empty' });
  }
  function planning() {
    state('placing');mount(2,'');
    sfx?.('paper');
    openPlan($('.jg-main'),data,placed,()=>interior(true),sfx);
    narrate?.('jianggongci', { cue: 'source', once: false, whileVisible: () => phase === 'placing' });
  }
  function annotations() {
    if(!view||!['built','inside-empty'].includes(phase))return;
    const position=(el,p)=>{
      if(el){el.style.left=(50+p.x*50)+'%';el.style.top=(50-p.y*50)+'%';}
    };
    for(const tag of view.querySelectorAll('[data-room]'))position(tag,model.projectRoom(tag.dataset.room));
    position($('.jg-entrance-tag'),new THREE.Vector3(0,0,-2.18).project(camera));
  }
  function measure() {
    if(!view)return;
    viewBox=view.getBoundingClientRect();
    if(!viewBox.width||!viewBox.height)return;
    const w=viewBox.width,h=viewBox.height;
    camera.aspect=w/h;fit=Math.min(.88,w*.83/(h*data.photo.aspect));
    const film=$('.jg-film');
    if(film){
      film.style.width=(h*fit*data.photo.aspect)+'px';film.style.height=(h*fit)+'px';
    }
    if(phase==='align'||phase==='aligned')model.gateCamera(yaw,fit);
    if(phase==='built'||phase==='inside-empty'){model.yardCamera(yardYaw);annotations();}
  }
  function update() {
    const now=performance.now();
    if(phase==='entering'){
      const t=Math.min(1,(now-walkStart)/2450);
      model.walk(t,fit,yardYaw);
      if(t===1)interior(false);
    }
    if(phase==='built')model.build(reduced()?1:Math.min(1,(now-buildStart)/870));
  }
  const viewport=new THREE.Vector4(), scissor=new THREE.Vector4(), clear=new THREE.Color();
  function render() {
    if(!viewBox)return;
    const savedTest=renderer.getScissorTest(),alpha=renderer.getClearAlpha(),auto=renderer.autoClear;
    renderer.getViewport(viewport);renderer.getScissor(scissor);renderer.getClearColor(clear);
    renderer.setScissorTest(false);renderer.setClearColor('#29241e',1);renderer.clear();
    const {left,bottom,width:w,height:h}=viewBox, y=height-bottom;
    renderer.setViewport(left,y,w,h);renderer.setScissor(left,y,w,h);renderer.setScissorTest(true);
    renderer.autoClear=true;renderer.render(scene,camera);
    renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(savedTest);
    renderer.setClearColor(clear,alpha);renderer.autoClear=auto;
  }
  function resize(w,h){height=h;measure();}
  shell.addEventListener('scroll',measure,{passive:true});
  function dispose(){
    sizeObserver.disconnect();shell.removeEventListener('scroll',measure);
    model.dispose();shell.remove();delete ui.dataset.phase;
  }
  gateReader();
  return {scene,camera,update,render,resize,dispose,test:{
    get phase(){return phase;}, get placed(){return [...placed];}, get yaw(){return yaw;}
  }};
}
