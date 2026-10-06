// combat-ai.mjs — 自动战斗行动选择策略(dnd5e-combat)。独立成模块,与结算内核(combat-engine)分离:
// 只决定「这一回合这个单位做什么、打谁」,不碰数值结算。策略:
//   ① 治疗优先:施法者有治疗法术、且我方有人伤重(hp < 50% 上限)→ 治最低血队友(濒死玩家也拉)。
//   ② 攻击目标:玩家方聚焦最低血敌人(减员优先);敌方随机分散火力(不集火,更像真实散兵)。
//   ③ 伤害最大化:敌人≥2 时优先放 AoE/多弹法术(范围全打/多弹各打),否则单目标;攻击/施法各半随机。
import { rnd } from './core.mjs'
import { isDead, listHealSpells, listCombatSpells, listAttacks } from './combat-engine.mjs'

const HEAL_THRESHOLD = 0.5

const lowestHp = (names, roster) => [...names].sort((a, b) => (roster[a].j.hp ?? 0) - (roster[b].j.hp ?? 0))[0]

/**
 * 为一名单位选行动。ctx = { roster, actor, sideMap, allies, enemies }。
 * @returns {{type:'heal'|'spell'|'attack'|'none', spell?:object, atk?:object, targets:string[]}}
 */
export function chooseAction(ctx) {
  const { roster, actor, sideMap, allies, enemies } = ctx
  const allNames = [...new Set([...allies, ...enemies])]
  const mySide = sideMap[actor]
  const myAlive = allNames.filter(n => sideMap[n] === mySide && !isDead(roster[n].j))
  const oppAlive = allNames.filter(n => sideMap[n] !== mySide && !isDead(roster[n].j))

  // ① 治疗:我方有人伤重(hp<50%)且有治疗法术 → 治最低血队友
  const heals = listHealSpells(roster, actor)
  const hurt = myAlive.filter(n => (roster[n].j.hp ?? 0) < (roster[n].j.hp_max ?? 0) * HEAL_THRESHOLD)
  if (heals.length && hurt.length) {
    return { type: 'heal', spell: heals[rnd(heals.length) - 1], targets: [lowestHp(hurt, roster)] }
  }

  const attacks = listAttacks(roster, actor)
  const spells = listCombatSpells(roster, actor)
  const useSpell = spells.length && (attacks.length === 0 || rnd(2) === 1)

  if (useSpell) {
    // 伤害最大化:敌人≥2 时优先 AoE/多弹(总伤更高)
    const multi = spells.filter(s => s.aoe || s.bolts > 1)
    if (multi.length && oppAlive.length >= 2) {
      const sp = multi[rnd(multi.length) - 1]
      const sorted = [...oppAlive].sort((a, b) => (roster[a].j.hp ?? 0) - (roster[b].j.hp ?? 0))
      const targets = sp.bolts > 1
        ? Array.from({ length: sp.bolts }, (_, i) => sorted[i % sorted.length])   // 多弹:最低血顺序重复填充
        : oppAlive                                                               // AoE:范围全打
      return { type: 'spell', spell: sp, targets }
    }
    // 单目标法术:玩家方聚焦最低血 / 敌方随机
    const sp = spells[rnd(spells.length) - 1]
    const t = mySide === 'ally' ? lowestHp(oppAlive, roster) : oppAlive[rnd(oppAlive.length) - 1]
    return { type: 'spell', spell: sp, targets: [t] }
  }

  if (attacks.length) {
    const t = mySide === 'ally' ? lowestHp(oppAlive, roster) : oppAlive[rnd(oppAlive.length) - 1]
    return { type: 'attack', atk: attacks[rnd(attacks.length) - 1], targets: [t] }
  }
  return { type: 'none' }
}
