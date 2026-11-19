import { CHAPTERS, EXHIBITS } from './data/exhibits.js';
/*
 * ?autoplay=1、bombs、jianggongci、longquan 从海报走到指定展品点亮。
 * ?fresh 从头开始。已有定稿时从展品卡重新调研。
 * 结束后标签页显示 AUTOPLAY DONE · <玩家展签>。hall 只走到展厅。
 */
const wait = ms => new Promise(r => setTimeout(r, ms));
const q = s => document.querySelector(s);
const byText = (sel, t) => [...document.querySelectorAll(sel)].find(n => n.textContent.includes(t));
async function until(fn, what, ms = 30000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await wait(200); } throw new Error('timeout ' + what); }
async function tap(n, ms = 1200, what = '') {
  if (!n) throw new Error('missing ' + what);
  if (typeof n.click === 'function') n.click();
  else {
    const r = n.getBoundingClientRect();
    n.dispatchEvent(new MouseEvent('click', {bubbles:true, clientX:r.x+r.width/2, clientY:r.y+r.height/2}));
  }
  await wait(ms);
}
const M = () => window.__museum;
const mode = new URLSearchParams(location.search).get('autoplay');
async function assertReachable(button) {
  button.scrollIntoView({block:'nearest',behavior:'instant'});await wait(50);
  const r=button.getBoundingClientRect();
  if(!button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))throw Error('无法点选 '+button.textContent);
}
async function assertSeparateChoices() {
  const buttons=[...q('.board-actions').querySelectorAll('button')];
  if(buttons.length!==2)throw Error('核验选项不全');
  const [a,b]=buttons.map(n=>n.getBoundingClientRect());
  if(a.left<b.right && b.left<a.right && a.top<b.bottom && b.top<a.bottom)throw Error('核验选项重叠');
  for(const button of buttons)await assertReachable(button);
}

function assertCoverCaption(caption) {
  const rect = caption.getBoundingClientRect();
  if (rect.width > 560 || rect.left < 0 || rect.top < 0 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1)
    throw Error('封面字幕超出可用区域');
  const protectedElements = '.pz-intro, .pz-enter, .atlas-open, .pz-city text, [data-scenery], .pz-photo, .pz-title, .pz-seal, .pz-kicker, .pz-sub';
  for (const node of q('#entry').querySelectorAll(protectedElements)) {
    const other = node.getBoundingClientRect();
    if (!other.width || !other.height || getComputedStyle(node).visibility === 'hidden') continue;
    if (rect.left < other.right && other.left < rect.right && rect.top < other.bottom && other.top < rect.bottom)
      throw Error('封面字幕遮挡 ' + (node.dataset.scenery || node.getAttribute('class') || node.textContent.trim()));
    if (node.matches('.pz-enter, .atlas-open') && !node.contains(document.elementFromPoint(other.x + other.width / 2, other.y + other.height / 2)))
      throw Error('字幕显示时无法点选 ' + node.textContent.trim());
  }
}

const requestedIds = { '1':'yishan-photo', bombs:'yishan-bombs', jianggongci:'zunyi-jianggongci', longquan:'longquan-view' };
async function openTask(ex) {
  const chapter = CHAPTERS.findIndex(c=>c.id===ex.chapter);
  let mark;
  if (!M().progress.done[ex.id]) {
    await tap(q('#chapters [data-i="'+chapter+'"]'),1300,'章节');
    mark=q('#markers .marker.show[data-id="'+ex.id+'"]');
  }
  if (mark) await tap(mark,1100,'墙上标记');
  else {
    // A portrait chapter can be narrower than its wall. The ledger reaches every frame.
    await tap(q('#tracker'),300,'任务灯');
    await tap(q('[data-task="'+ex.id+'"]'),1200,'任务灯中的展品');
  }
  await until(()=>q('#card.show')?.dataset.exhibit === ex.id,'展品卡');
  if (!ex.investigation) {
    if (q('#card [data-act="go"]') || !q('#card').textContent.includes('调研包待制作')) throw Error('待接入状态有误');
    document.title = 'AUTOPLAY PENDING · '+ex.title+' · 调研包待制作'; return false;
  }
  await tap(q('#card [data-act="go"], #card [data-act="redo"]'),1200,'开始调研');
  return true;
}
async function playLongquan() {
  const click = async sel => {
    const node=await until(()=>{const b=q(sel);return b&&!b.disabled&&b.getClientRects().length&&b;},sel);
    await tap(node,160,sel);
  };
  const field=k=>click('[data-lq="'+k+'"]'), desk=k=>click('[data-lqa="'+k+'"]');
  async function pin(doc,line) {
    await click('.lq-reader [data-doc="'+doc+'"]');
    await click('.lq-reader [data-line="'+line+'"]');
    await click('.lq-reader [data-read="pin"]');
  }
  await M().waitForNarration('longquan','look');
  await field('read');
  for (let i=0;i<5;i++) await click('[data-col="'+i+'"]');
  await field('date'); await field('right'); await field('depth');
  const slider=q('.lq-range input');slider.value=65;slider.dispatchEvent(new Event('input',{bubbles:true}));
  await field('point');await M().waitForNarration('longquan','point');
  await click('.lq-pick');await field('folder');await pin('han','a2');await M().waitForNarration('longquan','source');await field('blank');
  await field('map');await click('[data-zone="2"]');await field('archive');
  await M().waitForNarration('archive');await click('[data-claim="library"]');await desk('commit');
  for(const [id,doc] of [['c1','inscription'],['c2','inscription'],['d1','commons'],['a1','han']]){
    await desk('check-'+id);await pin(doc,id);
  }
  await desk('verdict');await desk('blank');await desk('light');
  await until(()=>q('.ceremony.show .cer-card.signed[data-exhibit="longquan-view"]'), '龙泉点亮',45000);
  const record=M().progress.done['longquan-view'];
  if(record.text!=='1941年10月，浙江大学龙泉分校新建校舍全景。' || !record.draft.includes('图书馆') ||
    record.evidence.decision!=='blank' || !['a1','a2','c1','c2','d1'].every(id=>record.evidence.pins.includes(id)))throw Error('龙泉展签或出处未完成');
  await until(()=>document.body.dataset.mode==='hall'||q('.opening-night.signed'),'回到展厅');
  document.title='AUTOPLAY DONE · '+record.text;
}

(async () => {
  const query = new URLSearchParams(location.search);
  if (query.has('alllit') && query.has('skip')) {
    await until(() => q('.opening-night.signed .night-go:not(:disabled)') && document.querySelectorAll('.opening-night.lit .night-lamps i').length === 4, '四灯终场', 65000);
    document.title = 'AUTOPLAY DONE · 四件展品已点亮';
    return;
  }
  await until(() => q('.poster.ready .pz-enter:not(:disabled)'), 'poster ready');
  q('.pz-photo img').click();
  assertCoverCaption(await until(() => q('#entry .narration-sub.show'), '封面讲解字幕'));
  assertCoverCaption(await until(() => q('#entry .narration-sub.show.quote'), '封面引文字幕'));
  await M().waitForNarration('poster');
  await tap(q('.pz-enter'), 4500, 'enter');
  await until(()=>document.body.dataset.mode==='hall-panorama','展厅全景',30000);
  await until(() => q('.letter.done') || document.body.dataset.mode==='hall', 'brief', 50000);
  if (q('.brief.show .letter.done')) {
    await M().waitForNarration('brief');await tap(q('.letter .btn'), 2700, 'accept');
    await M().waitForNarration('hall');
  }
  if (mode === 'hall') { document.title = 'AUTOPLAY DONE · hall'; return; }
  const target=EXHIBITS.find(ex=>ex.id===requestedIds[mode||'1']);
  if(!target)throw Error('未知调研入口 '+mode);
  if(!await openTask(target))return;
  if(mode==='longquan'){await playLongquan();return;}
  if (mode === 'bombs' || mode === 'jianggongci') {
    if (mode === 'bombs') {
      const {runBombsAutoplay} = await import('./pieces/bombs/autoplay.js');
      await runBombsAutoplay();
    } else {
      const {playJianggongci} = await import('./pieces/jianggongci/autoplay.js');
      await playJianggongci(q('#siteUI'),q('#archive'));
    }
    await until(()=>q('.ceremony.show .cer-card.signed[data-exhibit="'+target.id+'"]'),target.title+'点亮',50000);
    const result = M().progress.done[target.id];
    const expected = mode === 'bombs' ? '1939年2月5日，日机在广西宜山浙大校舍一带投弹118枚，其中一枚未爆。' : '江公祠，浙大遵义校本部图书馆，藏书约十万册。';
    if (result?.text !== expected || !result.draft || result.notes.length<3) throw Error(target.title+'展签或出处未完成');
    await until(()=>document.body.dataset.mode==='hall'||q('.opening-night.signed'),'点亮后回厅');
    document.title = 'AUTOPLAY DONE · '+result.text; return;
  }
  await until(() => q('.intro-card.ready'), 'site intro', 30000); await wait(1000);
  await tap(q('[data-act="begin"]'), 3000, 'begin');
  await M().waitForNarration('yishan','align');
  M().site.test.snap(); await wait(4000);
  M().site.test.setWipe(0.45); await wait(2200);
  M().site.test.setWipe(1); await wait(800);
  for (const id of ['lattice', 'gate', 'steps', 'people']) {
    await tap(q(`.site-ui .marker[data-id="${id}"]`), 1500, 'marker ' + id);
    await tap(byText('.clue-card .btn', '记入'), 700, 'keep');
  }
  await tap(byText('.notebook .btn', '档案台'), 1800, 'to archive');
  await M().waitForNarration('archive');
  await tap(byText('[data-group="when"] .chip', '开馆当天'), 400);
  await tap(byText('[data-group="where"] .chip', '图书馆门前'), 900);
  await tap(byText('.tray .btn', '就这样写'), 1200, 'commit');
  const openFolder = id => tap(q('.folder[data-doc="'+id+'"]'),750,'folder '+id);
  const pick = id => tap(q('.source-page .source-line[data-id="'+id+'"]'),1000,'circle '+id);
  const pin = () => tap(q('[data-action="pin"]'),1050,'pin');
  const boardTap = (sel,what) => tap(q('.proof-panel '+sel),420,what);
  async function place(id,drop=id,hold=120) {
    const token=q('[data-token="'+id+'"]'),target=q('[data-drop="'+drop+'"]:not(.ruler-dot)');
    if(!token||!target||token.disabled)throw Error('inactive token '+id);
    if(matchMedia('(pointer:coarse)').matches){
      token.scrollIntoView({block:'nearest'});await tap(token,150);
      if(token.getAttribute('aria-pressed')!=='true')throw Error('名签未选中 '+id);
      target.scrollIntoView({block:'nearest'});await tap(target,230);return;
    }
    const p=token.getBoundingClientRect(),d=target.getBoundingClientRect();
    const start=[p.x+p.width/2,p.y+p.height/2],end=[d.x+d.width/2,d.y+d.height/2];
    const pe=(type,coords)=>token.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,buttons:type==='pointerup'?0:1,pointerId:21,pointerType:'mouse',clientX:coords[0],clientY:coords[1]}));
    pe('pointerdown',start);
    for(let k=1;k<=6;k++){pe('pointermove',start.map((x,i)=>x+(end[i]-x)*k/6));await wait(26);}
    await wait(hold);pe('pointerup',end);await wait(230);
  }
  await tap(q('.tray [data-act="verify-where"]'),1400,'where');
  await openFolder('han2017');await wait(950);
  await assertReachable(q('[data-action="magnify"]'));
  await pick('a1');await pin();await M().waitForNarration('yishan','source');
  // 甲①定位图书馆。把合影的地点写得更准，还需核对另一份材料。
  await tap(byText('.tray .btn','改为'),800,'核对合影地点的出处');
  await pick('c1');await pin();
  await tap(byText('.tray .btn','改为'),1400,'place verdict');
  await tap(byText('.tray .btn','核验何人'),700);
  await boardTap('[data-cite="a3"]','professor source');await pick('a3');await pin();
  await place('buqing','quanzhi');
  if(M().archive.test.state.work.who.length)throw Error('wrong person accepted');
  await place('zhonghe');await place('jiangong');
  await place('buqing','buqing',1500);await place('quanzhi');
  await tap(byText('.board-actions .btn','记入'),660,'who verified');
  await tap(byText('.tray .btn','核验何时'),700);
  for(const id of ['a4','c2','d1','e1']){
    await boardTap('[data-cite="'+id+'"]','timeline source');
    if(id==='a4'){
      await pick('a1');if(!q('[data-action="pin"]').disabled)throw Error('指定原句未核对');
    }
    await pick(id);await pin();
  }
  for(const id of ['term','library','bomb','arrive','move']) await place(id);
  await assertSeparateChoices();
  await boardTap('[data-answer="0"]','counterclaim');
  if(M().archive.test.state.work.inference)throw Error('wrong inference accepted');
  await boardTap('[data-answer="1"]','inference');await wait(1600);
  await tap(byText('.board-actions .btn','核定年份'),700);
  await openFolder('wenhui2025');await pick('c1');await pin();
  await tap(byText('.tray .btn','仍然保留'),1000,'keep challenge');
  await tap(byText('.tray .btn','1939'),1000,'year');
  await tap(byText('.tray .btn','核验为何'),700);
  await assertSeparateChoices();
  await tap(byText('.board-actions .btn','留白'),1800,'why');
  await tap(byText('.tray .btn', '点亮'), 1000, 'light');
  await until(() => q('.cer-card.signed'), 'ceremony', 40000);
  await wait(4000);
  const result = M().progress.done['yishan-photo'];
  if (result?.text !== '1939年，四位教授在宜山文庙门前合影。') throw new Error('展签定稿有误');
  if (!result.notes.some(n => n.includes('甲③') && n.includes('教授'))) throw new Error('缺教授出处');
  if(!result.notes.some(n=>n.includes('丙①')&&n.includes('陈仲和')))throw Error('缺站位与年份的图注');
  const evidence=result.evidence;
  if(evidence.who.length!==4||evidence.timeline.length!==5||!evidence.inference||evidence.why!=='留白')throw Error('档案核验未完成');
  if(!['a3','a4','c1','c2','d1','e1'].every(id=>evidence.pins.includes(id)))throw Error('缺少已核便签');
  document.title = 'AUTOPLAY DONE · ' + result.text;
})().catch(e => { document.title = 'AUTOPLAY FAILED · ' + e.message; console.error(e); });
