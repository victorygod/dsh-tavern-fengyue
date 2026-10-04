// statuses 枚举化 + 双 lint 钉(2026-09-29;2026-10-04 人物卡更新器分拆——状态区工具 update_status 承 statuses 数组,
// 状态家族承旧语义;status 参数不再携带 schema enum——门禁在工具代码,报错列合法键)。
// saveChar 写盘当拍拦(层 1)、lint_characters 存量扫描(层 2)。事故锚:剧情复盘「同行」被当临时状态落进 Conditions。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

const PLAYER = { name: '梅西雅', role: 'pc', level: 1, hp: 10, hp_max: 10 }

/** 最小 rig:只铺 characters/ 与 ../preset/lib(status.mjs 随 lib 一起拷)。 */
function rig() {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-status-'))
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
function runScript(runtime: string, script: string) {
  const code = `await import(${JSON.stringify(pathToFileURL(join(CARD, 'scripts', `${script}.mjs`)).href)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
}
const j = (rt: string, f = 'player.json') => JSON.parse(readFileSync(join(rt, 'characters', f), 'utf8'))

describe('statuses 数组硬闸(update_status——名+applied_at,机械按名匹配,替换式)', () => {
  it('枚举外键(剧情态「同行」) → 拒绝,回执含枚举', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'update_status', { context: '约定同行', target: '梅西雅', statuses: [{ status: '同行', applied_at: '第 1 日 18 时' }] })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('status 不在临时状态枚举:同行')
    rmSync(base, { recursive: true, force: true })
  })
  it('条件条目=名+applied_at 落条,效果文案机械匹配(poisoned)', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'update_status', { context: '中毒', target: '梅西雅', statuses: [{ status: 'poisoned', applied_at: '第 2 轮' }] })
    expect(r.status).toBe(0)
    expect(j(rt).statuses.poisoned).toMatchObject({ applied_at: '第 2 轮' })
    expect(String(j(rt).statuses.poisoned.effect)).toContain('攻检与豁免')   // 文案出自 STATUS_TEXT 单源
    rmSync(base, { recursive: true, force: true })
  })
  it('法术 buff 条目=effect/mods 机械自动落(Bless 由 spell-data 按名检索,LLM 不传)', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'update_status', { context: '祝福', target: '梅西雅', statuses: [{ status: 'Bless', applied_at: '第 2 轮' }] })
    expect(r.status).toBe(0)
    expect(j(rt).statuses.Bless).toMatchObject({ mods: [{ stat: 'attack_save', magnitude: '1d4' }] })
    expect(String(j(rt).statuses.Bless.effect)).toContain('1d4')
    rmSync(base, { recursive: true, force: true })
  })
  it('替换式:未列即摘除(无 remove 参数),回报摘除名单', () => {
    const { cwd: rt, base } = rig()
    runTool(rt, 'update_status', { context: '毒', target: '梅西雅', statuses: [{ status: 'poisoned', applied_at: '第 2 轮' }] })
    const r = runTool(rt, 'update_status', { context: '解', target: '梅西雅', statuses: [{ status: 'Bless', applied_at: '第 3 轮' }] })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('摘除 poisoned')
    expect(j(rt).statuses.poisoned).toBeUndefined()
    expect(j(rt).statuses.Bless).toBeTruthy()
    rmSync(base, { recursive: true, force: true })
  })
  it('新条无 applied_at → 拒(时限手写)', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'update_status', { context: '毒', target: '梅西雅', statuses: [{ status: 'poisoned' }] })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('须带 applied_at')
    rmSync(base, { recursive: true, force: true })
  })
  it('schema 漂移钉:条目 status 枚举==STATUS_KEYS;旧家族参数(applied_at/effect/on_use/mods/remove)不设', async () => {
    const { STATUS_KEYS } = await import(pathToFileURL(join(CARD, 'lib', 'status.mjs')).href)
    const src = readFileSync(join(CARD, 'tools', 'update_status.mjs'), 'utf8')
    const schema = JSON.parse(/\/\*\*\s*@tavern-schema([\s\S]*?)\*\//.exec(src)![1])
    const itemProps = schema.parameters.statuses.items.properties
    expect(Object.keys(itemProps).sort()).toEqual(['applied_at', 'status', 'temp'])
    expect(itemProps.status.enum).toEqual([...STATUS_KEYS])
    for (const gone of ['status', 'applied_at', 'effect', 'on_use', 'mods', 'remove']) expect(schema.parameters[gone]).toBeUndefined()
  })
})

describe('saveChar 写盘当拍拦(层 1)', () => {
  it('工具写非枚举键(hp_change 自定义 temp 标签) → 被 saveChar 拒写', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'hp_change', { context: '临时生命', target: '梅西雅', temp: 5, name: '英雄宴' })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('statuses 非法键')
    expect(r.stdout).toContain('英雄宴')
    rmSync(base, { recursive: true, force: true })
  })
  it('hp_change 默认临时生命键(枚举内) → 正常落盘', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'hp_change', { context: '临时生命', target: '梅西雅', temp: 5 })
    expect(r.status).toBe(0)
    expect(j(rt).statuses['临时生命']).toMatchObject({ temp: 5 })
    rmSync(base, { recursive: true, force: true })
  })
})

describe('lint_characters 存量扫描(层 2)', () => {
  it('存量含枚举外键 → 报非法退出 1', () => {
    const { cwd: rt, base } = rig()
    writeFileSync(join(rt, 'characters', '老铁.json'), JSON.stringify({ name: '老铁', statuses: { 同行: { effect: '同意与波佐同行' } } }))
    const r = runScript(rt, 'lint_characters')
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('非法 statuses 键')
    expect(r.stdout).toContain('同行')
    rmSync(base, { recursive: true, force: true })
  })
  it('存量全合法 → 退出 0', () => {
    const { cwd: rt, base } = rig()
    writeFileSync(join(rt, 'characters', '老铁.json'), JSON.stringify({ name: '老铁', statuses: { poisoned: { effect: '中毒' } } }))
    const r = runScript(rt, 'lint_characters')
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('lint 全绿:statuses/persona 七键/history 形状合法')
    rmSync(base, { recursive: true, force: true })
  })
})