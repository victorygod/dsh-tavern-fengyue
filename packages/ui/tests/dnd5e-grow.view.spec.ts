// dnd5e 成长流 view 层回归钉（2026-09-24/25 定案,原型 docs/hud-proto-grow.html 为视觉正本）:
// 英文节标题+中文 data-tip、版面重排（Vitals 左移/Proficiencies 节首 PB/戏法拆行）、
// 呼吸标题(g-pend+有待分配+data-act=grow)、空数「无」版面常驻、头像内裁层、待办 chip 非按钮化。
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
  spellSplit: { cantrips: ['火焰箭'], known: ['魔法飞弹', '护盾术'] },
  pending: ['LV4·ASI 点选', 'LV4·新法术×2'], hd_available: 4, features: ['奥法回复|短休回环位|—'],
  gear: ['法术书'], resist: [], immune: [], statuses: [],
  persona: { alignment: '中立善良' }, background: '佣兵',
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
  armor: 'chain_mail', shield: true, resist: [], statuses: [], descriptor: '',
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
  const html = bookHtml(WIZ, {}, { open: null })
  it('节标题=SRD 英文,顺序=左[AbilityScores→SavingThrows→Vitals→Skills→Proficiencies]右[Spellcasting→Conditions→…]', () => {
    const caps = ['Ability Scores', 'Saving Throws', 'Vitals', 'Skills', 'Proficiencies', 'Spellcasting', 'Conditions', 'Equipment', 'Gear', 'Features', 'Resistances / Immunities']
    let last = -1
    for (const cap of caps) { const i = html.indexOf('>' + cap + '<'); expect(i).toBeGreaterThan(last); last = i }
    expect(html).not.toContain('>六维<'); expect(html).not.toContain('>速览<')
    expect(html).not.toContain('>技能<'); expect(html).not.toContain('训练与语言')
  })
  it('全 data-tip 不留原生 title 属性', () => {
    expect(html).not.toMatch(/\stitle="/)
    expect(html).toContain('data-tip="六维属性——')
    expect(html).toContain('data-tip="熟练加值——随等级 2→6')
  })
  it('呼吸标题=有待办节,g-pend+「有待分配」+data-act=grow+kind;open 态落 on 类', () => {
    expect(html).toContain('g-pend')
    expect(html).toContain('data-act="grow" data-kind="asi"')
    expect(html).toContain('data-act="grow" data-kind="spells"')
    expect(html.match(/class="g-wait"/g)?.length).toBe(2)
    expect(html).not.toContain('g-pend on')
    const openAsi = bookHtml(WIZ, {}, { open: 'asi' })
    expect(openAsi).toContain('g-pend on')
    expect(openAsi.split('g-pend on').length - 1).toBe(1)   // 只有 asi 节亮 on
  })
  it('无待办 NPC 不出现呼吸件(FIGHTER)', () => {
    expect(bookHtml(FIGHTER, {}, {})).not.toContain('g-pend')
  })
  it('Proficiencies:PB 单值居节首+组名中文+逐项 data-tip;缺族组照裁剪', () => {
    expect(html).toContain('Proficiency Bonus<b>+2</b>')
    expect(html).toContain('>武器熟练</span>')
    expect(html).toContain('>工具熟练</span>')
    expect(html).toContain('>语言掌握</span>')
    expect(html).not.toContain('>护甲熟练')   // 法师无护甲熟练组
    expect(html).toContain('data-tip="Weapons——攻检加熟练加值')
  })
  it('施法三行=戏法(level0)/已知(环术)/已备——空行「无」;非施法者整节「无」', () => {
    expect(html).toContain('>戏法</span><span class="nms">火焰箭</span>')
    expect(html).toContain('>已知</span><span class="nms">魔法飞弹 · 护盾术</span>')
    expect(html).toContain('>已备</span><span class="nms">魔法飞弹</span>')
    const noSplit = bookHtml({ ...WIZ, spellSplit: undefined }, {}, {})
    expect(noSplit).toContain('>已知</span><span class="nms">火焰箭 · 魔法飞弹 · 护盾术</span>')   // 泵缺席回退=已知行
    const f = bookHtml(FIGHTER, {}, {})
    expect(f).toContain('<span class="bk-empty">无</span>')
    expect(f).not.toContain('bk-slot')
  })
  it('空数据节常驻「无」:状态/抗免/背包(Gear 行尾)/护甲', () => {
    const f = bookHtml({ ...FIGHTER, gear: [], shield: false }, {}, {})
    expect(f.split('bk-empty">无</span>').length - 1).toBeGreaterThanOrEqual(4)
  })
  it('avatar:图槽→av-clip 内裁层包 av-img;缺席→仅首字', () => {
    const withImg = bookHtml({ ...WIZ, race: 'human' }, AV, {})
    expect(withImg).toContain('av-clip')
    expect(withImg).toContain('class="av-img"')
    expect(bookHtml({ ...WIZ }, {}, {})).not.toContain('av-clip')
  })
})
