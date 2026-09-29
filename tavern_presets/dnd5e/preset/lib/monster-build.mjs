// monster-build.mjs — statblock 怪物构造(纯数据版,2026-09-30 批3:MONSTER_CORE 快照单源,
// 零 fs 零 lorebook 零回退;语料=卡根 corpus/(extract-monster-core.mjs 重抽))。
// 职责:monster-core-data 的核心面 + 攻击/能力材料化(MONSTER_ATTACKS/RIDERS/STATUS_RIDERS/ABILITIES
// 按 kind 前缀 join 进档案馆键)——spawn_monster 自动填全靠本件;查无快照即抛(spawn 收口)。
import { MONSTER_CORE } from './monster-core-data.mjs'
import { MONSTER_ATTACKS } from './monster-attack-data.mjs'
import { ABILITIES, RIDERS, STATUS_RIDERS } from './monster-ability-data.mjs'

const slugOf = (s) => String(s).toLowerCase().replace(/\.[a-z]+$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** 攻击/能力材料化(抽取表按 kind 前缀 join,键去前缀即档案馆键)。 */
function materialize(slug) {
  const attacks = {}
  const abilities = {}
  for (const [k, rec] of Object.entries(MONSTER_ATTACKS)) {
    const pre = k.slice(0, k.indexOf('/')), atk = k.slice(k.indexOf('/') + 1)
    if (pre !== slug) continue
    attacks[atk] = { ...rec, ...(RIDERS[k] ? { riders: RIDERS[k] } : {}), ...(STATUS_RIDERS[k] ? { status_rider: STATUS_RIDERS[k] } : {}) }
  }
  for (const [k, rec] of Object.entries(ABILITIES)) {
    const pre = k.slice(0, k.indexOf('/')), ab = k.slice(k.indexOf('/') + 1)
    if (pre === slug) abilities[ab.replace(/-+$/, '')] = rec
  }
  return { attacks, abilities }
}

/** `${from}`(如 monsters/kobold.md)→ 怪物面板面(用于 spawn_monster 自动填)。
 *  纯数据:MONSTER_CORE 快照(零 fs 零回退);查无快照即抛(spawn 收口)。 */
export function buildMonster(from) {
  const slug = slugOf(String(from).replace(/^monsters\//i, ''))
  const core = MONSTER_CORE[slug]
  if (!core) throw new Error(`!查无 statblock:${from}(语料快照缺——重跑 extract-monster-core.mjs)`)
  return {
    ...core,
    kind: slug,
    hp_max: core.hp,
    hp_roll: core.hp_roll ?? null,
    darkvision: core.darkvision ?? null,
    languages: core.languages ?? [],
    save_prof: core.save_prof ?? [],
    skill_prof: core.skill_prof ?? [],
    features: core.features ?? [],
    ...materialize(slug),
  }
}