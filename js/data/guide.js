/*
 * 指引文案：展览部的手写便签、调研步骤、空闲提示。
 * 便签用“行草”（Long Cang），改这里的字后需重跑 tools/subset_fonts.py。
 */
export const GUIDE = {
  hall: {
    afterBrief: (n, title) => '墙上有 '+n+' 件待点亮。可以从《'+title+'》开始，也可以点任务灯选一件。',
    findDark: '找找墙上没亮灯的画框',
    tapDark: '点开暗着的展品，开始调研',
    pending: '这件的调研包待制作。点右上角任务灯可以查看其余展品。',
    afterLight: (n, next) => next ? '还有 '+n+' 件在等你。下一件可调研的是《'+next+'》。' : '还有 '+n+' 件待点亮，调研包待制作。已定稿的展签可以在墙上重读。',
    finaleTitle: '可以开幕了',
    signature: '展览部',
    allLit: '四盏灯全亮了。这面墙，现在可以开幕了。'
  },
  site: {
    pieceSteps: { bombs: ['辨读题记','核点量距','写下展签'], jianggongci: ['读匾对门','据文布置','写下展签'] },
    steps: ['找到机位', '现场取证', '写下展签'],
    alignIdle: '提示：拖动画面，让两根门柱和半透明照片里的门柱重合。',
    alignIdle2: '再往左一点，压低一点。台阶的边线也要对上。',
    collectIdle: '红点是线索。四条都记下，就能去档案台。',
    collectDone: '线索齐了。去档案台，把展签写出来。'
  },
  archive: {
    intro: '先凭第一眼写一句。之后，每个词都要找得到出处。'
  }
};
