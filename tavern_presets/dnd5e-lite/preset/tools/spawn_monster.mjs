/** @tavern-schema
{
  "description": "怪物创建器（枚举选怪）——怪物敌人建档必经本工具。何时调：怪物敌人登场（哥布林/狼/龙…）、即兴单位挂最近 monster_kind 再 override。monster_kind 直接从枚举取值——无需读任何怪物文档，选型即全视野；工具内部按枚举找到该怪的结构化档案，一切数值（CR/AC/HP 骰/六维/豁免技能/抗免/攻击/豁免型能力/特征）与风貌 description、预生成人设（数据面 persona 行）机械落档，回执给整卡人物面板。count 批量天干编号；attacks 仅表缺口才传。本工具不收人设参数——怪物人设=数据面预生成，个体化由尾代后补。",
  "agents": ["main", "tail"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "name": { "type": "string", "required": true, "description": "怪名（基名——count>1 时天干编号，如 哥布林×3→甲/乙/丙）；同名已存在则报错不覆盖。" },
    "stance": { "type": "string", "required": true, "enum": ["同伴", "中立", "敌对"], "description": "在场立场（出生当拍的快照——同伴坐骑=同伴、接战之敌=敌对、无主生物=中立；前端左/右分位与注入标注据此；后来翻转由尾代改附近 NPC 行）。" },
    "monster_kind": { "type": "string", "required": true, "enum": ["aboleth","acolyte","adult-black-dragon","adult-blue-dragon","adult-brass-dragon","adult-bronze-dragon","adult-copper-dragon","adult-gold-dragon","adult-green-dragon","adult-red-dragon","adult-silver-dragon","adult-white-dragon","air-elemental","ancient-black-dragon","ancient-blue-dragon","ancient-brass-dragon","ancient-bronze-dragon","ancient-copper-dragon","ancient-gold-dragon","ancient-green-dragon","ancient-red-dragon","ancient-silver-dragon","ancient-white-dragon","androsphinx","animated-armor","ankheg","ape","archmage","assassin","awakened-shrub","awakened-tree","axe-beak","azer","baboon","badger","balor","bandit","bandit-captain","barbed-devil","basilisk","bat","bearded-devil","behir","berserker","black-bear","black-dragon-wyrmling","black-pudding","blink-dog","blood-hawk","blue-dragon-wyrmling","boar","bone-devil","brass-dragon-wyrmling","bronze-dragon-wyrmling","brown-bear","bugbear","bulette","camel","cat","centaur","chain-devil","chimera","chuul","clay-golem","cloaker","cloud-giant","cockatrice","constrictor-snake","copper-dragon-wyrmling","couatl","crab","crocodile","cult-fanatic","cultist","darkmantle","death-dog","deep-gnome-svirfneblin","deer","deva","dire-wolf","djinni","doppelganger","draft-horse","dragon-turtle","dretch","drider","drow","druid","dryad","duergar","dust-mephit","eagle","earth-elemental","efreeti","elephant","elk","erinyes","ettercap","ettin","fire-elemental","fire-giant","flesh-golem","flying-snake","flying-sword","frog","frost-giant","gargoyle","gelatinous-cube","ghast","ghost","ghoul","giant-ape","giant-badger","giant-bat","giant-boar","giant-centipede","giant-constrictor-snake","giant-crab","giant-crocodile","giant-eagle","giant-elk","giant-fire-beetle","giant-frog","giant-goat","giant-hyena","giant-lizard","giant-octopus","giant-owl","giant-poisonous-snake","giant-rat","giant-rat-diseased","giant-scorpion","giant-sea-horse","giant-shark","giant-spider","giant-toad","giant-vulture","giant-wasp","giant-weasel","giant-wolf-spider","gibbering-mouther","glabrezu","gladiator","gnoll","goat","goblin","gold-dragon-wyrmling","gorgon","gray-ooze","green-dragon-wyrmling","green-hag","grick","griffon","grimlock","guard","guardian-naga","gynosphinx","half-red-dragon-veteran","harpy","hawk","hell-hound","hezrou","hill-giant","hippogriff","hobgoblin","homunculus","horned-devil","hunter-shark","hydra","hyena","ice-devil","ice-mephit","imp","invisible-stalker","iron-golem","jackal","killer-whale","knight","kobold","kraken","lamia","lemure","lich","lion","lizard","lizardfolk","mage","magma-mephit","magmin","mammoth","manticore","marilith","mastiff","medusa","merfolk","merrow","mimic","minotaur","minotaur-skeleton","mule","mummy","mummy-lord","nalfeshnee","night-hag","nightmare","noble","ochre-jelly","octopus","ogre","ogre-zombie","oni","orc","otyugh","owl","owlbear","panther","pegasus","phase-spider","pit-fiend","planetar","plesiosaurus","poisonous-snake","polar-bear","pony","priest","pseudodragon","purple-worm","quasit","quipper","rakshasa","rat","raven","red-dragon-wyrmling","reef-shark","remorhaz","rhinoceros","riding-horse","roc","roper","rug-of-smothering","rust-monster","saber-toothed-tiger","sahuagin","salamander","satyr","scorpion","scout","sea-hag","sea-horse","shadow","shambling-mound","shield-guardian","shrieker","silver-dragon-wyrmling","skeleton","solar","specter","spider","spirit-naga","sprite","spy","steam-mephit","stirge","stone-giant","stone-golem","storm-giant","succubus-incubus","swarm-of-bats","swarm-of-beetles","swarm-of-centipedes","swarm-of-insects","swarm-of-poisonous-snakes","swarm-of-quippers","swarm-of-rats","swarm-of-ravens","swarm-of-spiders","swarm-of-wasps","tarrasque","thug","tiger","treant","tribal-warrior","triceratops","troll","tyrannosaurus-rex","unicorn","vampire-bat","vampire-mist","vampire-spawn","vampire-vampire","veteran","violet-fungus","vrock","vulture","warhorse","warhorse-skeleton","water-elemental","weasel","werebear-bear","werebear-human","werebear-hybrid","wereboar-boar","wereboar-human","wereboar-hybrid","wererat-human","wererat-hybrid","wererat-rat","weretiger-human","weretiger-hybrid","weretiger-tiger","werewolf-human","werewolf-hybrid","werewolf-wolf","white-dragon-wyrmling","wight","will-o-wisp","winter-wolf","wolf","worg","wraith","wyvern","xorn","young-black-dragon","young-blue-dragon","young-brass-dragon","young-bronze-dragon","young-copper-dragon","young-gold-dragon","young-green-dragon","young-red-dragon","young-silver-dragon","young-white-dragon","zombie"], "description": "怪物种类（全部怪种的枚举，如 goblin/kobold/adult-red-dragon）——工具按枚举自寻结构化档案，零文档阅读面。" },
    "count": { "type": "integer", "description": "批量数量——name 为基名，天干编号（哥布林×3→甲/乙/丙）。" },
    "gear": { "type": "array", "items": { "type": "string" }, "description": "背包/额外掉落（战利品路由用），照剧情判断——statblock 武器自动并入默认掉落（工具按 attacks 键判武器类；天生武器咬/爪/尾击不落），你只声明额外物品（默认掉落=钱袋由工具掷）。" },
    "attacks": { "type": "array", "items": { "type": "string" }, "description": "攻击覆盖——仅当此怪在攻击数据表无攻击条目（如某些施法者的匕首）才填。每条 '攻击名|melee/ranged|加值|骰式|类型|触及'，如 'Bite|melee|+4|2d4+2|piercing|5'。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { findCharFile, stripEmptyArrays, saveChar, presenceAdd, pbOf, xpOf, rollExpr, equipmentFM, WEAPON_SLUG, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { buildMonster } = await import(pathToFileURL(process.cwd() + '/../preset/lib/monster-build.mjs').href)
const { rollTreasure } = await import(pathToFileURL(process.cwd() + '/../preset/lib/treasure.mjs').href)
const a = globalThis.argv ?? {}

a.context?.trim() || err('缺必填 context(剧情梗概——反作弊铁则)')
a.name || err('缺必填 name')
// monster_kind:内核 enum 已硬拦;此行=无 schema 通道/手工调用的兜底闸,归一式与档案派生同律
a.monster_kind || err('缺必填 monster_kind(怪物种类枚举)')
// 在场立场(2026-09-30 stance 回锅;战斗节仍=参战名单)
a.stance || err('缺必填 stance(同伴|中立|敌对)')
const kind = String(a.monster_kind).toLowerCase().replace(/\.[a-z]+$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// 读卡自动填+全材料化;缺档/坏档→抛,err 收口
let m
try { m = buildMonster(`monsters/${kind}.md`) } catch (e) { err(String(e.message ?? e).replace(/^!/, '')) }

// 幂等:同名先查重(批量任一重名整体拒绝)
const STEM = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const names = a.count ? Array.from({ length: a.count }, (_, i) => `${a.name}${STEM[i] ?? i + 1}`) : [a.name]
for (const n of names) if (findCharFile(n)) err(`!同名已存在:${n}——改名,或确认非同一人`)

// 攻击覆盖(仅数据表缺口怪;agent 条目优先于表材料——merge 语义)
let atkRec = null
if (Array.isArray(a.attacks) && a.attacks.length) {
  atkRec = {}
  for (const rec of a.attacks) {
    const p = String(rec).split('|').map(x => x.trim())
    if (p.length < 5) err(`!attacks 记录不合法:${rec}——'攻击名|melee/ranged|加值|骰式|类型|触及(近战填)'`)
    const [nm, k2, bonus, dice, type, reach] = p
    ;(k2 === 'melee' || k2 === 'ranged') || err(`!attacks kind 不合法:${rec}——melee/ranged`)
    atkRec[String(nm).toLowerCase().replace(/[^a-z0-9]+/g, '-')] = { kind: k2, bonus: +String(bonus).replace('+', ''), dice, type: type.toLowerCase(), ...(k2 === 'melee' ? { reach: +reach || 5 } : {}) }
  }
}

// 怪人设=数据面预生成(2026-09-30 二次裁定,persona-threelayer_zh.md 定案 4):MONSTER_CORE 的 persona 行
// 由数据批统一生成,spawn 只读不问——本工具不收 LLM 人设参数;个体化由尾代后补或数据批覆盖。
if (a.persona != null || a.history != null) err('!spawn_monster 不收 persona/history——怪人设=数据面 persona 行预生成,个体化走尾代补档')

// 战利品默认并入(2026-10-02 背包律 B 方案):statblock 攻击键中「武器类」(equipmentFM 查得到 weapon 字段)
// 自动入 gear 默认掉落——天生武器(bite/claw/尾击)EQ_CORE 查无=不落。中文名优先(WEAPON_SLUG 反查),
// 查无回退 fm.name 英文名;agent 的 gear 只增不删(去重 merge)——批量同 kind 每只掉落同(标配一致)。
const weaponDrops = (attacks) => Object.keys(attacks ?? {}).flatMap((key) => {
  const fm = equipmentFM(key)
  if (!fm?.weapon) return []
  const cn = Object.entries(WEAPON_SLUG).find(([, s]) => s === key)?.[0]
  return [cn ?? fm.name]
})
const finalAttacks = atkRec ? { ...m.attacks, ...atkRec } : m.attacks
const baseGear = [...new Set([...(a.gear ?? []), ...weaponDrops(finalAttacks)])]

const hpRule = m.hp_roll ? m.hp_roll : null
for (const n of names) {
  const hp = hpRule ? Math.max(1, (rollExpr(hpRule) || err(`!hp_roll 骰式不合法:${hpRule}`)).total) : m.hp   // 语料计算式掷(RAW 生命至少 1),批量每只独立;缺骰式字段回退卡值平均
  // 默认钱袋:DMG 个人财宝表按 CR 掷(每只独立)——掉落=背包+钱
  const coins = rollTreasure(m.cr)
  const j = stripEmptyArrays({
    name: n,
    role: a.stance === '同伴' ? 'companion' : 'npc',
    monster_kind: m.kind,
    level: m.cr,               // 怪=lv 直值(CR),成长 OFF
    ac: m.ac,
    hp, hp_max: hp,
    str: m.str, dex: m.dex, con: m.con, int: m.int, wis: m.wis, cha: m.cha,
    save_prof: m.save_prof,
    skill_prof: m.skill_prof,
    resist: m.resist,
    immune: m.immune,
    ...(m.vuln.length ? { vulnerabilities: m.vuln } : {}),
    speed: m.speed,
    ...(m.darkvision != null ? { darkvision: m.darkvision } : {}),
    ...(m.languages.length ? { languages: m.languages } : {}),
    ...(m.description ? { description: m.description } : {}),
    ...(m.features.length ? { features: m.features } : {}),
    ...(Object.keys(m.attacks).length ? { attacks: m.attacks } : {}),
    ...(Object.keys(m.abilities).length ? { abilities: m.abilities } : {}),
    ...(atkRec ? { attacks: { ...m.attacks, ...atkRec } } : {}),
    ...(baseGear.length ? { gear: baseGear } : {}),
    ...(coins.gp ? { gp: coins.gp } : {}),
    ...(coins.sp ? { sp: coins.sp } : {}),
    ...(coins.cp ? { cp: coins.cp } : {}),
    statuses: {},
    ...(m.persona && !a.count ? { persona: m.persona } : {}),   // 数据面 persona 行(每怪预生成)——批量杂兵不配个体人设;缺席=裁剪
  })
  const file = `characters/${n}.json`
  saveChar(file, j)
  presenceAdd(n, a.stance)
  const xp = xpOf(m.cr), p = pbOf(m.cr)
  console.log(`[创建 · ${n} · ${a.stance}]`)
  console.log(`  落盘: ${file} 已建档(kind ${m.kind} · level ${m.cr} · ac ${m.ac} · hp ${hp}${hpRule ? `=${hpRule}` : ''}${coins.line ? ' · 钱袋 ' + coins.line : ''})`)
  console.log(`  ◇ level ${m.cr}${xp ? ` → XP ${xp}` : ''} · pb ${p >= 0 ? '+' + p : p}(派生,不落档) · 攻击 ${Object.keys(m.attacks).length} 条 · 特征 ${m.features.length} 条${Object.keys(m.abilities).length ? ` · 豁免能力 ${Object.keys(m.abilities).length}` : ''}(全在档)`)
  // 回执=人物卡同格式:整卡 JSON(材料化面皆在档);特大体格怪收紧为单行防 8KB stdout 闸
  const pretty = JSON.stringify(j, null, 1)
  console.log(`### ${n}（${a.stance}）`)
  console.log(pretty.length > 7000 ? JSON.stringify(j) : pretty)
}
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
