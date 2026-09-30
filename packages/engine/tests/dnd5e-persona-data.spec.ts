// 怪物 persona 数据面钉(2026-09-30 persona-threelayer 定案 4:怪人设=数据面预生成,spawn 零 LLM 人设通道):
// sidecar=lib/monster-persona-data.mjs(merge-persona-batches.mjs 合并产物,手改会被覆盖)——七键白名单/
// 字数硬闸/alignment 9 值/slug ⊆ MONSTER_CORE/三键必填;buildMonster join+spawn 单只落卡/批量杂兵不落。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

const P7 = ['appearance', 'lens', 'reaction', 'voice', 'never', 'tension', 'alignment']

describe('monster-persona-data 形量钉(2026-09-30 数据批)', () => {
  it('七键白名单+三键必填+字数硬闸+alignment 9 值(全员过 lib/persona.mjs PERSONA_LIMITS)', async () => {
    const { MONSTER_PERSONA } = await import(pathToFileURL(join(CARD, 'lib', 'monster-persona-data.mjs')).href)
    const { PERSONA_LIMITS, PERSONA_ALIGNMENTS } = await import(pathToFileURL(join(CARD, 'lib', 'persona.mjs')).href)
    const slugs = Object.keys(MONSTER_PERSONA)
    expect(slugs.length).toBe(333)   // MONSTER_CORE 全部怪齐（commoner 2026-09-30 迁出=spawn_npc 职业）
    for (const s of slugs) {
      const p = MONSTER_PERSONA[s]
      expect(p.lens, `${s}.lens`).toBeTruthy()
      expect(p.reaction, `${s}.reaction`).toBeTruthy()
      expect(p.appearance, `${s}.appearance`).toBeTruthy()
      for (const [k, v] of Object.entries(p)) {
        expect(P7, `${s}.${k} 键`).toContain(k)
        expect(typeof v === 'string' && !/\d/.test(v), `${s}.${k}=${v}`).toBe(true)   // 中文短串,无数字
        if (k === 'alignment') expect(PERSONA_ALIGNMENTS, `${s} alignment`).toContain(v)
        else expect(v.length, `${s}.${k} 字数`).toBeLessThanOrEqual(PERSONA_LIMITS[k])
      }
    }
  })
})

describe('spawn_monster 数据 persona 行落卡(真实脚本)', () => {
  function rig() {
    const base = mkdtempSync(join(tmpdir(), 'dnd5e-persona-data-'))
    const cwd = join(base, 'runtime')
    for (const d of ['characters', 'dnd5e-srd-lorebook/monsters']) mkdirSync(join(cwd, d), { recursive: true })
    cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
    writeFileSync(join(base, 'runtime', 'state.md'), '# 世界状态\n\n## 附近 NPC\n\n## 战斗\n- （无战斗）\n')
    return { cwd, base }
  }
  function runTool(runtime: string, tool: string, args: Record<string, unknown>) {
    const code = `globalThis.argv=${JSON.stringify(args)};await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', `${tool}.mjs`)).href)})`
    return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
  }
  const j = (rt: string, f: string) => JSON.parse(readFileSync(join(rt, 'characters', f), 'utf8'))

  it('单只建档=卡带数据 persona;批量(count>1)=杂兵不落', async () => {
    const { MONSTER_PERSONA } = await import(pathToFileURL(join(CARD, 'lib', 'monster-persona-data.mjs')).href)
    const { cwd: rt, base } = rig()
    const single = runTool(rt, 'spawn_monster', { context: 'x', name: '独怪', stance: '敌对', monster_kind: 'goblin' })
    expect(single.status).toBe(0)
    expect(j(rt, '独怪.json').persona).toEqual(MONSTER_PERSONA.goblin)
    const batch = runTool(rt, 'spawn_monster', { context: 'x', name: '杂兵群', count: 2, stance: '敌对', monster_kind: 'goblin' })
    expect(batch.status).toBe(0)
    expect(j(rt, '杂兵群甲.json').persona).toBeUndefined()
    expect(j(rt, '杂兵群乙.json').persona).toBeUndefined()
    rmSync(base, { recursive: true, force: true })
  })
})
