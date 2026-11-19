/*
 * 加载页
 * ------------------------------------------------------------------
 * index.html 里的 #loader 是纯 HTML + 内联样式，脚本还没下载完时就能显示。
 * app.js 在各个阶段调用 loading.set(进度, 文字)，海报出现后调用 loading.done()。
 * 海报出现后展厅仍在后台搭建：loading.hall(k) 让“推门入馆”按钮底边的一道细光随贴图加载走满。
 */
const el = document.getElementById('loader');

export const loading = {
  set(k, msg) {
    if (!el) return;
    el.style.setProperty('--k', Math.max(0, Math.min(1, k)).toFixed(3));
    if (msg) el.querySelector('.ld-msg').textContent = msg;
  },
  done() {
    if (!el || el.classList.contains('done')) return;
    loading.set(1);
    el.classList.add('done');
    setTimeout(() => el.remove(), 900);
  },
  hall(k) {
    const b = document.querySelector('.pz-enter');
    if (b) b.style.setProperty('--prep', Math.max(0, Math.min(1, k)).toFixed(3));
  }
};
