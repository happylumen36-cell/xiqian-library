import { createSourceReader } from './reader.js';
import { esc, masthead, sourceIndex } from './ui.js';
import { EXHIBITS, SRC } from '../../data/exhibits.js';

export function createArchive(root,A,{photo,onBack,onDone,sfx}) {
  const S={phase:'draft',draft:{role:'hq',size:null,people:null},draftText:'',pins:[],role:null,size:null,now:false,people:null};
  const lines=sourceIndex(A.sources);
  const option=(slot,id)=>A.slots[slot].choices.find(o=>o.id===id)?.text;
  const drafted=(slot)=>option(slot,S.draft[slot]);
  const shell=document.createElement('div');shell.className='jg-shell jg-archive';
  shell.innerHTML=masthead(3,'回到院内')+'<main class="jg-arch-main"></main><div class="desk-reader" hidden></div>';
  root.replaceChildren(shell);root.classList.add('show');
  const $=s=>shell.querySelector(s);
  const main=$('main'),readerRoot=$('.desk-reader'),header=$('.jg-head');
  const act=id=>main.querySelector('[data-j="'+id+'"]');
  let sent=false;
  const reader=createSourceReader(readerRoot,A.sources,photo,{sfx,take:takeLine,none:()=>{
    hideReader();show('insufficient');
  },close:()=>{hideReader();act('folders')?.focus({preventScroll:true});}});
  header.querySelector('[data-j="back"]').onclick=onBack;
  function show(phase) {
    S.phase=phase;root.dataset.phase=phase;shell.dataset.archive=phase;
    if(phase==='draft')draft();
    else if(phase==='insufficient')insufficient();
    else if(phase==='final')finalLabel();
    else check();
    shell.scrollTop=0;
  }
  function hideReader(){readerRoot.hidden=true;main.inert=false;header.inert=false;}
  function browse(){
    if(!A.checks[S.phase])return;
    main.inert=true;header.inert=true;reader.open(S.phase,A.checks[S.phase]);
  }
  function takeLine(id) {
    const key=S.phase,C=A.checks[key];
    if(!C)return '';
    if(![...C.required,...(C.supplementary||[])].includes(id)){
      if(key==='people')return '这句没有指认门右二人。可换一袋再查，或回到档案袋记录“未记二人身份”。';
      return key==='size'?'这句未给出藏书量。再找韩文中写册数的那一句。':'这句未指明江公祠的馆址。再对读甲①与丙①。';
    }
    if(!S.pins.includes(id)) { S.pins.push(id); sfx?.('paper',{gain:0.5}); }
    hideReader();check();(act('accept')||act('folders'))?.focus({preventScroll:true});return '';
  }
  function labelText(isDraft=false) {
    const parts=['江公祠',isDraft?drafted('role'):option('role',S.role||S.draft.role)];
    if(isDraft){
      if(drafted('size'))parts.push(drafted('size'));
      if(S.draft.people==='staff')parts.push('门右两人或为图书馆员');
    }else{
      if(S.size==='about')parts.push('藏书约十万册');
      if(S.now)parts.push('原址今为遵义市一中操场');
    }
    return parts.filter(Boolean).join('，')+'。';
  }
  function pinnedNotes() {
    if(!S.pins.length)return '<p class="jg-empty-pins">圈取原句后，出处便签会钉在这里。</p>';
    return S.pins.map(id=>{
      const l=lines.get(id);
      return `<article class="pin-note"><strong>${l.mark}　${l.source.short}</strong><p>${esc(l.text)}</p></article>`;
    }).join('');
  }
  const slip=(id)=>`<div class="jg-quote"><b>${lines.get(id).mark}</b><q>${esc(lines.get(id).text)}</q></div>`;
  const primary=(id,text)=>`<button type="button" class="jg-primary" data-j="${id}">${text} <span>→</span></button>`;
  const secondary=(id,text)=>`<button type="button" class="jg-secondary" data-j="${id}">${text}</button>`;
  function draft() {
    main.innerHTML=`<div class="jg-arch-grid">
      <section class="jg-arch-paper"><div class="jg-paper-head"><b>签</b><span>学生策展人 · 展签初稿</span></div><h1>试写一句展签</h1>
      <p class="jg-draft-line" role="status"></p>
      <div class="jg-choices">${Object.entries(A.slots).map(([key,slot])=>`<fieldset><legend>${slot.name}</legend>
        ${slot.choices.map(o=>`<button type="button" data-slot="${key}" data-option="${o.id}">${o.text}</button>`).join('')}</fieldset>`).join('')}</div>
      ${primary('check','逐句核验')}</section>
      <aside class="jg-archive-aside"><figure class="jg-arch-photo"><img src="${photo.src}" alt="从门楣到门前二人的江公祠原照">
      <figcaption>遵义网 · 图四　刘凡供稿<br>使用许可待核</figcaption></figure><p>${A.commission}</p></aside></div>`;
    function refresh(){
      $('.jg-draft-line').textContent=labelText(true);
      main.querySelectorAll('[data-slot]').forEach(b=>b.setAttribute('aria-pressed',S.draft[b.dataset.slot]===b.dataset.option));
      act('check').disabled=!S.draft.size||!S.draft.people;
    }
    main.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>{S.draft[b.dataset.slot]=b.dataset.option;refresh();});
    act('check').onclick=()=>{if(!S.draft.size||!S.draft.people)return;S.draftText=labelText(true);show('role');};refresh();
  }
  function check() {
    const key=S.phase,C=A.checks[key], has=id=>S.pins.includes(id),ready=C.required.every(has);
    let stamp='',description=C.hint,actions=primary('folders','打开档案袋');
    if(key==='role'&&ready){
      stamp='有据';description='韩文记下江公祠的位置，图注把这道祠门与遵义校本部图书馆联系起来。';
      actions=primary('accept','保留“'+drafted('role')+'”')+secondary('folders','再取一条旁证');
    }
    if(key==='size'&&ready){
      const exact=S.draft.size==='about';
      stamp=exact?'有据':'证据不足';
      description=exact?'“左右”给出约数，这一条可以写进展签。':S.draft.size==='over'?'“十万余册”断定超过十万。原文的“左右”保留了上下浮动的余地。':'要比较全国藏书规模，还需要同期各馆的统计。甲文只给出了这里的约数。';
      actions=primary('accept',exact?'保留“约十万册”':'改为“约十万册”')+secondary('omit','删去藏书量');
    }
    const idx=['role','size','people'].indexOf(key);
    main.innerHTML=`<div class="jg-arch-grid"><section class="jg-arch-paper">
      <div class="jg-paper-head"><b>核</b><span>展签核验　${idx+1} / 3</span></div>
      <h1>${C.title}</h1><p class="jg-check-claim"><small>初稿 · ${A.slots[key].name}</small><span>${esc(drafted(key))}</span></p>
      ${stamp?`<span class="jg-stamp">${stamp}</span>`:''}
      <p class="jg-check-prose">${description}</p>
      ${key==='size'&&ready?slip('a5'):''}
      ${key==='role'?`<div class="jg-checkmarks">${C.required.map(id=>`<span class="${has(id)?'has':''}">${has(id)?'✓':'○'} ${lines.get(id).mark} ${id==='a1'?'馆址记述':'图四原注'}</span>`).join('')}</div>`:''}
      <div class="jg-actions">${actions}</div></section>
      <aside class="jg-notes"><h2>出处便签</h2>${pinnedNotes()}</aside></div>`;
    if(act('folders'))act('folders').onclick=browse;
    if(act('accept'))act('accept').onclick=()=>{
      if(key==='role'){S.role=S.draft.role;show('size');}
      else {S.size='about';show('people');}
    };
    if(act('omit'))act('omit').onclick=()=>{S.size='omit';show('people');};
  }
  function insufficient() {
    main.innerHTML=`<div class="jg-arch-grid jg-people-proof"><section class="jg-arch-paper">
      <div class="jg-paper-head"><b>核</b><span>展签核验　3 / 3　门右二人</span></div>
      <h1>两人的身份，能写吗？</h1><span class="jg-stamp">证据不足</span>
      <p class="jg-check-prose">照片可见一人穿长衫，一人穿浅色衣。图注记下了馆址与用途，三袋材料都未写下这两人的姓名或职务。</p>
      <div class="jg-unverified"><small>待核说法</small><del>图书馆员</del></div>
      ${slip('c1')}<div class="jg-actions">${primary('blank','身份留白')}${secondary('delete','删去人物判断')}</div>
      </section><figure class="jg-people-print"><div role="img" aria-label="原照门右局部，两人一穿长衫、一穿浅色衣"></div>
      <figcaption><b>门右二人</b><span>图四局部 · 刘凡供稿，遵义网<br>使用许可待核</span></figcaption></figure></div>`;
    for(const action of ['blank','delete'])act(action).onclick=()=>{S.people=action;show('final');};
  }
  function noteStrings(){
    const result=S.pins.map(id=>{
      const l=lines.get(id);return l.mark+' '+l.source.byline+'《'+l.source.title+'》　'+l.text;
    });
    result.push('人物待考 · 三袋材料均未记门右二人的姓名或职务，已'+(S.people==='delete'?'删去人物判断。':'将人物身份留白。'));
    if(S.now)result.push('今昔 · 原址用途据丙①。');
    return result;
  }
  function relatedWall(){
    const exhibits=['zunyi-gate','zunyi-hq','zunyi-books'].map(id=>EXHIBITS.find(ex=>ex.id===id));
    const entries=exhibits.map(ex=>ex.kind==='photo'
      ? '<figure><img loading="lazy" src="'+esc(ex.image)+'" alt="'+esc(ex.title)+'"><figcaption>'+esc(ex.title)+'<small>'+esc(SRC[ex.source].license)+'</small></figcaption></figure>'
      : '<p><b>文献展板《'+esc(ex.title)+'》</b><span>'+esc(ex.quote)+'　甲⑤</span></p>');
    return '<details class="jg-related"><summary>对照同墙展品</summary><div>'+entries.join('')+'</div></details>';
  }
  function finalLabel(){
    const roleMarks='甲①、丙①';
    let initial=esc(S.draftText);
    for(const rejected of [
      S.size==='omit'||S.draft.size!=='about'?drafted('size'):null,
      S.draft.people==='staff'?'门右两人或为图书馆员':null
    ].filter(Boolean))initial=initial.replace(rejected,'<del>'+rejected+'</del>');
    main.innerHTML=`<div class="jg-arch-grid jg-final-grid"><section class="jg-arch-paper jg-signed">
      <div class="jg-paper-head"><b>签</b><span>遵义 · 江公祠</span></div><h1>展签定稿</h1>
      <p class="jg-final-text">${esc(labelText())}</p>
      <div class="jg-signature">学生策展人 拟</div>
      <div class="jg-final-refs"><div><b>${roleMarks}</b><span>馆址与用途</span></div>
        ${S.size==='about'?'<div><b>甲⑤</b><span>藏书在十万册左右。</span></div>':''}
        <div><b>待考</b><span>门前二人身份${S.people==='delete'?'已删去':'留白'}。</span></div></div>
      <div class="jg-revision"><small>初稿对照</small><p>${initial}</p></div>
      <label class="jg-now"><input type="checkbox" data-j="now" ${S.now?'checked':''}> 写入今昔一句 <small>丙①</small></label>
      <div class="jg-actions">${primary('finish','点亮这件展品')}</div></section>
      <aside class="jg-notes"><h2>出处便签</h2>${pinnedNotes()}${relatedWall()}</aside></div>`;
    act('now').onchange=e=>{S.now=e.target.checked;$('.jg-final-text').textContent=labelText();};
    act('finish').onclick=()=>{
      if(sent)return;sent=true;act('finish').disabled=true;
      sfx?.('stamp');
      onDone({text:labelText(),notes:noteStrings(),draft:S.draftText});
    };
  }
  show('draft');
  return {test:{state:S},dispose(){reader.dispose();shell.remove();root.classList.remove('show');delete root.dataset.phase;}};
}
