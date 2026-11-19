/*
 * 宜山调研包 · 内容层
 * ------------------------------------------------------------------
 * 3D 现场（js/sites/yishan.js）和档案台（js/archive.js）只读这里。
 * 史料边界：
 *   - 照片与图注：陈启明《烽火中的吟咏——新见苏步青未刊〈青芝词稿〉》，《文汇报》2025-10-13（中国作家网转载）。
 *     原件收藏单位待查，展示前需确认署名与许可，见 sample/assets/source/出处登记.md。
 *   - 3D 场景是依照片透视“推测重建”的示意空间，非实测、非复原；不出现人物模型。
 *   - 摘录一律逐字；不得补写拍摄日期、拍摄缘由、人物对白或档案编号。
 */
export const CASE = {
  id: 'yishan',
  place: '广西宜山 · 文庙',
  gone: '宜山文庙现已不存',
  reconstructionNote: '依照片推测重建 · 非实测',

  photo: {
    src: 'assets/photos/yishan-1939.jpg', name: '合影', alt: '宜山合影',
    aspect: 993 / 793,
    caption: '1939年苏步青（右二）与陈仲和（左一）、陈建功（左二）、熊全治（右一）在广西宜山文庙前合影',
    credit: '图片刊于《文汇报》2025年10月13日（陈启明文）· 原件收藏待核'
  },

  intro: [
    '这张合影是宜山文庙留下的唯一一角。',
    '文庙已经不在了。我们按照片的透视，把这道门搭了回来。',
    '先找到当年摄影者站的位置。'
  ],

  align: {
    hint: '拖动视角，让台阶和门柱与半透明照片重合',
    pinchHint: '双指或滚轮可以前后移动',
    near: '很接近了',
    found: '就是这里。有人曾站在这个位置按下快门。',
    compare: '左右拖动，对照照片与重建'
  },

  /* 现场线索：anchor 为世界坐标（米），onPhoto 为照片上的比例坐标 */
  clues: [
    {
      id: 'lattice', title: '花窗墙',
      anchor: [-2.1, 3.0, -6.0],
      text: '门两侧的墙，上半截是镂空花窗。照片只拍进了门的一角。',
      source: { mark: '甲', text: '宜山文庙现已不存，也没有留下当时宜山文庙的全景照片' }
    },
    {
      id: 'gate', title: '门洞',
      anchor: [0.05, 3.15, -6.0],
      text: '台阶尽头是一道门。画面里看不到匾额——单看照片，认不出这是哪里。',
      source: null
    },
    {
      id: 'steps', title: '石阶',
      anchor: [-0.8, 0.25, -3.4],
      text: '七八级石阶。重建时按照片透视估算了高度和进深，真实尺寸没有记录。',
      source: null,
      honesty: true
    },
    {
      id: 'people', title: '四位教授',
      onPhoto: [0.1, 0.56],
      needsPhoto: true,
      text: '两位穿长衫，两位穿衬衫西裤。照片本身不会说出他们是谁——要靠图注。',
      source: { mark: '丙', text: '1939年苏步青（右二）与陈仲和（左一）、陈建功（左二）、熊全治（右一）在广西宜山文庙前合影' }
    }
  ],

  /* ===== 档案台 ===== */
  archive: {
    commission: '这件展品明天要点亮。展签只能写一句话。',
    fixedNote: { word: '教授', cite: 'a3', quote: '苏步青等教授在广西宜山文庙前合影' },
    sentence: [{ slot: 'when', suffix: '，' }, '四位教授在', { slot: 'where' }, '合影。'],
    slots: {
      when: {
        ask: '什么时候？', placeholder: '何时', blankText: '时间待考',
        options: [
          { id: 'opening', text: '开馆当天' },
          { id: 'ordinary', text: '某个寻常日子' },
          { id: 'unsure', text: '说不准', unsure: true }
        ]
      },
      where: {
        ask: '在哪里？', placeholder: '何处', blankText: '地点待考',
        options: [
          { id: 'library', text: '图书馆门前' },
          { id: 'temple', text: '一座古庙门前' },
          { id: 'unsure', text: '说不准', unsure: true }
        ]
      }
    },

    sources: [
      {
        id: 'han2017', mark: '甲', carrier: 'web', kind: '校方刊文', year: '2017',
        short: '西迁时的图书馆', title: '浙江大学西迁时的图书馆',
        byline: '韩松涛 · 浙江大学 · 2017 年 6 月 22 日',
        url: 'https://www.zju.edu.cn/2017/0622/c33231a1515572/pagem.htm', accessed: '2026-11-19',
        location: '“宜山时期的图书馆”一节，自“宜山图书馆设在文庙”起。',
        sentences: [
          { id: 'a1', text: '宜山图书馆设在文庙，' },
          { id: 'a2', text: '宜山文庙现已不存，也没有留下当时宜山文庙的全景照片，' },
          { id: 'a3', text: '只有一张苏步青等教授在广西宜山文庙前合影的老照片，可以窥见宜山文庙大门一角。' },
          { id: 'a4', text: '自1939年1月到达至12月再次搬迁，浙江大学图书馆在广西宜山只有不到一年的时间。' }
        ]
      },
      {
        id: 'lib2022', mark: '乙', carrier: 'web', kind: '图书馆通知', year: '2022',
        publisher: '浙江大学图书馆', short: '“印鉴百年”展讯', title: '关于“印鉴百年——庆祝浙江大学建校125周年图书馆藏书印展”展览正式开展的通知',
        byline: '浙江大学图书馆 · 2022 年 6 月 7 日',
        url: 'https://libweb.zju.edu.cn/2022/0607/c53489a2588374/page.htm', accessed: '2026-11-19',
        location: '正文叙述馆址沿革处，检索“江西泰和遐观楼”。',
        sentences: [{ id: 'b1', text: '浙大图书馆从杭州到江西泰和遐观楼、广西宜山文庙、贵州遵义江公祠、湄潭大成殿、永兴九皇阁以及浙江龙泉曾家大院，又最终回到杭州，' }]
      },
      {
        id: 'wenhui2025', mark: '丙', carrier: 'press', kind: '报刊与图注', year: '2025',
        short: '词稿与合影', title: '烽火中的吟咏——新见苏步青未刊《青芝词稿》',
        masthead: '文汇报', issue: '2025 年 10 月 13 日', byline: '陈启明 · 《文汇报》 · 中国作家网转载',
        url: 'https://www.chinawriter.com.cn/n1/2025/1013/c404063-40581057.html', accessed: '2026-11-19',
        location: '转载页第二幅插图图注；正文“早在宜山时期”段所引熊全治回忆。',
        sentences: [
          { id: 'c1', position: '第二幅插图下方完整图注', caption: true, text: '1939年苏步青（右二）与陈仲和（左一）、陈建功（左二）、熊全治（右一）在广西宜山文庙前合影' },
          { id: 'c2', position: '“早在宜山时期”段，熊全治回忆的前两句', text: '1939年3月间，我抵宜山，陈建功先生一人已到，家眷未同来。苏步青先生因送家眷到平阳老家，尚未到达。' }
        ]
      },
      {
        id: 'sculpture2016', mark: '丁', carrier: 'web', kind: '校方刊文', year: '2016',
        short: '宜山标营校舍', title: '为心仪的西迁故事雕塑方案点赞',
        byline: '浙江大学 · 2016 年 5 月 23 日',
        url: 'https://www.zju.edu.cn/2016/0523/c33439a1519579/pagem.htm', accessed: '2026-11-19',
        location: '“7.宜山/学校遭日寇飞机轰炸”条，首句。',
        sentences: [{ id: 'd1', text: '1939年2月5日，日寇竟然以浙大为目标，进行猛烈的轰炸。' }]
      },
      {
        id: 'commemoration2018', mark: '戊', carrier: 'web', kind: '校方报道', year: '2018',
        short: '西迁宜山办学', title: '浙江大学西迁宜山办学80周年纪念活动举行',
        byline: '浙江大学 · 2018 年 11 月 21 日',
        url: 'https://www.zju.edu.cn/2018/1121/c41533a904804/pagem.htm', accessed: '2026-11-19',
        location: '报道正文开头第一段，第一句前半。',
        sentences: [{ id: 'e1', text: '1938年10月至1939年12月，浙江大学于西迁途中在广西宜山（今宜州）停留办学14个月，' }]
      }
    ],

    checks: {
      who: {
        placementIntro: '接下来读照片的图注，把四张名签放回合影。',
        collectivePrompt: mark => '四张名签已对齐。点“圈取 '+mark+'”，再查“教授”的合称。',
        completePrompt: '四张名签与合称的出处已齐。记入展签，再查下一个词。',
        query: '依图注，把名签放到合影中的人身上。',
        cite: 'c1', collective: 'a3',
        positions: [
          { id: 'zhonghe', name: '陈仲和', side: '左一', x: 24, y: 60 },
          { id: 'jiangong', name: '陈建功', side: '左二', x: 42, y: 61 },
          { id: 'buqing', name: '苏步青', side: '右二', x: 62, y: 60 },
          { id: 'quanzhi', name: '熊全治', side: '右一', x: 78, y: 62 }
        ],
        tray: ['buqing','quanzhi','jiangong','zhonghe'],
        feedback: '左一、右二都从看照片的观者这一侧数。图注给出姓名与站位；甲③“苏步青等教授”是展签合称的依据。熊全治1939年的实际职称待核。'
      },
      timeline: {
        years: [1938,1939,1940], completePrompt: '五件事件已排好。读时间线，在下方选择你的判断。',
        query: '把材料中的事件钉到相应时间，再判断“开馆当天”。',
        events: [
          { id: 'term', date: '1938.10', text: '浙大在宜山办学时段开始', cite: 'e1' },
          { id: 'library', date: '1939.01', text: '图书馆到达宜山', cite: 'a4' },
          { id: 'bomb', date: '1939.02.05', text: '宜山校舍遭轰炸', cite: 'd1' },
          { id: 'arrive', date: '1939.03', text: '熊全治到宜山时苏步青尚未到', cite: 'c2' },
          { id: 'move', date: '1939.12', text: '图书馆再次搬迁', cite: 'a4' }
        ],
        tray: ['arrive','move','term','bomb','library'],
        question: '这些材料能支持“开馆当天合影”吗？',
        choices: ['材料足以确定当天拍摄','材料不支持这个说法'],
        answer: 1,
        feedback: '这是推理，不是证明。图书馆一月迁入，三月熊全治到宜山时苏步青尚未到。迁入日期不等于正式开馆日期。丙①只写了1939年，照片的确切日子仍然未知。'
      },
      why: { query: '现有材料写明了拍摄缘由吗？', feedback: '图注记载了谁在何处合影，所引回忆讲的是抵达宜山。拍摄缘由仍待考。', actions: ['留白','删去缘由'] },
      where: {
        query: '这里是什么地方？',
        none: '这条材料没有直接写明合影地点。',
        bySentence: {
          a1: { verdict: 'support', say: '这一句写明：宜山图书馆设在文庙。', readAloud: true },
          a3: { verdict: 'support', say: '这一句写到了这张合影：摄于广西宜山文庙前。' },
          c1: { verdict: 'support', say: '图注写明：在广西宜山文庙前合影。' },
          b1: { verdict: 'support', say: '这一句把“广西宜山文庙”列为西迁时的馆址之一。' },
          a2: { verdict: 'gap', say: '这一句说文庙已不存——没有说门前是什么地方。' },
          a4: { verdict: 'gap', say: '这一句写的是图书馆在宜山的时段，不是地点。' },
          c2: { verdict: 'gap', say: '这一句是熊全治到宜山的回忆，没有写到这道门。' }
        },
        chain: '连起来读：合影摄于宜山文庙前（丙①、甲③），当时图书馆设在文庙（甲①）。',
        sharpen: { text: '宜山文庙门前', cite: 'c1', accepts: ['c1','a3'] },
        byOption: {
          library: { keepLabel: '留下“图书馆门前”', sharpenLabel: '改为“宜山文庙门前”', why: '材料写的是“文庙”。观众读到“图书馆”，可能以为这是一座图书馆建筑。' },
          temple:  { keepLabel: '留下“一座古庙门前”', sharpenLabel: '改为“宜山文庙门前”', why: '你的第一眼没错。材料还能告诉观众：是哪一座庙。' },
          unsure:  { keepLabel: '仍然留白', sharpenLabel: '填上“宜山文庙门前”', why: '你当时说不准；现在材料替你补上了这一格。' }
        }
      },
      when: {
        query: '照片能写到哪一年？',
        bySentence: {
          c1: { verdict: 'year', say: '图注只写到年份：1939年。哪一天、为什么拍，没有写。' },
          c2: { verdict: 'gap', say: '熊全治 1939 年 3 月才到宜山，苏步青到得更晚；图书馆 1 月已迁来。这不能说明照片拍于哪一天，却让“开馆当天”更难成立。' },
          a4: { verdict: 'gap', say: '这一句给出图书馆在宜山的时段：1939 年 1 月到 12 月。照片拍于哪一天？仍然没写。' },
          a1: { verdict: 'gap', say: '这一句写了馆址，没写照片拍于哪一天。' },
          a2: { verdict: 'gap', say: '这一句讲文庙今天已不存，没写拍摄时间。' },
          a3: { verdict: 'gap', say: '这一句写到了这张合影，却没写拍摄日期，也没写为什么拍。' },
          b1: { verdict: 'gap', say: '这一句列出馆址，不涉及任何时间。' }
        },
        none: '材料能确定的只有年份：1939年。没有一句写到拍摄的日子或缘由。',
        year: { text: '1939年', cite: 'c1', label: '改为“1939年”', why: '材料能支持的最精确说法。' },
        claim: {
          deleteLabel: w => `删去“${w}”`,
          blankLabel: '留白 · 标记待考',
          keepLabel: '仍然保留',
          push: w => `知道“1939年、在文庙前”，还不足以写“${w}”。要写它，还需要一条关于拍摄日子的记录——比如原照背面的题记，或当年的日记。`,
          pushAgainKeep: '坚持保留'
        },
        unsure: { say: '材料没写日子，但给出了年份。', blankLabel: '留白 · 标记待考' }
      }
    },

    outcomes: {
      support: { stamp: '有据', say: '这个词站得住。展签上会标出它的出处。' },
      sharpen: { stamp: '有据', say: '改得更准了。出处已标在展签下。' },
      delete: { stamp: '删去', say: '整句短了，但每个字都站得住。' },
      blank: { stamp: '待考', say: '这一格暂时留白。展签告诉观众：这里还有待查证。' },
      doubt: { stamp: '存疑', say: '保留了。展签会把它标为“未见出处”，下一位观众会看到这个记号。' }
    },

    ending: {
      title: '档案完成',
      draftLabel: '你的第一眼',
      signature: '学生策展人 拟',
      light: '点亮这件展品'
    }
  }
};
