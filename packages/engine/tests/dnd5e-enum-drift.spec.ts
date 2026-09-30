// dnd5e 枚举漂移钉(2026-09-30 枚举政策批):schema 级枚举=死规则/语料单源——
// 重复字面量对写(stance ×2)、glossary-cn 正典单源(languages 16/伤害类型 13)、闭域闭环(rest kind/role)。
// 枚举即名录的核:数据/正本改动漏改 schema 时,本件红(heads-up:漂移=测试兜同步)。
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

const schemaOf = (tool: string) =>
  JSON.parse(/\/\*\*\s*@tavern-schema([\s\S]*?)\*\//.exec(readFileSync(join(CARD, 'tools', `${tool}.mjs`), 'utf8'))![1])

describe('枚举漂移钉(schema=单源/正本)', () => {
  it('stance 字面量×2(spawn_monster/spawn_npc)对写一致——重复枚举核', () => {
    expect(schemaOf('spawn_monster').parameters.stance.enum)
      .toEqual(schemaOf('spawn_npc').parameters.stance.enum)
    expect(schemaOf('spawn_npc').parameters.stance.enum).toEqual(['同伴', '中立', '敌对'])
  })
  it('languages 16 键==glossary-cn LANGUAGE_CN 单源', async () => {
    const { LANGUAGE_CN } = await import(pathToFileURL(join(CARD, 'lib', 'glossary-cn.mjs')).href)
    expect(schemaOf('update_character').parameters.languages.items.enum)
      .toEqual([...Object.keys(LANGUAGE_CN)])
  })
  it('damage type 13 型==glossary-cn DAMAGE_TYPE_CN 单源;数据面(spell-data/EQ_CORE)全在 13 内', async () => {
    const { DAMAGE_TYPE_CN } = await import(pathToFileURL(join(CARD, 'lib', 'glossary-cn.mjs')).href)
    const thirteen = [...Object.keys(DAMAGE_TYPE_CN)]
    expect(thirteen).toHaveLength(13)
    expect(schemaOf('damage').parameters.type.enum).toEqual(thirteen)
    const { SPELL_DATA } = await import(pathToFileURL(join(CARD, 'lib', 'spell-data.mjs')).href)
    const { EQ_CORE } = await import(pathToFileURL(join(CARD, 'lib', 'equip-core-data.mjs')).href)
    const bad: string[] = []
    for (const sp of Object.values(SPELL_DATA)) if (sp.type && !thirteen.includes(String(sp.type))) bad.push(String(sp.type))
    for (const e of Object.values(EQ_CORE)) {
      const t = e.fm?.damage_type
      if (t && !thirteen.includes(String(t).toLowerCase())) bad.push(String(t))   // Title Case 归一比较
    }
    expect(bad).toEqual([])   // 数据面超 13 型=正本漏改,钉先红
  })
  it('rest kind/role 闭域枚举闭环', () => {
    expect(schemaOf('rest').parameters.kind.enum).toEqual(['short', 'long'])
    expect(schemaOf('update_character').parameters.role.enum).toEqual(['companion', 'npc'])
  })
})
