import { citation } from './case.js';
import { openFolderDesk } from './reader.js';

const checks = [
  ['c1','照片的名称'], ['c2','题字的年月'], ['d1','文件页的日期'], ['a1','租用的宅院']
];
const control = (act,text,cls='') => '<button type="button" data-lqa="'+act+'" class="lq-button '+cls+'">'+text+'</button>';

export function createArchive(root, A, { photo, field, onDone, onBack, sfx }) {
  const state = { phase:'draft', name:0, claim:null, pins:new Set(field?.pins || []), decision:null, years:false, draft:'' };
  const desk=document.createElement('div');desk.className='lq-desk';root.replaceChildren(desk);root.classList.add('show');
  let reader, lastQuery='', committed=false;
  const get=s=>desk.querySelector(s);
  const bind=(key,fn)=>get('[data-lqa="'+key+'"]')?.addEventListener('click',fn);
  const sentence=()=> '1941年10月，'+A.names[state.name]+(state.years?'（图书馆在龙泉分校经历六年多）':'')+'。';
  const notes=()=>[
    '丙①、丙②　名称与年月据照片左下题字。民国三十年拾月换算为1941年10月。',
    '丁①　Commons 日期字段为“1 October 1941”。题字只记到月。',
    '甲①、甲②　韩松涛记载图书馆在租用的曾宅二楼。远景中的建筑无法据此指认，'+(state.decision==='delete'?'已删去指认。':'馆址留白。'),
    ...(state.years?['甲③　'+citation('a3').text]:[])
  ];
  function source(id,title,after) {
    lastQuery=id;reader=openFolderDesk(desk,A.sources,{sfx,query:title,target:id,
      onPin:p=>{reader=null;state.pins.add(p);after?.();draw();get('[data-lqa="check-'+p+'"]')?.focus({preventScroll:true});},
      onClose:()=>{reader=null;}});
  }
  function compare() {
    const dlg=document.createElement('dialog');dlg.className='lq-photo-dialog';
    dlg.innerHTML='<button type="button" autofocus>收起远景照片 ×</button><figure><img src="'+photo.src+'" alt="'+photo.alt+'"><figcaption>'+photo.credit+'</figcaption></figure>';
    desk.append(dlg);dlg.addEventListener('close',()=>dlg.remove(),{once:true});dlg.querySelector('button').onclick=()=>dlg.close();dlg.showModal();
  }
  function draw() {
    root.dataset.phase=desk.dataset.phase=state.phase;
    const final=state.phase==='done', drafting=state.phase==='draft';
    desk.innerHTML=`<header class="lq-desk-head"><button type="button" class="lq-return" data-lqa="back">‹ 回到现场</button><span>档案台 · 龙泉分校</span><button type="button" class="lq-return" data-lqa="photo">对照原照</button></header>
      <div class="lq-desk-body"><div class="lq-desk-heading"><p>学生策展人的展签</p><h1>${(A.deskTitles[state.phase] || A.deskTitles.verify).title}</h1></div>
      <div class="lq-desk-spread"><section class="lq-label-col"><article class="label"><div class="label-head"><span>龙泉分校远景</span><span class="label-state">${final?'定稿':drafting?'初稿':'核验中'}</span></div>
      <p class="sentence ${final?'typeset':''}"></p><div class="lq-label-notes"></div></article><div class="lq-tools"></div></section>
      <aside class="lq-evidence"><figure class="lq-print"><img src="${photo.src}" alt="${photo.alt}"><figcaption>照片左下 · 题字存于原件</figcaption></figure><div class="lq-pins"></div></aside></div></div>`;
    bind('back',onBack);bind('photo',compare);
    get('.sentence').textContent=drafting||state.phase==='verify'? '1941年10月，'+A.names[state.name]+(state.claim&&state.claim!=='blank'?'，'+A.claims[state.claim]:'')+'。':sentence();
    const tools=get('.lq-tools'),labelNotes=get('.lq-label-notes'),pins=get('.lq-pins');
    const card=(mark,head,body)=>'<article class="pin-note"><header><strong>'+mark+'</strong><small>'+head+'</small></header><p>'+body+'</p></article>';
    if(drafting){
      labelNotes.textContent='初稿可以带着猜测，定稿时逐项核验。';
      const options=(entries,current,group)=>entries.map(([id,text])=>'<button type="button" data-'+group+'="'+id+'" class="chip" aria-pressed="'+(id===current)+'">'+text+'</button>').join('');
      tools.innerHTML='<fieldset><legend>选择照片名称</legend><div>'+options(A.names.map((n,i)=>[i,n]),state.name,'name')+'</div></fieldset>'+
        '<fieldset><legend>初稿怎样写馆址？</legend><div>'+options(Object.entries(A.claims),state.claim,'claim')+'</div></fieldset>'+control('commit','就这样写，去核验');
      desk.querySelectorAll('[data-name]').forEach(b=>b.onclick=()=>{state.name=+b.dataset.name;draw();});
      desk.querySelectorAll('[data-claim]').forEach(b=>b.onclick=()=>{state.claim=b.dataset.claim;draw();get('[data-lqa="commit"]').focus({preventScroll:true});});
      get('[data-lqa="commit"]').disabled=!state.claim;
      bind('commit',()=>{state.draft=get('.sentence').textContent;state.phase='verify';draw();desk.scrollTop=0;});
      pins.innerHTML=card('甲②','现场手记',citation('a2').text);
    } else if(state.phase==='verify'){
      labelNotes.innerHTML='<span class="lq-proof-tag">待核</span> 题字、著录和馆址分别取证。';
      const list=[...checks,...(state.pins.has('a2')?[]:[['a2','曾宅图书馆的楼层']])];
      tools.innerHTML='<h2>圈原句，钉便签</h2><div class="lq-checks">'+list.map(([id,what])=>
        control('check-'+id,'<span>'+citation(id).mark+'　'+what+'</span><b>'+(state.pins.has(id)?'已钉':'查证')+'</b>','secondary')).join('')+'</div>'+control('verdict','核定馆址指认');
      for(const [id,what] of list)bind('check-'+id,()=>source(id,what));
      get('[data-lqa="verdict"]').disabled=!list.every(([id])=>state.pins.has(id));
      bind('verdict',()=>{state.phase='verdict';draw();});
      pins.innerHTML=[...state.pins].map(id=>{const c=citation(id);return card(c.mark,c.source.short,c.text);}).join('');
    } else if(state.phase==='verdict'){
      labelNotes.innerHTML='<span class="lq-proof-tag good">有据</span> 丙①②、丁①已核定名称与年月。';
      const claim=state.claim==='blank'?'照片中可见图书馆':A.claims[state.claim];
      tools.innerHTML='<h2><span class="lq-proof-tag">证据不足</span> “'+claim+'”</h2><p>甲文和乙文记下了曾宅这个馆址。照片的题字只说新建校舍，无法把任何一幢房屋认作曾宅。</p><div class="lq-verdict-actions">'+control('blank','馆址留白')+control('delete','删去指认','secondary')+'</div>'+
        '<button class="lq-source-link" data-lqa="notice">翻看乙①馆址名单</button>';
      pins.innerHTML=card('甲②','韩松涛',citation('a2').text)+card('丙①','原照题字',citation('c1').text);
      bind('notice',()=>source('b1','馆址名单中的龙泉'));
      for(const d of ['blank','delete'])bind(d,()=>{state.decision=d;state.phase='done';draw();desk.scrollTop=0;});
    } else {
      labelNotes.innerHTML='<p><b>有据</b> 丙①②、丁①　校名与年月</p><p><b>证据不足</b> 甲①②　画中馆址'+(state.decision==='delete'?'已删去':'已留白')+'</p>'+(state.years?'<p><b>有据</b> 甲③　在龙泉六年多</p>':'')+'<p class="label-sign">学生策展人 拟</p>';
      tools.innerHTML='<p class="lq-draft-line"><small>初稿</small> '+state.draft+'</p><div class="lq-final-actions">'+control('light','回展厅，点亮这幅照片')+control('years',state.years?'撤下馆史补记':'补记馆史 · 六年多','secondary')+'</div>';
      pins.innerHTML=card('丙①②','原照题字',citation('c1').text+'<br>'+citation('c2').text)+card('甲②','韩松涛',citation('a2').text)+(state.years?card('甲③','馆史补记',citation('a3').text):'');
      bind('years',()=>{if(state.years){state.years=false;draw();}else source('a3','图书馆在龙泉的时段',()=>{state.years=true;});});
      bind('light',()=>{if(committed)return;committed=true;get('[data-lqa="light"]').disabled=true;sfx?.('stamp');onDone({text:sentence(),notes:notes(),draft:state.draft,evidence:{pins:[...state.pins],decision:state.decision}});});
    }
  }
  draw();
  return {dispose(){reader?.dispose();desk.remove();root.classList.remove('show');delete root.dataset.phase;},test:{state,get lastQuery(){return lastQuery;}}};
}
