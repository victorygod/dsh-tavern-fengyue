// spell-build.mjs — 法术档案自含材料化(2026-09-30 第二批):spawn/opening/front_commit 把角色会/备的
// 每条法术按 SPELL_CORE 展开成 spell_details([{name, level, effect}])——注入卡自含,LLM 零 lorebook 语义依赖。
// SPELL_CORE 断档(fixture 法术)→fm 兜底读 md,effect 留空(测试语料无义可载)。
import { SPELL_CORE } from './spell-core-data.mjs'
// slug 键法与三检一致(撇号先弃再断):Hunter's Mark→hunters-mark / Arcanist's Magic Aura→arcanists-magic-aura 式——
// 旧键法撇号当断点(hunter-s-mark),查无 SPELL_CORE 键,词条降 fallback(level 0/effect 空)。
const slugOf = (s) => String(s).toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-')

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

/** 法术三检单源(存在/本职业表/环位≤可施;prepared 另禁 0 环,0 环归 spells_known)——与 spawn_npc 出生同律。
 * 失败走 err(回执拦);成功静默。label 进报错文案('spells_known'/'spells_prepared');level 仅入超环衬托(可 null)。 */
export function spellsCheck(names, cls, maxSlot, err, label, level = null) {
  for (const s of names) {
    const slug = slugOf(s)
    const fm = SPELL_CORE[slug]?.fm
    fm || err(`!查无法术:${s}(${label})——传法术名录内的英文名`)
    const classes = Array.isArray(fm.classes) ? fm.classes.map(x => String(x).toLowerCase()) : (typeof fm.classes === 'string' ? String(fm.classes).split(',').map(x => x.trim().toLowerCase()) : [])
    classes.includes(cls) || err(`!法术非本职业表:${s}(${cls} 表外)`)
    const slv = +fm.level
    Number.isFinite(slv) || err(`!法术环位非法:${s}`)
    slv <= maxSlot || err(`!法术环位超可施:${s}(${slv} 环${level != null ? ` > ${cls} L${level} 可施 ${maxSlot} 环` : `,可施 ${maxSlot} 环`})`)
    if (label === 'spells_prepared') slv >= 1 || err(`!戏法不入 prepared:${s}(0 环归 spells_known)`)
  }
}