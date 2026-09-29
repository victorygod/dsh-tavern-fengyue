// treasure.mjs — DMG 个人财宝表(2026-09-29 spawn_monster 档案自含批落地):怪出生按 CR 档掷默认钱袋。
// 掉落口径=背包+钱(用户定案):钱直接落怪档 gp/sp/cp(与人物同位),物品历来是 agent 的 gear 面——本件只产钱,
// 不造「掉落包」抽象。表出处:DMG p.133「Individual Treasure」四档——**本地 SRD 语料不收此表**(rules 33 章无
// Treasure,DMG 独立书未入 SRD 5.1),故数据来自外部转写:dungeon-mastertools.github.io 全表勘验;双源互证=
// CR5-10 首行「cp+ep 同行」/17+ 首行「ep+gp 同行」/11-16 第 2 行「ep+gp 同行」三处著名奇行与独立开卷记忆吻合、
// hoard 金行逐行吻合;CR0-4 档三行为转写值(均值≈5 gp/只,与社区公认均值一致)——遇官方 PDF 再校
// (backlog 已挂勘误候选)。货币归一:表产五币,人物卡只认 gp/sp/cp——1ep=5sp、1pp=10gp,换算正本=
// 语料 rules/standard-exchange-rates.md;ep/pp 归一后即弃,不落卡。
import { rollExpr, rnd, err } from './core.mjs'

/** 四档(d100 下界递升,末行到 100)。cell: {dice, times?}——rollExpr 掷骰后乘倍。 */
export const INDIVIDUAL_TREASURE = [
  // CR 0-4
  [
    { min: 1, cp: { dice: '5d6' } },
    { min: 31, sp: { dice: '4d6' } },
    { min: 61, ep: { dice: '3d6' } },
    { min: 71, gp: { dice: '3d6' } },
    { min: 96, pp: { dice: '1d6' } },
  ],
  // CR 5-10
  [
    { min: 1, cp: { dice: '4d6', times: 100 }, ep: { dice: '1d6', times: 10 } },
    { min: 31, sp: { dice: '6d6', times: 10 }, gp: { dice: '2d6', times: 10 } },
    { min: 61, ep: { dice: '1d6', times: 100 }, gp: { dice: '2d6', times: 10 } },
    { min: 71, gp: { dice: '4d6', times: 10 } },
    { min: 96, gp: { dice: '2d6', times: 10 }, pp: { dice: '3d6' } },
  ],
  // CR 11-16
  [
    { min: 1, sp: { dice: '4d6', times: 100 }, gp: { dice: '1d6', times: 100 } },
    { min: 21, ep: { dice: '1d6', times: 100 }, gp: { dice: '1d6', times: 100 } },
    { min: 36, gp: { dice: '2d6', times: 100 }, pp: { dice: '1d6', times: 10 } },
    { min: 76, gp: { dice: '2d6', times: 100 }, pp: { dice: '2d6', times: 10 } },
  ],
  // CR 17+
  [
    { min: 1, ep: { dice: '2d6', times: 1000 }, gp: { dice: '8d6', times: 100 } },
    { min: 16, gp: { dice: '1d6', times: 1000 }, pp: { dice: '1d6', times: 100 } },
    { min: 56, gp: { dice: '1d6', times: 1000 }, pp: { dice: '2d6', times: 100 } },
  ],
]
const TIER_CN = ['CR 0-4', 'CR 5-10', 'CR 11-16', 'CR 17+']

/**
 * 按 CR 档掷一次个人财宝(d100 单行,RAW)→ 归一三币 {cp,sp,gp}(零值键剔除)。
 * rnd 参数=1..max 掷(与 core.rnd 同约,可 seed);收据带档与 d100 供回执作证。
 */
export function rollTreasure(cr, diceRnd = rnd) {
  const c = Number(cr) || 0
  const tier = c >= 17 ? 3 : c >= 11 ? 2 : c >= 5 ? 1 : 0
  const d100 = diceRnd(100)
  const row = INDIVIDUAL_TREASURE[tier].find(r => d100 >= r.min) ?? err('!财宝表行缺(数据崩溃)')
  const raw = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }
  for (const [coin, cell] of Object.entries(row)) {
    if (coin === 'min') continue
    const r = rollExpr(cell.dice)
    r?.total != null || err(`!财宝骰式不合法:${cell.dice}`)
    raw[coin] += (r.total ?? 0) * (cell.times ?? 1)
  }
  const out = {
    cp: raw.cp,
    sp: raw.sp + raw.ep * 5,          // 1ep=5sp
    gp: raw.gp + raw.pp * 10,         // 1pp=10gp
  }
  const coins = Object.fromEntries(Object.entries(out).filter(([, v]) => v > 0))
  const line = Object.entries(coins).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(' · ') || '(空)'
  return { ...coins, tier: TIER_CN[tier], d100, line }
}