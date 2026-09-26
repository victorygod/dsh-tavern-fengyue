// dnd5e 附近 NPC 三态名单 v4 一致性锚(2026-09-25 定案,真脚本+临时树:cwd 与 preset 兄弟——部署同构):
// 注入器(get_npc_state)与泵(ui_data op=panel)从同一 lib/core presence() 取集——本 spec 断言
// 两端**人名序+三分类逐行相等**(镜像即机器锁,防 v2「注释与实现相悖」重演);敌卡敌行 HP/先攻
// join 压档案值;缺档行双通道示警;rev 扩容(state.md 进左栏 rev)后差量协议仍成立。
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const PRE = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

const STATE_MD = `## 时间敏感项
- 当前时间：第1日·18时

## 队伍
- 成员：player.json（主角）+ 老铁
- 平均等级：1

## 附近 NPC
- 老铁 | 同伴
- 石牙 | 敌对
- 掌柜 | 中立
- 幽灵客 | 中立

## 战斗
- 回合：2
- 先攻：石牙:11 > 洛克:9
- 敌行：石牙 | 状态 中毒

## 玩家所在
- 大区：边境边地
- 区域：灰鸦丘陵
- 地点：边境小镇·北门
- 地形：温带丘陵
- 天气：小雨
`

const PLAYER = { name: '洛克', role: 'pc', class: 'rogue', level: 2, hp: 14, hp_max: 14, gender: 'male', race: 'half_elf' }
const CHARS: Record<string, Record<string, unknown>> = {
  '老铁': { name: '老铁', role: 'companion', level: 1, hp: 10, hp_max: 10 },
  // 石牙档案 9/9 即敌卡真值(敌行瘦身后数值唯一居所=档案)
  '石牙': { name: '石牙', role: 'npc', level: 1, hp: 9, hp_max: 9, ac: 13 },
  '掌柜': { name: '掌柜', role: 'npc', description: '圆脸热心' },
}
const MISSING = ['幽灵客']   // 行在档缺 → 双通道示警

function rig(state = STATE_MD) {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-presence-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  cpSync(join(PRE, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'state.md'), state)
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify(PLAYER))
  for (const [n, j] of Object.entries(CHARS)) writeFileSync(join(cwd, 'characters', `${n}.json`), JSON.stringify(j))
  return { cwd, base }
}

/** 注入器出口:`### 名（态）` 行序列(缺档行带「勿采信」尾注)——与 postPrompt 面板同形。 */
function injectRows(rt: string) {
  const r = spawnSync(process.execPath, [join(PRE, 'scripts', 'get_npc_state.mjs')], { cwd: rt, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`get_npc_state exit ${r.status}: ${r.stderr.slice(0, 300)}`)
  return r.stdout.trim().split('\n')
    .map(l => /^### (.+?)（(同伴|中立|敌对)）(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(m => ({ name: m[1], stance: m[2], tail: m[3] }))
}

interface PumpOut { ok: boolean; rev?: string; changed?: boolean; data?: any; error?: string }
function pump(rt: string, name: string, argv: Record<string, unknown> = {}): PumpOut {
  const op = { op: 'panel', name, ...argv }
  const code = `globalThis.argv=[${JSON.stringify(JSON.stringify(op))}];await import(${JSON.stringify(join(PRE, 'scripts', 'ui_data.mjs'))})`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: rt, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`ui_data ${name} exit ${r.status}: ${r.stderr.slice(0, 300)}`)
  const line = r.stdout.trim().split('\n').filter(Boolean).pop() ?? ''
  return JSON.parse(line)
}

describe('dnd5e v4 三态名单——注入与前端逐行镜像', () => {
  it('人名序+三分类逐一相等(含缺档行);缺档=注入「勿采信」+前端占位', () => {
    const { cwd: rt } = rig()
    const rows = injectRows(rt)
    const left = pump(rt, 'hud-left')
    const right = pump(rt, 'hud-right')
    expect(rows.map(({ name, stance }) => ({ name, stance }))).toEqual([
      { name: '老铁', stance: '同伴' },
      { name: '掌柜', stance: '中立' },
      { name: '幽灵客', stance: '中立' },
      { name: '石牙', stance: '敌对' },
    ])
    // 前端池按注入顺序拼接后与注入集相等——镜像锁的真身断言
    const frontend = [
      ...(left.data?.companions ?? []).map((c: any) => ({ name: c.name as string })),
      ...(left.data?.neutrals ?? []).map((c: any) => ({ name: c.name as string })),
      ...(right.data?.foes ?? []).map((c: any) => ({ name: c.name as string })),
    ]
    expect(frontend).toEqual(rows.map(({ name }) => ({ name })))
    // 缺档双通道:注入尾注 + 前端 _missing
    const ghostRow = rows.find(r => r.name === '幽灵客')
    expect(ghostRow?.tail).toContain('勿采信')
    const ghost = [...(left.data?.neutrals ?? [])].find((c: any) => c.name === '幽灵客')
    expect(ghost?._missing).toBe(true)
    rmSync(dirname(rt), { recursive: true, force: true })
  })

  it('敌卡=档案值(敌行瘦身后行不落数值)+先攻 join;中立/同伴不带 init;玩家与档全池隔离', () => {
    const { cwd: rt } = rig()
    const right = pump(rt, 'hud-right')
    const foe = right.data?.foes?.[0]
    expect(foe.name).toBe('石牙')
    expect(foe.hp).toBe(9)          // 敌行不再落 HP——档案值即敌卡值(工具当拍写档,行只记身份/状态)
    expect(foe.hp_max).toBe(9)
    expect(foe.init).toBe(11)       // 先攻行 join
    // 档案 hp 与敌行同字段不可能区分——投影值即敌行值(战斗回合机械快照)
    const left = pump(rt, 'hud-left')
    expect(left.data?.player?.name).toBe('洛克')
    for (const c of [...(left.data?.companions ?? []), ...(left.data?.neutrals ?? [])]) expect(c.init).toBeUndefined()
    rmSync(dirname(rt), { recursive: true, force: true })
  })

  it('rev 三段式:state.md 一行名单之差触发重画;同 rev 裸 ack 差量仍成立', () => {
    const { cwd: rt } = rig()
    const first = pump(rt, 'hud-left')
    expect((first.rev ?? '').split(':').length).toBeGreaterThanOrEqual(3)   // player+characters+state.md
    const same = pump(rt, 'hud-left', { rev: first.rev })
    expect(same.changed).toBe(false)
    expect(same.data).toBeUndefined()
    // 名单加一行(不改 characters)→ 左栏 rev 必须变——state.md 已进左栏 rev 公式
    const md = STATE_MD.replace('- 幽灵客 | 中立', '- 幽灵客 | 中立\n- 新路人 | 中立')
    writeFileSync(join(rt, 'state.md'), md)
    const next = pump(rt, 'hud-left', { rev: first.rev })
    expect(next.changed).toBeUndefined()
    expect((next.data?.neutrals ?? []).map((c: any) => c.name)).toEqual(['掌柜', '幽灵客', '新路人'])
    rmSync(dirname(rt), { recursive: true, force: true })
  })

  it('名单空(种子态) → 注入占位文案,前端三池皆空——不误伤玩家', () => {
    const seed = `## 附近 NPC
- （无）

## 玩家所在
- 地点：边境小镇
`
    const { cwd: rt } = rig(seed)
    const r = spawnSync(process.execPath, [join(PRE, 'scripts', 'get_npc_state.mjs')], { cwd: rt, encoding: 'utf8' })
    expect(r.stdout).toContain('名单为空')
    const left = pump(rt, 'hud-left')
    expect(left.data?.player?.name).toBe('洛克')
    expect(left.data?.companions).toEqual([])
    expect(left.data?.neutrals).toEqual([])
    const right = pump(rt, 'hud-right')
    expect(right.data?.foes).toEqual([])
    rmSync(dirname(rt), { recursive: true, force: true })
  })
})
