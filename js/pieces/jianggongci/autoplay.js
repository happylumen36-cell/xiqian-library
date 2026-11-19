// Optional standalone / exhibition smoke test. All steps use public, visible controls.
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function playJianggongci(siteUI,archiveRoot) {
  async function get(root,selector) {
    const start=performance.now();
    while(performance.now()-start<10000){
      const b=root.querySelector(selector);
      if(b&&!b.disabled&&b.getClientRects().length&&getComputedStyle(b).visibility!=='hidden')return b;
      await wait(90);
    }
    throw Error('江公祠调研未到达 '+selector);
  }
  async function click(root,selector){const b=await get(root,selector);b.scrollIntoView({block:'nearest'});b.click();await wait(230);}
  const s=selector=>click(siteUI,selector), a=selector=>click(archiveRoot,selector);
  const action=id=>'[data-j="'+id+'"]';
  const light=()=>a(action('finish'));
  await get(siteUI,'.jg-plate [data-glyph="0"]');
  await window.__museum?.waitForNarration?.('jianggongci','plaque');
  for(const i of [0,1,2])await s('.jg-plate [data-glyph="'+i+'"]');
  await s(action('align'));
  const station=await get(siteUI,action('station'));
  station.value=0;station.dispatchEvent(new Event('input',{bubbles:true}));
  await s(action('enter'));await get(siteUI,action('plan'));
  await window.__museum?.waitForNarration?.('jianggongci','inside');
  await s(action('plan'));await window.__museum?.waitForNarration?.('jianggongci','source');
  for(const id of ['stage','office','reading','stacks']){
    await s('[data-token="'+id+'"]');await s('[data-drop="'+id+'"]');
  }
  await s(action('build'));await s(action('archive'));
  await window.__museum?.waitForNarration?.('archive');
  await a('[data-option="over"]');await a('[data-option="staff"]');await a(action('check'));
  const take=async(doc,line)=>{
    await a('.jg-actions '+action('folders'));await a('.folder[data-doc="'+doc+'"]');
    await a('.source-line[data-id="'+line+'"]');await a(action('pin'));
  };
  await take('han2017','a1');await take('zunyi2025','c1');await a(action('accept'));
  await take('han2017','a5');await a(action('accept'));
  await a('.jg-actions '+action('folders'));await a(action('none'));await a(action('blank'));await light();
}
