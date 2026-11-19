// Both challenges use the same pointer gesture and a two-tap/keyboard alternative.
function bindPlacement(board,onChoose,onPlace) {
  let selected=null,drag=null,ghost=null;
  const tokens=[...board.querySelectorAll('[data-token]')];
  const choose=id=>{
    selected=id;tokens.forEach(b=>b.setAttribute('aria-pressed',b.dataset.token===id));
    board.classList.toggle('has-selection',!!id);onChoose(id);
  };
  function stop(){ghost?.remove();ghost=null;drag=null;board.classList.remove('placing');}
  for(const b of tokens){
    let suppressClick=false;
    b.setAttribute('aria-pressed','false');
    b.onclick=()=>{if(suppressClick){suppressClick=false;return;}choose(b.dataset.token);};
    b.onpointerdown=e=>{
      if(e.button!==0 || b.disabled)return;suppressClick=false;drag={id:b.dataset.token,x:e.clientX,y:e.clientY,pointer:e.pointerId};if(e.isTrusted)b.setPointerCapture(e.pointerId);
    };
    b.onpointermove=e=>{
      if(!drag||drag.pointer!==e.pointerId)return;
      if(!ghost&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6) {
        choose(drag.id);ghost=document.createElement('span');ghost.className='moving-name';ghost.textContent=b.textContent;board.append(ghost);board.classList.add('placing');
      }
      if(ghost){ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';}
    };
    b.onpointerup=e=>{
      if(!drag)return;
      const id=drag.id, target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-drop]'),moved=!!ghost;
      stop();if(moved){suppressClick=true;if(target&&board.contains(target))onPlace(id,target.dataset.drop);}
    };
    b.onpointercancel=stop;
  }
  board.querySelectorAll('[data-drop]').forEach(b=>b.onclick=()=>{if(selected)onPlace(selected,b.dataset.drop);else onChoose(null);});
}

export function showEvidenceBoard(panel,type,{checks,photo,find,citeLabel,notes,work,read,compare,next}) {
  const C=checks[type], who=type==='who', timeline=type==='timeline', choices=who?C.positions:timeline?C.events:[];
  const placed=work[type];
  const lookup=id=>choices.find(v=>v.id===id);
  const pinned=id=>notes.includes(id);
  const tag=(text,cls,handler)=>{const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;b.onclick=handler;return b;};
  const render=()=>showEvidenceBoard(panel,type,{checks,photo,find,citeLabel,notes,work,read,compare,next});
  const keepOpen=panel.dataset.board===type && panel.querySelector('.proof-pocket')?.open;
  panel.hidden=false;panel.className='proof-panel '+type;panel.dataset.board=type;
  panel.innerHTML=`<div class="proof-card"><header class="proof-header"><small>展签核验</small><h2>${who?'何人':timeline?'何时':'为何'}</h2><button class="board-photo" type="button">对照${photo.name || '照片'}</button><p>${C.query}</p></header>
     <div class="proof-body"></div><p class="board-message" role="status"></p><div class="board-actions"></div></div>`;
  const body=panel.querySelector('.proof-body'),msg=panel.querySelector('.board-message'),actions=panel.querySelector('.board-actions');
  const guide=panel.querySelector('.proof-header p'); guide.setAttribute('role','status');
  panel.querySelector('.board-photo').onclick=compare;
  if(type==='why'){
    guide.textContent='最后处理拍摄缘由。选一种写法，就可以检查定稿。';
    msg.textContent=C.feedback;C.actions.forEach((s,i)=>actions.append(tag(s,'btn '+(i?'ghost':''),()=>{work.why=s;next();})));return;
  }
  const need=who?[C.cite,C.collective]:[...new Set(C.events.map(e=>e.cite))];
  const strip=document.createElement('div');strip.className='proof-sources';
  for(const id of need){
    const row=find(id),b=tag((pinned(id)?'✓ ':'圈取 ')+citeLabel(id)+' '+row.src.short,'source-ref',()=>read(type,row.src.id,id));
    b.dataset.cite=id;b.dataset.pinned=String(pinned(id));strip.append(b);
  }
  body.append(strip);
  const collected=need.filter(pinned);
  if(collected.length){
    const pocket=document.createElement('details');pocket.className='proof-pocket';pocket.open=!!keepOpen;
    const summary=document.createElement('summary');summary.textContent=who?'翻看已钉的人物原文':'翻看已钉的日期原文';pocket.append(summary);
    for(const id of collected){const p=document.createElement('p');p.textContent=citeLabel(id)+'　'+find(id).sent.text;pocket.append(p);}
    body.append(pocket);
  }
  if(who){
    body.insertAdjacentHTML('beforeend',`<div class="who-layout"><figure class="who-photo"><img src="${photo.src}" alt="${photo.alt || photo.name || '照片'}，按观者视角从左到右"><div class="name-drops">${C.positions.map(v=>`<button data-drop="${v.id}" style="left:${v.x}%;top:${v.y}%" class="${placed.includes(v.id)?'matched':''}"><span>${placed.includes(v.id)?v.name:v.side}</span></button>`).join('')}</div></figure>
    <div class="name-pile"><p>名签 · 已配 ${placed.length} / ${choices.length}</p>${C.tray.filter(id=>!placed.includes(id)).map(id=>`<button class="name-tag" data-token="${id}" ${pinned(C.cite)?'':'disabled'}>${lookup(id).name}</button>`).join('')}</div></div>`);
  }else{
    const years=C.years;
    const scale=e=>{const [year,month,day]=e.date.split('.').map(Number);return ((year-years[0])*12+month-1+(day?(day-1)/31:0))/((years.at(-1)-years[0])*12)*100;};
    const dots=choices.map(e=>`<button class="ruler-dot ${placed.includes(e.id)?'pinned':''}" type="button" data-drop="${e.id}" style="left:${scale(e)}%" title="${e.date}" aria-label="${e.date}"></button>`).join('');
    body.insertAdjacentHTML('beforeend',`<div class="chronology"><div class="years">${years.map(y=>'<span>'+y+'</span>').join('')}</div><div class="time-ruler">${dots}</div><div class="time-stops">${choices.map(e=>`<button data-drop="${e.id}" class="time-stop ${placed.includes(e.id)?'matched':''}"><time>${e.date}</time><span>${placed.includes(e.id)?e.text+' · '+citeLabel(e.cite):'钉在此处'}</span></button>`).join('')}</div></div>
      <div class="event-tray">${C.tray.filter(id=>!placed.includes(id)).map(id=>{const e=lookup(id);return `<button class="event-card" data-token="${id}" ${pinned(e.cite)?'':'disabled'}><small>${citeLabel(e.cite)}</small>${e.text}</button>`;}).join('')}</div>`);
  }
  function placementHint(id){
    if(who){
      if(!pinned(C.cite))return '点“圈取 '+citeLabel(C.cite)+'”，读'+(photo.name||'照片')+'图注，把原句钉回这里。';
      return id?'已选“'+lookup(id).name+'”。从看照片的方向数，点照片上对应的位置。':'先点一张名签，再点照片上的位置。也可以把名签直接拖到人物身上。';
    }
    if(id)return '已选“'+lookup(id).text+'”。对照 '+citeLabel(lookup(id).cite)+'，点它发生的日期。';
    const available=choices.some(e=>pinned(e.cite)&&!placed.includes(e.id));
    return available?'先点一张已解锁的事件卡，再点它发生的日期，也可以直接拖放。':'点上方“圈取”去取原句。钉回后，同编号的事件卡就可以移动。';
  }
  bindPlacement(panel,id=>{guide.textContent=placementHint(id);},(id,drop)=>{
    if(!lookup(id)||placed.includes(id))return;
    if(who&&!pinned(C.cite)){msg.textContent='先从'+citeLabel(C.cite)+'圈取这张照片的原图注。';return;}
    if(!who&&!pinned(lookup(id).cite)){msg.textContent='先从档案袋圈取这一事件的依据。';return;}
    if(id!==drop){guide.textContent=(who?'这个位置和图注不符。':'这个日期和原文不符。')+placementHint(id);return;}
    placed.push(id);render();
  });
  if(placed.length!==choices.length){
    guide.textContent=placementHint(null);
    msg.textContent=who?'图注的“左”和“右”都从看照片的人这一侧数。':'已配 '+placed.length+' / '+choices.length+' 件事件。灰色事件卡的编号对应上方的材料。';
    return;
  }
  if(who){
    if(!pinned(C.collective)){guide.textContent=C.collectivePrompt(citeLabel(C.collective));return;}
    guide.textContent=C.completePrompt;
    msg.textContent=C.feedback;actions.append(tag('记入人物核验','btn',()=>{work.whoDone=true;next();}));
  }else if(!work.inference){
    guide.textContent=C.completePrompt;
    msg.textContent=C.question;C.choices.forEach((s,i)=>{const b=tag(s,'btn '+(i?'':'ghost'),()=>{
      if(i===C.answer){work.inference=true;render();}else msg.textContent='再分辨迁入与开馆。材料有记载正式开馆日或按下快门的日子吗？';
    });b.dataset.answer=String(i);actions.append(b);});
  }else{guide.textContent='回到档案袋，用照片的原图注核定展签年份。';msg.textContent=C.feedback;actions.append(tag('带着推理核定年份','btn',next));}
}
