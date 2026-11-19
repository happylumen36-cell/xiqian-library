import { esc, sourceIndex } from './ui.js';

export function openPlan(host, data, placed, onBuild, sfx) {
  const index=sourceIndex(data.archive.sources), rooms=data.rooms;
  let selected=null, drag=null, ghost=null, ignoreClick=false;
  const lookup=id=>rooms.find(r=>r.id===id);
  const name=r=>r.name+(r.detail?' · '+r.detail:'');
  const tray=['reading','stage','stacks','office'];
  host.innerHTML=`<section class="jg-plan jg-layout">
    <figure class="jg-drawing">
      <header><h2>院落平面</h2><span>${data.reconstructionNote}</span></header>
      <div class="jg-map" aria-label="院门在下，进门朝图上方">
        <div class="jg-perimeter" aria-hidden="true"></div>
        ${rooms.map(r=>`<button type="button" class="jg-drop" data-drop="${r.id}"><small>${r.position}</small><b></b></button>`).join('')}
        <div class="jg-entry-arrow"><i></i><span>进门方向</span></div>
      </div>
      <figcaption><span>江公祠 · 馆内空间</span><span data-j="count"></span></figcaption>
    </figure>
    <div class="jg-plan-side">
      <article class="jg-manuscript">
        <div class="jg-paper-head"><b>甲</b><span>韩松涛　《浙江大学西迁时的图书馆》</span></div>
        <h2>照文字布置</h2>
        <blockquote data-j="spatial-text"></blockquote>
        <p class="jg-paper-foot">浙江大学，2017 · “遵湄时期的图书馆”</p>
      </article>
      <section class="jg-room-tray">
        <header><h3>房间牌</h3><span>先选一张，再点平面位置</span></header>
        <div class="jg-room-cards">${tray.map(id=>`<button type="button" data-token="${id}" aria-pressed="false">${name(lookup(id))}</button>`).join('')}</div>
        <p class="jg-plan-hint" role="status"></p>
        <button type="button" class="jg-primary" data-j="build" hidden>立起院落模型 <span>→</span></button>
      </section>
    </div>
  </section>`;
  const get=s=>host.querySelector(s), msg=get('.jg-plan-hint'), quote=get('[data-j="spatial-text"]');
  const drops=[...host.querySelectorAll('[data-drop]')], tokens=[...host.querySelectorAll('[data-token]')];
  function refresh(feedback='') {
    get('[data-j="count"]').textContent='已就位 '+placed.size+' / 4';
    for(const b of drops){
      const r=lookup(b.dataset.drop), done=placed.has(r.id);
      b.classList.toggle('occupied',done);b.setAttribute('aria-label',r.position+(done?'，已放好'+name(r):'，放置房间牌'));
      b.querySelector('b').textContent=done?name(r):'＋';
    }
    for(const b of tokens){
      b.disabled=placed.has(b.dataset.token);b.setAttribute('aria-pressed',selected===b.dataset.token);
    }
    const active=selected&&lookup(selected);
    quote.innerHTML=['a2','a3','a4'].map(id=>{
      let line=esc(index.get(id).text);
      if(active?.cite===id)line=line.replace(active.quote,'<mark>'+active.quote+'</mark>');
      return `<p><sup>${index.get(id).mark}</sup>${line}</p>`;
    }).join('');
    msg.textContent=feedback||(placed.size===4?'四处位置已与甲文相合。':active?'已选“'+name(active)+'”，点它在院中的位置。':'站在图下的门口，分清进门的左手和右手。');
    get('[data-j="build"]').hidden=placed.size!==4;
  }
  function select(id) {if(!placed.has(id)){selected=id;refresh();}}
  function place(id) {
    if(!selected){refresh(placed.has(id)?'这张房间牌已经就位。':'先选一张房间牌，再点这里。');return;}
    const r=lookup(selected);
    if(r.id!==id){refresh('再读甲文：“'+r.quote+'”。选择仍保留。');return;}
    placed.add(id);sfx?.('switch',{gain:0.5});selected=null;refresh(placed.size<4?name(r)+'已就位。再放一张。':'');
  }
  function stopDrag(){ghost?.remove();ghost=null;drag=null;}
  for(const t of tokens){
    t.onclick=()=>{if(ignoreClick){ignoreClick=false;return;}select(t.dataset.token);};
    t.onpointerdown=e=>{
      if(e.button!==0||t.disabled||drag)return;
      ignoreClick=false;drag={id:t.dataset.token,x:e.clientX,y:e.clientY,p:e.pointerId};
      t.setPointerCapture(e.pointerId);
    };
    t.onpointermove=e=>{
      if(!drag||drag.p!==e.pointerId)return;
      if(!ghost&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6){
        select(drag.id);ghost=document.createElement('span');ghost.className='jg-moving';ghost.textContent=name(lookup(drag.id));host.append(ghost);
      }
      if(ghost){ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';}
    };
    t.onpointerup=e=>{
      if(!drag||drag.p!==e.pointerId)return;
      const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-drop]');
      if(ghost){ignoreClick=true;if(target&&host.contains(target))place(target.dataset.drop);}
      stopDrag();
    };
    t.onpointercancel=stopDrag;
    t.onlostpointercapture=stopDrag;
  }
  drops.forEach(b=>b.onclick=()=>place(b.dataset.drop));
  get('[data-j="build"]').onclick=()=>{if(placed.size===4)onBuild();};
  refresh();
}
