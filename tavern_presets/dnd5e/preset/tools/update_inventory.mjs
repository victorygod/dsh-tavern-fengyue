/** @tavern-schema
{
  "description": "非战斗背包更新器——叙事可变的「随身之物」单源落档器（战斗战利品的装备已由 combat 工具自动归主角，勿走此）：weapons 武器名全量替换 + gear 随身物品全量替换 + armor 护甲名(标量) + shield 持盾/弃盾翻转。什么情况调:拾取/缴获/买/卖/遗失/丢弃/转赠/换装——背包律:战斗用物/消耗品/任务道具必须在 weapons/gear 行上才能被使用/交付,不在行上=身上没带。护甲变更 AC 回执自动前后上报,并触发换装律(persona.appearance 穿搭段同拍更新,归维护代理)。钱款(gp/sp/cp)走 gain_money,不在此。回执返回逐键变化+改后整卡 JSON。",
  "agents": ["main"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "target": { "type": "string", "required": true, "description": "角色名——玩家名也通(玩家名解析到 player.json)。" },
    "weapons": { "type": "array", "items": { "type": "string" }, "description": "面板武器名全量替换(拾取/丢失/缴获在此;攻击招式走 attack 工具)。" },
    "gear": { "type": "array", "items": { "type": "string" }, "description": "随身物品全量替换——战利品入包/遗失在此落。" },
    "armor": { "type": "string", "description": "护甲名——换装/缴获;AC 回执前后变化自动上报;变更触发换装律(persona.appearance 穿搭段同拍更新,归维护代理)。" },
    "shield": { "type": "boolean", "description": "持盾/弃盾翻转(true=持盾,false=弃盾)——AC 回执前后变化自动上报。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { resolveTarget, deriveAC, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}

a.context?.trim() || err('缺必填 context')
a.target || err('缺必填 target')

// 属分面裁决:非背包区字段点名所属(直接编辑=越区)——任一传入即拒,特殊修档=维护代理 runtimeEdit 兜底。
const DENY = new Map([
  ['gp', '钱款走 gain_money'], ['sp', '钱款走 gain_money'], ['cp', '钱款走 gain_money'],
  ['statuses', '状态由战斗/成长自动管理——本工具不收'], ['exhaustion', '力竭归维护代理——本工具不收'], ['role', '入队/离队翻转归建档面/维护代理'],
  ['spells_prepared', '已备法术=施法面(战斗内)——本工具不收'], ['spells_known', '已知法术=建档/前端——本工具不收'],
  ['history', '履历走 mvu 块 memory'], ['description', '现况一句走 mvu 块 memory'], ['thought', '当前想法走 mvu 块 memory'],
  ['languages', '语言=建档面/维护代理(runtimeEdit 兜底)——本工具不收'],
  ['persona', '人设七键=建档生成面/维护代理(换装律同拍)'],
  ['abilities', '六维=成长面(前端点/NPC 自动)'], ['features', '特征=职业行'], ['pending', '待办=成长面(前端消费)'],
  ['hp', '生命值由战斗/成长自动管理——本工具不收'], ['hp_max', '写入口=成长/升级链'], ['temp_hp', '临时生命由战斗/成长自动管理——本工具不收'],
])

// 可更新键白名单(=schema 平铺参数)——名单外的具名参数一律点名
const ALLOW = new Set(['context', 'target', 'weapons', 'gear', 'armor', 'shield'])

for (const k of Object.keys(a ?? {})) {
  if (ALLOW.has(k)) continue
  DENY.has(k) ? err(`${k} 不走背包区——${DENY.get(k)}`) : err(`不认识的参数:${k}——可更新键 ${[...ALLOW].filter(x => x !== 'context' && x !== 'target').join(' / ')}`)
}
Object.keys(a).some(k => !['context', 'target'].includes(k)) || err('未传任何可更新键——weapons/gear/armor/shield 至少传一项')

const tg = resolveTarget(a.target) || err(`查无目标:${a.target}——建档走 spawn(怪 spawn_monster/有职业者 spawn_npc)`)
const j = tg.j
const before = deriveAC(j)
const lines = []            // 回执逐键行

// 标量 null=删键;数组全量替换、空=删键(出生 stripEmptyArrays 同律)
const scalar = (k) => {
  if (a[k] === undefined) return
  const old = j[k]
  if (a[k] === null) { delete j[k]; lines.push(`${k}: ${old ?? '(缺)'}→删键`); return }
  j[k] = a[k]
  lines.push(`${k}: ${old === undefined ? '(缺)' : old}→${a[k]}`)
}
const list = (k) => {
  if (a[k] === undefined) return
  if (a[k] === null) { delete j[k]; lines.push(`${k}: 删键(还原缺省)`); return }
  Array.isArray(a[k]) || err(`${k} 须为字符串数组`)
  const arr = a[k].map(x => String(x).trim()).filter(Boolean)
  const oldN = Array.isArray(j[k]) ? j[k].length : 0
  if (arr.length) { j[k] = arr; lines.push(`${k}: ${oldN}条→${arr.length}条`) }
  else { delete j[k]; lines.push(`${k}: ${oldN}条→清空(删键)`) }
}

list('weapons'); list('gear'); scalar('armor'); scalar('shield')

lines.length || err('未传任何可更新键——weapons/gear/armor/shield 至少传一项')

saveChar(tg.file, j)
const after = deriveAC(j)
console.log(`[背包区 · ${a.target}]`)
for (const l of lines) console.log(`  ${l}`)
before !== after && console.log(`  AC: ${before}→${after}`)
if (a.armor !== undefined && a.armor !== null && a.armor !== '') console.log(`  ◇ 换装律: armor 变更——persona.appearance 穿搭段同拍更新,归维护代理`)
// 人物卡回执=改后整卡(维护代理可接力,注入面板即现值,无需再 runtimeRead)
console.log(`### ${j.name ?? a.target}（${j.role ?? '—'}）`)
console.log(JSON.stringify(j, null, 1))
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)