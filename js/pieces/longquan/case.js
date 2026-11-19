const filePage = 'https://commons.wikimedia.org/wiki/File:浙江大学龙泉分校远景.png';
const columns = ['國立浙江大學', '龍泉分校新建', '校舍全景', '中華民國三十年', '拾月'];
const sources = [
  {
    id: 'han', mark: '甲', kind: '校方刊文', year: '2017', publisher: '浙江大学',
    short: '西迁时的图书馆', title: '浙江大学西迁时的图书馆',
    byline: '韩松涛 · 2017 年 6 月 22 日', location: '“龙泉分校图书馆”一节',
    url: 'https://www.zju.edu.cn/2017/0622/c33231a1515572/pagem.htm',
    lines: [
      { id: 'a1', text: '龙泉分校校舍租赁于当地财主曾先生家。' },
      { id: 'a2', text: '二楼正厅连着后面房屋为图书馆。' },
      { id: 'a3', text: '从1939年7月至1945年11月，浙江大学图书馆在龙泉分校共经历六年多时间。' }
    ]
  },
  {
    id: 'notice', mark: '乙', kind: '图书馆通知', year: '2022', publisher: '浙江大学图书馆',
    short: '“印鉴百年”展讯', title: '关于“印鉴百年——庆祝浙江大学建校125周年图书馆藏书印展”展览正式开展的通知',
    byline: '浙江大学图书馆 · 2022 年 6 月 7 日', location: '“图书馆的发展与学校的变迁紧紧相随”一段中的馆址名单',
    url: 'https://libweb.zju.edu.cn/2022/0607/c53489a2588374/page.htm',
    lines: [{ id: 'b1', text: '浙大图书馆从杭州到江西泰和遐观楼、广西宜山文庙、贵州遵义江公祠、湄潭大成殿、永兴九皇阁以及浙江龙泉曾家大院，又最终回到杭州，' }]
  },
  {
    id: 'inscription', mark: '丙', kind: '照片题字', year: '原件', publisher: '《浙江大学图史》',
    short: '照片左下的题字', title: '龙泉分校远景 · 题字',
    byline: '由右至左逐列释读，空格表示原图换列。', location: '照片左下角，共五列白字',
    url: filePage, detail: 'assets/pieces/longquan/inscription.webp',
    lines: [{ id: 'c1', text: columns.slice(0, 3).join('　') }, { id: 'c2', text: columns.slice(3).join('　') }]
  },
  {
    id: 'commons', mark: '丁', kind: '图像著录', year: '文件页', publisher: 'Wikimedia Commons',
    short: '远景照片的著录', title: '浙江大学龙泉分校远景.png',
    byline: 'Wikimedia Commons · Summary · Date', location: '文件说明的日期字段。照片自身只写到月。',
    url: filePage, lines: [{ id: 'd1', text: '1 October 1941' }]
  }
];

export const data = {
  id: 'longquan', place: '浙江 · 龙泉', title: '龙泉分校远景', columns,
  stages: {
    look:{title:'山间的校舍'}, read:{title:'读出照片的名字'}, date:{title:'题字里的年月'},
    depth:{title:'站在对面山坡上'}, point:{title:'图书馆在哪里？'},
    check:{title:'这处屋舍，能指认吗？'}, map:{title:'把龙泉放回地图'}
  },
  steps: ['读照片题字', '查证馆址', '写下展签'],
  photo: {
    src: 'assets/photos/longquan-1941.jpg', url: filePage, aspect: 1400 / 760, name: '远景照片',
    alt: '群山间几排校舍，左下留有五列白色题字', detail: 'assets/pieces/longquan/inscription.webp',
    credit: '《浙江大学图史》 · Wikimedia Commons 收录 · 公有领域'
  },
  reason: {
    text: '为方便浙江、福建、安徽、江西等地的青年学生',
    title: '龙泉市代表团来访浙江大学', url: 'https://www.zju.edu.cn/2019/0614/c32884a1509995/pagem.htm'
  },
  archive: {
    deskTitles: {draft:{title:'拟一张展签'},verify:{title:'逐项核验'},done:{title:'展签定稿'}},
    sources, names: ['浙江大学龙泉分校新建校舍全景', '龙泉分校新建校舍全景'],
    claims: { library: '照片中可见图书馆', house: '这就是曾宅', blank: '馆址留白' }
  }
};

const numerals = ['①', '②', '③'];
export function citation(id) {
  for (const source of sources) {
    const index = source.lines.findIndex(line => line.id === id);
    if (index >= 0) return { ...source.lines[index], mark: source.mark + numerals[index], source };
  }
}
