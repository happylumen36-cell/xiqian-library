// Starting point for the shared autoplay after the hall has opened the bombs site.
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function until(ready,limit=45000){
  const start=performance.now();
  while(performance.now()-start<limit){const item=ready();if(item)return item;await sleep(90);}
  throw Error('等待宜山落弹图界面超时');
}
export async function runBombsAutoplay(){
  const tap=async s=>{
    const b=await until(()=>[...document.querySelectorAll(s)].find(el=>el.getClientRects().length && !el.disabled));
    b.click();await sleep(210);
  };
  const site=id=>tap('.bm-room [data-act="'+id+'"]');
  const desk=id=>tap('.bombs-archive [data-act="'+id+'"]');
  const folder=id=>tap('.bombs-archive .folder[data-doc="'+id+'"]');
  const pin=async id=>{await tap('.bombs-archive .source-line[data-id="'+id+'"]');await desk('pin');};
  await until(()=>document.querySelector('.bm-room [data-act="begin"]'));
  await window.__museum?.waitForNarration?.('bombs');
  await site('begin');await site('to-date');await tap('.bm-room [data-year="1939"]');
  await site('marks');await site('play');await until(()=>document.querySelector('.bm-room [data-value]')?.textContent==='118');
  await site('find');await tap('.bm-room [data-candidate="26"]');await site('scale');await site('start-scale');
  await tap('.bm-room [data-end="38"]');await site('archive');
  await window.__museum?.waitForNarration?.('archive');
  await tap('.bombs-archive [data-choice="casualties"]');await desk('commit');
  await folder('map');await pin('date');await desk('proceed');
  await folder('commons');await pin('entry');await desk('proceed');
  await folder('map');await pin('sum');await pin('exception');await desk('proceed');
  await desk('none');await desk('delete');await desk('light');
}
