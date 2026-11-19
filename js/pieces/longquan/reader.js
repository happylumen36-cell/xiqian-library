// The same envelopes are opened in the field and again when editing the label.
import { citation } from './case.js';

const ring = '<svg class="red-ring" viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M259 10C201 1 70 0 26 17C-4 33 2 62 52 70C116 83 263 76 288 56C309 32 277 12 249 10"/></svg>';

export function openFolderDesk(host, sources, { query, target, onPin, onClose, sfx }) {
  const opener = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'lq-reader';
  dialog.setAttribute('aria-label', '档案袋 · ' + query);
  host.append(dialog);
  dialog.innerHTML = `<div class="reading-table">
    <header class="reading-top"><button type="button" data-read="back">收起档案袋</button><strong>${query}</strong></header>
    <ol class="reading-steps"><li>打开档案袋</li><li>点原句画圈</li><li>钉上便签</li></ol>
    <section class="catalog"><h2>档案袋</h2><p></p><div class="folder-grid"></div></section>
    <section class="reading-page" hidden><div class="paper-tools"><button type="button" data-read="folders">换一袋材料</button><button type="button" data-read="zoom" aria-pressed="false">放大原文</button></div>
    <div class="reader-scroll"><article class="source-page web-print"></article></div>
    <footer class="reader-foot"><span role="status"></span><button type="button" class="btn" data-read="pin" disabled>钉上便签</button></footer></section></div>`;
  const get = s => dialog.querySelector(s);
  const action = k => get('[data-read="' + k + '"]');
  const catalog = get('.catalog'), page = get('.reading-page'), paper = get('.source-page');
  const expected = citation(target);
  let selected = '', current;
  get('.catalog p').textContent = '要核对' + query + '，到' + expected.source.mark + '袋《' + expected.source.short + '》找原句。其余材料也可翻看。';
  function progress(n) {
    dialog.querySelectorAll('.reading-steps li').forEach((li, i) => {
      if (n === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      li.classList.toggle('complete', i < n);
    });
  }
  function folders() {
    sfx?.('paper');
    catalog.hidden = false; page.hidden = true; progress(0);
    get('[data-doc="' + (current?.id || expected.source.id) + '"]').focus({ preventScroll: true });
  }
  function documentView(source) {
    sfx?.('paper');
    current = source; selected = ''; catalog.hidden = true; page.hidden = false; progress(1);
    paper.classList.remove('lq-large'); action('zoom').setAttribute('aria-pressed','false');
    paper.innerHTML = `<div class="print-header"><b>${source.publisher}</b><span>${source.kind}</span></div>
      <h2>${source.title}</h2><p class="print-by">${source.byline}</p>
      ${source.detail ? '<img class="lq-facsimile" src="' + source.detail + '" alt="照片上的五列原字">' : ''}
      <div class="web-excerpts"></div><p class="print-location">原文位置　${source.location}</p>
      <div class="print-address"><a href="${source.url}" target="_blank" rel="noopener">打开原件 ↗</a><time>核对 2026-11-19</time></div>`;
    get('.reader-scroll').scrollTop = 0;
    action('pin').disabled = true;
    get('.reader-foot span').textContent = source === expected.source ? '圈出能核对' + query + '的原文。' : '可先读这份，再到' + expected.source.mark + '袋核对。';
    for (const line of source.lines) {
      const b = document.createElement('button'); b.className = 'source-line'; b.type = 'button'; b.dataset.line = line.id;
      b.innerHTML = '<small>' + citation(line.id).mark + '</small><span></span>' + ring;
      b.querySelector('span').textContent = line.text;
      b.setAttribute('aria-pressed','false');
      b.onclick = () => {
        selected = selected === line.id ? '' : line.id;
        if (selected) sfx?.('brush', {gain:0.6});
        paper.querySelectorAll('.source-line').forEach(n => n.setAttribute('aria-pressed', n.dataset.line === selected));
        const valid = selected === target;
        action('pin').disabled = !valid;
        get('.reader-foot span').textContent = valid ? '已圈 ' + citation(selected).mark + '。把这句钉到便签上。' : selected ? '这句答的是别的问题。请找能核对' + query + '的原文。' : '点原句画圈。';
        progress(valid ? 2 : 1);
      };
      get('.web-excerpts').append(b);
    }
    action('folders').focus({preventScroll:true});
  }
  for (const s of sources) {
    const b = document.createElement('button'); b.className = 'folder'; b.type = 'button'; b.dataset.doc = s.id;
    b.innerHTML = `<span class="folder-flap"></span><i class="folder-tie"></i><span class="folder-slip"><small>${s.kind}　/　${s.year}</small><b>${s.short}</b></span><span class="folder-mark">${s.mark}</span>`;
    b.onclick = () => documentView(s); get('.folder-grid').append(b);
  }
  function close() { dialog.close(); dialog.remove(); opener?.focus?.({preventScroll:true}); }
  action('back').onclick = () => { close(); onClose?.(); };
  dialog.oncancel = e => { e.preventDefault(); if (!page.hidden) folders(); else action('back').click(); };
  action('folders').onclick = folders;
  action('zoom').onclick = () => action('zoom').setAttribute('aria-pressed', paper.classList.toggle('lq-large'));
  action('pin').onclick = () => { if (selected !== target) return; sfx?.('paper',{gain:0.5}); close(); onPin(selected); };
  dialog.showModal(); folders();
  return { dispose: close };
}
