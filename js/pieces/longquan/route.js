// Pixels on the poster's 1330 × 735 graticule, rounded after projection.
// Keep the branch off the six-stop line; a city point cannot locate a building.
const stops = [
  ['杭州',1203.999,92.728,17,-17], ['建德',1147.001,168.352,-20,-19],
  ['泰和',835.135,432.281,0,39], ['宜山',341.480,645.095,0,-22],
  ['遵义',211.862,353.332,-34,-18], ['湄潭',253.870,352.735,23,36]
];
const pin = [1148.429,294.372];
const candidates = [[1188,67], [1076,200], pin];
export function routeMap(placed) {
  const trail = stops.reduce((path, p, i) => {
    if (!i) return 'M' + p[1] + ' ' + p[2];
    const q = stops[i-1];
    return path + ' Q' + (q[1]+p[1])/2 + ' ' + ((q[2]+p[2])/2-26+(i%2)*40) + ' ' + p[1] + ' ' + p[2];
  }, '');
  const size = placed ? 28 : 11;
  return `<svg class="lq-map ${placed ? 'placed' : 'local'}" viewBox="${placed ? '0 0 1330 735' : '975 25 340 307'}" role="group" aria-label="西迁路线与龙泉分校定位图">
    <image href="assets/poster/migration-region.webp" width="1330" height="735"/>
    <path class="lq-trail" d="${trail}" stroke-width="${placed?4:2}"/>
    ${stops.map(([name,x,y,dx,dy])=>`<circle cx="${x}" cy="${y}" r="${placed?5:2.5}" fill="#5d4736"/><text x="${x+dx*(placed?1:.47)}" y="${y+dy*(placed?1:.47)}" font-size="${size}">${name}</text>`).join('')}
    ${placed ? `<g class="lq-pin"><circle cx="${pin[0]}" cy="${pin[1]}" r="16"/><circle cx="${pin[0]}" cy="${pin[1]}" r="5"/><text x="${pin[0]+14}" y="${pin[1]+39}" font-size="34">龙泉</text></g>` :
      candidates.map(([x,y],i)=>`<g class="lq-target" role="button" tabindex="0" data-zone="${i}" aria-label="在${['杭州以北','建德以西','建德以南'][i]}落针"><circle cx="${x}" cy="${y}" r="15"/><path d="M${x-5} ${y}h10M${x} ${y-5}v10"/></g>`).join('')}
    </svg>`;
}

export function bindMap(svg, choose) {
  svg.addEventListener('click', e => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const zone = e.target.closest('[data-zone]');
    choose(zone ? zone.dataset.zone === '2' : Math.hypot(p.x-pin[0],p.y-pin[1]) <= 20);
  });
  svg.addEventListener('keydown', e => {
    const zone = e.target.closest('[data-zone]');
    if (zone && ['Enter',' '].includes(e.key)) { e.preventDefault(); choose(zone.dataset.zone === '2'); }
  });
}
