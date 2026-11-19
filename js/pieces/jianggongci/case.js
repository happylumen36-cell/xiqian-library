// Extracts keep the punctuation of each publication. The reveal in the hall has its own caption.
const caption = '桃源山上江公祠。浙江大学迁来遵义后, 在此设浙大遵义校本部图书馆。现为遵义市一中操场。（二十世纪四十年代）';
const sources = [
  {
    id: 'han2017', mark: '甲', kind: '校方刊文', year: '2017', short: '西迁时的图书馆',
    title: '浙江大学西迁时的图书馆', publisher: '浙江大学',
    byline: '韩松涛 · 浙江大学 · 2017 年 6 月 22 日',
    url: 'https://www.zju.edu.cn/2017/0622/c33231a1515572/pagem.htm',
    location: '“遵湄时期的图书馆”第一段', accessed: '2026-11-19',
    sentences: [
      { id: 'a1', text: '校本部在遵义城内，图书馆在江公祠，位于丁字口旁的桃源山上。' },
      { id: 'a2', text: '江公祠整个都为图书馆所占，' },
      { id: 'a3', text: '乃两层木式结构古建筑，院内前方有戏台一座，雕梁画栋，颇具黔北祠庙特色。' },
      { id: 'a4', text: '进门靠左一排房子为采编、出纳联合办公之处；右一排则为参考阅览室；中间上下楼房均为书库。' },
      { id: 'a5', text: '藏书在十万册左右。' }
    ]
  },
  {
    id: 'lib2022', mark: '乙', kind: '馆址名单', year: '2022', short: '“印鉴百年”展讯',
    title: '关于“印鉴百年——庆祝浙江大学建校125周年图书馆藏书印展”展览正式开展的通知',
    publisher: '浙江大学图书馆', byline: '浙江大学图书馆 · 2022 年 6 月 7 日',
    url: 'https://libweb.zju.edu.cn/2022/0607/c53489a2588374/page.htm',
    location: '以“图书馆的发展与学校的变迁紧紧相随”开头的一段，馆址名单', accessed: '2026-11-19',
    sentences: [
      { id: 'b1', text: '浙大图书馆从杭州到江西泰和遐观楼、广西宜山文庙、贵州遵义江公祠、湄潭大成殿、永兴九皇阁以及浙江龙泉曾家大院，又最终回到杭州，' }
    ]
  },
  {
    id: 'zunyi2025', mark: '丙', kind: '照片与图注', year: '2025', short: '浙大西迁遵义',
    title: '浙大西迁遵义（组图4张）', publisher: '遵义网', byline: '刘凡供稿 · 遵义网 · 2025 年 1 月 12 日',
    url: 'https://www.zunyiol.cn/index.php?a=show&c=index&catid=267&id=4137&m=content',
    location: '正文末尾“图四”后的完整图注', accessed: '2026-11-19',
    sentences: [{ id: 'c1', caption: true, text: caption }]
  }
];

const rooms = [
  { id: 'stage', name: '戏台', position: '院内前方', quote: '院内前方有戏台一座', cite: 'a3' },
  { id: 'office', name: '采编出纳', position: '进门左排', quote: '进门靠左一排房子为采编、出纳联合办公之处', cite: 'a4' },
  { id: 'reading', name: '参考阅览室', position: '进门右排', quote: '右一排则为参考阅览室', cite: 'a4' },
  { id: 'stacks', name: '书库', detail: '上下两层', position: '院落中间', quote: '中间上下楼房均为书库', cite: 'a4' }
];

export const CASE = {
  id: 'jianggongci', place: '贵州遵义 · 桃源山',
  gone: '江公祠今已不存，原址现为遵义市一中操场',
  reconstructionNote: '依文字推测 · 非实测',
  photo: {
    src: 'assets/photos/zunyi-jianggongci-1940s.jpg', aspect: 981 / 1400, caption,
    credit: '遵义网《浙大西迁遵义（组图4张）》图四 · 刘凡供稿，2025 · 使用许可待核'
  },
  plaque: [
    { char: '江', x: 69.6, y: 44.7 }, { char: '公', x: 52.7, y: 45.1 }, { char: '祠', x: 35.6, y: 45.6 }
  ],
  rooms,
  archive: {
    sources,
    commission: '为江公祠写一句展签，逐项核对馆址、藏书与门前人物。',
    slots: {
      role: { name: '馆址', choices: [{ id: 'hq', text: '浙大遵义校本部图书馆' }, { id: 'site', text: '浙大图书馆旧址' }] },
      size: { name: '藏书', choices: [{ id: 'about', text: '藏书约十万册' }, { id: 'over', text: '藏书十万余册' }, { id: 'largest', text: '藏书规模全国最大' }] },
      people: { name: '门右二人', choices: [{ id: 'staff', text: '图书馆员' }, { id: 'blank', text: '身份留白' }] }
    },
    checks: {
      role: { title: '这座祠堂作何用途？', hint: '找出甲文记馆址的一句，再和丙袋的照片图注对读。', required: ['a1', 'c1'], supplementary: ['a2','b1'] },
      size: { title: '藏书有多少？', hint: '韩松涛用了哪两个字来限定藏书量？到甲袋里圈出原句。', required: ['a5'] },
      people: { title: '门右的两人是谁？', hint: '翻看三袋材料。要写下职务，先找一条指向照片中二人的记载。', required: [] }
    }
  }
};
