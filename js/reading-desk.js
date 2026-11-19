// Documents are transcribed separately in the case data. Quotation and navigation
// are kept distinct so punctuation from the source is never used as UI markup.
const nums = '①②③④⑤⑥⑦';
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ring = '<svg class="red-ring" viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M260 10 C218 1 110 2 62 6 C21 9 5 23 7 44 C9 70 75 77 167 75 C237 74 289 68 294 47 C300 27 283 10 255 9 L240 8"/></svg>';

export function createReader(root,sources,photo,{onPin,onClose,onNone,onVisibility,sfx}) {
  const photoName = esc(photo.name || '照片');
  root.innerHTML = `<div class="reading-table" role="dialog" aria-modal="true" aria-label="案头阅读">
    <header class="reading-top"><button type="button" data-action="return">← 回到展签</button><strong data-reader="query"></strong>
    <button class="photo-toggle" data-action="photo"><img src="${esc(photo.src)}" alt="">对照${photoName}</button></header>
    <ol class="reading-steps" aria-label="取证步骤"><li>打开档案袋</li><li>点原句画圈</li><li>钉上便签</li></ol>
    <section class="catalog"><h2>档案袋</h2><p data-reader="instruction"></p><div class="folder-grid"></div>
    <button type="button" class="no-evidence" data-action="none">这些材料未提供依据</button></section>
    <section class="reading-page" hidden><div class="paper-tools"><button data-action="folders">‹ 换一袋材料</button>
    <button data-action="magnify" aria-pressed="false">放大镜</button></div>
    <div class="reader-scroll"><article class="source-page"></article></div>
    <footer class="reader-foot"><span role="status"></span><button class="btn" data-action="pin" disabled>钉到展签旁</button></footer></section>
    <section class="photo-board" hidden><button data-action="photo">收起${photoName} ×</button><figure><img src="${esc(photo.src)}" alt="${esc(photo.alt || photo.name || '照片')}，可长按放大"><figcaption>${esc(photo.credit)}</figcaption></figure></section>
    <div class="reading-lens" hidden aria-hidden="true"><div></div></div></div>`;
  const get=s=>root.querySelector(s), action=k=>get('[data-action="'+k+'"]');
  const table=get('.reading-table'), catalog=get('.catalog'), page=get('.reading-page'), paper=get('.source-page'), board=get('.photo-board'), lens=get('.reading-lens');
  const photoBtn=action('photo');
  let current=null,picked=null,context=null,hold=0,zoom=false,track=null,opener=null,standalone=false,suppressTap=false;
  let expected=null,destination='';
  const purpose={where:'地点词条',when:'时间词条',who:'人物核验',timeline:'时间线'};
  function step(n){
    get('.reading-steps').hidden=standalone;
    get('.reading-steps').querySelectorAll('li').forEach((li,i)=>{
      if(i===n)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');
      li.classList.toggle('complete',i<n);
    });
  }
  const folders=get('.folder-grid');
  for(const s of sources){
    const b=document.createElement('button');b.className='folder';b.dataset.doc=s.id;
    b.innerHTML=`<span class="folder-flap"></span><i class="folder-tie"></i><span class="folder-slip"><small>${esc(s.kind)}　/　${s.year}</small><b>${esc(s.short)}</b></span><span class="folder-mark">${s.mark}</span>`;
    b.onclick=()=>openDocument(s);folders.append(b);
  }
  function closeLens(){ clearTimeout(hold);hold=0;track=null;lens.hidden=true;lens.firstElementChild.replaceChildren(); }
  function showLens(target,x,y){
    const surface=target.closest('.source-page,.photo-board figure');if(!surface)return;
    const rect=surface.getBoundingClientRect(),copy=lens.firstElementChild;
    if(track!==surface){copy.innerHTML=surface.outerHTML;const clone=copy.firstElementChild;clone.inert=true;
      clone.style.cssText='width:'+rect.width+'px;height:'+rect.height+'px;max-width:none;margin:0;transform:none;position:relative;';track=surface;}
    const r=lens.offsetWidth/2||80, mag=1.8;
    const cx=Math.max(r+6,Math.min(innerWidth-r-6,x+92)),cy=Math.max(r+6,Math.min(innerHeight-r-6,y-78));
    lens.hidden=false;lens.style.left=cx+'px';lens.style.top=cy+'px';
    copy.style.transform='translate('+(r-(x-rect.left)*mag)+'px,'+(r-(y-rect.top)*mag)+'px) scale('+mag+')';
  }
  table.addEventListener('click',e=>{if(suppressTap){suppressTap=false;e.stopPropagation();e.preventDefault();}},true);
  table.addEventListener('pointerdown',e=>{suppressTap=false;if(e.target.closest('.source-page,.photo-board figure')){if(zoom)showLens(e.target,e.clientX,e.clientY);else hold=setTimeout(()=>{suppressTap=true;showLens(e.target,e.clientX,e.clientY);},420);}});
  table.addEventListener('pointermove',e=>{if(zoom||track)showLens(e.target,e.clientX,e.clientY);});
  for(const name of ['pointerup','pointercancel','pointerleave'])table.addEventListener(name,closeLens);
  function setView(isDocument){catalog.hidden=isDocument;page.hidden=!isDocument;board.hidden=true;closeLens();root.dataset.view=isDocument?'document':'folders';step(isDocument?1:0);}
  function openDocument(s){
    sfx?.('paper');
    current=s;picked=null;setView(true);get('.reader-scroll').scrollTop=0;
    const press=s.carrier==='press';paper.className='source-page '+(press?'press-print':'web-print');paper.dataset.doc=s.id;
    const line=(v,i)=>`<button type="button" class="source-line" data-id="${v.id}" aria-pressed="false"><small>${s.mark+nums[i]}</small><span>${esc(v.text)}</span>${ring}</button>`;
    const lines=press?`<div class="clipping-cols"><figure class="caption-mount"><img src="${esc(photo.src)}" alt="报刊图注对应的${photoName}"><figcaption>图注摘录</figcaption>${line(s.sentences[0],0)}</figure><div class="press-column"><p class="extract-label">文中所引回忆</p>${line(s.sentences[1],1)}</div></div>`:
      `<p class="extract-label">正文摘录</p><div class="web-excerpts">${s.sentences.map(line).join('')}</div>`;
    paper.innerHTML=`<div class="print-header">${press?`<b class="masthead">${s.masthead}</b><span>${s.issue}　·　转载摘录</span>`:`<b>${esc(s.publisher || '浙江大学')}</b><span>网页打印稿</span>`}</div>
    <div class="print-address"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a><time>检索 ${s.accessed}</time></div>
    <h2>${esc(s.title)}</h2><p class="print-by">${esc(s.byline)}</p>${lines}<p class="print-location">原文位置　${esc(s.location)}</p>`;
    for(const b of paper.querySelectorAll('.source-line')){
      b.onclick=()=>{if(zoom)return;picked=picked===b.dataset.id?null:b.dataset.id;
        if(picked)sfx?.('brush',{gain:0.6});
        for(const other of paper.querySelectorAll('.source-line'))other.setAttribute('aria-pressed',other.dataset.id===picked);
        updateFoot();};
    }
    updateFoot();action('folders').focus({preventScroll:true});
    if(expected && s===expected.source)paper.querySelector('[data-id="'+expected.id+'"]')?.scrollIntoView({block:'nearest'});
  }
  function updateFoot(){
    const idx=current.sentences.findIndex(s=>s.id===picked);
    const ready=idx>=0 && (!expected || expected.id===picked), pinButton=action('pin');
    pinButton.disabled=!ready;
    pinButton.textContent='钉到'+purpose[context]+(context==='where'||context==='when'?'旁':'');
    step(ready?2:1);
    const hint=get('.reader-foot span');
    if(zoom && !ready)hint.textContent='放大镜已开启。读清后点“收起放大镜”，就能圈句。';
    else if(ready)hint.textContent='已圈 '+current.mark+nums[idx]+'。点右侧按钮收好这句原文。';
    else if(expected && expected.source!==current)hint.textContent='这次要找'+expected.mark+'。点“换一袋材料”，打开《'+expected.source.short+'》。';
    else if(expected)hint.textContent=(picked?'已圈 '+current.mark+nums[idx]+'。':'')+'请点编号 '+expected.mark+' 的原句。';
    else hint.textContent='直接点能核验'+destination+'的一句原文，朱笔会沿句子画圈。';
  }
  function hide(){
    standalone=false;root.hidden=true;root.dataset.view='closed';setZoom(false);onVisibility();
    closeLens();opener?.focus?.({preventScroll:true});
  }
  action('return').onclick=()=>{const comparing=standalone;hide();if(!comparing)onClose(context);};
  action('none').onclick=()=>{hide();onNone(context);};
  action('folders').onclick=()=>{sfx?.('paper');setZoom(false);setView(false);folders.querySelector('[data-doc="'+current.id+'"]')?.focus();};
  action('pin').onclick=()=>{if(action('pin').disabled)return;const id=picked;sfx?.('paper',{gain:0.5});hide();onPin(context,id);};
  table.querySelectorAll('[data-action="photo"]').forEach(b=>b.onclick=()=>{if(standalone){hide();return;}board.hidden=!board.hidden;closeLens();if(!board.hidden)board.querySelector('button').focus();else photoBtn.focus();});
  function setZoom(value){
    zoom=value;action('magnify').setAttribute('aria-pressed',value);action('magnify').textContent=value?'收起放大镜':'放大镜';closeLens();
  }
  action('magnify').onclick=()=>{setZoom(!zoom);updateFoot();};
  function key(e){
    if(root.hidden)return;
    if(e.key==='Escape'){if(standalone){hide();return;}if(!board.hidden){board.hidden=true;photoBtn.focus();}else if(!page.hidden)action('folders').click();else action('return').click();}
    if(e.key==='Tab'){const buttons=[...table.querySelectorAll('button:not(:disabled),a[href]')].filter(b=>b.getClientRects().length);
      if(!buttons.length)return;if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}}
  }
  document.addEventListener('keydown',key);
  return {open(task,query,docId,expectedId){
    if(!docId)sfx?.('paper');
    standalone=false;opener=document.activeElement;context=task;destination=query;expected=null;
    if(expectedId){
      const source=sources.find(s=>s.sentences.some(v=>v.id===expectedId));
      expected={id:expectedId,source,mark:source.mark+nums[source.sentences.findIndex(v=>v.id===expectedId)]};
    }
    get('[data-reader="query"]').textContent='正在查证 · '+query;
    get('[data-reader="instruction"]').textContent=expected?'打开《'+expected.source.short+'》，在原文里找 '+expected.mark+'。':
      '点一只档案袋，找能核验'+query+'的原句。读完一袋，还可以换一袋。';
    root.hidden=false;onVisibility();setView(false);action('none').hidden=!['where','when'].includes(task);
    action('return').textContent=task==='who'||task==='timeline'?'← 回到核验':'← 回到展签';
    if(docId)openDocument(sources.find(s=>s.id===docId));else folders.firstElementChild.focus({preventScroll:true});
  }, compare(){
    opener=document.activeElement;standalone=true;root.hidden=false;onVisibility();catalog.hidden=true;page.hidden=true;board.hidden=false;step(0);
    get('[data-reader="query"]').textContent='对照'+(photo.name || '照片');board.querySelector('button').focus();
  }, dispose(){document.removeEventListener('keydown',key);closeLens();}};
}
