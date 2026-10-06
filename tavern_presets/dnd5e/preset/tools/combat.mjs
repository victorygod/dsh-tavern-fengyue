/** @tavern-schema
{
  "description": "战斗结算器——一切战斗必经本工具(v1 全自动):点名交战双方→无档敌方按怪种当场建档→按先攻自动互丢攻击/战斗法术→战报回执。何时调:敌意显现、接战触发即调,一次调用走完一场。日常叙事不碰任何战斗数值;我方默认=玩家+附近「同伴」,敌方点名(怪种如 goblin 当场建档、已在册者只传名)。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。" },
    "allies": { "type": "array", "items": { "type": "string" }, "description": "我方名单。默认=玩家+附近「同伴」(presence 读);可显式覆盖。" },
    "enemies": { "type": "array", "items": { "type": "string" }, "description": "敌方名单——每项=怪物种类(如 goblin、wolf、adult-red-dragon)或已在册角色名;同种多只就列多次(如 'goblin,goblin,goblin')。工具自动分辨:在册名直用,否则按怪种当场建档。" },
    "terrain": { "type": "string", "description": "战场风味(只进战报叙事,不参与机制——v1 忽略占位/移动)。" }
  }
}
*/
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { rnd, rollExpr, findCharFile, saveChar, presence, presenceAdd, stripEmptyArrays, xpOf, slotsFor, equipmentFM, WEAPON_SLUG, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { buildMonster } = await import(pathToFileURL(process.cwd() + '/../preset/lib/monster-build.mjs').href)
const { rollTreasure } = await import(pathToFileURL(process.cwd() + '/../preset/lib/treasure.mjs').href)
const { applyExp } = await import(pathToFileURL(process.cwd() + '/../preset/lib/mvu-apply.mjs').href)
const { resolveAttack, resolveSpell, resolveDeathSave, rollInitiative, isDead } = await import(pathToFileURL(process.cwd() + '/../preset/lib/combat-engine.mjs').href)
const { chooseAction } = await import(pathToFileURL(process.cwd() + '/../preset/lib/combat-ai.mjs').href)
const a = globalThis.argv ?? {}

a.context?.trim() || err('缺必填 context(剧情梗概——反作弊铁则)')
Array.isArray(a.enemies) && a.enemies.length || err('缺必填 enemies(敌方名单)')

const readJ = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } }
const STEM = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
// 战利品武器掉落(与 spawn_monster 同律):档案 attacks 键中「武器类」(equipmentFM 查得到 weapon 字段)
// 自动入 gear 默认掉落——天生武器(咬/爪/尾击)查无=不落。
const weaponDrops = (attacks) => Object.keys(attacks ?? {}).flatMap((key) => {
  const fm = equipmentFM(key)
  if (!fm?.weapon) return []
  const cn = Object.entries(WEAPON_SLUG).find(([, s]) => s === key)?.[0]
  return [cn ?? fm.name]
})

// ── 我方名单(默认=玩家+附近同伴) ──
const allies = Array.isArray(a.allies) && a.allies.length ? a.allies.map(s => String(s).trim()).filter(Boolean) : ['玩家', ...presence().mates.map(m => m.name)]

// ── 敌方名单(字符串数组:怪种优先建档/否则在册名直读) ──
const enemies = []
const kindIdx = new Map()   // 怪种 → 已出现次数(同种多只天干编号)
for (const e of a.enemies) {
  const raw = String(e).trim()
  if (!raw) continue
  let m = null
  try { m = buildMonster(`monsters/${raw}.md`) } catch { m = null }
  if (m) {   // 怪种(英文 slug)——能建档就建档,与在册同名不冲突
    const i = (kindIdx.get(raw) ?? 0) + 1
    kindIdx.set(raw, i)
    const n = i === 1 ? raw : `${raw}${STEM[i - 2]}`
    const hp = m.hp_roll ? Math.max(1, (rollExpr(m.hp_roll) || err(`!hp_roll 骰式不合法:${m.hp_roll}`)).total) : m.hp
    const coins = rollTreasure(m.cr)
    const baseGear = [...new Set(weaponDrops(m.attacks))]
    const j = stripEmptyArrays({
      name: n, role: 'npc', monster_kind: m.kind, level: m.cr, ac: m.ac, hp, hp_max: hp,
      str: m.str, dex: m.dex, con: m.con, int: m.int, wis: m.wis, cha: m.cha,
      save_prof: m.save_prof, skill_prof: m.skill_prof, resist: m.resist, immune: m.immune,
      ...(m.vuln.length ? { vulnerabilities: m.vuln } : {}), speed: m.speed,
      ...(m.darkvision != null ? { darkvision: m.darkvision } : {}),
      ...(m.languages.length ? { languages: m.languages } : {}),
      ...(m.description ? { description: m.description } : {}),
      ...(m.features.length ? { features: m.features } : {}),
      ...(Object.keys(m.attacks).length ? { attacks: m.attacks } : {}),
      ...(Object.keys(m.abilities).length ? { abilities: m.abilities } : {}),
      ...(baseGear.length ? { gear: baseGear } : {}),
      statuses: {},
      ...(coins.gp ? { gp: coins.gp } : {}), ...(coins.sp ? { sp: coins.sp } : {}), ...(coins.cp ? { cp: coins.cp } : {}),
    })
    saveChar(`characters/${n}.json`, j)
    presenceAdd(n, '敌对')
    enemies.push(n)
  } else if (findCharFile(raw)) {   // 在册角色名
    enemies.push(raw)
  } else {
    err(`!敌方无法识别:${raw}——非怪种(英文 slug)也非在册角色名`)
  }
}

// ── roster 全量入内存(战斗中唯一真相,结束统一落盘) ──
const roster = {}
for (const n of [...new Set([...allies, ...enemies])]) {
  const file = findCharFile(n) || err(`!角色不存在:${n}`)
  const j = readJ(file) || err(`!档案损坏:${n}`)
  roster[n] = { j, file }
}
const side = {}
for (const n of allies) side[n] = 'ally'
for (const n of enemies) side[n] = 'enemy'

// ── 先攻 ──
const order = rollInitiative(roster, [...new Set([...allies, ...enemies])])

const sideAlive = (s) => [...new Set([...allies, ...enemies])].some(n => side[n] === s && !isDead(roster[n].j))

const log = []
log.push(`[战斗 · ${a.terrain || '未知地形'} · ${enemies.length} 敌 vs ${allies.length} 我]`)
log.push(`先攻: ${order.map(o => `${o.name}:${o.init}`).join(' > ')}`)

// ── 自动战斗循环 ──
const MAX_ROUNDS = 20
let ended = null
for (let round = 1; round <= MAX_ROUNDS; round++) {
  log.push(`— 第 ${round} 轮 —`)
  for (const p of order) {
    const j = roster[p.name].j
    if (isDead(j)) continue
    // 玩家 0HP 濒死豁免(回合开始,仅未稳定/未死)
    if (j.role === 'pc' && (j.hp ?? 0) === 0 && (j.death_success ?? 0) < 3 && (j.death_fail ?? 0) < 3) {
      try { const ds = resolveDeathSave(roster, p.name); log.push(...ds.lines); if (ds.dead) { ended = '玩家死亡(终局)'; break } } catch (e) { log.push(`  ⚠ ${e.message}`) }
      continue
    }
    // 目标池:对立侧存活者(结束判定用)
    const opp = side[p.name] === 'ally' ? 'enemy' : 'ally'
    if (![...new Set([...allies, ...enemies])].some(n => side[n] === opp && !isDead(roster[n].j))) { ended = opp === 'enemy' ? '全歼敌' : '我方全灭'; break }
    // 行动选择(AI 模块):治疗优先 / AoE 多目标 / 玩家方聚焦 / 敌方随机
    try {
      const act = chooseAction({ roster, actor: p.name, sideMap: side, allies, enemies })
      if (act.type === 'heal' || act.type === 'spell') {
        const r = resolveSpell(roster, p.name, act.spell.spell, act.targets, { at: `第 ${round} 轮` })
        log.push(...r.lines)
      } else if (act.type === 'attack') {
        const r = resolveAttack(roster, p.name, act.targets[0], { weapon: act.atk.key, at: `第 ${round} 轮` })
        log.push(...r.lines)
      } else {
        log.push(`  ${p.name} 无可行动作(无武器无位)——空过`)
      }
    } catch (e) { log.push(`  ⚠ ${p.name} 行动失败: ${e.message}`) }
  }
  if (ended) break
  if (!sideAlive('enemy')) { ended = '全歼敌'; break }
  if (!sideAlive('ally')) { ended = '我方全灭'; break }
}
if (!ended) ended = `轮数封顶(${MAX_ROUNDS} 轮)——未分胜负`

// ── 战斗后结算:经验(存活我方均分)+ 战利品汇总 + 战斗收尾(保留战损)+ 落盘 ──
const defeatedEnemies = enemies.filter(n => isDead(roster[n].j))
const totalXp = defeatedEnemies.reduce((s, n) => s + (xpOf(roster[n].j.level) ?? 0), 0)
const aliveAllies = allies.filter(n => !isDead(roster[n].j) && roster[n].j.exp !== undefined)
const perXp = aliveAllies.length ? Math.floor(totalXp / aliveAllies.length) : 0
const xpLines = []
if (perXp > 0) for (const n of aliveAllies) {
  const { ups, leveled } = applyExp(roster[n].j, perXp, 'avg')
  xpLines.push(`${n} +${perXp} XP${leveled ? ` 升级(LV→${roster[n].j.level})` : ''}${leveled && ups.length ? ` · ${ups.join(' · ')}` : ''}`)
}
const loot = []
// 战利品自动归主角(玩家档):钱并入钱包、装备并入 gear;怪身清空(不可重复获取)。玩家已死(终局)则不拾取。
const playerEntry = Object.values(roster).find(r => r.j.role === 'pc')
if (playerEntry && !isDead(playerEntry.j)) {
  for (const n of enemies) {
    const j = roster[n].j
    if (!isDead(j)) continue
    const coins = [['gp', j.gp], ['sp', j.sp], ['cp', j.cp]].filter(([, v]) => Number(v) > 0)
    const gear = Array.isArray(j.gear) ? j.gear.filter(Boolean) : []
    const coinStr = coins.map(([k, v]) => `${k} ${v}`).join(' · ')
    if (coins.length || gear.length) loot.push(`${n}:${coinStr ? ' ' + coinStr : ''}${gear.length ? ' · ' + gear.join('、') : ''}`)
    for (const [k, v] of coins) { playerEntry.j[k] = (playerEntry.j[k] ?? 0) + v; j[k] = 0 }
    if (gear.length) { playerEntry.j.gear = [...(Array.isArray(playerEntry.j.gear) ? playerEntry.j.gear : []), ...gear]; j.gear = [] }
  }
}
// 战斗收尾(不再自动回满——HP/环位保留战损,恢复走 rest 工具):仅清濒死计数/专注/临时生命
for (const n of allies) {
  const j = roster[n].j
  if (isDead(j)) continue
  j.death_success = 0; j.death_fail = 0
  j.concentrating = null
  j.temp_hp = 0
  const st = {}
  for (const [k, v] of Object.entries(j.statuses ?? {})) if (!(v?.temp)) st[k] = v
  j.statuses = st
}
for (const [, r] of Object.entries(roster)) { try { saveChar(r.file, r.j) } catch (e) { log.push(`  ⚠ 落盘失败 ${r.file}: ${e.message}`) } }

// ── 战报(全量,不截断——引擎 stdout 闸已放宽,见 packages/engine/src/tools.ts TOOL_OUTPUT_CAP) ──
const tail = [
  '',
  `—— 战果 ——`,
  `胜负: ${ended}`,
  `幸存: ${[...new Set([...allies, ...enemies])].filter(n => !isDead(roster[n].j)).map(n => `${n}(hp ${roster[n].j.hp}/${roster[n].j.hp_max ?? '?'})`).join(' · ') || '无'}`,
  ...(xpLines.length ? [`经验已自动平分: ${xpLines.join(' · ')}`] : []),
  ...(loot.length ? [`战利品已自动归主角(怪身已清空,不可重复获取): ${loot.join(' · ')}`] : []),
  `  ◇ 梗概: ${a.context}`,
  `  ◇ 铁则: 后续剧情必须遵守梗概与结果,不得篡改!`,
]
console.log(log.join('\n') + '\n' + tail.join('\n'))
