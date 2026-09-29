// test-fixtures.mjs — 数据核注入夹具助手(2026-09-30 批3:回退全拆后,测试 fixture 一律注入数据模块,
// runtime 零 lorebook)。卡内所有 dnd5e spec(packages/engine/tests/dnd5e-*)经 pathToFileURL 动态引本件——
// 与 runTool 引工具同式,卡片测试工具住卡片(script 面),不外溢进引擎包。
// 三个口:
//   injectSpellCore(base, slug, fm)  — 向拷贝件的 lib/spell-core-data.mjs 加法术条目
//   injectMonsterCore(base, slug, entry) — 向拷贝件的 lib/monster-core-data.mjs 加怪物条目
//   monsterArchive(base, slug, o)    — base=preset 目录;读拷贝件 lib/monster-build 产整卡(abilities/attacks 已材料化),o 覆盖
// base=rig 拷贝出的 runtime 兄弟 preset/ 目录。语料=卡根 corpus/(与各 extract 脚本同源)。
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const readDataModule = (file, key) =>
  JSON.parse(readFileSync(file, 'utf8').split(`export const ${key} = `)[1].trim())

const writeDataModule = (file, key, core) =>
  writeFileSync(file, `export const ${key} = ${JSON.stringify(core)}\n`)

export function injectSpellCore(base, slug, fm) {
  const file = join(base, 'lib', 'spell-core-data.mjs')
  const core = readDataModule(file, 'SPELL_CORE')
  core[slug] = { fm, effect: '' }
  writeDataModule(file, 'SPELL_CORE', core)
}

export function injectMonsterCore(base, slug, entry) {
  const file = join(base, 'lib', 'monster-core-data.mjs')
  const core = readDataModule(file, 'MONSTER_CORE')
  core[slug] = entry
  writeDataModule(file, 'MONSTER_CORE', core)
}

/** 读拷贝件 monster-build 产整卡(abilities/attacks 已材料化)。o 覆盖(hp 等钉值用)。 */
export async function monsterArchive(base, slug, o = {}) {
  const { buildMonster } = await import(pathToFileURL(join(base, 'lib', 'monster-build.mjs')).href)
  return { ...buildMonster(`monsters/${slug}.md`), ...o }
}