// 怪物豁免能力消费钉(2026-09-28 G1 龙息):attack 的 ability 入口——走豁免不走攻检,DC/骰式自语料表。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')
const { monsterArchive } = await import(pathToFileURL(join(ROOT, 'tavern_presets', 'dnd5e', 'test', 'test-fixtures.mjs')).href)
const PLAYER = { name: '梅西雅', role: 'pc', class: 'wizard', level: 5, hp: 60, hp_max: 60, str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10 }
async function dragonArchive(o: Record<string, unknown> = {}) {
  return monsterArchive(CARD, 'adult-red-dragon', { name: '红龙', role: 'npc', hp: 200, hp_max: 200, ...o })
}

async function rig(dragon: Record<string, unknown>) {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-abl-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify(PLAYER))
  writeFileSync(join(cwd, 'characters', '红龙.json'), JSON.stringify(dragon))
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
const j = (rt: string) => JSON.parse(readFileSync(join(rt, 'characters', 'player.json'), 'utf8'))

describe('怪物豁免能力(真实脚本)', () => {
  it('龙息:豁免判定+DC 自表+伤害落盘(半伤/全额皆可,hp 降)', async () => {
    const { cwd: rt, base } = await rig(await dragonArchive())
    const r = runTool(rt, 'attack', { context: '喷吐', who: '红龙', target: '梅西雅', ability: 'fire-breath' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/豁免判定: d20/)
    expect(r.stdout).toMatch(/vs DC 21/)
    expect(r.stdout).toMatch(/18d6/)
    expect(r.stdout).toMatch(/落盘: 梅西雅 hp 60→\d+/)
    expect(j(rt).hp).toBeLessThan(60)
    rmSync(base, { recursive: true, force: true })
  })
  it('wing-attack:knockProne 失败时回执带倒地', async () => {
    const { cwd: rt, base } = await rig(await dragonArchive())
    const r = runTool(rt, 'attack', { context: '翼击', who: '红龙', target: '梅西雅', ability: 'wing-attack-costs-2-actions-legendary' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/vs DC 22/)
    expect(r.stdout).toMatch(/2d6\+8/)
    expect(r.stdout).toContain('倒地')
    rmSync(base, { recursive: true, force: true })
  })
  it('表外能力响亮报错', async () => {
    const { cwd: rt, base } = await rig(await dragonArchive())
    const r = runTool(rt, 'attack', { context: 'x', who: '红龙', target: '梅西雅', ability: 'nope' })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('能力查不到:nope')
    rmSync(base, { recursive: true, force: true })
  })
  it('状态骑手:狼咬命中→DC13 力量豁免,失败自动上倒地', async () => {
    const { cwd: rt, base } = await rig(await dragonArchive())
    writeFileSync(join(rt, 'characters', '冰原狼.json'), JSON.stringify(await monsterArchive(CARD, 'dire-wolf', { name: '冰原狼', role: 'npc', hp: 40, hp_max: 40 })))
    const r = runTool(rt, 'attack', { context: '扑咬', who: '冰原狼', target: '梅西雅', weapon: 'bite', at: '第 2 轮' }, 2)  // seed 2 → d20=8 命中
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/状态骑手: DC 13 strength 豁免/)
    expect(r.stdout).toMatch(/落盘: 梅西雅 hp 60→\d+/)
    rmSync(base, { recursive: true, force: true })
  })
})