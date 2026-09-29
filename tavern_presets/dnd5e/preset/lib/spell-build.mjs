// spell-build.mjs — 法术档案自含材料化(2026-09-30 第二批):spawn/opening/front_commit 把角色会/备的
// 每条法术按 SPELL_CORE 展开成 spell_details([{name, level, effect}])——注入卡自含,LLM 零 lorebook 语义依赖。
// SPELL_CORE 断档(fixture 法术)→fm 兜底读 md,effect 留空(测试语料无义可载)。
import { SPELL_CORE } from './spell-core-data.mjs'
const slugOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')

/** names(法术英文名混 slug)→ [{name, level, effect}]——重复名去重(同术双表读写一侧)。 */
export function materializeSpellDetails(names) {
  const out = []
  const seen = new Set()
  for (const raw of names ?? []) {
    const n = String(raw).trim()
    if (!n) continue
    const slug = slugOf(n)
    if (seen.has(slug)) continue
    seen.add(slug)
    const core = SPELL_CORE[slug]
    out.push({ name: core?.fm?.name ?? n, level: core?.fm?.level ?? 0, effect: core?.effect ?? '' })
  }
  return out
}