export const esc = value => String(value).replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[ch]);

export function masthead(step, back = '回到展厅') {
  const steps = ['读匾', '进门', '布置', '拟签'];
  return `<header class="jg-head">
    <button class="jg-back" data-j="back" type="button"><span aria-hidden="true">←</span> ${back}</button>
    <span class="jg-brand">一路相随的图书馆<span> / 遵义</span></span>
    <ol class="jg-steps" aria-label="调研进度">${steps.map((s, i) => `<li ${i === step ? 'aria-current="step"' : ''} class="${i < step ? 'passed' : ''}">${s}</li>`).join('')}</ol>
  </header>`;
}

export function sourceIndex(sources) {
  return new Map(sources.flatMap(s => s.sentences.map((line, i) => [line.id, {
    ...line, source: s, mark: s.mark + '①②③④⑤⑥⑦'[i]
  }])));
}

export function photoCredit(photo) {
  return `<figcaption class="jg-credit">${esc(photo.credit)}</figcaption>`;
}
