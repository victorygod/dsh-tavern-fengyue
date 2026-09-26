// glossary-cn — EN→CN 显示名单源术语表（2026-09-27 定案）。
// 职责：面板/开场表单的「值中文化」唯一出处——key/节标题保持 SRD 英文，值译中文。
// 口径 = docs/translation-protocol_zh.md v3 台版锚点（Rogue 盗贼 / Paladin 圣骑士 /
//   Warlock 契术师 / Gnome 地侏 / Conjuration 咒法；Chill Touch 寒颤之触）。
// 纪律：**存储层不改**（character.json 的 spells_known/weapons 仍存英文——cast/attack
//   按英文 slug 找 lorebook 卡）；本表只供 ui_data（泵投影）/ opening_data（表单 META）消费。
// 消费方：scripts/ui_data.mjs · scripts/opening_data.mjs。view.mjs 不改（其内联小表照旧兜底）。

// 归一：一切非字母数字折叠为 `_`（"Heroes' Feast"→heroes_feast、"Fire Bolt"→fire_bolt）。
export const norm = s => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
export const cn = (map, key) => { const k = norm(key); return (k && map[k] != null) ? map[k] : String(key ?? '') }

// ── 319 法术（SRD spells/ 全量；台版/社区通行译法） ──
export const SPELL_CN = {
  acid_arrow: '强酸箭', acid_splash: '酸液飞溅', aid: '援助术', alarm: '警报术', alter_self: '变身术',
  animal_friendship: '动物友善', animal_messenger: '动物信使', animal_shapes: '动物形体', animate_dead: '亡灵唤起',
  animate_objects: '操控物体', antilife_shell: '抗生命法球', antimagic_field: '反魔法力场', antipathy_sympathy: '反感/共鸣',
  arcane_eye: '秘法眼', arcane_hand: '秘法之手', arcane_lock: '秘法锁', arcane_sword: '秘法剑',
  arcanist_s_magic_aura: '秘法师的魔法灵光', astral_projection: '星界投射', augury: '卜筮术', awaken: '觉醒术',
  bane: '灾厄术', banishment: '放逐术', barkskin: '树皮术', beacon_of_hope: '希望信标', bestow_curse: '降咒术',
  black_tentacles: '黑暗触手', blade_barrier: '刀刃屏障', bless: '祝福术', blight: '枯萎术', blindness_deafness: '目盲/耳聋',
  blink: '闪烁术', blur: '朦胧术', branding_smite: '烙印斩', burning_hands: '燃烧之手', call_lightning: '召唤雷电',
  calm_emotions: '安抚情绪', chain_lightning: '连环闪电', charm_person: '魅惑人类', chill_touch: '寒颤之触',
  circle_of_death: '死亡法阵', clairvoyance: '千里眼', clone: '克隆术', cloudkill: '毒云术', color_spray: '七彩喷射',
  command: '命令术', commune: '通神术', commune_with_nature: '与自然沟通', comprehend_languages: '通晓语言',
  compulsion: '强制术', cone_of_cold: '寒冰锥', confusion: '混乱术', conjure_animals: '召唤动物',
  conjure_celestial: '召唤天界生物', conjure_elemental: '召唤元素', conjure_fey: '召唤精类',
  conjure_minor_elementals: '召唤次级元素', conjure_woodland_beings: '召唤林地生物', contact_other_plane: '联络异界',
  contagion: '传染术', contingency: '应急术', continual_flame: '不灭明焰', control_water: '操控水体',
  control_weather: '操控天气', counterspell: '反制法术', create_food_and_water: '创造饮食', create_or_destroy_water: '创造或毁灭水',
  create_undead: '创造亡灵', creation: '创造术', cure_wounds: '治疗伤口', dancing_lights: '舞光术', darkness: '黑暗术',
  darkvision: '黑暗视觉', daylight: '昼明术', death_ward: '死亡防护', delayed_blast_fireball: '延迟爆裂火球',
  demiplane: '半位面', detect_evil_and_good: '侦测善恶', detect_magic: '侦测魔法', detect_poison_and_disease: '侦测毒害与疾病',
  detect_thoughts: '侦测思想', dimension_door: '任意门', disguise_self: '伪装术', disintegrate: '解离术',
  dispel_evil_and_good: '解除善恶', dispel_magic: '解除魔法', divination: '预言术', divine_favor: '神圣恩宠',
  divine_word: '神圣之言', dominate_beast: '支配野兽', dominate_monster: '支配怪物', dominate_person: '支配人类',
  dream: '梦魇术', druidcraft: '德鲁伊戏法', earthquake: '地震术', eldritch_blast: '魔能爆', enhance_ability: '强化属性',
  enlarge_reduce: '变巨/缩小术', entangle: '纠缠术', enthrall: '迷魂术', etherealness: '以太化',
  expeditious_retreat: '加速撤离', eyebite: '魔眼术', fabricate: '造物术', faerie_fire: '精灵之火',
  faithful_hound: '忠犬术', false_life: '虚假生命', fear: '恐惧术', feather_fall: '羽落术', feeblemind: '弱智术',
  find_familiar: '召唤魔宠', find_steed: '召唤坐骑', find_the_path: '寻路术', find_traps: '寻找陷阱',
  finger_of_death: '死亡一指', fire_bolt: '火焰箭', fire_shield: '火焰护盾', fire_storm: '火焰风暴', fireball: '火球术',
  flame_blade: '火焰之刃', flame_strike: '烈焰打击', flaming_sphere: '炽焰法球', flesh_to_stone: '石化术',
  floating_disk: '漂浮碟', fly: '飞行术', fog_cloud: '云雾术', forbiddance: '禁入术', forcecage: '力场牢笼',
  foresight: '远见术', freedom_of_movement: '行动自如', freezing_sphere: '冰冻法球', gaseous_form: '气化形态',
  gate: '传送门', geas: '誓约术', gentle_repose: '安息术', giant_insect: '巨型昆虫', glibness: '巧言术',
  globe_of_invulnerability: '无敌法球', glyph_of_warding: '防护符文', goodberry: '好莓术', grease: '油腻术',
  greater_invisibility: '高等隐形术', greater_restoration: '高等复原术', guardian_of_faith: '信仰守护',
  guards_and_wards: '守护与结界', guidance: '指引术', guiding_bolt: '引导之箭', gust_of_wind: '狂风术', hallow: '圣化术',
  hallucinatory_terrain: '幻景地形', harm: '重伤术', haste: '加速术', heal: '治愈术', healing_word: '治疗真言',
  heat_metal: '灼热金属', hellish_rebuke: '地狱火焚', heroes_feast: '英雄盛宴', heroism: '英勇术',
  hideous_laughter: '狂笑术', hold_monster: '定身怪物', hold_person: '定身人类', holy_aura: '神圣灵光',
  hunter_s_mark: '猎人印记', hypnotic_pattern: '催眠图纹', ice_storm: '冰风暴', identify: '鉴定术',
  illusory_script: '幻影文字', imprisonment: '禁锢术', incendiary_cloud: '燃烧之云', inflict_wounds: '造成伤害',
  insect_plague: '虫灾术', instant_summons: '即时召唤', invisibility: '隐形术', irresistible_dance: '无法抗拒之舞',
  jump: '跳跃术', knock: '开门术', legend_lore: '传说典故', lesser_restoration: '次级复原术', levitate: '漂浮术',
  light: '光亮术', lightning_bolt: '闪电束', locate_animals_or_plants: '定位动植物', locate_creature: '定位生物',
  locate_object: '定位物件', longstrider: '长途步', mage_armor: '法师护甲', mage_hand: '法师之手',
  magic_circle: '魔法阵', magic_jar: '魔法瓶', magic_missile: '魔法飞弹', magic_mouth: '魔法口', magic_weapon: '魔法武器',
  magnificent_mansion: '华丽府邸', major_image: '高等幻影', mass_cure_wounds: '群体治疗伤口', mass_heal: '群体治愈术',
  mass_healing_word: '群体治疗真言', mass_suggestion: '群体暗示术', maze: '迷宫术', meld_into_stone: '融入石中',
  mending: '修复术', message: '传讯术', meteor_swarm: '流星爆', mind_blank: '心灵屏障', minor_illusion: '次级幻影',
  mirage_arcane: '秘法幻境', mirror_image: '镜像术', mislead: '误导术', misty_step: '迷雾步',
  modify_memory: '修改记忆', moonbeam: '月光术', move_earth: '移动土石', nondetection: '隐藏术',
  pass_without_trace: '无踪术', passwall: '穿墙术', phantasmal_killer: '幻影杀手', phantom_steed: '幻影坐骑',
  planar_ally: '异界盟友', planar_binding: '异界束缚', plane_shift: '异位面传送', plant_growth: '植物生长',
  poison_spray: '毒液喷射', polymorph: '变形术', power_word_kill: '律令死亡', power_word_stun: '律令昏迷',
  prayer_of_healing: '治愈祷言', prestidigitation: '魔术戏法', prismatic_spray: '虹彩喷射', prismatic_wall: '虹彩墙',
  private_sanctum: '私人圣所', produce_flame: '制造火焰', programmed_illusion: '预置幻象', project_image: '投影术',
  protection_from_energy: '能量防护', protection_from_evil_and_good: '防护善恶', protection_from_poison: '防毒术',
  purify_food_and_drink: '净化饮食', raise_dead: '复活死者', ray_of_enfeeblement: '衰弱射线', ray_of_frost: '冰霜射线',
  regenerate: '再生术', reincarnate: '转世术', remove_curse: '解除诅咒', resilient_sphere: '弹性法球',
  resistance: '抗性术', resurrection: '复活术', reverse_gravity: '逆转重力', revivify: '回生术', rope_trick: '绳技',
  sacred_flame: '神圣火焰', sanctuary: '庇护术', scorching_ray: '灼热射线', scrying: '探查术', secret_chest: '秘藏箱',
  see_invisibility: '看破隐形', seeming: '幻形术', sending: '送讯术', sequester: '隐匿术', shapechange: '形体变化',
  shatter: '粉碎术', shield: '护盾术', shield_of_faith: '信仰护盾', shillelagh: '橡木棍', shocking_grasp: '电击之触',
  silence: '沉默术', silent_image: '无声幻影', simulacrum: '拟像术', sleep: '睡眠术', sleet_storm: '冰雨风暴',
  slow: '缓慢术', spare_the_dying: '挽救垂死', speak_with_animals: '与动物交谈', speak_with_dead: '与死者交谈',
  speak_with_plants: '与植物交谈', spider_climb: '蛛行术', spike_growth: '尖刺生长', spirit_guardians: '灵体守护',
  spiritual_weapon: '灵体武器', stinking_cloud: '恶臭云雾', stone_shape: '塑石术', stoneskin: '石肤术',
  storm_of_vengeance: '复仇风暴', suggestion: '暗示术', sunbeam: '日光射线', sunburst: '日爆术', symbol: '符印术',
  telekinesis: '念力术', telepathic_bond: '心灵链接', teleport: '传送术', teleportation_circle: '传送法阵',
  thaumaturgy: '奇术', thunderwave: '雷鸣波', time_stop: '时间停止', tiny_hut: '小屋术', tongues: '语言通',
  transport_via_plants: '植物传送', tree_stride: '树行术', true_polymorph: '真实变形术', true_resurrection: '真实复活',
  true_seeing: '真知术', true_strike: '真击术', unseen_servant: '隐形仆人', vampiric_touch: '吸血之触',
  vicious_mockery: '恶毒嘲讽', wall_of_fire: '火墙术', wall_of_force: '力场墙', wall_of_ice: '冰墙术',
  wall_of_stone: '石墙术', wall_of_thorns: '荆棘之墙', warding_bond: '守护连结', water_breathing: '水下呼吸',
  water_walk: '水面行走', web: '蛛网术', weird: '诡谲术', wind_walk: '风之步', wind_wall: '风墙术', wish: '许愿术',
  word_of_recall: '召回真言', zone_of_truth: '真言法阵',
}

// ── 职业名（Spellcasting: X 转写用；与 view.mjs CLS_CN 同源同值） ──
export const CLS_CN = {
  barbarian: '野蛮人', bard: '吟游诗人', cleric: '牧师', druid: '德鲁伊', fighter: '战士', monk: '武僧',
  paladin: '圣骑士', ranger: '游侠', rogue: '盗贼', sorcerer: '术士', warlock: '契术师', wizard: '法师',
}

// ── 子职业（SRD classes/*.md subclass 全量 12） ──
export const SUBCLASS_CN = {
  berserker: '狂暴者', champion: '冠军', devotion: '奉献', draconic: '龙脉', evocation: '塑能', fiend: '魔君',
  hunter: '猎人', land: '大地', life: '生命', lore: '博识', open_hand: '空手', thief: '窃贼',
}

// ── 语言（SRD languages/ 全量 16；对齐 protocol v3 ⑪ 语言名全局定案） ──
export const LANGUAGE_CN = {
  abyssal: '深渊语', celestial: '天界语', common: '通用语', deep_speech: '深语', draconic: '龙语',
  dwarvish: '矮人语', elvish: '精灵语', giant: '巨人语', gnomish: '地侏语', goblin: '哥布林语',
  halfling: '半身人语', infernal: '炼狱语', orc: '兽人语', primordial: '原初语', sylvan: '妖精语', undercommon: '地下通用语',
}

// ── 武器（SRD 简易+军用全量；slug 与 equipment/proficiencies 对齐） ──
export const WEAPON_CN = {
  club: '木棒', dagger: '匕首', greatclub: '巨木棒', handaxe: '手斧', javelin: '标枪', light_hammer: '轻型战锤',
  mace: '硬头锤', quarterstaff: '长棍', sickle: '镰刀', spear: '矛', light_crossbow: '轻弩', dart: '飞镖',
  shortbow: '短弓', sling: '投石索', battleaxe: '战斧', flail: '链枷', glaive: '长柄刀', greataxe: '巨斧',
  greatsword: '巨剑', halberd: '戟', lance: '骑枪', longsword: '长剑', maul: '大槌', morningstar: '晨星锤',
  pike: '长矛', rapier: '细剑', scimitar: '弯刀', shortsword: '短剑', trident: '三叉戟', war_pick: '战镐',
  warhammer: '战锤', whip: '鞭', blowgun: '吹箭', hand_crossbow: '手弩', heavy_crossbow: '重弩', longbow: '长弓', net: '网',
}

// ── 特征基础名（SRD classes/*.md Features 列，去括注；Spellcasting: X 由 featureCn 特判） ──
export const FEATURE_CN = {
  ability_score_improvement: '属性值提升', action_surge: '动作如潮', arcane_recovery: '秘法复苏',
  arcane_tradition: '秘法传统', archdruid: '大德鲁伊', aura_of_courage: '勇气灵光', aura_of_protection: '防护灵光',
  bard_college: '吟游诗人学院', bardic_inspiration: '吟游诗人激励', beast_spells: '野兽施法', blindsense: '盲视感知',
  brutal_critical: '凶蛮暴击', channel_divinity: '引导神力', channel_divinity_turn_undead: '引导神力·驱散亡灵',
  cleansing_touch: '净化之触', countercharm: '反魅惑', cunning_action: '狡黠动作', danger_sense: '危险感知',
  deflect_missiles: '拨挡飞弹', destroy_undead: '摧毁亡灵', diamond_soul: '钻石之魂', divine_domain: '神圣领域',
  divine_health: '神圣健康', divine_intervention: '神圣干预', divine_sense: '神圣感知', divine_smite: '神圣打击',
  domain_spells: '领域法术', druid_circle: '德鲁伊圈', druidic: '德鲁伊语', eldritch_invocations: '魔能祈唤',
  eldritch_master: '魔能大师', elusive: '无踪', empty_body: '空灵之体', evasion: '闪避', expertise: '专精',
  extra_attack: '额外攻击', fast_movement: '快速移动', favored_enemy: '宿敌', feral_instinct: '野性本能',
  feral_senses: '野性感官', fighting_style: '战斗风格', flexible_casting: '灵活施法',
  flexible_casting_converting_spell_slot: '灵活施法：转换法术位', flexible_casting_creating_spell_slots: '灵活施法：创造法术位',
  flurry_of_blows: '疾风连击',
  foe_slayer: '屠敌者', font_of_inspiration: '灵感之源', font_of_magic: '魔法之源', hide_in_plain_sight: '隐于众目',
  improved_divine_smite: '高等神圣打击', indomitable: '不屈', indomitable_might: '不屈力量',
  jack_of_all_trades: '万事通', ki: '气', ki_empowered_strikes: '气贯打击', land_s_stride: '大地之步',
  lay_on_hands: '圣疗', magical_secrets: '魔法秘辛', martial_archetype: '武术流派', martial_arts: '武术',
  metamagic: '超魔法', monastic_tradition: '修院传统', mystic_arcanum: '秘法奥秘', natural_explorer: '天生探索者',
  oath_spells: '誓约法术', otherworldly_patron: '异界宗主', pact_boon: '契约恩惠', pact_magic: '契约魔法',
  path_feature: '道途特性', patient_defense: '以守代攻', perfect_self: '圆满自我', persistent_rage: '持续狂暴',
  primal_champion: '原初冠军', primal_path: '原初道途', primeval_awareness: '原始感知', purity_of_body: '纯净之躯',
  rage: '狂暴', ranger_archetype: '游侠流派', reckless_attack: '鲁莽攻击', relentless_rage: '不屈狂暴',
  reliable_talent: '可靠天赋', roguish_archetype: '盗贼流派', sacred_oath: '神圣誓言', second_wind: '回气',
  signature_spell: '招牌法术', slippery_mind: '油滑心智', slow_fall: '缓慢坠落', sneak_attack: '偷袭',
  song_of_rest: '休息之歌', sorcerous_origin: '术法起源', sorcerous_restoration: '术法恢复', spell_mastery: '法术精通',
  spellcasting: '施法', step_of_the_wind: '疾风步', stillness_of_mind: '心如止水', stroke_of_luck: '幸运一击',
  stunning_strike: '震慑打击', superior_inspiration: '卓越灵感', thieves_cant: '盗贼黑话', timeless_body: '不朽之躯',
  tongue_of_the_sun_and_moon: '日与月之舌', unarmored_defense: '无甲防御', unarmored_movement: '无甲移动',
  uncanny_dodge: '直觉闪避', vanish: '消隐', wild_shape: '荒野变形',
}

// ── 括注轻译（机械数值不译：dice/CR/环位；只译 prose 词；复合词先于单词） ──
const PAREN_CN = [
  [/\(([^()]*)\)/g, '（$1）'],
  [/no flying or swim speed/g, '无飞行或游泳速度'], [/no flying speed/g, '无飞行速度'],
  [/terrain types?/g, '地形类型'], [/terrains?/g, '地形'],
  [/\btypes?\b/g, '类'], [/\buses?\b/g, '次'], [/\bdice\b/g, '骰'], [/\bdie\b/g, '骰'],
  [/or below/g, '或以下'], [/or lower/g, '或以下'],
  [/\brest\b/g, '休'], [/\blevels?\b/g, '环'], [/\benem(y|ies)\b/g, '敌人'],
]

// 特征单条名译（输入=features 行首段，如 "Spellcasting: Bard"、"Bardic Inspiration (d6)"）。
export function featureNameCn(name) {
  const s = String(name ?? '').trim()
  if (!s) return s
  // Spellcasting: X → 施法（X中文）
  const sc = /^Spellcasting:\s*(.+)$/i.exec(s)
  if (sc) return `施法（${cn(CLS_CN, sc[1])}）`
  const m = /^(.*?)\s*(\([^)]*\))?$/.exec(s)
  const base = (m?.[1] ?? s).trim()
  let out = cn(FEATURE_CN, base)
  if (out === base) {   // 未命中→泛化 "Base: Sub"（如 Channel Divinity: X）——译前半,后半原样
    const c2 = /^([^:]+):\s*(.+)$/.exec(base)
    if (c2) { const b = cn(FEATURE_CN, c2[1]); if (b !== c2[1]) out = `${b}：${c2[2]}` }
  }
  if (m?.[2]) { let p = m[2]; for (const [re, rep] of PAREN_CN) p = p.replace(re, rep); out += p }
  return out
}

// ── 便捷出口（泵/表单统一调用，避免各自拼 cn） ──
export const spellCn = n => cn(SPELL_CN, n)
export const subclassCn = n => cn(SUBCLASS_CN, n)
export const languageCn = n => cn(LANGUAGE_CN, n)
export const weaponCn = n => cn(WEAPON_CN, n)
