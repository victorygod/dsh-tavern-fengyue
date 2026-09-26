// dnd5e v4 人际三区 view 钉(2026-09-25,行式 `- 名 | 态` 名单的渲染端):
// 左=hero+同伴+中立(两 zone,空区整隐);右=敌对(置顶)+环境+任务;敌卡敌行 HP 文本+先攻 chip;
// 缺档占位卡(不可点,勿采信);敌对区暖红类挂卡。
import { describe, expect, it } from 'vitest'
import { heroPanel, rightPanel } from '../../../tavern_presets/dnd5e/preset/ui/view.mjs'

const PLAYER = { name: '洛克', level: 2, gender: 'male', race: 'half_elf', hp: 14, hp_max: 14, statuses: [], pending: [], derived: { hpPct: 100 } }
const MATE = { name: '老铁', _file: 'characters/老铁.json', gender: 'male', level: 1, hp: 10, hp_max: 10, statuses: [], derived: { hpPct: 100 } }
const NEU = { name: '掌柜', _file: 'characters/掌柜.json', gender: 'unknown', statuses: [], derived: { hpPct: null } }
const GHOST = { name: '幽灵客', _file: 'characters/幽灵客.json', _missing: true }
const FOE = { name: '石牙', _file: 'characters/石牙.json', gender: 'male', level: 1, hp: 5, hp_max: 9, init: 11, statuses: [{ name: '中毒', kind: 'd', effect: '' }], derived: { hpPct: 56 } }
const STATE = { time_day: 1, time_hour: 18, region: '边境边地', area: '灰鸦丘陵', place: '边境小镇·北门', terrain: '温带丘陵', weather: '小雨', main: ['线人失联——北门外丘陵'], side: [] }

describe('heroPanel · 左区两态(同伴+中立)', () => {
  it('zone 序=同伴→中立;同伴卡可点开册,缺档卡不可点且带示警 chip', () => {
    const html = heroPanel({ player: PLAYER, companions: [MATE], neutrals: [NEU, GHOST] })
    const zones = [...html.matchAll(/m-zone">([^<]+)</g)].map(m => m[1])
    expect(zones).toEqual(['同伴', '中立'])
    expect(html).toContain('data-act="book" data-target="characters/老铁.json"')
    expect(html).toContain('m-card missing')
    expect(html.slice(html.indexOf('幽灵客'))).not.toContain('data-act="book"')
    expect(html).toContain('缺档')
  })
  it('两池皆空 → hero-mates 整体不渲染', () => {
    const html = heroPanel({ player: PLAYER, companions: [], neutrals: [] })
    expect(html).not.toContain('m-zone')
    expect(html).not.toContain('hero-mates')
  })
})

describe('rightPanel · 右区第三态(敌对沉底于任务下方)', () => {
  it('敌对 zone 在任务列表之下(用户令:敌人在任务下方);敌卡 HP=敌行口径文本+先攻 chip ◆N+暖红区类', () => {
    const html = rightPanel({ state: STATE, foes: [FOE] })
    expect(html.indexOf('sec-foes')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('sec-foes')).toBeGreaterThan(html.indexOf('class="quests"'))
    expect(html).toContain('class="mates foes"')
    expect(html).toContain('◆11')
    expect(html).toContain('>5/9<')
    expect(html).toContain('data-act="book" data-target="characters/石牙.json"')
  })
  it('敌对空 → 区隐,环境+任务照常', () => {
    const html = rightPanel({ state: STATE, foes: [] })
    expect(html).not.toContain('sec-foes')
    expect(html).toContain('wcard')
    expect(html).toContain('任务')
  })
})
