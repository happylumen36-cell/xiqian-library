/*
 * 展墙内容 v3 ·「一路相随的图书馆」
 * ------------------------------------------------------------------
 * 25 件展品，分 7 个章节，按西迁先后挂在一面长墙上（沙龙式挂法）。
 * 21 件开展即点亮。其余 4 件由玩家在现场取证、写定展签后点亮。
 *
 * 每件展品的 caption 都直接取自 source 所列出处，不补写日期、人物或缘由。
 *   SRC.tushi   —— Wikimedia Commons 收录、出自《浙江大学图史》，公有领域（Public domain）
 *   SRC.zunyi   —— 遵义网《浙大西迁遵义（组图4张）》，刘凡供稿，2025-01-12（使用许可待核）
 *   SRC.cnr     —— 央广网 王子衿《浙江大学西迁贵州湄潭：树我邦国 天下来同》，2019-09-21（使用许可待核）
 *   SRC.wenhui  —— 《文汇报》2025-10-13 陈启明文（使用许可待核）
 *   SRC.han     —— 韩松涛《浙江大学西迁时的图书馆》，浙江大学网站，2017-06-22
 *
 * 字段：
 *   kind   'photo' 照片 | 'text' 文献展板（原图待寻时，用排好字的引文陈列）
 *   size   画框大小档（1 小 · 2 中 · 3 大），只影响挂法
 *   status 'lit' 已点亮 | 'dark' 待调研
 *   investigation  调研包键名，对应 js/app.js 的 SITES 注册表
 */
export const SRC = {
  tushi: { name: '《浙江大学图史》（Wikimedia Commons 收录）', license: '公有领域', url: 'https://commons.wikimedia.org/wiki/Category:History_of_Zhejiang_University' },
  zunyi: { name: '遵义网《浙大西迁遵义（组图4张）》，刘凡供稿，2025', license: '使用许可待核', url: 'https://zunyiol.cn/index.php?a=show&c=index&catid=267&id=4137&m=content' },
  cnr:   { name: '央广网《浙江大学西迁贵州湄潭：树我邦国 天下来同》，王子衿摄，2019', license: '使用许可待核', url: 'http://m.cnr.cn/news/20190921/t20190921_524786752.html' },
  wenhui:{ name: '《文汇报》2025年10月13日，陈启明文', license: '原件收藏与许可待核', url: 'https://www.chinawriter.com.cn/n1/2025/1013/c404063-40581057.html' },
  han:   { name: '韩松涛《浙江大学西迁时的图书馆》，浙江大学网站，2017', license: '引文', url: 'https://www.zju.edu.cn/2017/0622/c33231a1515572/pagem.htm' }
};

export const HALL = {
  title: '一路相随的图书馆',
  kicker: '浙江大学西迁校史展',
  years: '1937 — 1946',
  subtitle: '学生策展人计划',
  intro: '抗战时期，浙江大学西迁办学，图书馆一路相随。',
  brief: {
    from: '展览部 致 新到任的学生策展人',
    lines: [
      '展览明早开幕。',
      '墙上的展品大多已经布好，灯也亮了。',
      '还有四件没能完成档案——它们的灯还暗着。',
      '请你逐一查证，替它们写下站得住的展签，再亲手把灯点亮。'
    ],
    sign: '展览部',
    accept: '接下任务'
  }
};

/* 章节：墙上从左到右的顺序 */
export const CHAPTERS = [
  { id: 'taihe',   name: '泰和', years: '1938', note: '江西' },
  { id: 'yishan',  name: '宜山', years: '1938—1939', note: '广西' },
  { id: 'zunyi',   name: '遵义', years: '1940—1946', note: '贵州' },
  { id: 'meitan',  name: '湄潭', years: '1940—1946', note: '贵州' },
  { id: 'yongxing',name: '永兴 · 青岩', years: '1940—1946', note: '贵州' },
  { id: 'longquan',name: '龙泉', years: '1939—1945', note: '浙江 · 分校' },
  { id: 'echo',    name: '回望', years: '', note: '今日旧址' }
];

export const EXHIBITS = [
  /* ---------- 泰和 ---------- */
  { id: 'taihe-library', chapter: 'taihe', kind: 'photo', size: 1, status: 'lit',
    image: 'assets/photos/taihe-zhu-1938.jpg', title: '泰和时的图书馆前', date: '1938年5月',
    caption: '竺可桢等浙江大学老师在西迁泰和时的图书馆前留影（1938年5月）', source: 'tushi' },
  { id: 'taihe-xiaguan', chapter: 'taihe', kind: 'text', size: 2, status: 'lit',
    title: '遐观楼', date: '三个多月',
    quote: '浙大图书馆设在新村趣园内的遐观楼。',
    caption: '上田村趣园的遐观楼原是乡里富家的藏书楼，作为浙江大学图书馆只有短短的三个多月。', source: 'han' },

  /* ---------- 宜山 ---------- */
  { id: 'yishan-biaoying', chapter: 'yishan', kind: 'photo', size: 2, status: 'lit',
    image: 'assets/photos/yishan-biaoying-1939.jpg', title: '宜山标营教室', date: '1939年春',
    caption: '1939年春，浙江大学在广西宜山标营的教室。', source: 'tushi' },
  { id: 'yishan-photo', chapter: 'yishan', kind: 'photo', size: 3, status: 'dark', investigation: 'yishan',
    image: 'assets/photos/yishan-1939.jpg', title: '文庙前的合影', date: '待查证',
    caption: '一张合影，一道门的一角。照片能告诉我们多少？', darkHint: '调研包已就绪', source: 'wenhui' },
  { id: 'yishan-bombs', chapter: 'yishan', kind: 'photo', size: 2, status: 'dark', investigation: 'bombs',
    image: 'assets/photos/yishan-bombmap-1939.jpg', title: '落弹分布图', date: '待查证',
    caption: '一张手绘的平面图，上面密密麻麻标着记号。', darkHint: '调研包已就绪', source: 'tushi' },
  { id: 'yishan-song', chapter: 'yishan', kind: 'text', size: 2, status: 'lit',
    title: '校歌', date: '1938年 · 宜山',
    quote: '树我邦国，天下来同。',
    caption: '1938年在广西宜山，竺可桢主持校务会议，决定请马一浮先生写作浙江大学校歌，一直传唱至今。', source: 'cnr' },
  { id: 'guizhou-zhu', chapter: 'yishan', kind: 'photo', size: 2, status: 'lit',
    image: 'assets/photos/guizhou-zhu-1939.jpg', title: '考察新校址', date: '1939年6月',
    caption: '1939年6月，竺可桢由广西宜山到贵州考察第四次西迁校址，与在贵州工作的浙大毕业生留影。同年底，作出迁校遵义的决定。', source: 'zunyi' },

  /* ---------- 遵义 ---------- */
  { id: 'zunyi-gate', chapter: 'zunyi', kind: 'photo', size: 3, status: 'lit',
    image: 'assets/photos/zunyi-gate-1940s.jpg', title: '遵义校本部大门', date: '1940年代',
    caption: '该址原为省立三中校舍，俗称“子弹库”。1940年1月浙大迁遵后，在此设总务处、校长室及文学院和师范学院办公室。', source: 'zunyi' },
  { id: 'zunyi-hq', chapter: 'zunyi', kind: 'photo', size: 2, status: 'lit',
    image: 'assets/photos/zunyi-hq-1940s.jpg', title: '子弹库校总部', date: '1940年代',
    caption: '1940年代，浙江大学在贵州遵义的校总部。', source: 'tushi' },
  { id: 'zunyi-jianggongci', chapter: 'zunyi', kind: 'photo', size: 2, status: 'dark', investigation: 'jianggongci',
    image: 'assets/photos/zunyi-jianggongci-1940s.jpg', title: '江公祠', date: '待查证',
    caption: '门楣上有三个字。这座祠堂在西迁中做过什么？', darkHint: '调研包已就绪', source: 'zunyi' },
  { id: 'zunyi-books', chapter: 'zunyi', kind: 'text', size: 1, status: 'lit',
    title: '十万册', date: '遵义 · 江公祠',
    quote: '藏书在十万册左右。',
    caption: '江公祠整个都为图书馆所占：左排采编出纳，右排参考阅览，中间楼上楼下皆为书库。', source: 'han' },

  /* ---------- 湄潭 ---------- */
  { id: 'meitan-library', chapter: 'meitan', kind: 'photo', size: 3, status: 'lit',
    image: 'assets/photos/meitan-library-1945.jpg', title: '湄潭文庙 · 浙大图书馆', date: '1945年秋',
    caption: '1945年秋，设在湄潭文庙的浙江大学图书馆。', source: 'tushi' },
  { id: 'meitan-dacheng', chapter: 'meitan', kind: 'text', size: 2, status: 'lit',
    title: '大成殿', date: '湄潭 · 文庙第三进',
    quote: '自早至晚，师生络绎不绝。',
    caption: '湄潭图书馆设于文庙的大成殿。藏书虽不多，却是数百同学和教师借阅书籍的去处。', source: 'han' },
  { id: 'meitan-lamp', chapter: 'meitan', kind: 'photo', size: 1, status: 'lit',
    image: 'assets/photos/meitan-tung-oil-lamp.jpg', title: '桐油灯', date: '陈列馆藏品',
    caption: '浙江大学师生在贵州湄潭期间学习、生活时使用的照明工具——桐油灯。', source: 'cnr' },
  { id: 'meitan-weather', chapter: 'meitan', kind: 'photo', size: 1, status: 'lit',
    image: 'assets/photos/meitan-weather-tools.jpg', title: '气象观测工具', date: '陈列馆藏品',
    caption: '陈列馆展出的浙江大学师生使用过的气象观测工具。', source: 'cnr' },
  { id: 'meitan-sculpture', chapter: 'meitan', kind: 'photo', size: 2, status: 'lit',
    image: 'assets/photos/meitan-sculpture.jpg', title: '西迁群像', date: '陈列馆雕塑',
    caption: '陈列馆内，一组表现浙江大学师生西迁的雕塑，展示当时办学条件之艰难。', source: 'cnr' },

  /* ---------- 永兴 · 青岩 ---------- */
  { id: 'yongxing-huiguan', chapter: 'yongxing', kind: 'photo', size: 3, status: 'lit',
    image: 'assets/photos/yongxing-huiguan-1940s.jpg', title: '永兴 · 江西会馆', date: '1940年代',
    caption: '建在湄潭县永兴镇的江西会馆，又称“万寿宫”。浙江大学永兴分部办公室及各系教室均设在这里。', source: 'zunyi' },
  { id: 'yongxing-jiuhuang', chapter: 'yongxing', kind: 'text', size: 1, status: 'lit',
    title: '九皇阁', date: '永兴分馆',
    quote: '图书馆永兴分馆设在江西会馆后面的九皇阁。',
    caption: '一年级新生在永兴读书，图书馆也跟了过去，共历约五年半。', source: 'han' },
  { id: 'qingyan-group', chapter: 'yongxing', kind: 'photo', size: 2, status: 'lit',
    image: 'assets/photos/qingyan-fuwutuan-1945.jpg', title: '战地服务团', date: '1945年',
    caption: '1945年，浙江大学战地服务团在贵州青岩合影。', source: 'tushi' },
  { id: 'qingyan-zhenwu', chapter: 'yongxing', kind: 'text', size: 1, status: 'lit',
    title: '真武宫', date: '青岩分校',
    quote: '教室、图书馆、办公室均集中于此。',
    caption: '青岩分校只存在了七个月左右，图书馆仍然设立，就在真武宫进门的门楼上。', source: 'han' },

  /* ---------- 龙泉 ---------- */
  { id: 'longquan-view', chapter: 'longquan', kind: 'photo', size: 3, status: 'dark', investigation: 'longquan',
    image: 'assets/photos/longquan-1941.jpg', title: '山间的校舍', date: '待查证',
    caption: '山坡上一片平房。照片左下留着几列白字。', darkHint: '调研包已就绪', source: 'tushi' },
  { id: 'longquan-zeng', chapter: 'longquan', kind: 'text', size: 2, status: 'lit',
    title: '曾宅', date: '1939.7—1945.11',
    quote: '二楼正厅连着后面房屋为图书馆。',
    caption: '龙泉分校的校舍租用当地曾姓人家的宅院，图书馆在这里经历了六年多。', source: 'han' },

  /* ---------- 回望 ---------- */
  { id: 'echo-site', chapter: 'echo', kind: 'photo', size: 2, status: 'lit',
    image: 'assets/photos/meitan-site-today.jpg', title: '湄潭西迁旧址', date: '今日',
    caption: '浙江大学西迁旧址（湄潭文庙）。', source: 'cnr' },
  { id: 'echo-museum', chapter: 'echo', kind: 'photo', size: 1, status: 'lit',
    image: 'assets/photos/meitan-museum-exterior.jpg', title: '陈列馆外景', date: '今日',
    caption: '湄潭浙江大学西迁历史陈列馆外景。', source: 'cnr' },
  { id: 'echo-calligraphy', chapter: 'echo', kind: 'photo', size: 2, status: 'lit',
    image: 'assets/photos/zhu-calligraphy.jpg', title: '重游故地', date: '竺可桢手迹',
    caption: '竺可桢重游故地后留下的作品手迹，现陈列于湄潭。', source: 'cnr' }
];

/* 只有完成调研、被点亮后才揭示的真实图注（暗展品点亮后替换 caption） */
export const REVEALED = {
  'yishan-photo': { title: '宜山文庙前的合影', date: '1939年', caption: '1939年苏步青（右二）与陈仲和（左一）、陈建功（左二）、熊全治（右一）在广西宜山文庙前合影' },
  'yishan-bombs': { title: '宜山落弹分布图', date: '1939年2月5日', caption: '1939年2月5日，日军飞机轰炸迁至广西宜山的浙江大学，投弹118枚。' },
  'zunyi-jianggongci': { title: '江公祠 · 遵义校本部图书馆', date: '1940年代', caption: '桃源山上江公祠。浙江大学迁来遵义后，在此设浙大遵义校本部图书馆。' },
  'longquan-view': { title: '龙泉分校远景', date: '1941年10月', caption: '浙江大学龙泉分校新建校舍全景。' }
};
