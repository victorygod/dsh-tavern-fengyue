// dnd5e 附近 NPC 三态名单元钉(2026-09-30 stance 回锅——行式 `- 名 | 同伴/中立/敌对`,真脚本+临时树:cwd 与 preset 兄弟——部署同构):
// 注入器(get_npc_state)与泵(ui_data op=panel)从同一 lib/core presence() 取集——本 spec 断言
// 两端**人名序+三分类逐行相等**(镜像即机器锁);前端左=同伴+中立/右=敌对(三态列驱动);
// 参战者 HP/先攻 join 参战行(战斗节=参战名单,2026-09-29b 保留);缺档行双通道示警;单列旧行兼容读=中立;
// rev 扩容(state.md 进左栏 rev)后差量协议仍成立。
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
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
- 幽灵客

## 战斗
- 回合：2
- 先攻：石牙:11 > 洛克:9
- 参战行：石牙 | 状态 中毒

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
  // 石牙档案 9/9 即敌卡真值(参战名单化后数值唯一居所=档案)
  '石牙': { name: '石牙', role: 'npc', level: 1, hp: 9, hp_max: 9, ac: 13 },
  '掌柜': { name: '掌柜', role: 'npc', description: '圆脸热心' },
}
const MISSING = ['幽灵客']   // 行在档缺 → 双通道示警(单列旧行=中立池,保守归属)

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

/** 注入器出口:`### 名（标）` 行序列(缺档行带「勿采信」尾注)——与 postPrompt 面板同形。 */
function injectRows(rt: string) {
  const r = spawnSync(process.execPath, [join(PRE, 'scripts', 'get_npc_state.mjs')], { cwd: rt, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`get_npc_state exit ${r.status}: ${r.stderr.slice(0, 300)}`)
  return r.stdout.trim().split('\n')
    .map(l => /^### (.+?)（(同伴|中立|敌对|档缺)）(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(m => ({ name: m[1], label: m[2], tail: m[3] }))
}

interface PumpOut { ok: boolean; rev?: string; changed?: boolean; data?: any; error?: string }
function pump(rt: string, name: string, argv: Record<string, unknown> = {}): PumpOut {
  const op = { op: 'panel', name, ...argv }
  const code = `globalThis.argv=[${JSON.stringify(JSON.stringify(op))}];await import(${JSON.stringify(pathToFileURL(join(PRE, 'scripts', 'ui_data.mjs')).href)})`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: rt, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`ui_data ${name} exit ${r.status}: ${r.stderr.slice(0, 300)}`)
  const line = r.stdout.trim().split('\n').filter(Boolean).pop() ?? ''
  return JSON.parse(line)
}

describe('dnd5e 附近 NPC 三态名单——注入与前端逐行镜像(2026-09-30 stance 回锅)', () => {
  it('人名序+三分类逐一相等(含缺档行);缺档=注入「勿采信」+前端占位', () => {
    const { cwd: rt } = rig()
    const rows = injectRows(rt)
    const left = pump(rt, 'hud-left')
    const right = pump(rt, 'hud-right')
    // 注入序=池序(同伴→中立→敌对),非行序
    expect(rows.map(({ name, label }) => ({ name, label }))).toEqual([
      { name: '老铁', label: '同伴' },
      { name: '掌柜', label: '中立' },
      { name: '幽灵客', label: '中立' },   // 幽灵客行无态列=单列兼容→中立(注入带勿采信尾注)
      { name: '石牙', label: '敌对' },
    ])
    // 前端三池与注入序镜像:左=同伴+中立,右=敌对——拼接后与注入顺序相等(镜像锁真身断言)
    const frontend = [
      ...(left.data?.companions ?? []).map((c: any) => ({ name: c.name as string })),
      ...(left.data?.neutrals ?? []).map((c: any) => ({ name: c.name as string })),
      ...(right.data?.foes ?? []).map((c: any) => ({ name: c.name as string })),
    ]
    expect(frontend).toEqual(rows.map(({ name }) => ({ name })))   // 前端池拼接序=注入池序,仍逐行镜像
    // 缺档双通道:注入尾注 + 前端 _missing(落左中立池=保守归属)
    const ghostRow = rows.find(r => r.name === '幽灵客')
    expect(ghostRow?.tail).toContain('勿采信')
    const ghost = (left.data?.neutrals ?? []).find((c: any) => c.name === '幽灵客')
    expect(ghost?._missing).toBe(true)
    rmSync(dirname(rt), { recursive: true, force: true })
  })

  it('参战行 join=档案值+先攻;非参战者不带 init;玩家与池隔离', () => {
    const { cwd: rt } = rig()
    const right = pump(rt, 'hud-right')
    const foe = right.data?.foes?.[0]
    expect(foe.name).toBe('石牙')
    expect(foe.hp).toBe(9)          // 参战行不落 HP——档案值即敌卡值(工具当拍写档,行只记身份/状态)
    expect(foe.hp_max).toBe(9)
    expect(foe.init).toBe(11)       // 先攻行 join
    const left = pump(rt, 'hud-left')
    expect(left.data?.player?.name).toBe('洛克')
    for (const c of left.data?.companions ?? []) expect(c.init).toBeUndefined()
    expect((left.data?.neutrals ?? []).find((c: any) => c.name === '掌柜')?.init).toBeUndefined()
    rmSync(dirname(rt), { recursive: true, force: true })
  })

  it('单列旧行兼容读(存量 state.md 平滑):无态列=中立', () => {
    const legacy = STATE_MD.replace('- 老铁 | 同伴', '- 老铁').replace('- 石牙 | 敌对', '- 石牙').replace('- 掌柜 | 中立', '- 掌柜')
    const { cwd: rt } = rig(legacy)
    const rows = injectRows(rt)
    expect(rows.map(({ name, label }) => ({ name, label }))).toEqual([
      { name: '老铁', label: '中立' },   // 单列旧行=中立
      { name: '石牙', label: '中立' },
      { name: '掌柜', label: '中立' },
      { name: '幽灵客', label: '中立' },
    ])
    rmSync(dirname(rt), { recursive: true, force: true })
  })

  it('rev 三段式:state.md 一行名单之差触发重画;同 rev 裸 ack 差量仍成立', () => {
    const { cwd: rt } = rig()
    const first = pump(rt, 'hud-left')
    expect((first.rev ?? '').split(':').length).toBeGreaterThanOrEqual(3)   // player+characters+state.md
    const same = pump(rt, 'hud-left', { rev: first.rev })
    expect(same.changed).toBe(false)
    expect(same.data).toBeUndefined()
    // 名单加一行(不改 characters)→ rev 必须变——state.md 已进 rev 公式
    const md = STATE_MD.replace('- 幽灵客', '- 幽灵客\n- 新路人')
    writeFileSync(join(rt, 'state.md'), md)
    const next = pump(rt, 'hud-left', { rev: first.rev })
    expect(next.changed).toBeUndefined()
    expect((next.data?.companions ?? []).map((c: any) => c.name)).toEqual(['老铁'])
    expect((next.data?.neutrals ?? []).filter((c: any) => ['幽灵客', '新路人'].includes(c.name)).map((c: any) => c.name)).toEqual(['幽灵客', '新路人'])
    const rightNext = pump(rt, 'hud-right')
    expect((rightNext.data?.foes ?? []).map((c: any) => c.name)).toEqual(['石牙'])
    rmSync(dirname(rt), { recursive: true, force: true })
  })

  it('名单空(种子态) → 注入占位文案,前端两池皆空——不误伤玩家', () => {
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
    const right = pump(rt, 'hud-right')
    expect(right.data?.foes).toEqual([])
    rmSync(dirname(rt), { recursive: true, force: true })
  })
})
