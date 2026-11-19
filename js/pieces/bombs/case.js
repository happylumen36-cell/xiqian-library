import { MAP } from './marks.js';

const commons = 'https://commons.wikimedia.org/wiki/File:';
const fileTitle = '民国二十八年二月五日浙江大学遭日军轰炸落弹分布图';
const mapURL = commons + fileTitle + '.png';
const scan = 'assets/pieces/bombs/yishan-bombmap-original.png';
const phrases = ['1939年2月5日','日机在广西宜山浙大校舍一带投弹118枚','其中一枚未爆'];

const sources = [
  {
    id: 'map', mark: '甲', kind: '手绘图版', year: '1939', short: '落弹分布图',
    title: fileTitle, byline: '佚名　《浙江大学图史》第57页', url: mapURL,
    location: '上缘总记、日期与地点，大路上方26号旁的括注。',
    sentences: [
      { id: 'sum', mark: '甲①', text: '共落一百十八彈中有一彈未爆炸', crop: 'title', gloss: '“落”“爆”两字墨迹较重，辨读存疑。总数与“一彈未”仍可读见。' },
      { id: 'date', mark: '甲②', text: '日期：中華民國二十八年二月五日', crop: 'date' },
      { id: 'place', mark: '甲③', text: '地點：廣西宜山', crop: 'place', gloss: '“點”的笔画较模糊，辨读存疑。' },
      { id: 'exception', mark: '甲④', text: '（未炸）', crop: 'note', gloss: '大路上方，括注紧邻26号圈点。' }
    ]
  },
  {
    id: 'commons', mark: '乙', kind: '图版著录', year: 'Commons', short: '图版说明',
    title: '落弹分布图的英文说明', byline: 'Wikimedia Commons　文件说明页', url: mapURL,
    location: 'Summary 表格，Description 栏的 English 原句。',
    sentences: [{ id: 'entry', mark: '乙①', lang: 'en',
      text: 'On 5 February 1939, the Japanese air force attacked Zhejiang University, which retreated to Yishan, Guangxi in western China during the war, with 118 bombs.',
      gloss: '译意　1939年2月5日，日本空军轰炸了战时迁至广西宜山的浙江大学，投弹118枚。' }]
  },
  {
    id: 'classroom', mark: '丙', kind: '展墙照片', year: '1939年春', short: '宜山标营教室',
    title: '1939年春浙江大学广西宜山标营教室', byline: '浙江大学　《浙江大学图史》', url: commons+'1939年春浙江大学广西宜山标营教室.png',
    image: 'assets/photos/yishan-biaoying-1939.jpg', location: '同名文件 Summary 表格的 Description 栏。',
    sentences: [{ id: 'campus', mark: '丙①', lang: 'en', text: 'Zhejiang University campus in Yishan, Guangxi in Spring 1939',
      gloss: '译意　1939年春，浙江大学在广西宜山的校园。' }]
  },
  {
    id: 'library', mark: '丁', kind: '校方刊文', year: '2017', short: '宜山时期的图书馆',
    title: '浙江大学西迁时的图书馆', byline: '韩松涛　浙江大学　2017年6月22日', url: 'https://www.zju.edu.cn/2017/0622/c33231a1515572/pagem.htm',
    location: '“宜山时期的图书馆”一节，首句开头。',
    sentences: [{ id: 'library', mark: '丁①', text: '宜山图书馆设在文庙，' }]
  }
];

export const CASE = {
  id: 'bombs', place: '广西宜山', title: '宜山落弹分布图',
  reconstructionNote: '点位按原图位置数字化 · 非实测',
  photo: {
    src: scan, aspect: MAP.width / MAP.height,
    caption: '民国二十八年二月五日浙江大学遭日军轰炸落弹分布图',
    credit: '佚名 · 《浙江大学图史》第57页 · Wikimedia Commons · 公有领域'
  },
  map: MAP,
  archive: {
    commission: '给这张图写一句展签，再为句子里的每一项说法找出处。',
    phrases, base: phrases.join('，'),
    choices: [
      { id: 'enough', label: '就写到一枚未爆', text: '' },
      { id: 'area', label: '落弹集中在操场、宿舍一带', text: '落弹集中在操场、宿舍一带', revision: '图中操场、宿舍一带均有编号' },
      { id: 'casualties', label: '师生伤亡惨重', text: '师生伤亡惨重', gap: '图上记了落点与编号，未记师生伤亡人数或伤情。' },
      { id: 'damage', label: '校舍全毁', text: '校舍全毁', gap: '屋形是位置参照。图上未逐栋记载校舍的损毁程度。' }
    ],
    sources, accessed: '2026-11-19',
    checks: [
      { id: 'date', name: '日期', question: '公元日期从哪一行换算而来？', accepts: ['date'],
        help: '打开甲袋，圈出题记中用民国纪年写日期的那一行。',
        verified: '二十八加一九一一，得到一九三九。月和日照录。',
        note: '甲②　日期题记换算为1939年2月5日。' },
      { id: 'entry', name: '投弹', question: '谁在何地投弹？共多少枚？', accepts: ['entry'],
        help: '打开乙袋，找出同时记载日机、广西宜山浙大和投弹数的一句。',
        verified: '著录写明日机、广西宜山的浙江大学与118枚，数量也与图顶总记相合。',
        note: '乙①　Commons 英文著录记载日机轰炸迁至宜山的浙大，投弹118枚。' },
      { id: 'exception', name: '未爆', question: '哪条图上记录支持“一枚未爆”？', accepts: ['sum','exception'],
        help: '打开甲袋，圈总记或26号旁的括注，核对那一枚。',
        verified: '图顶总记写到“一彈”，26号旁另标“（未炸）”。两处可以对读。',
        note: '甲①、甲④　图顶总记和26号旁的“（未炸）”相互印证。' }
    ],
    ending: { signature: '学生策展人 拟', light: '点亮这件展品' }
  }
};
