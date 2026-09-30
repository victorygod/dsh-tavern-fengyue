// dnd5e 成长流 view 层回归钉（2026-09-24/25 定案,原型 docs/hud-proto-grow.html 为视觉正本）:
// 版面重排（Vitals 左移/Proficiencies 节首 PB/戏法拆行）、
// 呼吸标题(g-pend+有待分配+data-act=grow)、空数「无」版面常驻、头像内裁层、待办 chip 非按钮化。
// 2026-09-29 翻案:节标题收编 hud-proto-v8 中文正本(六维/豁免/速览/…),SRD 英文标题退役;状态签短名化(effect 全句进 data-tip)。
import { describe, expect, it } from 'vitest'
import { bookHtml, heroPanel } from '../../../tavern_presets/dnd5e/preset/ui/view.mjs'

const AV = { 'human-male': 'data:image/webp;base64,QQ==' }

const WIZ = {
  _who: 'player', name: '洛克', gender: 'male', level: 4, race: 'half_elf', class: 'wizard', role: 'pc',
  hp: 20, hp_max: 26, temp_hp: 0, exhaustion: 0, speed: 30, darkvision: 60, armor: null, shield: false,
  str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 11,
  skill_prof: ['arcana'], save_prof: ['int'], weapon_prof: ['匕首', '长杖'], tool_prof: ['书写工具'],
  languages: ['通用语', '龙语'], caster_attr: 'int', slots_l1: 4, slots_l2: 3,
  spells_known: ['火焰箭', '魔法飞弹', '护盾术'], spells_prepared: ['魔法飞弹'],
  spellSplit: { cantrips: ['火焰箭'], known: ['魔法飞弹', '护盾术'], tips: { 火焰箭: '掷火击敌', 魔法飞弹: '三枚力场飞镖', 护盾术: '力场屏障 +5 AC' } }, skillTips: { arcana: '奥术知识的回溯检定' },
  pending: ['LV4·ASI 点选', 'LV4·新法术×2'], hd_available: 4, features: ['奥法回复|短休回环位|—'],
  gear: ['法术书'], resist: [], immune: [], statuses: {},
  persona: { alignment: '中立善良' },
  derived: {
    hpPct: 77, pb: 2, dc: 13, atk: 4, passive: 11, ac: null, expBar: null, slotsNow: 7, slotsTotal: 7,
    slotsLv: [{ lv: 1, now: 4, total: 4 }, { lv: 2, now: 3, total: 3 }],
    attrMods: ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(k => ({ key: k, mod: k === 'int' ? 3 : 0 })),
    skills: [{ key: 'arcana', attr: 'int', mod: 5, prof: true, exp: false }],
    saves: [{ key: 'int', mod: 5, prof: true }, { key: 'str', mod: 0, prof: false }],
    weapons: [{ name: 'quarterstaff', damage: '1d6', damage_type: 'bludgeoning', props: ['versatile'] }],
  },
}

const FIGHTER = {
  ...WIZ, _who: 'iron', name: '老铁', class: 'fighter', role: 'npc', caster_attr: null, slots_l1: null,
  spells_known: [], spells_prepared: [], spellSplit: { cantrips: [], known: [] }, pending: [],
  armor: 'chain_mail', shield: true, resist: [], statuses: {}, descriptor: '',
  derived: { ...WIZ.derived, slotsLv: [], slotsNow: 0, slotsTotal: null, dc: null, atk: null },
}

describe('heroPanel · 待办 chip 非按钮化', () => {
  it('chip 文案=未分配成长·N,无 data-act(点卡整体开册);无待办则 chip 不渲染', () => {
    const html = heroPanel({ player: { ...WIZ, derived: WIZ.derived }, companions: [] })
    expect(html).toContain('未分配成长·2')
    expect(html).not.toContain('data-act="pending"')
    expect(html).toContain('data-act="book"')
    const bare = heroPanel({ player: { ...WIZ, pending: [], derived: WIZ.derived }, companions: [] })
    expect(bare).not.toContain('未分配成长')
  })
  it('头像:图槽命中=首字+av-clip 内裁层;缺席=仅首字', () => {
    const withImg = heroPanel({ player: { ...WIZ, race: 'human', derived: WIZ.derived }, companions: [] }, { avatars: AV })
    expect(withImg).toContain('av-clip')
    expect(withImg).toContain('pix-letter')
    const noImg = heroPanel({ player: { ...WIZ, race: 'dragonborn', derived: WIZ.derived }, companions: [] }, { avatars: {} })
    expect(noImg).not.toContain('av-clip')
  })
})

describe('bookHtml · 版面与术语锚', () => {
  const html = bookHtml(WIZ, {})
  it('节标题=中文(v8 正本),顺序=左[六维→豁免→速览→技能→训练与语言]右[施法→状态→…]', () => {
    const caps = ['六维', '豁免', '速览', '技能', '训练与语言', '施法', '状态', '装备', '背包', '特征', '抗性 / 免疫']
    let last = -1
    for (const cap of caps) { const i = html.indexOf('>' + cap + '<'); expect(i).toBeGreaterThan(last); last = i }
    expect(html).not.toContain('>Ability Scores<'); expect(html).not.toContain('>Saving Throws<')
    expect(html).not.toContain('>Spellcasting<'); expect(html).not.toContain('>Conditions<')
  })
  it('hover 浮签:技能行挂 skillTips 的 data-tip(2026-09-30 施法/技能中文简介批)', () => {
    expect(html).toContain('bk-sk prof" data-tip="奥术知识的回溯检定"')
  })
  it('全 data-tip 不留原生 title 属性', () => {
    expect(html).not.toMatch(/\stitle="/)
    expect(html).toContain('data-tip="六维属性——')
    expect(html).toContain('data-tip="熟练加值——随等级 2→6')
  })
  it('呼吸标题=有待办节,g-pend+「有待分配」+data-act=grow+kind(on 高亮断链已删,2026-09-27)', () => {
    expect(html).toContain('g-pend')
    expect(html).toContain('data-act="grow" data-kind="asi"')
    expect(html).toContain('data-act="grow" data-kind="spells"')
    expect(html.match(/class="g-wait"/g)?.length).toBe(2)
    expect(html).not.toContain('g-pend on')
  })
  it('无待办 NPC 不出现呼吸件(FIGHTER)', () => {
    expect(bookHtml(FIGHTER, {})).not.toContain('g-pend')
  })
  it('Proficiencies:PB 单值居节首+组名中文+逐项 data-tip;缺族组照裁剪', () => {
    expect(html).toContain('熟练加值<b>+2</b>')
    expect(html).toContain('>武器熟练</span>')
    expect(html).toContain('>工具熟练</span>')
    expect(html).toContain('>语言掌握</span>')
    expect(html).not.toContain('>护甲熟练')   // 法师无护甲熟练组
    expect(html).toContain('data-tip="Weapons——攻检加熟练加值')
  })
  it('施法三行=戏法(level0)/法术(环术)/已备——空行「无」;非施法者整节「无」', () => {
    expect(html).toContain('>戏法</span><span class="nms"><span data-tip="掷火击敌">火焰箭</span></span>')
    expect(html).toContain('>法术</span><span class="nms"><span data-tip="三枚力场飞镖">魔法飞弹</span> · <span data-tip="力场屏障 +5 AC">护盾术</span></span>')
    expect(html).toContain('>已备</span><span class="nms"><span data-tip="三枚力场飞镖">魔法飞弹</span></span>')
    const noSplit = bookHtml({ ...WIZ, spellSplit: undefined }, {})
    expect(noSplit).toContain('>法术</span><span class="nms"><span>火焰箭</span> · <span>魔法飞弹</span> · <span>护盾术</span></span>')   // 泵缺席回退=法术行全列,无 tips 不挂 data-tip
    const f = bookHtml(FIGHTER, {})
    expect(f).toContain('<span class="bk-empty">无</span>')
    expect(f).not.toContain('bk-slot')
  })
  it('空数据节常驻「无」:状态/抗免/背包(Gear 行尾)/护甲', () => {
    const f = bookHtml({ ...FIGHTER, gear: [], shield: false }, {})
    expect(f.split('bk-empty">无</span>').length - 1).toBeGreaterThanOrEqual(4)
  })
  it('avatar:图槽→av-clip 内裁层包 av-img;缺席→仅首字', () => {
    const withImg = bookHtml({ ...WIZ, race: 'human' }, AV)
    expect(withImg).toContain('av-clip')
    expect(withImg).toContain('class="av-img"')
    expect(bookHtml({ ...WIZ }, {})).not.toContain('av-clip')
  })
})

describe('bookHtml · 人设三层小传(2026-09-30 persona-threelayer)', () => {
  const SEVEN = { appearance: '灰发方脸', lens: '重价不重义', reaction: '遇袭→翻账本', voice: '冷腔', never: '不碰老头目', tension: '守约却盼约毁', alignment: '守序中立' }
  it('persona 六行有则逐行显(外观/底色/遇事/腔调/红线/张力);五件旧标退役;履历=[0]+追加行', () => {
    const h = bookHtml({ ...WIZ, persona: SEVEN, history: ['学者出身,家道中落', '第3日·欠了酒钱', '[秘]仍在找当日嚣张的账房'] }, {})
    for (const [l, v] of [['外观', '灰发方脸'], ['底色', '重价不重义'], ['遇事', '遇袭→翻账本'], ['腔调', '冷腔'], ['红线', '不碰老头目'], ['张力', '守约却盼约毁']])
      expect(h).toContain(`<span class="pl">${l}</span><span class="pv">${v}</span>`)
    expect(h).toContain('<div class="mt">履历</div>')
    expect(h).toContain('学者出身,家道中落'); expect(h).toContain('第3日·欠了酒钱')
    expect(h).toContain('仍在找当日嚣张的账房')   // [秘] 玩家=去前缀显示
    expect(h).not.toContain('[秘]')
    expect(h).not.toContain('>性格</span>'); expect(h).not.toContain('>理想</span>')
  })
  it('NPC:[秘] 行永不显示;卡头=阵营(background 顶键已退役)', () => {
    const h = bookHtml({ ...WIZ, role: 'npc', persona: SEVEN, history: ['北境来客', '[秘]通匪'] }, {})
    expect(h).toContain('北境来客')
    expect(h).not.toContain('通匪')
    expect(h).toContain('<div class="bk-sub2">守序中立</div>')
  })
  it('无 persona/无 history:小传仍可由 description 撑起;七键缺哪不渲染哪(不占位)', () => {
    const h = bookHtml({ ...WIZ, persona: { lens: '重价不重义' }, description: '现况一句' }, {})
    expect(h).toContain('<span class="pl">底色</span><span class="pv">重价不重义</span>')
    expect(h).not.toContain('<span class="pl">外观</span>')
    expect(h).not.toContain('<div class="mt">履历</div>')
    expect(h).toContain('现况一句')
  })
})
