/** @tavern-schema
{
  "description": "角色创建器——为登场的新角色建立完整档案并登记在场：怪物、NPC、同伴，一切新角色必经（玩家角色由开局表单创建，不经此）。什么情况调：剧情中任何新角色登场。创建前先读卡：怪物 runtimeRead monsters/ 下的 statblock 照原文填，原创 NPC 凭你的设定填——数字要过你的脑子，战斗中是你亲自跑它。怎么填：必填 name+stance+level+ac+hp+六维；level 是统一刻度——怪物抄卡头 CR（0.25 小数原样），有职业的填等级；有什么能力填什么族（施法者必须填全 caster_attr+spells_known+slots），没有的不填；设定重的角色填 persona/biography，杂兵跳过。特殊通道：from 传 statblock 路径做镜像校验（填错报错列差异；有意改数值的变体不带 from）；count 批量（name 为基名，天干编号）。预期效果：档案+在场名单落盘，回执给落盘行与 XP/熟练加值摘要（派生，不落档）；同名已存在会报错。",
  "agents": ["main", "tail"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "name": { "type": "string", "required": true, "description": "角色名——同名已存在（含 player.json）则报错不覆盖。" },
    "stance": { "type": "string", "required": true, "description": "同伴|中立|敌对——在场三态；role 由此派生且定形（stance 可变，role 不变）。" },
    "level": { "type": "number", "required": true, "description": "刻度：怪照 statblock 卡头抄 CR（0.25 等小数原样）；class-NPC 与同伴填等级。" },
    "ac": { "type": "integer", "required": true, "description": "AC——怪=卡头直值；着甲类人=照甲算好填入。" },
    "hp": { "type": "integer", "required": true, "description": "HP 现值（=上限，出生即满血；statblock 均值为惯例）。" },
    "str": { "type": "integer", "required": true, "description": "力量值。" },
    "dex": { "type": "integer", "required": true, "description": "敏捷值（兼先攻与 AC 派生输入）。" },
    "con": { "type": "integer", "required": true, "description": "体质值。" },
    "int": { "type": "integer", "required": true, "description": "智力值。" },
    "wis": { "type": "integer", "required": true, "description": "感知值。" },
    "cha": { "type": "integer", "required": true, "description": "魅力值。" },
    "save_prof": { "type": "array", "items": { "type": "string" }, "description": "豁免熟练（str/dex/con/int/wis/cha），照卡。" },
    "skill_prof": { "type": "array", "items": { "type": "string" }, "description": "技能熟练，照卡。" },
    "resist": { "type": "array", "items": { "type": "string" }, "description": "伤害抗性，照卡。" },
    "immune": { "type": "array", "items": { "type": "string" }, "description": "伤害免疫，照卡。" },
    "vulnerabilities": { "type": "array", "items": { "type": "string" }, "description": "伤害易伤，照卡。" },
    "speed": { "type": "integer", "description": "速度（尺），照卡。" },
    "darkvision": { "type": "integer", "description": "黑暗视觉范围（尺），无则不填。" },
    "languages": { "type": "array", "items": { "type": "string" }, "description": "语言，照卡。" },
    "caster_attr": { "type": "string", "description": "施法属性（int/wis/cha）——施法族声明则必全。" },
    "spells_known": { "type": "array", "items": { "type": "string" }, "description": "已知法术——施法族声明则必全。" },
    "slots": { "type": "array", "items": { "type": "integer" }, "description": "施法位表（从 1 环起逐环数量，如 [4,2]）——落档为 slots_l1..lN；施法族声明则必全。" },
    "persona": { "type": "string", "description": "一句话人设（伸缩：无设定的怪不填）。" },
    "biography": { "type": "string", "description": "背景首行（复杂 NPC 用，追加式）。" },
    "description": { "type": "string", "description": "名册一句话简介。" },
    "count": { "type": "integer", "description": "批量数量——name 为基名，天干编号（哥布林×3→甲/乙/丙）。" },
    "race": { "type": "string", "description": "种族（avatar/叙事用）。" },
    "gender": { "type": "string", "description": "male|female|unknown（avatar 用）。" },
    "from": { "type": "string", "description": "statblock 路径（monsters/goblin.md）——校验锚：对照 FM 镜像校验，不符报错列差异；造变体不带。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { readFM, findCharFile, stripEmptyArrays, saveChar, presenceAdd, pbOf, xpOf, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
a.name || err('缺必填 name')
const STANCES = ['同伴', '中立', '敌对']
STANCES.includes(a.stance) || err('缺必填 stance(同伴|中立|敌对)')
if (a.level === undefined || a.level === null) err('缺必填 level(怪=卡头 CR 小数原样;成长者=等级)')
if (a.ac === undefined || a.ac === null) err('缺必填 ac')
if (a.hp === undefined || a.hp === null) err('缺必填 hp')
for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha']) if (a[k] === undefined || a[k] === null) err(`缺必填 ${k}`)
if (a.caster_attr !== undefined) {
  if (!(Array.isArray(a.spells_known) && a.spells_known.length) || !(Array.isArray(a.slots) && a.slots.length)) err('施法族声明则必全:caster_attr+spells_known+slots')
}

// from 镜像校验(白名单镜像先例=opening_commit):不符报错列差异,强制重读;变体不带 from。
if (a.from) {
  let fm
  try { fm = readFM(a.from) } catch { err(`!查无 statblock:${a.from}`) }
  if (!fm.name) err(`!查无 statblock:${a.from}`)
  const diffs = []
  if (fm.ac !== undefined && +fm.ac !== +a.ac) diffs.push(`ac 卡=${fm.ac}≠传${a.ac}`)
  if (fm.hp !== undefined && +fm.hp !== +a.hp) diffs.push(`hp 卡=${fm.hp}≠传${a.hp}`)
  if (fm.cr !== undefined && +fm.cr !== +a.level) diffs.push(`CR 卡=${fm.cr}≠传${a.level}`)
  for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha']) if (fm[k] !== undefined && +fm[k] !== +a[k]) diffs.push(`${k} 卡=${fm[k]}≠传${a[k]}`)
  if (diffs.length) err(`!from 校验不符:${diffs.join(' · ')}——重读卡,或去掉 from(变体)`)
}

// 批量天干编号(哥布林×3→甲/乙/丙);先查重后建档,同名即整体拒绝。
const STEM = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const names = a.count ? Array.from({ length: a.count }, (_, i) => `${a.name}${STEM[i] ?? i + 1}`) : [a.name]
for (const n of names) if (findCharFile(n)) err(`!同名已存在:${n}——改名,或确认非同一人`)

const role = a.stance === '同伴' ? 'companion' : 'npc'
for (const n of names) {
  const j = stripEmptyArrays({
    name: n,
    role,
    level: a.level,
    ac: a.ac,
    hp: a.hp, hp_max: a.hp,
    str: a.str, dex: a.dex, con: a.con, int: a.int, wis: a.wis, cha: a.cha,
    ...(Array.isArray(a.save_prof) ? { save_prof: a.save_prof } : {}),
    ...(Array.isArray(a.skill_prof) ? { skill_prof: a.skill_prof } : {}),
    ...(Array.isArray(a.resist) ? { resist: a.resist } : {}),
    ...(Array.isArray(a.immune) ? { immune: a.immune } : {}),
    ...(Array.isArray(a.vulnerabilities) ? { vulnerabilities: a.vulnerabilities } : {}),
    ...(a.speed !== undefined ? { speed: a.speed } : {}),
    ...(a.darkvision !== undefined ? { darkvision: a.darkvision } : {}),
    ...(Array.isArray(a.languages) ? { languages: a.languages } : {}),
    ...(a.caster_attr !== undefined ? {
      caster_attr: a.caster_attr,
      spells_known: a.spells_known ?? [],
      ...Object.fromEntries((a.slots ?? []).map((v, i) => [`slots_l${i + 1}`, v])),
    } : {}),
    ...(a.persona ? { persona: { personality: a.persona } } : {}),
    ...(a.biography ? { biography: [a.biography] } : {}),
    ...(a.description ? { description: a.description } : {}),
    ...(a.race ? { race: a.race } : {}),
    ...(a.gender ? { gender: a.gender } : {}),
    ...(a.from ? { path: a.from } : {}),          // 出生地溯源(initiative 建敌行取)
  })
  const file = `characters/${n}.json`
  saveChar(file, j)
  presenceAdd(n, a.stance)
  console.log(`[创建 · ${n} · ${a.stance}]`)
  console.log(`  落盘: ${file} 已建档(level ${a.level} · ac ${a.ac} · hp ${a.hp})`)
  console.log(`  落盘: state.md 附近NPC +${a.stance}行`)
  const xp = xpOf(a.level), p = pbOf(a.level)
  console.log(`  ◇ level ${a.level}${xp ? ` → XP ${xp}` : ''} · pb ${p >= 0 ? '+' + p : p}(派生,不落档)`)
}
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
