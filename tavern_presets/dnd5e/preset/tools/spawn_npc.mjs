/** @tavern-schema
{
  "description": "角色创建器（class 制）——有职业的 NPC/同伴建档必经本工具。何时调：有职业等级的 NPC 登场（对手法师 LV5、随行同伴）；纯场景者照 commoner 走 spawn_monster。你只输入设定：职业/等级/是否同伴，六维与法术技能照剧情设定传（六维可不传=照职业自动 roll）；一切数值（HP/豁免/熟练/位表/经验成长）由工具按职业规则算好落档，回执给整卡面板与成长明细。",
  "agents": ["main", "tail"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "name": { "type": "string", "required": true, "description": "角色名；同名已存在（含 player.json）则报错不覆盖。" },
    "stance": { "type": "string", "required": true, "enum": ["同伴", "中立", "敌对"], "description": "在场立场（出生当拍的快照——前端左/右分位与注入标注据此；敌我后来的翻转由尾代改附近 NPC 行,不入此参）。" },
    "class": { "type": "string", "required": true, "enum": ["barbarian","bard","cleric","druid","fighter","monk","paladin","ranger","rogue","sorcerer","warlock","wizard"], "description": "职业(枚举即名录,12 类)。" },
    "level": { "type": "integer", "required": true, "enum": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], "description": "职业等级(1..20 卡内口径)。" },
    "abilities": { "type": "object", "properties": { "str": { "type": "integer" }, "dex": { "type": "integer" }, "con": { "type": "integer" }, "int": { "type": "integer" }, "wis": { "type": "integer" }, "cha": { "type": "integer" } }, "additionalProperties": false, "description": "六维 1 级基础值(六键全整型,内核 schema 硬校)——想钉设定才传;不传=职业主属性自动 roll;历史 ASI 由工具按等级自动补足(回执列明细)。" },
    "skills": { "type": "array", "items": { "type": "string", "enum": ["acrobatics","animal_handling","arcana","athletics","deception","history","insight","intimidation","investigation","medicine","nature","perception","performance","persuasion","religion","sleight_of_hand","stealth","survival"] }, "description": "技能熟练(18 键枚举,snake_case)——选数与职业白名单仍由工具闸;不传=无技能。" },
    "subclass": { "type": "string", "enum": ["Berserker","Champion","Devotion","Draconic","Evocation","Fiend","Hunter","Land","Life","Lore","Open Hand","Thief"], "description": "子职名(语料名录,12 值;须与本职业匹配——工具查 class×subclass 对,错配仍会降错)。" },
    "spells_known": { "type": "array", "items": { "type": "string", "enum": ["Acid Arrow","Acid Splash","Aid","Alarm","Alter Self","Animal Friendship","Animal Messenger","Animal Shapes","Animate Dead","Animate Objects","Antilife Shell","Antimagic Field","Antipathy/Sympathy","Arcane Eye","Arcane Hand","Arcane Lock","Arcane Sword","Arcanist's Magic Aura","Astral Projection","Augury","Awaken","Bane","Banishment","Barkskin","Beacon of Hope","Bestow Curse","Black Tentacles","Blade Barrier","Bless","Blight","Blindness/Deafness","Blink","Blur","Branding Smite","Burning Hands","Call Lightning","Calm Emotions","Chain Lightning","Charm Person","Chill Touch","Circle of Death","Clairvoyance","Clone","Cloudkill","Color Spray","Command","Commune","Commune With Nature","Comprehend Languages","Compulsion","Cone of Cold","Confusion","Conjure Animals","Conjure Celestial","Conjure Elemental","Conjure Fey","Conjure Minor Elementals","Conjure Woodland Beings","Contact Other Plane","Contagion","Contingency","Continual Flame","Control Water","Control Weather","Counterspell","Create Food and Water","Create Undead","Create or Destroy Water","Creation","Cure Wounds","Dancing Lights","Darkness","Darkvision","Daylight","Death Ward","Delayed Blast Fireball","Demiplane","Detect Evil and Good","Detect Magic","Detect Poison and Disease","Detect Thoughts","Dimension Door","Disguise Self","Disintegrate","Dispel Evil and Good","Dispel Magic","Divination","Divine Favor","Divine Word","Dominate Beast","Dominate Monster","Dominate Person","Dream","Druidcraft","Earthquake","Eldritch Blast","Enhance Ability","Enlarge/Reduce","Entangle","Enthrall","Etherealness","Expeditious Retreat","Eyebite","Fabricate","Faerie Fire","Faithful Hound","False Life","Fear","Feather Fall","Feeblemind","Find Familiar","Find Steed","Find Traps","Find the Path","Finger of Death","Fire Bolt","Fire Shield","Fire Storm","Fireball","Flame Blade","Flame Strike","Flaming Sphere","Flesh to Stone","Floating Disk","Fly","Fog Cloud","Forbiddance","Forcecage","Foresight","Freedom of Movement","Freezing Sphere","Gaseous Form","Gate","Geas","Gentle Repose","Giant Insect","Glibness","Globe of Invulnerability","Glyph of Warding","Goodberry","Grease","Greater Invisibility","Greater Restoration","Guardian of Faith","Guards and Wards","Guidance","Guiding Bolt","Gust of Wind","Hallow","Hallucinatory Terrain","Harm","Haste","Heal","Healing Word","Heat Metal","Hellish Rebuke","Heroes' Feast","Heroism","Hideous Laughter","Hold Monster","Hold Person","Holy Aura","Hunter's Mark","Hypnotic Pattern","Ice Storm","Identify","Illusory Script","Imprisonment","Incendiary Cloud","Inflict Wounds","Insect Plague","Instant Summons","Invisibility","Irresistible Dance","Jump","Knock","Legend Lore","Lesser Restoration","Levitate","Light","Lightning Bolt","Locate Animals or Plants","Locate Creature","Locate Object","Longstrider","Mage Armor","Mage Hand","Magic Circle","Magic Jar","Magic Missile","Magic Mouth","Magic Weapon","Magnificent Mansion","Major Image","Mass Cure Wounds","Mass Heal","Mass Healing Word","Mass Suggestion","Maze","Meld Into Stone","Mending","Message","Meteor Swarm","Mind Blank","Minor Illusion","Mirage Arcane","Mirror Image","Mislead","Misty Step","Modify Memory","Moonbeam","Move Earth","Nondetection","Pass Without Trace","Passwall","Phantasmal Killer","Phantom Steed","Planar Ally","Planar Binding","Plane Shift","Plant Growth","Poison Spray","Polymorph","Power Word Kill","Power Word Stun","Prayer of Healing","Prestidigitation","Prismatic Spray","Prismatic Wall","Private Sanctum","Produce Flame","Programmed Illusion","Project Image","Protection From Energy","Protection from Evil and Good","Protection from Poison","Purify Food and Drink","Raise Dead","Ray of Enfeeblement","Ray of Frost","Regenerate","Reincarnate","Remove Curse","Resilient Sphere","Resistance","Resurrection","Reverse Gravity","Revivify","Rope Trick","Sacred Flame","Sanctuary","Scorching Ray","Scrying","Secret Chest","See Invisibility","Seeming","Sending","Sequester","Shapechange","Shatter","Shield","Shield of Faith","Shillelagh","Shocking Grasp","Silence","Silent Image","Simulacrum","Sleep","Sleet Storm","Slow","Spare the Dying","Speak with Animals","Speak with Dead","Speak with Plants","Spider Climb","Spike Growth","Spirit Guardians","Spiritual Weapon","Stinking Cloud","Stone Shape","Stoneskin","Storm of Vengeance","Suggestion","Sunbeam","Sunburst","Symbol","Telekinesis","Telepathic Bond","Teleport","Teleportation Circle","Thaumaturgy","Thunderwave","Time Stop","Tiny Hut","Tongues","Transport via Plants","Tree Stride","True Polymorph","True Resurrection","True Seeing","True Strike","Unseen Servant","Vampiric Touch","Vicious Mockery","Wall of Fire","Wall of Force","Wall of Ice","Wall of Stone","Wall of Thorns","Warding Bond","Water Breathing","Water Walk","Web","Weird","Wind Walk","Wind Wall","Wish","Word of Recall","Zone of Truth"] }, "description": "已知法术(319 名录枚举,含戏法)——本职业表/环位匹配仍由工具闸。" },
    "spells_prepared": { "type": "array", "items": { "type": "string", "enum": ["Acid Arrow","Acid Splash","Aid","Alarm","Alter Self","Animal Friendship","Animal Messenger","Animal Shapes","Animate Dead","Animate Objects","Antilife Shell","Antimagic Field","Antipathy/Sympathy","Arcane Eye","Arcane Hand","Arcane Lock","Arcane Sword","Arcanist's Magic Aura","Astral Projection","Augury","Awaken","Bane","Banishment","Barkskin","Beacon of Hope","Bestow Curse","Black Tentacles","Blade Barrier","Bless","Blight","Blindness/Deafness","Blink","Blur","Branding Smite","Burning Hands","Call Lightning","Calm Emotions","Chain Lightning","Charm Person","Chill Touch","Circle of Death","Clairvoyance","Clone","Cloudkill","Color Spray","Command","Commune","Commune With Nature","Comprehend Languages","Compulsion","Cone of Cold","Confusion","Conjure Animals","Conjure Celestial","Conjure Elemental","Conjure Fey","Conjure Minor Elementals","Conjure Woodland Beings","Contact Other Plane","Contagion","Contingency","Continual Flame","Control Water","Control Weather","Counterspell","Create Food and Water","Create Undead","Create or Destroy Water","Creation","Cure Wounds","Dancing Lights","Darkness","Darkvision","Daylight","Death Ward","Delayed Blast Fireball","Demiplane","Detect Evil and Good","Detect Magic","Detect Poison and Disease","Detect Thoughts","Dimension Door","Disguise Self","Disintegrate","Dispel Evil and Good","Dispel Magic","Divination","Divine Favor","Divine Word","Dominate Beast","Dominate Monster","Dominate Person","Dream","Druidcraft","Earthquake","Eldritch Blast","Enhance Ability","Enlarge/Reduce","Entangle","Enthrall","Etherealness","Expeditious Retreat","Eyebite","Fabricate","Faerie Fire","Faithful Hound","False Life","Fear","Feather Fall","Feeblemind","Find Familiar","Find Steed","Find Traps","Find the Path","Finger of Death","Fire Bolt","Fire Shield","Fire Storm","Fireball","Flame Blade","Flame Strike","Flaming Sphere","Flesh to Stone","Floating Disk","Fly","Fog Cloud","Forbiddance","Forcecage","Foresight","Freedom of Movement","Freezing Sphere","Gaseous Form","Gate","Geas","Gentle Repose","Giant Insect","Glibness","Globe of Invulnerability","Glyph of Warding","Goodberry","Grease","Greater Invisibility","Greater Restoration","Guardian of Faith","Guards and Wards","Guidance","Guiding Bolt","Gust of Wind","Hallow","Hallucinatory Terrain","Harm","Haste","Heal","Healing Word","Heat Metal","Hellish Rebuke","Heroes' Feast","Heroism","Hideous Laughter","Hold Monster","Hold Person","Holy Aura","Hunter's Mark","Hypnotic Pattern","Ice Storm","Identify","Illusory Script","Imprisonment","Incendiary Cloud","Inflict Wounds","Insect Plague","Instant Summons","Invisibility","Irresistible Dance","Jump","Knock","Legend Lore","Lesser Restoration","Levitate","Light","Lightning Bolt","Locate Animals or Plants","Locate Creature","Locate Object","Longstrider","Mage Armor","Mage Hand","Magic Circle","Magic Jar","Magic Missile","Magic Mouth","Magic Weapon","Magnificent Mansion","Major Image","Mass Cure Wounds","Mass Heal","Mass Healing Word","Mass Suggestion","Maze","Meld Into Stone","Mending","Message","Meteor Swarm","Mind Blank","Minor Illusion","Mirage Arcane","Mirror Image","Mislead","Misty Step","Modify Memory","Moonbeam","Move Earth","Nondetection","Pass Without Trace","Passwall","Phantasmal Killer","Phantom Steed","Planar Ally","Planar Binding","Plane Shift","Plant Growth","Poison Spray","Polymorph","Power Word Kill","Power Word Stun","Prayer of Healing","Prestidigitation","Prismatic Spray","Prismatic Wall","Private Sanctum","Produce Flame","Programmed Illusion","Project Image","Protection From Energy","Protection from Evil and Good","Protection from Poison","Purify Food and Drink","Raise Dead","Ray of Enfeeblement","Ray of Frost","Regenerate","Reincarnate","Remove Curse","Resilient Sphere","Resistance","Resurrection","Reverse Gravity","Revivify","Rope Trick","Sacred Flame","Sanctuary","Scorching Ray","Scrying","Secret Chest","See Invisibility","Seeming","Sending","Sequester","Shapechange","Shatter","Shield","Shield of Faith","Shillelagh","Shocking Grasp","Silence","Silent Image","Simulacrum","Sleep","Sleet Storm","Slow","Spare the Dying","Speak with Animals","Speak with Dead","Speak with Plants","Spider Climb","Spike Growth","Spirit Guardians","Spiritual Weapon","Stinking Cloud","Stone Shape","Stoneskin","Storm of Vengeance","Suggestion","Sunbeam","Sunburst","Symbol","Telekinesis","Telepathic Bond","Teleport","Teleportation Circle","Thaumaturgy","Thunderwave","Time Stop","Tiny Hut","Tongues","Transport via Plants","Tree Stride","True Polymorph","True Resurrection","True Seeing","True Strike","Unseen Servant","Vampiric Touch","Vicious Mockery","Wall of Fire","Wall of Force","Wall of Ice","Wall of Stone","Wall of Thorns","Warding Bond","Water Breathing","Water Walk","Web","Weird","Wind Walk","Wind Wall","Wish","Word of Recall","Zone of Truth"] }, "description": "已准备法术(准备制职业用;禁戏法由工具闸)。" },
    "race": { "type": "string", "enum": ["dragonborn","dwarf","elf","gnome","half-elf","half-orc","halfling","human","tiefling"], "description": "种族(缺省 human——枚举即 9 族名录)。" },
    "gender": { "type": "string", "enum": ["male", "female", "unknown"], "description": "性别(avatar 用)。" },
    "armor": { "type": "string", "description": "护甲（不传=职业起装）。" },
    "shield": { "type": "boolean", "description": "持盾（不传=职业起装）。" },
    "weapons": { "type": "array", "items": { "type": "string" }, "description": "面板武器名（不传=职业起装）。" },
    "gear": { "type": "array", "items": { "type": "string" }, "description": "随身物品（不传=职业起装）。" },
    "persona": { "type": "string", "description": "一句话人设。" },
    "biography": { "type": "string", "description": "背景首行。" },
    "description": { "type": "string", "description": "名册一句话简介。" },
    "background": { "type": "string", "description": "出身背景名。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { rnd, stripEmptyArrays, saveChar, presenceAdd, pbOf, XP_THRESHOLDS, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { buildClass, classHpMax, applyAsiGrowth, rollBaseArray } = await import(pathToFileURL(process.cwd() + '/../preset/lib/class-build.mjs').href)
const { CLASS_CN } = await import(pathToFileURL(process.cwd() + '/../preset/lib/opening-meta.mjs').href)
const { materializeSpellDetails } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-build.mjs').href)
const { RACE_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/race-core-data.mjs').href)
const { SPELL_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-core-data.mjs').href)
const a = globalThis.argv ?? {}

a.context?.trim() || err('缺必填 context(剧情梗概——反作弊铁则)')
a.name || err('缺必填 name')
// 我方位(2026-09-30 stance 回锅:在场关系快照,三态枚举;战斗节仍=参战名单,不受此判)
a.stance || err('缺必填 stance(同伴|中立|敌对)')
const role = a.stance === '同伴' ? 'companion' : 'npc'
const cls = String(a.class ?? '').toLowerCase()
CLASS_CN[cls] || err(`未知职业:${a.class}——barbarian/bard/cleric/druid/fighter/monk/paladin/ranger/rogue/sorcerer/warlock/wizard`)
const level = +a.level; Number.isInteger(level) && level >= 1 || err(`level 不合法:${a.level}`)
// 六维:agent 可钉 1 级基础值;不传=标准数组按职业主属性自动 roll(opening「有逻辑 roll」同律)
const hasAb = a.abilities != null && typeof a.abilities === 'object'
if (hasAb) for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha']) if (a.abilities[k] === undefined || a.abilities[k] === null) err(`缺六维 abilities.${k}`)
const ab = hasAb ? a.abilities : rollBaseArray(cls, rnd)

// class 派生(确定性数值;hp 因依赖子职走 classHpMax);缺档/坏档→err 收口
let c
try { c = buildClass(cls, level) } catch (e) { err(String(e.message ?? e).replace(/^!/, '')) }

// 技能校验(白名单+选数;不传=无技能)——anySkill(吟游诗人)的 whitelist 已是全 18
const chosenSkills = Array.isArray(a.skills) ? a.skills : []
if (chosenSkills.length) {
  chosenSkills.every(s => c.skillWhitelist.includes(s)) || err(`技能超出职业白名单:${chosenSkills.join(',')}——本职业可选 ${c.skillWhitelist.join(' / ')}`)
  chosenSkills.length === c.skillCount || err(`技能须选 ${c.skillCount} 项(本职业选数),非法数 ${chosenSkills.length}`)
}
// 子职(等级≥分岔级才落;须在语料清单)
let subclass = null
if (typeof a.subclass === 'string' && a.subclass) {
  level >= c.subclass_level || err(`子职 ${a.subclass} 的 ${cls} 到 ${c.subclass_level} 级才分岔`)
  c.subclass_list.includes(a.subclass) || err(`子职业 ${a.subclass} 不在 ${cls} 语料清单:${c.subclass_list.join(' / ')}`)
  subclass = a.subclass
}

// 六维=1 级基础值 → 按 ASI 档(4/8/12/16/19,fighter/rogue 特表)补历史成长(主属性加权随机,回执列明细)
const grown = applyAsiGrowth(cls, level, ab, rnd)

// 法术三检(与 front_commit 玩家学法术同律:存在/本职业表/环位≤可施;prepared 另禁戏法)
const spellsKnown = Array.isArray(a.spells_known) ? a.spells_known : []
const spellsPrepared = Array.isArray(a.spells_prepared) ? a.spells_prepared : []
if ((spellsKnown.length || spellsPrepared.length) && !c.isCaster) err(`!${cls} 非施法职业——spells_known/spells_prepared 不收`)
if (c.isCaster && (spellsKnown.length || spellsPrepared.length)) {
  const maxSlot = Math.max(0, ...(c.slots ?? []).map((v, i) => (v > 0 ? i + 1 : 0)))
  const check = (list, label) => { for (const s of list) {
    const slug = String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const fm = SPELL_CORE[slug]?.fm
    fm || err(`!查无法术:${s}(${label})——传法术名录内的英文名`)
    const classes = Array.isArray(fm.classes) ? fm.classes.map(x => String(x).toLowerCase()) : (typeof fm.classes === 'string' ? String(fm.classes).split(',').map(x => x.trim().toLowerCase()) : [])
    classes.includes(cls) || err(`!法术非本职业表:${s}(${cls} 表外)`)
    const slv = +fm.level; Number.isFinite(slv) || err(`!法术环位非法:${s}`)
    slv <= maxSlot || err(`!法术环位超可施:${s}(${slv} 环 > ${cls} L${level} 可施 ${maxSlot} 环)`)
    if (label === 'spells_prepared') slv >= 1 || err(`!戏法不入 prepared:${s}(0 环归 spells_known)`)
  } }
  check(spellsKnown, 'spells_known'); check(spellsPrepared, 'spells_prepared')
}

// HP:出生即满血(max=公式;带伤登场是叙事事件,归 hp_change 结算,spawn 不开直改后门)——con 用成长后值
const hpMax = classHpMax(cls, c.hit_die, grown.con, level, subclass)
const hp = hpMax

// 种族(缺省 human;数据主路 RACE_CORE,2026-09-30 零 lorebook)
const race = (a.race ?? 'human').toLowerCase()
let raceFM = RACE_CORE[race]?.fm ?? {}

// 起装(agent 可覆盖)
const eq = c.equipment ?? {}
const shield = a.shield !== undefined ? a.shield === true : eq.shield === true
const armor = a.armor ?? eq.armor ?? ''

// 施法族(位表自动落;spells_known/prepared agent 声明;spell_details=档案自含全文,SPELL_CORE 展开)
const spellDetails = materializeSpellDetails([...spellsKnown, ...spellsPrepared])
const casterFields = c.isCaster ? {
  caster_attr: c.caster_attr,
  ...(spellsKnown.length ? { spells_known: spellsKnown } : {}),
  ...(spellsPrepared.length ? { spells_prepared: spellsPrepared } : {}),
  ...(spellDetails.length ? { spell_details: spellDetails } : {}),
  concentrating: null,
  ...Object.fromEntries((c.slots ?? []).map((v, i) => [`slots_l${i + 1}`, v])),
} : {}

const j = stripEmptyArrays({
  name: a.name,
  role,
  class: cls, ...(subclass ? { subclass } : {}), level,
  hp, hp_max: hpMax,
  exp: XP_THRESHOLDS[level - 1] ?? 0,          // 成长族出生:当前级下限(expBar 连贯;L1=0 与 opening 同口径)——gain_exp 可入账升级
  hd_available: level,
  str: +grown.str, dex: +grown.dex, con: +grown.con, int: +grown.int, wis: +grown.wis, cha: +grown.cha,
  save_prof: c.save_prof,
  ...(chosenSkills.length ? { skill_prof: chosenSkills } : {}),
  ...(c.feature_details?.length ? { feature_details: c.feature_details } : {}),
  armor_prof: c.armor_prof, weapon_prof: c.weapon_prof,
  ...(armor ? { armor } : {}), ...(shield ? { shield: true } : {}),
  features: c.features,
  ...casterFields,
  race, ...(typeof a.gender === 'string' ? { gender: a.gender } : {}),
  ...(raceFM.speed ? { speed: raceFM.speed } : {}),
  ...(raceFM.darkvision ? { darkvision: raceFM.darkvision } : {}),
  ...(raceFM.languages ? { languages: raceFM.languages } : {}),
  ...(raceFM.resist ? { resist: raceFM.resist } : {}),
  weapons: Array.isArray(a.weapons) ? a.weapons : (eq.weapon ? [eq.weapon] : []),
  ...(Array.isArray(a.gear) && a.gear.length ? { gear: a.gear } : (eq.gear ? { gear: eq.gear } : {})),
  gp: eq.gp ?? 0, sp: eq.sp ?? 0, cp: eq.cp ?? 0,
  ...(a.persona ? { persona: { personality: a.persona } } : {}),
  ...(a.biography ? { biography: [a.biography] } : {}),
  ...(a.description ? { description: a.description } : {}),
  ...(a.background ? { background: a.background } : {}),
  pending: [], statuses: {},
})

const file = `characters/${a.name}.json`
saveChar(file, j)
presenceAdd(a.name, a.stance)
console.log(`[创建 · ${a.name} · ${a.stance}]`)
console.log(`  落盘: ${file} 已建档(class ${cls}${subclass ? '/' + subclass : ''} L${level} · hp ${hp} · pb +${pbOf(level)})`)
if (grown.gains.length) console.log(`  ◇ 历史成长(ASI 档自动分配,基础值→现值): ${grown.gains.join(' · ')}`)
console.log(`  ◇ AC/豁免/熟练/位表已按 class 规则派生(派生,不落显式 ac);exp/hd 成长族已出生,后续 XP 走 gain_exp`)
// 回执带面板(get_npc_state 同格式):DM 一眼看到落盘整卡全貌
console.log(`### ${a.name}（${a.stance}）`)
console.log(JSON.stringify(j, null, 1))
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)