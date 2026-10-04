/** @tavern-schema
{
  "description": "角色创建器（class 制）——有职业的 NPC/同伴建档必经本工具。何时调：NPC/同伴登场一律走本工具——普通人=职业 commoner(1 级无职业特征/无豁免无技能)，怪物(兽/魔物/敌将)才走 spawn_monster。你只输入设定：人设三层（persona 人格七键=怎么演/history 履历首行=为什么成为此/description 现况一句，写法判据见各键描述——每个角色都认真创造，禁形容词标签糊弄）、职业/等级/是否同伴，六维与法术技能照剧情设定传（六维可不传=照职业自动 roll）；一切数值（HP/豁免/熟练/位表/经验成长）由工具按职业规则算好落档；入参错处全字段一趟查完聚合报出（失败回执每行以 ! 点名一处）；成功则回执给整卡面板与成长明细。",
  "agents": ["main"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "name": { "type": "string", "required": true, "description": "角色名；同名已存在（含 player.json）则报错不覆盖。" },
    "stance": { "type": "string", "required": true, "enum": ["同伴", "中立", "敌对"], "description": "在场立场（出生当拍的快照——前端左/右分位与注入标注据此；敌我后来的翻转由尾代改附近 NPC 行,不入此参）。" },
    "class": { "type": "string", "required": true, "enum": ["barbarian","bard","commoner","cleric","druid","fighter","monk","paladin","ranger","rogue","sorcerer","warlock","wizard"], "description": "职业(枚举即名录,12 职+commoner 普通人;玩家创建面只收 12 职)。" },
    "level": { "type": "integer", "required": true, "enum": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], "description": "职业等级(1..20 卡内口径)。" },
    "abilities": { "type": "object", "properties": { "str": { "type": "integer" }, "dex": { "type": "integer" }, "con": { "type": "integer" }, "int": { "type": "integer" }, "wis": { "type": "integer" }, "cha": { "type": "integer" } }, "additionalProperties": false, "description": "六维 1 级基础值(六键全整型,内核 schema 硬校)——想钉设定才传;不传=职业主属性自动 roll;历史 ASI 由工具按等级自动补足(回执列明细)。" },
    "skills": { "type": "array", "items": { "type": "string", "enum": ["acrobatics","animal_handling","arcana","athletics","deception","history","insight","intimidation","investigation","medicine","nature","perception","performance","persuasion","religion","sleight_of_hand","stealth","survival"] }, "description": "技能熟练(18 键枚举,snake_case)——选数与职业白名单仍由工具闸;不传=无技能。" },
    "subclass": { "type": "string", "enum": ["Berserker","Champion","Devotion","Draconic","Evocation","Fiend","Hunter","Land","Life","Lore","Open Hand","Thief"], "description": "子职名(语料名录,12 值;须与本职业匹配——工具查 class×subclass 对,错配仍会降错)。" },
    "spells_known": { "type": "array", "items": { "type": "string", "enum": ["Acid Arrow","Acid Splash","Aid","Alarm","Alter Self","Animal Friendship","Animal Messenger","Animal Shapes","Animate Dead","Animate Objects","Antilife Shell","Antimagic Field","Antipathy/Sympathy","Arcane Eye","Arcane Hand","Arcane Lock","Arcane Sword","Arcanist's Magic Aura","Astral Projection","Augury","Awaken","Bane","Banishment","Barkskin","Beacon of Hope","Bestow Curse","Black Tentacles","Blade Barrier","Bless","Blight","Blindness/Deafness","Blink","Blur","Branding Smite","Burning Hands","Call Lightning","Calm Emotions","Chain Lightning","Charm Person","Chill Touch","Circle of Death","Clairvoyance","Clone","Cloudkill","Color Spray","Command","Commune","Commune With Nature","Comprehend Languages","Compulsion","Cone of Cold","Confusion","Conjure Animals","Conjure Celestial","Conjure Elemental","Conjure Fey","Conjure Minor Elementals","Conjure Woodland Beings","Contact Other Plane","Contagion","Contingency","Continual Flame","Control Water","Control Weather","Counterspell","Create Food and Water","Create Undead","Create or Destroy Water","Creation","Cure Wounds","Dancing Lights","Darkness","Darkvision","Daylight","Death Ward","Delayed Blast Fireball","Demiplane","Detect Evil and Good","Detect Magic","Detect Poison and Disease","Detect Thoughts","Dimension Door","Disguise Self","Disintegrate","Dispel Evil and Good","Dispel Magic","Divination","Divine Favor","Divine Word","Dominate Beast","Dominate Monster","Dominate Person","Dream","Druidcraft","Earthquake","Eldritch Blast","Enhance Ability","Enlarge/Reduce","Entangle","Enthrall","Etherealness","Expeditious Retreat","Eyebite","Fabricate","Faerie Fire","Faithful Hound","False Life","Fear","Feather Fall","Feeblemind","Find Familiar","Find Steed","Find Traps","Find the Path","Finger of Death","Fire Bolt","Fire Shield","Fire Storm","Fireball","Flame Blade","Flame Strike","Flaming Sphere","Flesh to Stone","Floating Disk","Fly","Fog Cloud","Forbiddance","Forcecage","Foresight","Freedom of Movement","Freezing Sphere","Gaseous Form","Gate","Geas","Gentle Repose","Giant Insect","Glibness","Globe of Invulnerability","Glyph of Warding","Goodberry","Grease","Greater Invisibility","Greater Restoration","Guardian of Faith","Guards and Wards","Guidance","Guiding Bolt","Gust of Wind","Hallow","Hallucinatory Terrain","Harm","Haste","Heal","Healing Word","Heat Metal","Hellish Rebuke","Heroes' Feast","Heroism","Hideous Laughter","Hold Monster","Hold Person","Holy Aura","Hunter's Mark","Hypnotic Pattern","Ice Storm","Identify","Illusory Script","Imprisonment","Incendiary Cloud","Inflict Wounds","Insect Plague","Instant Summons","Invisibility","Irresistible Dance","Jump","Knock","Legend Lore","Lesser Restoration","Levitate","Light","Lightning Bolt","Locate Animals or Plants","Locate Creature","Locate Object","Longstrider","Mage Armor","Mage Hand","Magic Circle","Magic Jar","Magic Missile","Magic Mouth","Magic Weapon","Magnificent Mansion","Major Image","Mass Cure Wounds","Mass Heal","Mass Healing Word","Mass Suggestion","Maze","Meld Into Stone","Mending","Message","Meteor Swarm","Mind Blank","Minor Illusion","Mirage Arcane","Mirror Image","Mislead","Misty Step","Modify Memory","Moonbeam","Move Earth","Nondetection","Pass Without Trace","Passwall","Phantasmal Killer","Phantom Steed","Planar Ally","Planar Binding","Plane Shift","Plant Growth","Poison Spray","Polymorph","Power Word Kill","Power Word Stun","Prayer of Healing","Prestidigitation","Prismatic Spray","Prismatic Wall","Private Sanctum","Produce Flame","Programmed Illusion","Project Image","Protection From Energy","Protection from Evil and Good","Protection from Poison","Purify Food and Drink","Raise Dead","Ray of Enfeeblement","Ray of Frost","Regenerate","Reincarnate","Remove Curse","Resilient Sphere","Resistance","Resurrection","Reverse Gravity","Revivify","Rope Trick","Sacred Flame","Sanctuary","Scorching Ray","Scrying","Secret Chest","See Invisibility","Seeming","Sending","Sequester","Shapechange","Shatter","Shield","Shield of Faith","Shillelagh","Shocking Grasp","Silence","Silent Image","Simulacrum","Sleep","Sleet Storm","Slow","Spare the Dying","Speak with Animals","Speak with Dead","Speak with Plants","Spider Climb","Spike Growth","Spirit Guardians","Spiritual Weapon","Stinking Cloud","Stone Shape","Stoneskin","Storm of Vengeance","Suggestion","Sunbeam","Sunburst","Symbol","Telekinesis","Telepathic Bond","Teleport","Teleportation Circle","Thaumaturgy","Thunderwave","Time Stop","Tiny Hut","Tongues","Transport via Plants","Tree Stride","True Polymorph","True Resurrection","True Seeing","True Strike","Unseen Servant","Vampiric Touch","Vicious Mockery","Wall of Fire","Wall of Force","Wall of Ice","Wall of Stone","Wall of Thorns","Warding Bond","Water Breathing","Water Walk","Web","Weird","Wind Walk","Wind Wall","Wish","Word of Recall","Zone of Truth"] }, "description": "已知法术(319 名录枚举,含戏法)——agent 视野唯一全法术名录(别处不重复枚举);本职业表/环位匹配仍由工具闸。已备表(spells_prepared)出生为空,叙事期走 update_status 落。" },
    "race": { "type": "string", "enum": ["dragonborn","dwarf","elf","gnome","half-elf","half-orc","halfling","human","tiefling"], "description": "种族(缺省 human——枚举即 9 族名录)。" },
    "gender": { "type": "string", "enum": ["male", "female", "unknown"], "description": "性别(avatar 用)。" },
    "armor": { "type": "string", "description": "护甲（不传=职业起装）。" },
    "shield": { "type": "boolean", "description": "持盾（不传=职业起装）。" },
    "weapons": { "type": "array", "items": { "type": "string" }, "description": "面板武器名（不传=职业起装）。" },
    "gear": { "type": "array", "items": { "type": "string" }, "description": "随身物品（不传=职业起装）。" },
    "persona": {
      "type": "object", "additionalProperties": false,
      "description": "人格七键（人设三维度·外观/行为/来历中「怎么演」的面，docs/persona-threelayer_zh.md §2/§5）。每个角色都认真创造：鲜活、性格各异、有故事性张力，可从文艺作品里立得住的成功角色设定汲取灵感（取神不抄皮），禁千人一面；判据=生成力（拿设定能推没写过的情境）/辨识度/张力，禁形容词标签堆叠。",
      "properties": {
        "appearance": { "type": "string", "description": "外观：一眼看上去的印象，西幻人物风——至少含头发、脸、身体一处分明的部位，加当前穿搭（服饰=现在穿什么），画面感，禁只写身高体重。" },
        "lens": { "type": "string", "description": "底色：他/她看人看事的独特镜片，一句话——判据：换个人不该也想得到；拿到没写过的情境能由此推出态度。禁『重情重义』式通用价值观。" },
        "reaction": { "type": "string", "description": "日常、冒险、战斗、情感4个方面，每个方面的遇事：行为契约，各2-3条，判据：遇到没写的情境能推出反应。禁形容词标签（『多疑』不算，『被施压时闭口不谈』才算）。" },
        "voice": { "type": "string", "description": "腔调：说话方式/嗓音/口癖；口癖点到即止，过量=模仿秀。" },
        "never": { "type": "string", "description": "红线：此人的硬边界1-3件，须可判（涉及具体人/物/场合）：『不出卖投宿客人』可判，『为人正派』不可判。" },
        "tension": { "type": "string", "description": "张力：数对矛盾，保留不合解——人物深度的来源，立得住的角色都有几处拧着的地方；都有深层矛盾和千层矛盾。" },
        "alignment": { "type": "string", "enum": ["守序善良","中立善良","混乱善良","守序中立","绝对中立","混乱中立","守序邪恶","中立邪恶","混乱邪恶"], "description": "阵营（9 值枚举）。" }
      }
    },
    "history": { "type": "string", "description": "履历首行：长期设定——出身+塑造往事，事件对『之所以是此/之所以在此』的因果，要有故事张力，不写流水账；≤120字；秘密子句行首『[秘]』前缀（不主动叙述，揭示后去前缀）。" },
    "description": { "type": "string", "description": "现况一句：身份+当前处境/动向，≤40字；出生写当下，随 history 追加同拍刷新（维护面，规则在 maintenancePrompt）。" }
  }
}
*/
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { rnd, stripEmptyArrays, saveChar, presenceAdd, pbOf, XP_THRESHOLDS, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { buildClass, classHpMax, applyAsiGrowth, rollBaseArray } = await import(pathToFileURL(process.cwd() + '/../preset/lib/class-build.mjs').href)
const { CLASS_CN } = await import(pathToFileURL(process.cwd() + '/../preset/lib/opening-meta.mjs').href)
const { NPC_CLASSES } = await import(pathToFileURL(process.cwd() + '/../preset/lib/class-core-data.mjs').href)
const { materializeSpellDetails } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-build.mjs').href)
const { personaGate } = await import(pathToFileURL(process.cwd() + '/../preset/lib/persona.mjs').href)
const { RACE_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/race-core-data.mjs').href)
const { SPELL_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-core-data.mjs').href)
const a = globalThis.argv ?? {}

// ── 字段校验聚合(2026-09-30):逐字段错误入账不即断,全字段查完一次上回执 ──
// 旧 err 首错即 exit:其余字段的坏被藏进下一轮调用(agent 修一个才见下一个);聚合一行一错并行成账单,
// 一次修净。内核失败回执整段转述(Exit 非零+stdout 原文),多行 `!` 行原样可见。
const bad = []
const gate = (ok, msg) => { ok || bad.push(String(msg).replace(/^!+/, '')); return ok }   // 返 ok 供依赖链短路
gate(a.context?.trim(), '缺必填 context(剧情梗概——反作弊铁则)')
gate(a.name, '缺必填 name')
// 同名守护(schema 承诺「同名已存在(含 player.json)则报错不覆盖」——saveChar 直写,闸落在本工具)
if (a.name) gate(!existsSync(`characters/${a.name}.json`), `同名已存在:${a.name}——建档名不得覆盖,另起名(改现有角色走 update_status/update_memory/update_inventory)`)
// 我方位(2026-09-30 stance 回锅:在场关系快照,三态枚举;战斗节仍=参战名单,不受此判)
gate(a.stance, '缺必填 stance(同伴|中立|敌对)')
// 退役参数守闸(persona.mjs 先例):spells_prepared 收回到叙事期更新器——已备表=运行时可变态,不属出生面
gate(a.spells_prepared == null, 'spells_prepared 已退役(2026-09-30 人物卡更新器分拆)——已备表走 update_status 落(spells_prepared 键)')
const role = a.stance === '同伴' ? 'companion' : 'npc'
const cls = String(a.class ?? '').toLowerCase()
// 岗位名录=玩家 12 职(CLASS_CN)∪NPC 专属(NPC_CLASSES:commoner 普通人)——玩家创建面不收后者
const JOB_CN = { ...CLASS_CN, ...NPC_CLASSES }
const clsOk = gate(JOB_CN[cls], `未知职业:${a.class}——barbarian/bard/commoner/druid/fighter/monk/paladin/ranger/rogue/sorcerer/warlock/wizard`)
const level = +a.level
const lvOk = gate(Number.isInteger(level) && level >= 1, `level 不合法:${a.level}`)
// 六维:agent 可钉 1 级基础值;不传=标准数组按职业主属性自动 roll(opening「有逻辑 roll」同律)——
// commoner 例外:SRD statblock 全 10,不 roll 标准数组(15/14 开局不是普通人)。
const hasAb = a.abilities != null && typeof a.abilities === 'object'
if (hasAb) for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha']) gate(a.abilities[k] !== undefined && a.abilities[k] !== null, `缺六维 abilities.${k}`)
const ab = hasAb ? a.abilities : (cls === 'commoner' ? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } : rollBaseArray(cls, rnd))

// class 派生(确定性数值;hp 因依赖子职走 classHpMax)——入参坏处已入账,此处只被语料缺档/坏档才收口
// (数据病非入参错,不入聚合账,err 即断)
let c = null
if (clsOk && lvOk) try { c = buildClass(cls, level) } catch (e) { err(String(e.message ?? e).replace(/^!/, '')) }

// 技能校验(白名单+选数;不传=无技能)——anySkill(吟游诗人)的 whitelist 已是全 18
const chosenSkills = Array.isArray(a.skills) ? a.skills : []
if (c && chosenSkills.length) {
  gate(chosenSkills.every(s => c.skillWhitelist.includes(s)), `技能超出职业白名单:${chosenSkills.join(',')}——本职业可选 ${c.skillWhitelist.join(' / ')}`)
  gate(chosenSkills.length === c.skillCount, `技能须选 ${c.skillCount} 项(本职业选数),非法数 ${chosenSkills.length}`)
}
// 子职(等级≥分岔级才落;须在语料清单)——两闸独立记账(一处坏不遮另一处),双闸全过才落参
let subclass = null
if (c && typeof a.subclass === 'string' && a.subclass) {
  const mark = bad.length
  gate(level >= c.subclass_level, `子职 ${a.subclass} 的 ${cls} 到 ${c.subclass_level} 级才分岔`)
  gate(c.subclass_list.includes(a.subclass), `子职业 ${a.subclass} 不在 ${cls} 语料清单:${c.subclass_list.join(' / ')}`)
  if (bad.length === mark) subclass = a.subclass
}

// 法术三检(与 front_commit 玩家学法术同律:存在/本职业表/环位≤可施)——置备表事宜归 update_status(叙事期);
// 非施法职业整表记账一次;施法职业逐法术逐检,多法术多罪并排一次报全
const spellsKnown = Array.isArray(a.spells_known) ? a.spells_known : []
if (c && spellsKnown.length && gate(c.isCaster, `!${cls} 非施法职业——spells_known 不收`)) {
  const maxSlot = Math.max(0, ...(c.slots ?? []).map((v, i) => (v > 0 ? i + 1 : 0)))
  for (const s of spellsKnown) {
    const slug = String(s).toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-')   // 撇号先弃再断(SPELL_CORE 键法:arcanists-magic-aura 式)
    const fm = SPELL_CORE[slug]?.fm
    if (!gate(fm, `!查无法术:${s}(spells_known)——传法术名录内的英文名`)) continue
    const classes = Array.isArray(fm.classes) ? fm.classes.map(x => String(x).toLowerCase()) : (typeof fm.classes === 'string' ? String(fm.classes).split(',').map(x => x.trim().toLowerCase()) : [])
    gate(classes.includes(cls), `!法术非本职业表:${s}(${cls} 表外)`)
    const slv = +fm.level
    gate(Number.isFinite(slv), `!法术环位非法:${s}`)
    gate(slv <= maxSlot, `!法术环位超可施:${s}(${slv} 环 > ${cls} L${level} 可施 ${maxSlot} 环)`)
  }
}

// 人设三层(docs/persona-threelayer_zh.md 定案 4/5):persona 七键+history 履历首行+description 现况——
// 形量硬闸与分级必填归 lib/persona.mjs(同伴四件+history/路人 lens+reaction),错误并入同一本账;
// 内容判断归 LLM,缺项回执软提示。
const pg = personaGate(a, { role, requireHistory: role === 'companion' })
bad.push(...pg.errors)

// ── 清账(全字段查完才到这):坏项逐行上回执 Exit 1;账平才走出生派生/写盘 ──
if (bad.length) { for (const m of bad) console.log('!' + m); process.exit(1) }

// 六维=1 级基础值 → 按 ASI 档(4/8/12/16/19,fighter/rogue 特表)补历史成长(主属性加权随机,回执列明细)
const grown = applyAsiGrowth(cls, level, ab, rnd)

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

// 施法族(位表自动落;spells_known agent 声明;spell_details=档案自含全文,SPELL_CORE 展开;已备表出生为空→走 update_status)
const spellDetails = materializeSpellDetails(spellsKnown)
const casterFields = c.isCaster ? {
  caster_attr: c.caster_attr,
  ...(spellsKnown.length ? { spells_known: spellsKnown } : {}),
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
  ...(pg.persona ? { persona: pg.persona } : {}),
  ...(pg.history ? { history: [pg.history] } : {}),
  ...(pg.description ? { description: pg.description } : {}),
  pending: [], statuses: {},
})

const file = `characters/${a.name}.json`
saveChar(file, j)
presenceAdd(a.name, a.stance)
console.log(`[创建 · ${a.name} · ${a.stance}]`)
console.log(`  落盘: ${file} 已建档(class ${cls}${subclass ? '/' + subclass : ''} L${level} · hp ${hp} · pb +${pbOf(level)})`)
if (grown.gains.length) console.log(`  ◇ 历史成长(ASI 档自动分配,基础值→现值): ${grown.gains.join(' · ')}`)
console.log(`  ◇ AC/豁免/熟练/位表已按 class 规则派生(派生,不落显式 ac);exp/hd 成长族已出生,后续 XP 走 gain_exp`)
if (pg.tips.length) console.log(`  ◇ 人设缺项(可后补,尾代可补): ${pg.tips.join('/')}——写法与判据见键描述`)
if (c.isCaster && ['cleric', 'druid', 'paladin', 'ranger'].includes(cls)) console.log(`  ◇ 准备制职业:spells_prepared 出生为空——叙事期走 update_status 落已备表`)
// 回执带整卡全貌(验收——DM 一眼核实落盘建档):与注入面板(panel-view 简洁投影)不同,回执保持全量。
console.log(`### ${a.name}（${a.stance}）`)
console.log(JSON.stringify(j, null, 1))
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)