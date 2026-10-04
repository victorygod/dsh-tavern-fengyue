/** @tavern-schema
{
  "description": "状态区更新器——叙事可变的「状态四件」单源落档器：statuses 数组=在施状态全量列表(每条=状态名+applied_at,条目 effect/mods/on_use/临时抗免 机械按名自动匹配,替换式未列即摘除)+ exhaustion 力竭级(0..6)+ spells_prepared 已备法术(准备制职业全量替换,长休换备走此键)。role(companion/npc)=入队/离队翻转也在此。什么情况调:刻画中施加/解除状态、长休换备已备法术(玩家需先停下问)、行军力竭、入队/离队 role 翻转。生成面(persona/abilities/race/熟练/特征/抗免)与结算面(hp/钱款/经验/法术位)不在可写之列——传了报错点名归属。回执返回逐键变化+改后整卡 JSON。",
  "agents": ["main"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "target": { "type": "string", "required": true, "description": "角色名——玩家名也通(玩家名解析到 player.json)。" },
    "statuses": { "type": "array", "items": { "type": "object", "additionalProperties": false, "properties": { "status": { "type": "string", "enum": ["blinded","charmed","deafened","exhaustion","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious","Bless","Bane","Shield of Faith","Haste","Divine Favor","Branding Smite","False Life","Sleep","Color Spray","Power Word Stun","Power Word Kill","Divine Word","Animal Friendship","Banishment","Blindness/Deafness","Calm Emotions","Charm Person","Command","Compulsion","Confusion","Dominate Beast","Dominate Person","Entangle","Enthrall","Fear","Faerie Fire","Flesh to Stone","Grease","Hideous Laughter","Hold Person","Hold Monster","Hypnotic Pattern","Irresistible Dance","Levitate","Mass Suggestion","Modify Memory","Planar Binding","Polymorph","Resilient Sphere","Scrying","Slow","Suggestion","Shield","Hunter's Mark","Warding Bond","Resistance","Guidance","Longstrider","Heroism","Beacon of Hope","Death Ward","临时生命","Rage","Bardic Inspiration"], "description": "状态名——枚举=临时状态名录(内核 schema 硬闸+工具代码双闸)。" }, "applied_at": { "type": "string", "description": "施加时间——你按当前叙事时间手写('第 3 日 9 时 30 分'/'第 2 轮',对齐「当前时间」行精到分)。" }, "temp": { "type": "integer", "description": "仅「临时生命」条目携带——缓冲池数额(结算归 hp_change)。" } } }, "description": "在施状态全量列表(替换式:所列=保留/新施,未列=摘除——无 remove 参数)。每条=状态名+applied_at;条目其余字段(effect/mods/on_use)机械按名自动匹配——条件/职业态文案单源=lib/status.mjs,法术条=spell-data 的 buff/pool/onFail,LLM 不手写效果文本与机械修正;temp 仅临时生命条目带。到期摘除=下次列表不带该条(时间对账在维护面)。" },
    "exhaustion": { "type": "integer", "description": "力竭级 0..6(6=死)——强制行军/绝食等叙事级 +1 在此落;恢复走 rest 长休(工具自动 -1)。" },
    "spells_prepared": { "type": "array", "items": { "type": "string" }, "description": "已准备法术全量替换(准备制职业出生为空,长休换备走此键;施法池=known∪prepared 同入收录闸)——无枚举;另禁 0 环(戏法归 spells_known);空表=清空。任一法术键变更 spell_details 自动重铺。" },
    "role": { "type": "string", "enum": ["companion", "npc"], "description": "档案位(枚举即名录)——入队/离队翻转;state.md「附近 NPC」行改标仍归维护代理(回执提醒)。错值内核硬拦。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { resolveTarget, deriveAC, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { STATUS_KEYS, STATUS_TEXT } = await import(pathToFileURL(process.cwd() + '/../preset/lib/status.mjs').href)
const { SPELL_DATA } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-data.mjs').href)
const { SPELL_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-core-data.mjs').href)
const { materializeSpellDetails, spellsCheck } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-build.mjs').href)
const a = globalThis.argv ?? {}

a.context?.trim() || err('缺必填 context')
a.target || err('缺必填 target')

// 属分面裁决:非状态区字段点名所属(直接编辑=越区)——任一传入即拒,特殊修档=维护代理 runtimeEdit 兜底。
const DENY = new Map([
  ['name', '建档主键——连文件名/state.md 行全链,归维护代理手工'],
  ['description', '现况一句走 update_memory'], ['thought', '当前想法走 update_memory'], ['history', '履历走 update_memory(history_append 只增)'],
  ['weapons', '武器走 update_inventory'], ['gear', '随身物品走 update_inventory'], ['armor', '护甲走 update_inventory'], ['shield', '持盾走 update_inventory'],
  ['languages', '语言=建档面/维护代理(runtimeEdit 兜底)——本工具不收'],
  ['spells_known', '已知法术=建档/前端(front_commit 学法术)/维护——本工具不收(换备只传 spells_prepared)'],
  ['pending', '待办=成长面(gain_exp 挂/前端消费)'],
  ['gp', '钱款走 gain_money'], ['sp', '钱款走 gain_money'], ['cp', '钱款走 gain_money'],
  ['hp', '伤害/治疗走 hp_change'], ['hp_max', '写入口=成长/升级链'], ['temp_hp', '临时生命走 hp_change'],
  ['death_success', '濒死计数走 death'], ['death_fail', '濒死计数走 death'],
  ['concentrating', '专注走 cast/dropConcentration 链'],
  ['status', '已并档——在施状态传 statuses 数组(每条=状态名+applied_at)'],
  ['applied_at', '条目自带字段——随 statuses 数组落,不单传'], ['effect', '条目自带字段——机械按名自动匹配,不手写'],
  ['on_use', '条目自带字段——机械按名自动匹配'], ['mods', '条目自带字段——机械按名自动匹配(status.mjs/spell-data 单源)'],
  ['remove', '已退役——statuses 全量替换:未列即摘除'],
  ['abilities', '六维=成长面(ASI 点选/pending 消费链)'], ['race', '建档面(spawn)'], ['gender', '建档面(spawn——avatar 用)'],
  ['persona', '人设=建档生成面/维护代理'],
  ['save_prof', '熟练六件=建档面'], ['skill_prof', '熟练六件=建档面'], ['expertise', '熟练六件=建档面'],
  ['armor_prof', '熟练六件=建档面'], ['weapon_prof', '熟练六件=建档面'], ['tool_prof', '熟练六件=建档面'],
  ['features', '特征=职业行'], ['feature_details', '特征=职业行'],
  ['resist', '持久抗免=建档面(临时抗性走 statuses)'], ['vulnerabilities', '持久抗免=建档面(临时易伤走 statuses)'], ['immune', '持久抗免=建档面(临时免疫走 statuses)'],
  ['level', '成长走 gain_exp'], ['exp', '经验走 gain_exp'], ['hd_available', '成长档面归 spawn/长休 rest'],
])
for (let i = 1; i <= 9; i++) DENY.set(`slots_l${i}`, '法术位消耗与恢复走 cast/rest')

// 可更新键白名单(=schema 平铺参数)——名单外的具名参数一律点名
const ALLOW = new Set(['context', 'target', 'statuses', 'exhaustion', 'spells_prepared', 'role'])

for (const k of Object.keys(a ?? {})) {
  if (ALLOW.has(k)) continue
  DENY.has(k) ? err(`${k} 不走状态区——${DENY.get(k)}`) : err(`不认识的参数:${k}——可更新键 ${[...ALLOW].filter(x => x !== 'context' && x !== 'target').join(' / ')}`)
}
Object.keys(a).some(k => !['context', 'target'].includes(k)) || err('未传任何可更新键——statuses/exhaustion/spells_prepared/role 至少传一项')

const tg = resolveTarget(a.target) || err(`查无目标:${a.target}——建档走 spawn(怪 spawn_monster/有职业者 spawn_npc)`)
const j = tg.j
const before = deriveAC(j)
const lines = []            // 回执逐键行
let verb = '更新', statusTouched = false

// ── statuses 全量替换(数组入参:每条=状态名+applied_at;条目其余字段机械按名匹配;未列=摘除,无 remove) ──
// 机械字段单源:条件/职业态文案=STATUS_TEXT;法术条=名(SPELL_CORE fm.name)→slug→spell-data 检索
// (buff/pool/onFail 的 effect/mods)——LLM 只报名+时间,效果文本与机械修正零手抄。
const spellByName = new Map(Object.entries(SPELL_CORE).filter(([, c]) => c.fm?.name).map(([slug, c]) => [c.fm.name, slug]))
const statusMech = (name) => {
  const txt = STATUS_TEXT[name]
  if (txt !== undefined) return typeof txt === 'string' ? { effect: txt } : { ...txt }
  const sp = SPELL_DATA[spellByName.get(name) ?? '']
  const t = sp?.buff ?? sp?.pool ?? sp?.onFail ?? null
  return t ? { effect: t.effect, ...(t.mods ? { mods: t.mods } : {}) } : null
}
if (a.statuses !== undefined) {
  a.statuses === null && err('statuses 传 null 无意义——数组(全量在施列表)或空数组(全摘)')
  Array.isArray(a.statuses) || err('statuses 须为状态数组([{status, applied_at}])——在施全量列表,未列即摘除')
  const st = {}
  for (const item of a.statuses) {
    (typeof item === 'object' && !Array.isArray(item)) || err('statuses 每条须为对象 {status, applied_at}')
    const name = String(item.status ?? '').trim()
    STATUS_KEYS.has(name) || err(`status 不在临时状态枚举:${name}——合法键 ${[...STATUS_KEYS].join(' / ')}`)
    const at = String(item.applied_at ?? '').trim()
    at || err(`状态「${name}」须带 applied_at(施加时游戏时间,你手写)`)
    item.temp !== undefined && name !== '临时生命' && err(`temp 仅「临时生命」条目携带(数额结算归 hp_change):${name}`)
    const mech = statusMech(name) ?? {}
    st[name] = {
      applied_at: at,
      ...(mech.effect ? { effect: mech.effect } : {}),
      ...(mech.mods ? { mods: mech.mods } : {}),
      ...(mech.on_use ? { on_use: mech.on_use } : {}),
      ...(Array.isArray(mech.resist) && mech.resist.length ? { resist: mech.resist } : {}),     // 临时抗性(Rage 等职业态)
      ...(Array.isArray(mech.immune) && mech.immune.length ? { immune: mech.immune } : {}),     // 临时免疫
      ...(item.temp !== undefined ? { temp: +item.temp } : {}),
    }
  }
  const beforeN = Object.keys(j.statuses ?? {}).length
  const dropped = Object.keys(j.statuses ?? {}).filter(k => !(k in st))
  const added = Object.keys(st).filter(k => j.statuses?.[k] === undefined)
  j.statuses = st
  statusTouched = true
  verb = added.length ? '施加' : dropped.length ? '摘除' : '更新'
  lines.push(`statuses: ${beforeN}→${Object.keys(st).length} 条${dropped.length ? ` · 摘除 ${dropped.join(' / ')}` : ''}${added.length ? ` · 新施 ${added.join(' / ')}` : ''}`)
}

// role(入队/离队翻转;行改标归维护代理——双处判据由回执提醒缝合)
if (a.role !== undefined) {
  a.role === null && err('role 传 null 无意义——companion / npc')
  a.role === 'companion' || a.role === 'npc' || err(`role 不合法:${a.role}——companion / npc`)
  const old = j.role
  j.role = a.role
  lines.push(`role: ${old ?? '(缺)'}→${j.role} ◇ 「附近 NPC」行改标/队列双写仍归维护代理`)
}
// exhaustion(0..6;恢复归 rest 长休)
if (a.exhaustion !== undefined && a.exhaustion !== null) {
  Number.isInteger(a.exhaustion) && a.exhaustion >= 0 && a.exhaustion <= 6 || err(`exhaustion 须 0..6 整型,得 ${a.exhaustion}`)
  const old = j.exhaustion ?? 0
  j.exhaustion = a.exhaustion
  lines.push(`exhaustion: ${old}→${j.exhaustion}`)
}

// ── spells_prepared(全量替换;三检=存在/本职业表/环位≤当前可施,禁 0 环;spell_details 任一变更重铺) ──
if (a.spells_prepared !== undefined && a.spells_prepared !== null) {
  j.caster_attr != null || err('无施法能力(该角色无施法族)——spells_prepared 不收')
  const cls = String(j.class ?? '').toLowerCase()
  const maxSlot = Math.max(0, ...Array.from({ length: 9 }, (_, i) => (+j[`slots_l${i + 1}`] > 0 ? i + 1 : 0)))
  const oldP = Array.isArray(j.spells_prepared) ? j.spells_prepared.length : 0
  Array.isArray(a.spells_prepared) || err('spells_prepared 须为法术英文名数组(全量替换;空表=清空;改后整卡在回执可对照)')
  spellsCheck(a.spells_prepared, cls, maxSlot, err, 'spells_prepared', j.level)
  const prep = a.spells_prepared.map(s => String(s).trim()).filter(Boolean)
  prep.length ? j.spells_prepared = prep : delete j.spells_prepared
  const known = Array.isArray(j.spells_known) ? j.spells_known : []
  const details = materializeSpellDetails([...known, ...prep])
  details.length ? j.spell_details = details : delete j.spell_details
  lines.push(`法术: 三检通过 · prepared ${oldP}→${prep.length}条 · spell_details 重铺(${details.length}条)`)
}

lines.length || err('未传任何可更新键——statuses/exhaustion/spells_prepared/role 至少传一项')

saveChar(tg.file, j)
const after = deriveAC(j)
console.log(`[状态区 · ${a.target} · ${verb}]`)
for (const l of lines) console.log(`  ${l}`)
if (statusTouched) console.log(`  完整状态: ${JSON.stringify(j.statuses)}`)
before !== after && console.log(`  AC: ${before}→${after}`)
// 人物卡回执=改后整卡(维护代理可接力,注入面板即现值,无需再 runtimeRead)
console.log(`### ${j.name ?? a.target}（${j.role ?? '—'}）`)
console.log(JSON.stringify(j, null, 1))
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)