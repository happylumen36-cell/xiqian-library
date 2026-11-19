// Adapted from the exhibition's archive desk. The document reader here needs a facsimile,
// a Commons catalogue entry and a spatial observation, with different evidence rules.
import { MAP } from './marks.js';
import { cropHTML } from './plate.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ring='<svg class="red-ring" viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M260 10 C218 1 110 2 62 6 C21 9 5 23 7 44 C9 70 75 77 167 75 C237 74 289 68 294 47 C300 27 283 10 255 9 L240 8"/></svg>';
const area={id:'area',mark:'甲⑤',text:'图中操场、宿舍一带均有编号',crop:'ground',observation:true};
const action=(id,label,style='')=>'<button type="button" class="btn '+style+'" data-act="'+id+'">'+esc(label)+'</button>';

export function createArchive(root,A,{photo,onDone,onBack,sfx}) {
  const S={phase:'draft',choice:null,task:0,pins:new Set(),verdict:null,picked:null,doc:null,decision:null,delivered:false};
  const refs=new Map(A.sources.flatMap(s=>s.sentences.map(line=>[line.id,line])));
  refs.set(area.id,area);
  const routeNames=[...A.checks.map(check=>check.name),'余句'];
  const choice=()=>A.choices.find(c=>c.id===S.choice);
  const draftText=()=>A.base+(choice()?.text?'，'+choice().text:'')+'。';
  const finalText=()=>A.base+(S.decision==='revise'?'，'+choice().revision:'')+'。';
  const question=()=>A.checks[S.task]?.question || '材料能支持“'+choice().text+'”吗？';
  function notes(){
    const all=A.checks.map(c=>c.note);
    if(S.decision==='blank') all.push('待考　'+(S.choice==='casualties'?'师生伤亡情况':S.choice==='damage'?'校舍损毁程度':'各区域的落弹密度')+'留白。');
    if(S.decision==='revise') all.push('甲⑤　操场、宿舍周围的编号可在图面逐一指认。');
    return all;
  }
  root.classList.add('bombs-archive','show');
  root.innerHTML=`
    <div class="ar-scrim"></div><div class="archive-route" aria-label="展签核验进度">
      <span data-ref="route"></span><ol>${routeNames.map(s=>'<li><i></i>'+s+'</li>').join('')}</ol></div>
    <section class="ar-desk"><header class="ar-head">
      <button class="ghost-btn" data-act="back">← 回到灯箱</button><span class="ar-title">档案台</span>
      <button class="ar-photo" data-act="compare"><img src="${photo.src}" alt=""><span>对照原图</span></button></header>
      <p class="ar-commission"></p>
      <div class="desk-writing"><article class="label show">
        <div class="label-head"><span>宜山落弹分布图 · 展签</span><span class="label-state"></span></div>
        <p class="sentence"></p><ol class="notes"></ol><p class="label-sign"></p></article>
        <aside class="pinned-notes" aria-label="证据便签"></aside></div><div class="tray" aria-live="polite"></div>
    </section>
    <section class="desk-reader" hidden role="dialog" aria-modal="true" aria-label="案头阅读">
      <div class="reading-table"><header class="reading-top"><button data-act="close">← 回到展签</button>
        <strong data-ref="query"></strong><button class="photo-toggle" data-act="compare"><img src="${photo.src}" alt="">对照原图</button></header>
        <ol class="reading-steps"><li>打开档案袋</li><li>朱笔圈选</li><li>钉上便签</li></ol>
        <section class="catalog"><h2>档案袋</h2><p data-ref="hint"></p>
          <div class="folder-grid">${A.sources.map(s=>`<button class="folder" data-doc="${s.id}"><span class="folder-flap"></span><i class="folder-tie"></i><span class="folder-slip"><small>${s.kind}　/　${s.year}</small><b>${s.short}</b></span><span class="folder-mark">${s.mark}</span></button>`).join('')}</div>
          <button class="no-evidence" data-act="none">材料未提供这项依据</button></section>
        <section class="reading-page" hidden><div class="paper-tools"><button data-act="folders">‹ 换一袋材料</button><span>点原句或图面，朱笔圈选</span></div>
          <div class="reader-scroll"><article class="source-page"></article></div>
          <footer class="reader-foot"><span role="status"></span><button class="btn" data-act="pin" disabled>钉到展签旁</button></footer></section>
      </div></section>
    <dialog class="bm-comparison" aria-label="对照落弹分布图"><button data-act="close-photo">收起原图 ×</button>
      <figure><img src="${photo.src}" alt="${esc(photo.caption)}"><figcaption>${esc(photo.credit)}</figcaption></figure></dialog>`;
  const $=s=>root.querySelector(s);
  const reader=$('.desk-reader'),desk=$('.ar-desk'),tray=$('.tray'),dialog=$('dialog');
  function route() {
    $('[data-ref="route"]').textContent=S.phase==='draft'?'展签初稿':S.phase==='done'?'展签定稿':'核验进度';
    [...root.querySelectorAll('.archive-route li')].forEach((li,i)=>{
      const done=S.phase==='done'||(S.phase==='check' && (i<S.task || (i===S.task && S.verdict==='support')));
      li.classList.toggle('complete',done);
      if(i===S.task && S.phase==='check' && !done)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');
    });
  }
  function written() {
    const done=S.phase==='done';
    $('.label-state').textContent=done?'定稿':S.phase==='draft'?'初稿':'待核';
    $('.label-sign').textContent=done?A.ending.signature:'';
    const sentence=$('.sentence');sentence.classList.toggle('typeset',done);
    const marks=['甲②','乙①','甲①、甲④'];
    const clauses=A.phrases.map((text,slot)=>{
      const cited=done || S.task>slot || (S.task===slot && S.verdict==='support');
      const tail=slot===1?'118枚':text.slice(-1);
      const body=esc(text.slice(0,-tail.length))+'<span class="bm-cited">'+esc(tail)+(cited?'<sup>'+marks[slot]+'</sup>':'')+'</span>';
      return '<span class="fixed'+(S.phase==='check'&&S.task===slot?' bm-word':'')+'">'+body+'</span>';
    });
    let html=clauses.join('，');
    if(done && S.decision==='revise') html+='，<span class="fixed">'+esc(choice().revision)+'<sup>甲⑤</sup></span>';
    if(!done && choice()?.text)html+='，<span class="'+(S.task===3?'bm-word':'')+'">'+esc(choice().text)+'</span>';
    sentence.innerHTML=html+'。';
    $('.notes').innerHTML=done?notes().map(note=>{const [mark,content]=note.split('　');return '<li><b class="n">'+mark+'</b><span>'+content+'</span></li>';}).join(''):'';
    const pins=$('.pinned-notes');pins.hidden=!S.pins.size;
    pins.innerHTML='<h3>证据便签</h3>'+[...S.pins].map(id=>{
      const f=refs.get(id);
      return '<article class="pin-note" data-cite="'+id+'"><header><strong>'+f.mark+'</strong><small>'+
        (id==='entry'?'投弹记录':id==='date'?'日期题记':id==='area'?'图面观察':id==='sum'?'总记 · 辨读存疑':'未爆记录')+'</small></header><p lang="'+(f.lang||'zh')+'">'+esc(f.text)+'</p></article>';
    }).join('');
    route();
  }
  function writeDraft(){
    root.dataset.phase='draft';$('.ar-commission').textContent=A.commission;
    tray.innerHTML='<p class="ask">读完灯箱，你想把展签写到哪里？</p><div class="chips">'+A.choices.map(c=>'<button class="chip" data-choice="'+c.id+'" aria-pressed="'+(S.choice===c.id)+'">'+esc(c.label)+'</button>').join('')+'</div>'+action('commit','就这样写，打开档案袋 →');
    $('[data-act="commit"]').disabled=!S.choice;written();
  }
  function finish(decision) {
    S.phase='done';S.decision=decision;S.verdict=null;root.dataset.phase='done';
    $('.ar-commission').textContent='档案完成';
    const contrast=choice().text?'，<del>'+esc(choice().text)+'</del>':'';
    tray.innerHTML='<div class="compare"><span class="row-k">初稿对照</span><span class="row-v">'+esc(A.base)+contrast+'。</span></div>'+action('light',A.ending.light+' →');
    written();desk.scrollTop=0;$('[data-act="light"]').focus({preventScroll:true});
  }
  function nextTask() {
    S.task++;S.verdict=null;S.picked=null;
    if(S.task===3 && S.choice==='enough') {finish('keep');return;}
    openFolders();
  }
  function setReader(on) {
    reader.hidden=!on;desk.inert=on;
    if(!on)reader.dataset.view='closed';
  }
  function openFolders() {
    sfx?.('paper');
    S.verdict=null;S.picked=null;S.doc=null;
    checkDesk();setReader(true);reader.dataset.view='folders';
    $('.catalog').hidden=false;$('.reading-page').hidden=true;
    $('[data-ref="query"]').textContent='核验'+routeNames[S.task]+' · '+question();
    $('[data-ref="hint"]').textContent=A.checks[S.task]?.help ||
      (S.choice==='area'?'打开甲袋，看看原图能把落点的位置写到什么程度。':'翻看材料，区分落点记录与初稿里的说法。');
    steps(0);$('.folder').focus({preventScroll:true});
  }
  function steps(current) {
    [...root.querySelectorAll('.reading-steps li')].forEach((li,i)=>{
      if(i===current)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');
      li.classList.toggle('complete',i<current);
    });
  }
  function openDocument(id) {
    const s=A.sources.find(item=>item.id===id);if(!s)return;
    sfx?.('paper');
    S.doc=id;S.picked=null;
    reader.dataset.view='document';$('.catalog').hidden=true;$('.reading-page').hidden=false;
    const paper=$('.source-page');paper.dataset.doc=id;
    const lines=id==='map'?[...s.sentences,area]:s.sentences;
    const imprint=id==='map'?'浙江大学图史':id==='library'?'浙江大学':'Wikimedia Commons';
    const sheetType=id==='map'?'原图摘读':id==='library'?'网页打印稿':'文件说明页';
    paper.innerHTML=`<div class="print-header"><b>${imprint}</b><span>${sheetType}</span></div>
      <div class="print-address"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">查看来源 · ${new URL(s.url).hostname} ↗</a><time>检索 ${A.accessed}</time></div>
      <h2>${esc(s.title)}</h2><p class="print-by">${esc(s.byline)}</p>
      ${s.image?'<figure class="bm-classroom"><img src="'+s.image+'" alt="1939年春宜山标营教室"><figcaption>'+esc(s.title)+'</figcaption></figure>':''}
      <div class="bm-source-lines">${lines.map(line=>{
        const facet=line.crop?cropHTML(photo.src,MAP,MAP.crops[line.crop],line.observation?'操场、宿舍附近的原图':line.mark+'对应的原迹'):'';
        return '<div class="bm-source-item">'+facet+'<button type="button" lang="'+(line.lang||'zh')+'" class="source-line" data-id="'+line.id+'" aria-pressed="false"><small>'+line.mark+'</small><span>'+esc(line.text)+'</span>'+ring+'</button>'+
          (line.gloss?'<p class="bm-gloss">'+esc(line.gloss)+'</p>':'')+(line.observation?'<p class="bm-gloss">图面观察 · 圈取这一处位置关系</p>':'')+'</div>';
      }).join('')}</div><p class="print-location">原文位置　${esc(s.location)}</p>`;
    refreshFoot();$('.reader-scroll').scrollTop=0;
    $('[data-act="folders"]').focus({preventScroll:true});
  }
  function refreshFoot() {
    const ready=!!S.picked, task=A.checks[S.task];
    $('[data-act="pin"]').disabled=!ready;
    $('.reader-foot [role="status"]').textContent=ready?'已圈 '+refs.get(S.picked).mark+'，可钉回展签。':
      task?.id==='exception' && S.pins.has('sum')?'总记已钉。再圈26号的括注。':
      task?.id==='exception' && S.pins.has('exception')?'括注已钉。再圈图顶总记。':'点一处原文或图面作为依据。';
    steps(ready?2:1);
  }
  function checkDesk() {
    root.dataset.phase='check';$('.ar-commission').textContent='逐项核验 · '+question();
    const check=A.checks[S.task];
    let body='';
    if(S.verdict==='support') {
      body='<div class="verdict"><span class="seal">有据</span><p class="say">'+esc(check.verified)+'</p></div>'+
        action('proceed',S.task===2?(S.choice==='enough'?'查看定稿':'核验余句 →'):'核验'+routeNames[S.task+1]+' →');
    } else if(S.verdict==='gap' && S.task===3) {
      const c=choice();
      body='<div class="verdict bm-gap"><span class="seal gap">不足</span><div><p class="ask">证据不足</p><p class="say">“'+esc(c.text)+'”</p></div><p class="more">'+esc(c.gap||'图上能指认操场、宿舍周围的圈点。要判断“集中”，还须界定各区域并比较密度。')+'</p></div><div class="btn-row">'+
        (c.revision && S.pins.has('area')?action('revise','改为图上可见的范围'):'')+action('delete','删去这句','red')+action('blank','留白 · 标记待考','ghost')+'</div>'+
        '<button class="link" data-act="read">回到材料再找</button>';
    } else if(S.verdict==='gap') {
      body='<div class="verdict"><span class="seal gap">不足</span><p class="say">这项材料还不能核定'+check.name+'。</p><p class="more">'+esc(check.help)+'</p></div>'+action('read','回到材料再找');
    } else {
      body='<p class="instr">'+esc(check?.help||'对照原图和材料，决定这半句的去留。')+'</p>'+action('read','打开档案袋 →');
    }
    tray.innerHTML=body;written();
  }
  function verdict(type) {
    S.verdict=type;setReader(false);checkDesk();
    const first=tray.querySelector('button');first?.focus({preventScroll:true});
    if(innerWidth<=720)tray.scrollIntoView({block:'nearest',behavior:'instant'});
  }
  function keepPin(id) {
    if(S.pins.has(id))return;
    S.pins.add(id);sfx?.('paper',{gain:0.5});
  }
  function pin(id) {
    const check=A.checks[S.task];
    if(!check) {
      if(id==='area' && S.choice==='area')keepPin(id);
      verdict('gap');return;
    }
    if(!check.accepts.includes(id)){verdict('gap');return;}
    keepPin(id);
    if(check.id==='exception' && !check.accepts.every(required=>S.pins.has(required))) {
      S.picked=null;written();
      reader.querySelectorAll('.source-line').forEach(b=>b.setAttribute('aria-pressed','false'));
      refreshFoot();return;
    }
    verdict('support');
  }
  function handleClick(e) {
    const b=e.target.closest('button');if(!b || b.disabled)return;
    if(b.dataset.choice && S.phase==='draft'){S.choice=b.dataset.choice;writeDraft();root.querySelector('[data-choice="'+S.choice+'"]').focus({preventScroll:true});return;}
    if(b.dataset.doc && !reader.hidden){openDocument(b.dataset.doc);return;}
    if(b.classList.contains('source-line')){
      S.picked=S.picked===b.dataset.id?null:b.dataset.id;
      if(S.picked)sfx?.('brush',{gain:0.6});
      reader.querySelectorAll('.source-line').forEach(v=>v.setAttribute('aria-pressed',v.dataset.id===S.picked));
      refreshFoot();return;
    }
    switch(b.dataset.act){
      case 'back':onBack();break;
      case 'compare':if(!dialog.open)dialog.showModal();break;
      case 'close-photo':dialog.close();break;
      case 'commit':if(S.choice){S.phase='check';openFolders();}break;
      case 'read':case 'folders':openFolders();break;
      case 'close':setReader(false);checkDesk();tray.querySelector('button')?.focus();break;
      case 'none':verdict('gap');break;
      case 'pin':if(S.picked)pin(S.picked);break;
      case 'proceed':if(S.verdict==='support')nextTask();break;
      case 'revise':case 'delete':case 'blank':
        if(S.task===3 && S.verdict==='gap')finish(b.dataset.act);break;
      case 'light':
        if(S.phase==='done' && !S.delivered){S.delivered=true;sfx?.('stamp');onDone({text:finalText(),notes:notes(),draft:draftText()});}break;
    }
  }
  function keys(e) {
    if(reader.hidden||dialog.open)return;
    if(e.key==='Escape'){e.preventDefault();reader.querySelector(reader.dataset.view==='document'?'[data-act="folders"]':'[data-act="close"]').click();}
    if(e.key==='Tab'){
      const buttons=[...reader.querySelectorAll('button:not(:disabled),a[href]')].filter(b=>b.getClientRects().length);
      if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1)?.focus();}
      if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0]?.focus();}
    }
  }
  root.addEventListener('click',handleClick);root.addEventListener('keydown',keys);
  writeDraft();
  return {dispose(){if(dialog.open)dialog.close();root.removeEventListener('click',handleClick);root.removeEventListener('keydown',keys);root.classList.remove('bombs-archive','show');delete root.dataset.phase;root.replaceChildren();},
    test:{get state(){return {...S,pins:[...S.pins]};}}};
}
