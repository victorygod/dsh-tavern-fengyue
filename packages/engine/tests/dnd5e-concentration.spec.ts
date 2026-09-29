// 专注断链当拍级联钉(2026-09-28,audit-fixes §7 F 线):cast 顶替跨档删 / check 专注失败级联 /
// 无条目容错 / 幂等。dropConcentration(fcast) 是判定件零写盘律的唯一显式例外——判词即写。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

const PLAYER = { name: '梅西雅', role: 'pc', class: 'wizard', level: 3, hp: 10, hp_max: 22, str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10, save_prof: ['dex'], caster_attr: 'int', slots_l1: 4, spells_known: ['test-hex'] }
const MATE = { name: '老铁', role: 'npc', level: 1, hp: 10, hp_max: 10, str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
const MATE2 = { name: '缇娜', role: 'npc', level: 1, hp: 10, hp_max: 10, str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
const HEX = '---\nname: Test Hex\nlevel: 1\nconcentration: true\n---\n\n正文'
const BLESS = { applied_at: '第 2 轮', mods: [{ stat: 'attack_save', magnitude: '1d4' }] }

function rig() {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-conc-'))
  const cwd = join(base, 'runtime')
  for (const d of ['characters', 'dnd5e-srd-lorebook/spells']) mkdirSync(join(cwd, d), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify(PLAYER))
  writeFileSync(join(cwd, 'characters', '老铁.json'), JSON.stringify(MATE))
  writeFileSync(join(cwd, 'characters', '缇娜.json'), JSON.stringify(MATE2))
  // test-hex 走 SPELL_CORE 数据注入(夹具法术不在语料——2026-09-30 回退全拆)
  const scFile = join(base, 'preset', 'lib', 'spell-core-data.mjs')
  const sc = JSON.parse(readFileSync(scFile, 'utf8').split('export const SPELL_CORE = ')[1].trim())
  sc['test-hex'] = { fm: { name: 'Test Hex', level: 1, concentration: true }, effect: '' }
  writeFileSync(scFile, `export const SPELL_CORE = ${JSON.stringify(sc)}\n`)
  return { cwd, base }
}
function runTool(runtime: string, tool: string, args: Record<string, unknown>, seed?: number) {
  const TOOL_CORE = join(dirname(runtime), 'preset', 'lib', 'core.mjs')
  const prelude = seed === undefined ? '' : `(await import(${JSON.stringify(pathToFileURL(TOOL_CORE).href)})).setSeed(${seed});`
  const code = `globalThis.argv=${JSON.stringify(args)};${prelude}await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', `${tool}.mjs`)).href)})`
  const rr = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
  if (rr.status !== 0) console.error('[tool-fail]', rr.stdout)
  return rr
}
const j = (rt: string, f: string) => JSON.parse(readFileSync(join(rt, 'characters', f), 'utf8'))

describe('专注断链级联(真实脚本)', () => {
  it('cast 顶替链:旧专注跨档双删(施法者+两名受益人) + concentrating 换', () => {
    const { cwd: rt, base } = rig()
    const pj = JSON.parse(readFileSync(join(rt, 'characters', 'player.json'), 'utf8'))
    pj.concentrating = 'Bless'; pj.statuses = { Bless: BLESS }
    writeFileSync(join(rt, 'characters', 'player.json'), JSON.stringify(pj))
    const m1 = JSON.parse(readFileSync(join(rt, 'characters', '老铁.json'), 'utf8')); m1.statuses = { Bless: BLESS }; writeFileSync(join(rt, 'characters', '老铁.json'), JSON.stringify(m1))
    const m2 = JSON.parse(readFileSync(join(rt, 'characters', '缇娜.json'), 'utf8')); m2.statuses = { Bless: BLESS }; writeFileSync(join(rt, 'characters', '缇娜.json'), JSON.stringify(m2))
    const r = runTool(rt, 'cast', { context: '顶替', spell: 'test-hex', caster: '梅西雅' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('concentrating Bless→Test Hex')
    expect(r.stdout).toMatch(/老铁 statuses −「Bless」/)
    expect(r.stdout).toMatch(/缇娜 statuses −「Bless」/)
    expect(j(rt, 'player.json').concentrating).toBe('Test Hex')
    expect(j(rt, '老铁.json').statuses.Bless).toBeUndefined()
    expect(j(rt, '缇娜.json').statuses.Bless).toBeUndefined()
    rmSync(base, { recursive: true, force: true })
  })
  it('check 专注维持失败级联:跨档删 + concentrating 清(seed 2→d20=8, DC15 失败)', () => {
    const { cwd: rt, base } = rig()
    const pj = JSON.parse(readFileSync(join(rt, 'characters', 'player.json'), 'utf8'))
    pj.concentrating = 'Bless'; pj.statuses = { Bless: BLESS }
    writeFileSync(join(rt, 'characters', 'player.json'), JSON.stringify(pj))
    const m1 = JSON.parse(readFileSync(join(rt, 'characters', '老铁.json'), 'utf8')); m1.statuses = { Bless: BLESS }; writeFileSync(join(rt, 'characters', '老铁.json'), JSON.stringify(m1))
    const r = runTool(rt, 'check', { context: '箭雨', who: '梅西雅', damage: 1000 }, 2)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('失败')
    expect(r.stdout).toMatch(/梅西雅 statuses −「Bless」|老铁 statuses −「Bless」/)
    expect(j(rt, 'player.json').concentrating).toBeFalsy()
    expect(j(rt, '老铁.json').statuses.Bless).toBeUndefined()
    rmSync(base, { recursive: true, force: true })
  })
  it('无条目容错:concentrating 有值但无人 statuses 受灾 → 只清 concentrating', () => {
    const { cwd: rt, base } = rig()
    const pj = JSON.parse(readFileSync(join(rt, 'characters', 'player.json'), 'utf8'))
    pj.concentrating = 'Bless'   // 有专注,但无任何 statuses.Bless 条目
    writeFileSync(join(rt, 'characters', 'player.json'), JSON.stringify(pj))
    const r = runTool(rt, 'check', { context: '箭雨', who: '梅西雅', damage: 1000 }, 2)
    expect(r.status).toBe(0)
    expect(j(rt, 'player.json').concentrating).toBeFalsy()
    expect(r.stdout).not.toMatch(/statuses −/)
    rmSync(base, { recursive: true, force: true })
  })
  it('幂等:concentrating 空 → 专注维持失败零副作用零落盘行', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'check', { context: '箭雨', who: '梅西雅', damage: 1000 }, 2)
    expect(r.status).toBe(0)
    expect(r.stdout).not.toMatch(/落盘:.*concentrating|statuses −/)
    rmSync(base, { recursive: true, force: true })
  })
})