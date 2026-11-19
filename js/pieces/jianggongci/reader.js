import { esc, sourceIndex } from './ui.js';

// The folder, printed-page and red-pencil styles are the exhibition's shared reading desk.
const ring='<svg class="red-ring" viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M259 10 C210 1 110 2 61 6 C22 9 4 26 8 46 C12 69 83 77 165 74 C239 72 294 65 293 44 C292 23 276 14 251 9 L238 8"/></svg>';

export function createSourceReader(root,sources,photo,{take,none,close,sfx}) {
  const lines=sourceIndex(sources);
  let topic=null, selected=null, zoom=false;
  root.innerHTML=`<section class="reading-table" role="dialog" aria-modal="true" aria-label="案头阅读">
    <header class="reading-top"><button data-j="leave">← 回到展签</button><strong></strong><button data-j="photo" class="photo-toggle"><img src="${photo.src}" alt="">对照原照</button></header>
    <ol class="reading-steps" aria-label="取证步骤"><li>打开档案袋</li><li>点原句画圈</li><li>钉上便签</li></ol>
    <section class="catalog"><h2>档案袋</h2><p></p><div class="folder-grid"></div>
      <button class="no-evidence" data-j="none">这些材料未记二人身份</button></section>
    <section class="reading-page" hidden><div class="paper-tools"><button data-j="folders">‹ 换一袋材料</button><button data-j="zoom" aria-pressed="false">放大原文</button></div>
      <div class="reader-scroll"><article class="source-page web-print"></article></div>
      <footer class="reader-foot"><span role="status"></span><button class="btn" data-j="pin" disabled>钉到展签旁</button></footer></section>
    <section class="photo-board" hidden><button data-j="unphoto">收起原照 ×</button><figure><img src="${photo.src}" alt="江公祠原照，门右一人穿长衫，一人穿浅色衣"><figcaption>${esc(photo.credit)}</figcaption></figure></section>
  </section>`;
  const $=s=>root.querySelector(s),act=id=>$('[data-j="'+id+'"]');
  const page=$('.reading-page'),catalog=$('.catalog'),paper=$('.source-page'),board=$('.photo-board'),foot=$('.reader-foot span');
  function step(i){root.querySelectorAll('.reading-steps li').forEach((l,k)=>{
    l.classList.toggle('complete',k<i);if(k===i)l.setAttribute('aria-current','step');else l.removeAttribute('aria-current');
  });}
  function setZoom(flag){zoom=flag;paper.classList.toggle('jg-zoom',flag);act('zoom').setAttribute('aria-pressed',flag);act('zoom').textContent=flag?'缩回原文':'放大原文';}
  function folders() {
    sfx?.('paper');
    catalog.hidden=false;page.hidden=true;board.hidden=true;selected=null;step(0);
    root.dataset.view='folders';act('none').hidden=topic.key!=='people';
    $('.catalog p').textContent=topic.hint;
    $('.folder-grid button').focus({preventScroll:true});
  }
  function documentView(s) {
    sfx?.('paper');
    selected=null;catalog.hidden=true;page.hidden=false;board.hidden=true;step(1);
    root.dataset.view='document';paper.dataset.doc=s.id;setZoom(false);
    const hasPhoto=s.sentences[0].caption;
    const sentences=s.sentences.map(l=>`<button class="source-line" type="button" data-id="${l.id}" aria-pressed="false"><small>${lines.get(l.id).mark}</small><span>${esc(l.text)}</span>${ring}</button>`).join('');
    paper.innerHTML=`<div class="print-header"><b>${s.publisher}</b><span>网页摘录</span></div>
      <div class="print-address"><a href="${esc(s.url)}" target="_blank" rel="noopener">原文网页 ↗</a><time>核对 ${s.accessed}</time></div>
      <h2>${esc(s.title)}</h2><p class="print-by">${esc(s.byline)}</p>
      <div class="${hasPhoto?'jg-caption-page':'web-excerpts'}">${hasPhoto?`<figure><img src="${photo.src}" alt="图四，桃源山上江公祠"><figcaption>原图 · 使用许可待核</figcaption></figure>`:''}
      <div><p class="extract-label">${hasPhoto?'图四原注':s.location}</p>${sentences}</div></div>`;
    act('pin').disabled=true;foot.textContent='点能核对当前词条的原句，用朱笔画圈。';
    paper.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{
      selected=selected===b.dataset.id?null:b.dataset.id;
      if(selected)sfx?.('brush',{gain:0.6});
      paper.querySelectorAll('[data-id]').forEach(row=>row.setAttribute('aria-pressed',row.dataset.id===selected));
      act('pin').disabled=!selected;step(selected?2:1);
      foot.textContent=selected?'已圈 '+lines.get(selected).mark+'。可带回展签核对。':'点一句原文。';
    });
    $('.reader-scroll').scrollTop=0;act('folders').focus({preventScroll:true});
  }
  for(const s of sources){
    const b=document.createElement('button');b.className='folder';b.type='button';b.dataset.doc=s.id;
    b.innerHTML=`<span class="folder-flap"></span><i class="folder-tie"></i><span class="folder-slip"><small>${s.kind}　/　${s.year}</small><b>${esc(s.short)}</b></span><span class="folder-mark">${s.mark}</span>`;
    b.onclick=()=>documentView(s);$('.folder-grid').append(b);
  }
  act('folders').onclick=folders;act('zoom').onclick=()=>setZoom(!zoom);
  act('leave').onclick=close;act('none').onclick=()=>{if(topic?.key==='people')none();};
  act('pin').onclick=()=>{
    if(!selected)return;
    const feedback=take(selected);
    if(feedback)foot.textContent=feedback;
  };
  act('photo').onclick=()=>{board.hidden=false;act('unphoto').focus();};
  act('unphoto').onclick=()=>{board.hidden=true;act('photo').focus();};
  function onKey(e) {
    if(root.hidden)return;
    if(e.key==='Escape'){
      if(!board.hidden)act('unphoto').click();
      else if(!page.hidden)folders();else close();
    }
    if(e.key==='Tab'){
      const buttons=[...(board.hidden?root:board).querySelectorAll('button:not(:disabled),a[href]')].filter(b=>b.getClientRects().length);
      if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1)?.focus();}
      else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0]?.focus();}
    }
  }
  document.addEventListener('keydown',onKey);
  return {
    open(key,check){topic={...check,key};root.hidden=false;$('.reading-top strong').textContent='正在查证 · '+check.title;folders();},
    dispose(){document.removeEventListener('keydown',onKey);}
  };
}
