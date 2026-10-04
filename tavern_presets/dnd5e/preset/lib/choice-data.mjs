// choice-data.mjs — 成长选项单源(2026-10-03):阶段1 成长选项机械化——每个「待选」特征对应的
// 选项集 + 落点字段 + 选数。消费:front_commit op=choice(落字段)、ui/acts.mjs(前端对话框)、
// gain_exp(只推 pending,不含选项);option 键=英文正典(slug),值=中文展示名。
// 落点字段:expertise 落 j.expertise(已存在,check 消费);其余为新字段(战斗风格→attack/deriveAC 消费)。
export const FIGHTING_STYLES = {
  archery: '射术', defense: '防御', dueling: '决斗',
  great_weapon_fighting: '巨武战斗', protection: '保护', two_weapon_fighting: '双武器战斗',
}
export const FAVORED_ENEMY = {
  aberration: '异怪', beast: '野兽', celestial: '天界生物', construct: '构装体', dragon: '龙',
  elemental: '元素', fey: '精类', fiend: '邪魔', giant: '巨人', monstrosity: '怪物',
  ooze: '泥怪', plant: '植物', undead: '不死生物', humanoid: '类人',
}
export const TERRAINS = {
  arctic: '极地', coast: '海岸', desert: '沙漠', forest: '森林',
  grassland: '草原', mountain: '山地', swamp: '沼泽', underdark: '幽暗地域',
}
export const METAMAGIC = {
  careful: '谨慎施法', distant: '远程施法', empowered: '强化施法', extended: '延时施法',
  heightened: '增高效力', quickened: '迅捷施法', subtle: '隐晦施法', twinned: '孪生施法',
}
export const PACT_BOONS = { blade: '魔剑契约', chain: '魔宠契约', tome: '魔典契约' }
// 魔能祈唤(SRD 全量 32,warlock L2 起选;展示名=正典中文,后续可再精校)
export const INVOCATIONS = {
  agonizing_blast: '痛苦冲击', armor_of_shadows: '暗影护甲', beast_speech: '兽语', beguiling_influence: '蛊惑影响',
  book_of_ancient_secrets: '远古秘密之书', devil_s_sight: '恶魔视觉', eldritch_sight: '魔能视觉', eldritch_spear: '魔能之矛',
  eyes_of_the_rune_keeper: '符文守护者之眼', fiendish_vigor: '邪魔活力', gaze_of_two_minds: '双心凝视', mask_of_many_faces: '万面面具',
  misty_visions: '迷雾幻象', repelling_blast: '击退冲击', thief_of_five_fates: '五命窃贼', voice_of_the_chain_master: '锁链之主之声',
  mire_the_mind: '心智泥沼', one_with_shadows: '与影合一', sign_of_ill_omen: '凶兆之印', thirsting_blade: '渴血之刃',
  bewitching_whispers: '迷魂低语', dreadful_word: '恐怖之语', sculptor_of_flesh: '血肉塑形者', ascendant_step: '升腾之步',
  minions_of_chaos: '混沌仆从', otherworldly_leap: '异界跃迁', whispers_of_the_grave: '坟墓低语', lifedrinker: '夺命饮者',
  chains_of_carceri: '卡塞里锁链', master_of_myriad_forms: '万形大师', visions_of_distant_realms: '远域视界', witch_sight: '巫术视觉',
}
// 游侠「猎人」子选择(L3/7/11/15 各二~三选一)
export const HUNTERS_PREY = { colossus_slayer: '巨兽斩杀', giant_killer: '巨人杀手', horde_breaker: '群敌破击' }
export const DEFENSIVE_TACTICS = { escape_the_horde: '逃离敌群', multiattack_defense: '多重攻击防御', steel_will: '钢铁意志' }
export const MULTIATTACK = { volley: '齐射', whirlwind_attack: '旋风攻击' }
export const SUPERIOR_HUNTERS_DEFENSE = { evasion: '闪避', stand_against_the_tide: '逆潮而立', uncanny_dodge: '直觉闪避' }
export const SKILL_CN = {
  acrobatics: '杂技', animal_handling: '驯兽', arcana: '奥秘', athletics: '运动', deception: '欺瞒',
  history: '历史', insight: '洞悉', intimidation: '威吓', investigation: '调查', medicine: '医药',
  nature: '自然', perception: '察觉', performance: '表演', persuasion: '游说', religion: '宗教',
  sleight_of_hand: '巧手', stealth: '隐匿', survival: '生存',
}

// 特征基础名(slug,与 FEATURE_CN 同键)→ 成长选项定义。max>1 为多选(数组落点)。
export const CHOICES = {
  fighting_style: { field: 'fighting_style', min: 1, max: 1, options: FIGHTING_STYLES },
  favored_enemy: { field: 'favored_enemy', min: 1, max: 1, options: FAVORED_ENEMY },
  natural_explorer: { field: 'natural_explorer', min: 1, max: 1, options: TERRAINS },
  expertise: { field: 'expertise', min: 2, max: 2, options: SKILL_CN },
  metamagic: { field: 'metamagic', min: 2, max: 2, options: METAMAGIC },
  pact_boon: { field: 'pact_boon', min: 1, max: 1, options: PACT_BOONS },
  eldritch_invocations: { field: 'invocations', min: 2, max: 2, options: INVOCATIONS },
  hunters_prey: { field: 'hunters_prey', min: 1, max: 1, options: HUNTERS_PREY },
  defensive_tactics: { field: 'defensive_tactics', min: 1, max: 1, options: DEFENSIVE_TACTICS },
  multiattack: { field: 'multiattack_choice', min: 1, max: 1, options: MULTIATTACK },
  superior_hunters_defense: { field: 'superior_hunters_defense', min: 1, max: 1, options: SUPERIOR_HUNTERS_DEFENSE },
}

// 子职特征(12)→ 特判 kind='subclass'(选项=CLASS_CORE[cls].fm.subclass 按职业动态取);法术选择→kind='spells'(复用学法术流)。
const SUBCLASS_FEATURES = ['primal_path', 'bard_college', 'divine_domain', 'druid_circle', 'martial_archetype', 'monastic_tradition',
  'sacred_oath', 'ranger_archetype', 'roguish_archetype', 'sorcerous_origin', 'otherworldly_patron', 'arcane_tradition']
const SPELL_CHOICES = ['magical_secrets', 'mystic_arcanum', 'spell_mastery', 'signature_spell']

// 特征基础名(英文,含括注如 'Favored Enemy (1 type)')→ 成长选项 kind('subclass'/'spells'/静态键)。查无=null。
export function resolveChoice(name) {
  const s = String(name ?? '').split('|')[0].split('(')[0].trim()
  if (/^spellcasting\s*:/i.test(s)) return null
  const slug = s.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  if (SUBCLASS_FEATURES.includes(slug)) return 'subclass'
  if (SPELL_CHOICES.includes(slug)) return 'spells'
  return CHOICES[slug] ? slug : null
}

// pending 待办行(如 'LV3·Fighting Style 待选')→ CHOICES 键(slug)。查无=非成长选项待办。
export function pendingKind(entry) {
  const m = /^LV\d+·(.+?)\s*待选\s*$/.exec(String(entry))
  return m ? resolveChoice(m[1]) : null
}
