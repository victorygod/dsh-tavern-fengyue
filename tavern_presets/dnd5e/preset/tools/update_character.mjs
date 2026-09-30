/** @tavern-schema
{
  "description": "人物卡更新器——叙事可变字段的单源落档器:statuses 数组=在施状态全量列表(每条=状态名+applied_at,条目 effect/on_use/mods 机械按名自动匹配,替换式未列即摘除),其余平铺参数只改传入项(不传=不改;传 null=删键还原缺省;数组=全量替换)。什么情况调:叙事中的卡片变动——施加/解除状态、换装/弃盾、拾取/缴获装备、学习法术(known)/长休换备(prepared)、行军力竭、入队/离队 role 翻转、事件入 history+description 同拍刷现况。生成面字段(persona/abilities/race/gender/六熟练/特征/抗免)与结算字段(hp/钱款/经验/法术位)不在可写之列——传了报错点名归属(特殊修档=维护代理 runtimeEdit 兜底)。回执返回逐键变化+改后整卡 JSON(维护代理可接力,面板即现值)。",
  "agents": ["main", "tail"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "target": { "type": "string", "required": true, "description": "角色名——玩家名也通(玩家名解析到 player.json)。" },
    "statuses": { "type": "array", "items": { "type": "object", "additionalProperties": false, "properties": { "status": { "type": "string", "enum": ["blinded","charmed","deafened","exhaustion","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious","Bless","Bane","Shield of Faith","Haste","Divine Favor","Branding Smite","False Life","Sleep","Color Spray","Power Word Stun","Power Word Kill","Divine Word","Animal Friendship","Banishment","Blindness/Deafness","Calm Emotions","Charm Person","Command","Compulsion","Confusion","Dominate Beast","Dominate Person","Entangle","Enthrall","Fear","Faerie Fire","Flesh to Stone","Grease","Hideous Laughter","Hold Person","Hold Monster","Hypnotic Pattern","Irresistible Dance","Levitate","Mass Suggestion","Modify Memory","Planar Binding","Polymorph","Resilient Sphere","Scrying","Slow","Suggestion","Shield","Hunter's Mark","Warding Bond","Resistance","Guidance","Longstrider","Heroism","Beacon of Hope","Death Ward","临时生命","Rage","Bardic Inspiration"], "description": "状态名——枚举=临时状态名录(内核 schema 硬闸+工具代码双闸)。" }, "applied_at": { "type": "string", "description": "施加时间——你按当前叙事时间手写('第 3 日 9 时 30 分'/'第 2 轮',对齐「当前时间」行精到分)。" }, "temp": { "type": "integer", "description": "仅「临时生命」条目携带——缓冲池数额(结算归 hp_change)。" } } }, "description": "在施状态全量列表(替换式:所列=保留/新施,未列=摘除——无 remove 参数)。每条=状态名+applied_at;条目其余字段(effect/on_use/mods)机械按名自动匹配——条件/职业态文案单源=lib/status.mjs,法术条=spell-data 的 buff/pool/onFail,LLM 不手写效果文本与机械修正;temp 仅临时生命条目带。到期摘除=下次列表不带该条(时间对账在维护面)。" },
    "description": { "type": "string", "description": "现况一句：身份+当前处境/动向,≤40 字——history 追加行的同拍刷新键(一起传)。" },
    "thought": { "type": "string", "description": "当前想法:NPC/怪卡专属条目(内心一句,≤400 字;人物面板常驻,玩家卡不落=内心自主权在玩家)——持续更新唯一通道=本参数;传 null 删键。" },
    "history_append": { "type": "string", "description": "history 追加一行(≤120 字;行首日戳「第N日·」,秘密子句行首「[秘]」不主动叙述)——行数组只增不改写;不传=无追加。" },
    "role": { "type": "string", "enum": ["companion", "npc"], "description": "档案位(枚举即名录)——入队/离队翻转;state.md「附近 NPC」行改标仍归维护代理(回执提醒)。错值内核硬拦。" },
    "exhaustion": { "type": "integer", "description": "力竭级 0..6(6=死)——强制行军/绝食等叙事级 +1 在此落;恢复走 rest 长休(工具自动 -1)。" },
    "armor": { "type": "string", "description": "护甲名——换装/缴获;AC 回执前后变化自动上报。" },
    "shield": { "type": "boolean", "description": "持盾/弃盾翻转(true=持盾,false=弃盾)——AC 回执前后变化自动上报。" },
    "weapons": { "type": "array", "items": { "type": "string" }, "description": "面板武器名全量替换(拾取/丢失/缴获在此;攻击招式走 attack 工具)。" },
    "gear": { "type": "array", "items": { "type": "string" }, "description": "随身物品全量替换——战利品入包/遗失在此落。" },
    "languages": { "type": "array", "items": { "type": "string", "enum": ["abyssal","celestial","common","deep_speech","draconic","dwarvish","elvish","giant","gnomish","goblin","halfling","infernal","orc","primordial","sylvan","undercommon"] }, "description": "语言全量替换(枚举=SRD 语言正典 16,键=英文 snake_case;口径=glossary-cn LANGUAGE_CN 单源,漂移钉兜同步;错值内核硬拦)——习得新语言(downtime/魔法)在此,稀有方言不在名录=runtimeEdit 兜底。" },
    "spells_known": { "type": "array", "items": { "type": "string" }, "description": "已知法术全量替换——无枚举(名录=spawn_npc 的 spells_known 枚举);三检闸在代码=存在/本职业表/环位≤当前可施;传全表(回执整卡可对照现状);空表=清空。" },
    "spells_prepared": { "type": "array", "items": { "type": "string" }, "description": "已准备法术全量替换(准备制职业出生为空,长休换备走此键;施法池=known∪prepared 同入收录闸)——无枚举;另禁 0 环(戏法归 spells_known);空表=清空。任一法术键变更 spell_details 自动重铺。" },
    "pending": { "type": "array", "items": { "type": "string" }, "description": "待办行全量替换(与 gain_exp 同格式:'LV2·ASI 点选'/'LV3·新法术×2');消费一条待办即传剩余全表——残留旧条会致重复宣告(新增不必经此键,gain_exp 会挂)。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { resolveTarget, deriveAC, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { STATUS_KEYS, STATUS_TEXT } = await import(pathToFileURL(process.cwd() + '/../preset/lib/status.mjs').href)
const { PERSONA_LIMITS } = await import(pathToFileURL(process.cwd() + '/../preset/lib/persona.mjs').href)
const { SPELL_DATA } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-data.mjs').href)
const { SPELL_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-core-data.mjs').href)
const { materializeSpellDetails, spellsCheck } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-build.mjs').href)
const a = globalThis.argv ?? {}

a.context?.trim() || err('缺必填 context')
a.target || err('缺必填 target')

// 属分面裁决:结算字段/生成面字段点名所属(直接编辑=绕过机械单源或出生面不需要)——任一传入即拒,特殊修档=维护代理 runtimeEdit 兜底。
const DENY = new Map([
  ['name', '建档主键——连文件名/state.md 行全链,归维护代理手工'],
  ['class', '建档面(spawn)'], ['subclass', '建档面(spawn)'], ['caster_attr', '建档面(spawn 派生)'],
  ['level', '成长走 gain_exp'], ['exp', '经验走 gain_exp'], ['hd_available', '成长档面归 spawn/长休 rest'],
  ['abilities', '六维=成长面(ASI 点选/pending 消费链)——维护代理同拍带 CON 追溯'],
  ['hp', '伤害/治疗走 hp_change(直改绕过受伤结算单源)'], ['hp_max', '写入口=成长/升级链'], ['temp_hp', '临时生命走 hp_change'],
  ['death_success', '濒死计数走 death'], ['death_fail', '濒死计数走 death'],
  ['gp', '钱款走 gain_money'], ['sp', '钱款走 gain_money'], ['cp', '钱款走 gain_money'],
  ['concentrating', '专注走 cast/dropConcentration 链'],
  ['status', '已并档——在施状态传 statuses 数组(每条=状态名+applied_at)'],
  ['applied_at', '条目自带字段——随 statuses 数组落,不单传'], ['effect', '条目自带字段——机械按名自动匹配,不手写'],
  ['on_use', '条目自带字段——机械按名自动匹配'], ['mods', '条目自带字段——机械按名自动匹配(status.mjs/spell-data 单源)'],
  ['remove', '已退役——statuses 全量替换:未列即摘除'],
  ['race', '建档面(spawn)'], ['gender', '建档面(spawn——avatar 用)'],
  ['persona', '人设=建档生成面(七键出生即定;后补/改写归维护代理)'],
  ['save_prof', '熟练六件=建档面(职业白名单闸)——训练面起步即定'], ['skill_prof', '熟练六件=建档面(职业白名单闸)——训练面起步即定'],
  ['expertise', '熟练六件=建档面(专精跟随职业行)'],
  ['armor_prof', '熟练六件=建档面(职业白名单闸)'], ['weapon_prof', '熟练六件=建档面(职业白名单闸)'], ['tool_prof', '熟练六件=建档面(职业白名单闸)'],
  ['features', '特征=职业行(建档/gain_exp 升级)'], ['feature_details', '特征=职业行(建档/gain_exp 升级)'],
  ['resist', '持久抗免=建档面(种族/数据);临时抗性走 statuses'], ['vulnerabilities', '持久抗免=建档面(种族/数据);临时易伤走 statuses'], ['immune', '持久抗免=建档面(种族/数据);临时免疫走 statuses'],
  ['speed', '建档面(种族)'], ['darkvision', '建档面(种族)'],
  ['history', '已退役参数——用 history_append(行数组只增)'],
])
for (let i = 1; i <= 9; i++) DENY.set(`slots_l${i}`, '法术位消耗与恢复走 cast/rest')

// 可更新键白名单(=schema 平铺参数)——名单外的具名参数一律点名(防幻觉:以为改了其实静默落空)
const ALLOW = new Set(['context', 'target', 'statuses',
  'description', 'thought', 'history_append', 'role', 'exhaustion', 'armor', 'shield', 'weapons', 'gear', 'languages',
  'spells_known', 'spells_prepared', 'pending'])

for (const k of Object.keys(a ?? {})) {
  if (ALLOW.has(k)) continue
  DENY.has(k) ? err(`${k} 不走更新器——${DENY.get(k)}`) : err(`不认识的参数:${k}——可更新键 ${[...ALLOW].filter(x => x !== 'context' && x !== 'target').join(' / ')}`)
}
Object.keys(a).some(k => !['context', 'target'].includes(k)) || err('未传任何可更新键——statuses/各字段参数至少传一项')

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

// ── 字段平铺(叙事可变):标量 null=删键;数组全量替换、空=删键(出生 stripEmptyArrays 同律) ──
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
// description(现况一句;≤PERSONA_LIMITS.description)
if (a.description !== undefined && a.description !== null) {
  const d = String(a.description).trim()
  d && d.length <= (PERSONA_LIMITS.description ?? 40) || err(`description 须非空且 ≤${PERSONA_LIMITS.description} 字,得 ${d.length}`)
  lines.push(`description: ${j.description ?? '(缺)'}→${d}`)
  j.description = d
}
// thought(当前想法;NPC/怪专属——玩家内心自主,玩家卡拒落;schema 同款 ≤400 字)
if (a.thought !== undefined && a.thought !== null) {
  j.role === 'pc' && err('thought 不落玩家卡——玩家内心自主权,DM 不代写(NPC/怪专属)')
  const t = String(a.thought).trim()
  t && t.length <= 400 || err(`thought 须非空且 ≤400 字,得 ${t.length}`)
  lines.push(`thought: ${j.thought ?? '(缺)'}→${t}`)
  j.thought = t
} else if (a.thought === null) {
  j.role === 'pc' && err('thought 不落玩家卡——玩家内心自主权,DM 不代写(NPC/怪专属)')
  delete j.thought
  lines.push('thought: 删键(还原缺省)')
}
// history_append(行数组只增;同拍 description 刷新由描述引导)
if (a.history_append !== undefined && a.history_append !== null) {
  const row = String(a.history_append).trim()
  row || err('history_append 须非空(无追加=不传)')
  row.length <= (PERSONA_LIMITS.history ?? 120) || err(`history_append 超长(≤${PERSONA_LIMITS.history} 字,得 ${row.length})`)
  Array.isArray(j.history) || (j.history = [])
  j.history.push(row)
  lines.push(`history: 追加第 ${j.history.length} 行`)
}

// ── 法术面(全量替换;三检=存在/本职业表/环位≤当前可施,prepared 禁 0 环;spell_details 任一变更重铺) ──
const knownIn = a.spells_known !== undefined && a.spells_known !== null
const prepIn = a.spells_prepared !== undefined && a.spells_prepared !== null
if (knownIn || prepIn) {
  j.caster_attr != null || err('无施法能力(该角色无施法族)——spells_known/prepared 不收')
  const cls = String(j.class ?? '').toLowerCase()
  const maxSlot = Math.max(0, ...Array.from({ length: 9 }, (_, i) => (+j[`slots_l${i + 1}`] > 0 ? i + 1 : 0)))
  const oldK = Array.isArray(j.spells_known) ? j.spells_known.length : 0
  const oldP = Array.isArray(j.spells_prepared) ? j.spells_prepared.length : 0
  const loadList = (k, label) => {
    Array.isArray(a[k]) || err(`${label} 须为法术英文名数组(全量替换;空表=清空;改后整卡在回执可对照)`)
    spellsCheck(a[k], cls, maxSlot, err, label, j.level)
    return a[k].map(s => String(s).trim()).filter(Boolean)
  }
  const known = knownIn ? loadList('spells_known', 'spells_known') : (Array.isArray(j.spells_known) ? [...j.spells_known] : [])
  const prep = prepIn ? loadList('spells_prepared', 'spells_prepared') : (Array.isArray(j.spells_prepared) ? [...j.spells_prepared] : [])
  knownIn && (known.length ? j.spells_known = known : delete j.spells_known)
  prepIn && (prep.length ? j.spells_prepared = prep : delete j.spells_prepared)
  const details = materializeSpellDetails([...known, ...prep])
  details.length ? j.spell_details = details : delete j.spell_details
  lines.push(`法术: 三检通过 · known ${oldK}→${known.length}条 · prepared ${oldP}→${prep.length}条 · spell_details 重铺(${details.length}条)`)
}

list('languages'); list('weapons'); list('gear'); list('pending')
scalar('armor'); scalar('shield')

lines.length || err('未传任何可更新键——statuses/各字段参数至少传一项')

saveChar(tg.file, j)
const after = deriveAC(j)
console.log(`[人物卡 · ${a.target} · ${verb}]`)
for (const l of lines) console.log(`  ${l}`)
if (statusTouched) console.log(`  完整状态: ${JSON.stringify(j.statuses)}`)
before !== after && console.log(`  AC: ${before}→${after}`)
// 人物卡回执=改后整卡(维护代理可接力,注入面板即现值,无需再 runtimeRead)
console.log(`### ${j.name ?? a.target}（${j.role ?? '—'}）`)
console.log(JSON.stringify(j, null, 1))
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
