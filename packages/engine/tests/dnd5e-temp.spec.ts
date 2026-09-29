// 临时生命独立缓冲池钉(2026-09-28 RAW 方案 A):temp_hp 独立键/取高不叠/到期回收/受伤先扣临时。
// RAW 语义(not actual hp; buffer; lost first; separate; can exceed max; healing 不回填)。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')
const PLAYER = { name: '梅西雅', role: 'pc', class: 'wizard', level: 3, hp: 10, hp_max: 20, str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10 }

function rig() {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-temp-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify(PLAYER))
  return { cwd, base }
}
function runTool(runtime: string, tool: string, args: Record<string, unknown>) {
  const code = `globalThis.argv=${JSON.stringify(args)};await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', `${tool}.mjs`)).href)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
}
const j = (rt: string) => JSON.parse(readFileSync(join(rt, 'characters', 'player.json'), 'utf8'))

describe('临时生命独立缓冲池(真实脚本)', () => {
  it('授予:只写 temp_hp 键,hp/hp_max 不动(RAW 独立池)', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'hp_change', { context: '虚假生命', target: '梅西雅', temp: 5 })
    expect(r.status).toBe(0)
    const p = j(rt)
    expect(p.temp_hp).toBe(5)
    expect(p.hp).toBe(10)          // hp 不随临时抬
    expect(p.hp_max).toBe(20)      // hp_max 永不因临时变
    expect(p.statuses['临时生命'].temp).toBe(5)
    rmSync(base, { recursive: true, force: true })
  })
  it('取高不叠(RAW "12 or 10, not 22")', () => {
    const { cwd: rt, base } = rig()
    runTool(rt, 'hp_change', { context: 'a', target: '梅西雅', temp: 5 })
    const low = runTool(rt, 'hp_change', { context: 'b', target: '梅西雅', temp: 3 })
    expect(low.status).toBe(0)
    expect(low.stdout).toContain('不叠')
    expect(j(rt).temp_hp).toBe(5)                       // 低位不叠
    runTool(rt, 'hp_change', { context: 'c', target: '梅西雅', temp: 8 })
    expect(j(rt).temp_hp).toBe(8)                       // 取高
    rmSync(base, { recursive: true, force: true })
  })
  it('受伤先扣临时,剩余落 hp;hp_max 不变', () => {
    const { cwd: rt, base } = rig()
    runTool(rt, 'hp_change', { context: '虚假生命', target: '梅西雅', temp: 5 })
    const r = runTool(rt, 'damage', { context: '火舌', dice: '1d6+50', target: '梅西雅', type: 'fire' })  // 必 >5,临时先耗尽
    expect(r.status).toBe(0)
    const p = j(rt)
    expect(p.temp_hp).toBe(0)                           // 临时先耗尽
    expect(p.hp).toBe(0)                                // hp 10 - 剩余(46+) → 0
    expect(p.hp_max).toBe(20)                           // hp_max 不动
    rmSync(base, { recursive: true, force: true })
  })
})