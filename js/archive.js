import { createReader } from './reading-desk.js';
import { showEvidenceBoard } from './evidence-board.js';
/*
 * 档案台：第一眼拟签 → 逐词查证 → 改字 → 完成档案。
 * 由基准样本 v1 的交互改写为可复用模块：createArchive(root, A, { photo, onDone, onBack })
 * A 是调研包里的 archive 内容（见 data/yishan-case.js）。
 * 每个可核对的词有一个结果 status：pending · support · sharpen · delete · blank · doubt
 */
const NUM = ['①', '②', '③', '④', '⑤', '⑥'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

export function createArchive(root, A, { photo, onDone, onBack, readSource, sfx }) {
  const photoName = esc(photo.name || '照片');
  const SLOTS = A.sentence.filter(t => typeof t === 'object').map(t => t.slot);
  const S = { phase: 'draft', draft: {}, result: {}, querying: null, pending: null, pins: [], work: {who: [], timeline: [], whoDone:false, inference:false, why:null} };
  const stages = {where:'何处',who:'何人',when:'何时',why:'为何'};
  const pinTasks = new Map();

  root.innerHTML = `
    <div class="ar-scrim"></div>
    <div class="archive-route" role="group" aria-label="展签核验进度"><span data-ref="routeTitle">展签初稿</span>
      <ol>${Object.entries(stages).map(([id,name])=>`<li data-step="${id}"><i aria-hidden="true"></i>${name}</li>`).join('')}</ol></div>
    <section class="ar-desk">
      <header class="ar-head">
        <button class="ghost-btn" data-act="back">← 回到现场</button>
        <span class="ar-title">档案台</span>
        <button class="ar-photo" type="button" aria-label="对照${photoName}"><img src="${esc(photo.src)}" alt=""><span>对照${photoName}</span></button>
      </header>
      <p class="ar-commission">${esc(A.commission)}</p>
      <div class="desk-writing"><article class="label show" data-ref="label">
        <div class="label-head"><span>展签</span><span class="label-state" data-ref="state">初稿</span></div>
        <p class="sentence" data-ref="sentence"></p>
        <ol class="notes" data-ref="notes"></ol>
        <p class="label-sign" data-ref="sign"></p>
      </article>
      <aside class="pinned-notes" data-ref="pins" aria-label="钉在展签旁的便签"></aside></div>
      <div class="tray" data-ref="tray" aria-live="polite"></div>
    </section>
    <section class="proof-panel" data-ref="proof" hidden></section>
    <section class="desk-reader" data-ref="reader" hidden></section>`;
  const $ = s => root.querySelector(`[data-ref="${s}"]`);
  function markTask(task) {
    const done={where:S.result.where && S.result.where.status!=='pending',who:S.work.whoDone,
      when:S.result.when && S.result.when.status!=='pending',why:!!S.work.why};
    $('routeTitle').textContent=S.phase==='draft'?'展签初稿':S.phase==='done'?'展签定稿':'核验进度';
    for(const step of root.querySelectorAll('.archive-route li')){
      const id=step.dataset.step;
      step.classList.toggle('complete',!!done[id]);
      if(id===task)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');
      step.setAttribute('aria-label',stages[id]+(done[id]?'，已核验':id===task?'，正在核验':'，待核验'));
    }
  }
  root.querySelector('[data-act="back"]').onclick = () => onBack();
  requestAnimationFrame(() => root.classList.add('show'));

  /* ---------- 工具 ---------- */
  const opt = slot => A.slots[slot].options.find(o => o.id === S.draft[slot]);
  const find = id => { for (const s of A.sources) { const i = s.sentences.findIndex(x => x.id === id); if (i > -1) return { src: s, sent: s.sentences[i], idx: i }; } return null; };
  const citeLabel = id => { const r = find(id); return r ? r.src.mark + NUM[r.idx] : ''; };
  const wordNow = slot => (S.result[slot] && S.result[slot].text) || opt(slot).text;
  const trim = t => t.replace(/^[…\s“]+|[，。、…\s”]+$/g, '');
  const btn = (label, cls, fn) => { const b = el('button', 'btn ' + (cls || ''), esc(label)); b.type = 'button'; b.onclick = fn; return b; };
  const row = (...b) => { const r = el('div', 'btn-row'); b.forEach(x => x && r.appendChild(x)); return r; };
  const tray = (...nodes) => {
    const t=$('tray'); t.replaceChildren(...nodes.filter(Boolean));
    // Finish scrolling before the curator can tap a newly displayed verdict.
    if(nodes.length)t.scrollIntoView({block:'nearest',behavior:'instant'});
  };
  // 同一出处只编一个注号
  const citeOrder = () => { const list = []; for (const s of SLOTS) { const r = S.result[s]; if (r && (r.status === 'support' || r.status === 'sharpen') && !list.includes(r.cite)) list.push(r.cite); } return list; };
  const noteNo = slot => citeLabel(S.result[slot].cite);
  function syncLayers(){
    root.querySelector('.ar-desk').inert=!$('proof').hidden || !$('reader').hidden;
    $('proof').inert=!$('reader').hidden;
  }
  const reader = createReader($('reader'), A.sources,photo,{
    sfx, onVisibility:syncLayers,
    onPin(task,id) {
      if(!S.pins.includes(id)) S.pins.push(id);
      if(!pinTasks.has(id))pinTasks.set(id,new Set());
      pinTasks.get(id).add(task);renderSentence();
      if (task==='who'||task==='timeline') board(task);
      else cite(task,id);
    },
    onClose(task) { if(task==='who'||task==='timeline')board(task);else {S.querying=null; renderSentence();checkTray();} },
    onNone(task) { cite(task,null); }
  });
  root.querySelector('.ar-photo').onclick=()=>reader.compare();
  function renderPins(){
    const target=$('pins');target.replaceChildren();target.hidden=!S.pins.length;
    if(!S.pins.length)return;
    target.append(el('h3','','证据便签'));
    for(const id of S.pins){
      const f=find(id),card=el('article','pin-note');
      card.dataset.cite=id;
      const links=new Set(pinTasks.get(id));
      for(const slot of SLOTS)if(S.result[slot]?.cite===id)links.add(slot);
      if(S.work.whoDone && [A.checks.who.cite,A.checks.who.collective].includes(id))links.add('who');
      const names={where:'地点',when:'年份',who:'人物',timeline:'时间线'};
      const head=el('header');head.append(el('strong','',citeLabel(id)),el('small','',[...links].map(t=>names[t]).join(' · ')));
      card.append(head,el('p','',esc(f.sent.text)));
      target.append(card);
    }
  }
  function board(type){
    const panel=$('proof');$('reader').hidden=true;
    markTask(type==='timeline'?'when':type);
    S.querying=null;
    showEvidenceBoard(panel,type,{checks:A.checks,photo,find,citeLabel,notes:S.pins,work:S.work,
      compare:()=>reader.compare(),
      read:(task,doc,id)=>reader.open(task,task==='who'?photoName+'中的人物':'时间线上的事件',doc,id),
      next:()=>{panel.hidden=true;syncLayers();renderSentence();if(type==='who')checkTray();
        else if(type==='timeline')openSheet('when');else finish();}
    });
    syncLayers();
  }
  /* ---------- 句子 ---------- */
  function renderSentence(just) {
    const box = $('sentence'); box.innerHTML = '';
    box.classList.toggle('typeset', S.phase === 'done');
    for (const tok of A.sentence) {
      if (typeof tok === 'string') { const fixed=el('span','fixed',esc(tok));
        if(A.fixedNote && S.work.whoDone) {
          const word=esc(A.fixedNote.word);fixed.innerHTML=esc(tok).replace(word,word+'<sup>'+citeLabel(A.fixedNote.cite)+'</sup>');
        }
        box.append(fixed); continue; }
      const slot = tok.slot, r = S.result[slot], o = opt(slot);
      let node;
      if (!o) {
        node = el('button', 'w empty', esc(A.slots[slot].placeholder)); node.setAttribute('aria-label', A.slots[slot].ask);
        node.onclick=()=>root.querySelector(`[data-group="${slot}"] .chip`)?.focus();
      }
      else if (!r || r.status === 'pending') {
        if (S.phase === 'check') {
          node = el('button', 'w check', esc(o.text)); node.setAttribute('aria-label', `查证“${o.text}”`);
          if (S.querying === slot || (S.pending && S.pending.slot === slot)) node.classList.add('querying');
          node.onclick = () => openSheet(slot);
        } else node = el('span', 'w draft' + (o.unsure ? ' unsure' : ''), esc(o.text));
      } else if (r.status === 'delete') continue;
      else if (r.status === 'blank') node = el('span', 'w blank', esc(A.slots[slot].blankText));
      else if (r.status === 'doubt') node = el('span', 'w doubt', `${esc(r.text)}<sup>？</sup>`);
      else node = el('span', 'w set', `${esc(r.text)}<sup>${noteNo(slot)}</sup>`);
      if (just !== slot && /set|blank/.test(node.className)) node.style.animation = 'none';
      node.dataset.slot = slot;
      box.appendChild(node);
      if (tok.suffix) box.appendChild(el('span', 'fixed', esc(tok.suffix)));
    }
    renderNotes(); renderPins();
  }
  function renderNotes() {
    const ol = $('notes'); ol.innerHTML = '';
    if (A.fixedNote && S.work.whoDone) {
      const {word, cite, quote} = A.fixedNote;
      const src = find(cite).src;
      ol.appendChild(el('li', '', `<span class="n">${citeLabel(cite)}</span><span>“${esc(word)}”据${esc(src.byline)}：“${esc(quote)}”。</span>`));
    }
    citeOrder().forEach((c, i) => { const f = find(c); ol.appendChild(el('li', '', `<span class="n">${citeLabel(c)}</span><span> ${esc(f.src.byline.split(' · ')[0])}《${esc(f.src.title)}》：“${esc(trim(f.sent.text))}”</span>`)); });
    for (const s of SLOTS) {
      const r = S.result[s]; if (!r) continue;
      let n, t;
      if (r.status === 'support' || r.status === 'sharpen') continue;
      else if (r.status === 'blank') { n = '待考'; t = s === 'when' ? '材料没有写到这张照片拍摄的具体日子。' : '地点暂未核实。'; }
      else if (r.status === 'doubt') { n = '？'; t = `“${esc(r.text)}”未见出处。`; }
      else continue;
      ol.appendChild(el('li', '', `<span class="n">${n}</span><span>${t}</span>`));
    }
  }
  function plain(markSlot, tag) {
    return A.sentence.map(t => {
      if (typeof t === 'string') return esc(t);
      const r = S.result[t.slot];
      if (r && r.status === 'delete') return '';
      let w = r && r.status === 'blank' ? `〔${esc(A.slots[t.slot].blankText)}〕` : esc(wordNow(t.slot));
      if (t.slot === markSlot) w = `<${tag}>${w}</${tag}>`;
      return w + esc(t.suffix || '');
    }).join('');
  }

  /* ---------- 第一眼 ---------- */
  function draftTray() {
    root.dataset.phase = 'draft';
    const wrap = el('div');
    wrap.appendChild(el('p', 'instr', '时间和地点各选一项，写下你第一眼的判断。接下来可以用原文改签。'));
    for (const slot of SLOTS) {
      const D = A.slots[slot];
      wrap.appendChild(el('p', 'ask', esc(D.ask)));
      const g = el('div', 'chips'); g.dataset.group = slot;
      for (const o of D.options) {
        const b = el('button', 'chip' + (o.unsure ? ' unsure' : ''), esc(o.text));
        b.setAttribute('aria-pressed', S.draft[slot] === o.id);
        b.onclick = () => { S.draft[slot] = o.id; g.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b)); renderSentence(slot); go.disabled = !SLOTS.every(s => S.draft[s]); };
        g.appendChild(b);
      }
      wrap.appendChild(g);
    }
    const go = btn('就这样写', '', commitDraft); go.disabled = true;
    wrap.appendChild(go);
    tray(wrap);
  }
  function commitDraft() {
    S.draftText = A.sentence.map(t => typeof t === 'string' ? t : opt(t.slot).text + (t.suffix || '')).join('');
    SLOTS.forEach(s => S.result[s] = { status: 'pending' });
    S.phase = 'check'; root.dataset.phase = 'check'; $('state').textContent = '待核';
    renderSentence(); checkTray();
  }
  function checkTray() {
    if((S.result.where.status!=='pending'||S.result.when.status!=='pending') && !S.work.whoDone) {
      markTask('who');
      return tray(el('p','instr',A.checks.who.placementIntro),row(btn('核验何人','',()=>board('who'))));
    }
    const left = SLOTS.filter(s => S.result[s].status === 'pending');
    if (!left.length) return S.work.why?finish():board('why');
    const slot=left.includes('where')?'where':left[0];
    markTask(slot);
    const instruction=slot==='where'
      ? '从地点入手。打开档案袋，找一句提到'+photoName+'地点的原文，钉到展签旁。'
      : '把材料里的事件放上时间线，再决定展签的时间可以写多细。';
    const go=btn('核验'+stages[slot],'',()=>openSheet(slot));
    go.dataset.act='verify-'+slot;
    tray(el('p','instr',instruction),row(go));
  }

  /* ---------- 证据层 ---------- */
  function openSheet(slot) {
    if(slot==='when' && !S.work.inference) {board('timeline');return;}
    markTask(slot); S.querying=slot; S.pending=null; renderSentence();
    reader.open(slot,'展签上的“'+wordNow(slot)+'”');
  }
  function cite(slot,sentId) {
    markTask(slot);
    S.pending={slot,sentId,stage:'verdict'}; S.querying=null; renderSentence(); decision();
    if (A.checks[slot].bySentence[sentId]?.readAloud) {
      const verdict = S.pending;
      readSource?.({ whileVisible: () => S.pending === verdict && $('reader').hidden && $('proof').hidden });
    }
  }

  const seal = (t, gap) => el('div', 'seal' + (gap ? ' gap' : ''), esc(t));
  const backLink = slot => { const b = el('button', 'link', '回到材料再找'); b.onclick = () => openSheet(slot); return b; };

  function decision() {
    const { slot, sentId, stage } = S.pending, C = A.checks[slot], o = opt(slot);
    const hit = sentId ? C.bySentence[sentId] : null, verdict = hit ? hit.verdict : 'gap';
    const v = el('div', 'verdict'), f = sentId && find(sentId);
    if (stage === 'push') {
      v.append(seal('存疑', true), el('p', 'say', `“${esc(o.text)}”会被下一位观众当作事实来读。`), el('p', 'push', esc(C.claim.push(o.text))));
      circle(slot);
      return tray(v, row(btn(C.year.label, '', () => decide(slot, 'sharpen', C.year.text, C.year.cite)), btn(C.claim.blankLabel, '', () => decide(slot, 'blank')), btn(C.claim.deleteLabel(o.text), 'red', () => decide(slot, 'delete')), btn(C.claim.pushAgainKeep, 'ghost', () => decide(slot, 'doubt', o.text))), backLink(slot));
    }
    v.append(seal(verdict === 'support' ? '有据' : verdict === 'year' ? '半据' : '不足', verdict !== 'support'), el('p', 'say', esc(hit ? hit.say : C.none)));
    if (f) v.appendChild(el('p', 'cite', `${citeLabel(sentId)}　“${esc(trim(f.sent.text))}”`));
    if (slot === 'where' && verdict === 'support') {
      const b = C.byOption[o.id];
      v.appendChild(el('p', 'more', esc(C.chain) + '<br>' + esc(b.why)));
      return tray(v, row(btn(b.sharpenLabel, '', () => decide(slot, 'sharpen', C.sharpen.text, C.sharpen.accepts?.includes(sentId)?sentId:C.sharpen.cite)), o.unsure ? btn(b.keepLabel, 'ghost', () => decide(slot, 'blank')) : btn(b.keepLabel, 'ghost', () => decide(slot, 'support', o.text, sentId))));
    }
    if (slot === 'when') {
      v.appendChild(el('p','more',esc(A.checks.timeline.feedback)));
      if (sentId && verdict !== 'year') v.appendChild(el('p', 'more', esc(C.none)));
      if (o.unsure) { v.appendChild(el('p', 'more', esc(C.unsure.say))); return tray(v, row(btn(C.year.label, '', () => decide(slot, 'sharpen', C.year.text, C.year.cite)), btn(C.unsure.blankLabel, 'ghost', () => decide(slot, 'blank'))), backLink(slot)); }
      return tray(v, row(btn(C.year.label, '', () => decide(slot, 'sharpen', C.year.text, C.year.cite)), btn(C.claim.deleteLabel(o.text), 'red', () => decide(slot, 'delete')), btn(C.claim.blankLabel, 'ghost', () => decide(slot, 'blank')), btn(C.claim.keepLabel, 'ghost', () => { S.pending.stage = 'push'; decision(); })), backLink(slot));
    }
    tray(v, row(btn('换一句再找', '', () => openSheet(slot)), btn('留白 · 标记待考', 'ghost', () => decide(slot, 'blank'))));
  }
  function circle(slot) {
    const w = $('sentence').querySelector(`[data-slot="${slot}"]`);
    if (w && !w.querySelector('.circle')) w.insertAdjacentHTML('beforeend', '<svg class="circle" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="50" cy="21" rx="48" ry="18" transform="rotate(-2 50 21)" vector-effect="non-scaling-stroke"/></svg>');
  }
  function decide(slot, status, text, citeId) {
    // A more precise label can only cite a passage its curator has actually opened.
    if(citeId&&!S.pins.includes(citeId)){
      S.querying=slot;reader.open(slot,'展签上的“'+text+'”',find(citeId).src.id,citeId);return;
    }
    const before = plain(slot, status === 'support' || status === 'doubt' ? 'span' : 'del');
    const commit = () => { S.result[slot] = { status, text: text || null, cite: citeId || null }; S.pending = null; renderSentence(slot); outcome(slot, status, before); };
    const node = $('sentence').querySelector(`[data-slot="${slot}"]`);
    if (status === 'delete' && node) {
      tray(); node.classList.remove('querying'); node.classList.add('striking');
      const tail = A.sentence.find(t => t.slot === slot).suffix ? node.nextElementSibling : null;
      setTimeout(() => {
        [node, tail].forEach(n => { if (!n) return; n.style.display = 'inline-block'; n.style.maxWidth = n.offsetWidth + 'px'; n.style.overflow = 'hidden'; n.style.verticalAlign = 'bottom'; });
        requestAnimationFrame(() => [node, tail].forEach(n => { if (n) { n.classList.add('collapsing'); n.style.maxWidth = '0px'; } }));
      }, 520);
      setTimeout(commit, 1150);
    } else { if (node) { node.style.transition = 'opacity .22s'; node.style.opacity = '0'; } setTimeout(commit, node ? 230 : 0); }
  }
  function outcome(slot, status, before) {
    markTask(null);
    const O = A.outcomes[status], v = el('div', 'verdict');
    v.append(seal(O.stamp, status !== 'support' && status !== 'sharpen'), el('p', 'say', esc(O.say)), el('p', 'cite diff', `<span class="was">${before}</span><span class="now">${plain(slot, 'b')}</span>`));
    const nextLabel = !S.work.whoDone?'核验何人':S.result.when.status==='pending'?'核验何时':S.result.where.status==='pending'?'核验何处':'核验为何';
    tray(v,row(btn(nextLabel,'',()=>{if(!S.work.whoDone)board('who');
      else if(S.result.when.status==='pending')openSheet('when');
      else if(S.result.where.status==='pending')openSheet('where');else board('why');})));

  }

  /* ---------- 完成 ---------- */
  function finish() {
    if(!S.work.whoDone || !S.work.inference || !S.work.why || SLOTS.some(s=>S.result[s].status==='pending'))return checkTray();
    S.phase = 'done'; root.dataset.phase='done'; markTask(null); renderSentence();
    $('state').textContent = A.ending.title; $('sign').textContent = A.ending.signature;
    const draftHTML = A.sentence.map(t => {
      if (typeof t === 'string') return esc(t);
      const o = opt(t.slot), r = S.result[t.slot], changed = r.status !== 'support' && r.status !== 'doubt';
      return (changed ? `<del>${esc(o.text)}</del>` : esc(o.text)) + esc(t.suffix || '');
    }).join('');
    const text = plain(null, 'b');
    const notes = [...$('notes').querySelectorAll('li')].map(li => li.textContent);
    tray(el('div', 'compare', `<span class="row-k">${esc(A.ending.draftLabel)}</span><span class="row-v">${draftHTML}</span>`),
      el('p','reason-choice',S.work.why==='留白'?'拍摄缘由已留白。':'已从展签删去拍摄缘由。'),
      row(btn(A.ending.light, 'red big', event => {
        event.currentTarget.disabled = true;
        sfx?.('stamp');
        onDone({ text, notes, draft: S.draftText, evidence:{...S.work,pins:[...S.pins]} });
      })));
  }

  markTask(null); renderSentence(); draftTray();
  return {
    dispose() { reader.dispose(); delete root.dataset.phase; root.classList.remove('show'); root.innerHTML = ''; },
    test: { state: S }
  };
}
