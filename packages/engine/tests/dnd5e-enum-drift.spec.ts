// dnd5e 枚举漂移钉(2026-09-30 枚举政策批):schema 级枚举=死规则/语料单源——
// 重复字面量对写(stance ×2)、glossary-cn 正典单源(伤害类型 13)、闭域闭环(rest kind/role)。
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
  it('rest kind 闭域枚举闭环', () => {
    expect(schemaOf('rest').parameters.kind.enum).toEqual(['short', 'long'])
  })
})
