// 法术结算数据表(2026-09-28 由 lorebook 320 件正文批量抽取+人核;消费方=cast.mjs 选骰)。
// 单一事实源=语料正文——再抽取/改语料须 diff 评审;手工条目:eldritch-blast(计数型,连调,非骰增)·spiritual-weapon(attrMod+两环一档)。
// 字典:damage 基础骰/type 伤害类型/hitFlat Hit 行平值(attrMod 互斥)/cantripScale 戏法骰随角色档 5/11/17/upcast 每档增量/upcastBase 对照环/upcastStep 每 N 环一档/bolts 基础弹数/upcastBolts 每环增弹(分配=DM,dice 逃生舱)/heal 治疗 dice/healMod 加施法属性/healFlat 平值
// 语义分类(2026-09-28 审计批,判决表=docs/audit-fixes_zh.md §1.3):suppress=伤害面整体封死(语料数字属实但非施放时点直伤——mishap/骑手/地形/条件/自险款,后续按 RAW 用 damage/check 工具逐事件结算);save=T 级豁免覆写(修 FM 洞:call-lightning 等 RAW 实为豁免型而 FM 缺 save 键);healMulti=群疗法术逐目标独立掷;buff 承接武器附伤骑手(stat:'damage',attack 伤害侧掷算)。
// 2026-09-29 补录:池/断定/失败落状态三形态开槽 + 治疗翻生族 + buff 族——见表尾块注释;判决理由=docs/spell-coverage-audit_zh.md。
export const SPELL_DATA = {
  'false-life': { temp: '1d4+4' },
  'bless': { buff: { effect: '攻/豁 +1d4，持续 1 分钟（专注）', mods: [{ stat: 'attack_save', magnitude: '1d4' }] } },
  'bane': { buff: { effect: '攻/豁 −1d4，持续 1 分钟（专注）', mods: [{ stat: 'attack_save', magnitude: '-1d4' }] } },
  'shield-of-faith': { buff: { effect: 'AC +2，持续 10 分钟（专注）', mods: [{ stat: 'ac', magnitude: 2 }] } },
  'haste': { buff: { effect: 'AC +2，额外动作/速度倍化，持续 1 分钟（专注）', mods: [{ stat: 'ac', magnitude: 2 }] } },
  'acid-arrow': { damage: '4d4', type: 'acid', upcast: '1d4', upcastBase: 2 },
  'acid-splash': { damage: '1d6', type: 'acid', cantripScale: true },
  'arcane-hand': { suppress: true },   // 构装体攻击(Clenched Fist=melee spell attack 每击)——攻击通道二期 backlog B
  'arcane-sword': { damage: '3d10', type: 'force' },
  'bestow-curse': { suppress: true },   // 诅咒四选一无伤害款(1d8=误抽);违令伤害款归 damage 工具
  'black-tentacles': { damage: '3d6', type: 'bludgeoning' },
  'blade-barrier': { damage: '6d10', type: 'slashing' },
  'blight': { damage: '8d8', type: 'necrotic', upcast: '1d8', upcastBase: 4 },
  'branding-smite': { buff: { effect: '武器命中下一击附伤 +2d6 光耀并使隐形者显形，持续 1 分钟（专注）', mods: [{ stat: 'damage', magnitude: '2d6' }] } },
  'burning-hands': { damage: '3d6', type: 'fire', upcast: '1d6', upcastBase: 1 },
  'call-lightning': { damage: '3d10', type: 'lightning', upcast: '1d10', upcastBase: 3, save: 'dex' },
  'chain-lightning': { damage: '10d8', type: 'lightning', bolts: 3, upcastBolts: 1 },
  'chill-touch': { damage: '1d8', type: 'necrotic', cantripScale: true },
  'circle-of-death': { damage: '8d6', type: 'necrotic', upcast: '2d6', upcastBase: 6 },
  'cloudkill': { damage: '5d8', type: 'poison', upcast: '1d8', upcastBase: 5 },
  'cone-of-cold': { damage: '8d8', type: 'cold', upcast: '1d8', upcastBase: 5 },
  'contact-other-plane': { suppress: true },   // 自险款:施法者自身 DC15 INT 检定,失败 6d6 归 damage 工具
  'control-water': { suppress: true },   // RAW 无伤害(2d8=误抽)
  'cure-wounds': { upcast: '1d8', upcastBase: 1, heal: '1d8', healMod: true },
  'dimension-door': { suppress: true },   // 到点占位冲突款 4d6=事件,归 damage 工具
  'disintegrate': { damage: '10d6', type: 'force', hitFlat: 40, upcast: '3d6', upcastBase: 6 },
  'divine-favor': { buff: { effect: '武器命中附伤 +1d4 光耀，持续 1 分钟（专注）', mods: [{ stat: 'damage', magnitude: '1d4' }] } },
  'dream': { suppress: true },   // 信使术,无施放时点伤害(3d6=误抽)
  'earthquake': { damage: '5d6', type: 'bludgeoning', save: 'dex' },
  'eldritch-blast': { damage: '1d10', type: 'force' },
  'enlarge-reduce': { suppress: true },   // 体型武器补差 1d4=骑手而非法术直伤;安/减益叙述+update_status
  'faithful-hound': { damage: '4d8', type: 'piercing' },
  'feeblemind': { damage: '4d6', type: 'psychic' },
  'finger-of-death': { damage: '7d8', type: 'necrotic', hitFlat: 30 },
  'fire-bolt': { damage: '1d10', type: 'fire', cantripScale: true },
  'fire-storm': { damage: '7d10', type: 'fire' },
  'fireball': { damage: '8d6', type: 'fire', upcast: '1d6', upcastBase: 3 },
  'flame-blade': { suppress: true },   // 构装体持剑(melee spell attack 每击)——攻击通道二期 backlog B
  'flame-strike': { damage: '4d6', type: 'fire', upcast: '1d6', upcastBase: 5 },
  'flaming-sphere': { damage: '2d6', type: 'fire', upcast: '1d6', upcastBase: 2, save: 'dex' },   // RAW 撞压=DEX 豁免,FM 缺 save 键
  'freezing-sphere': { damage: '10d6', type: 'cold', upcast: '1d6', upcastBase: 6 },
  'geas': { suppress: true },   // 违令 5d10=事件款,归 damage 工具
  'guiding-bolt': { damage: '4d6', type: 'radiant', upcast: '1d6', upcastBase: 1 },
  'harm': { damage: '14d6', type: 'necrotic' },
  'healing-word': { upcast: '1d4', upcastBase: 1, heal: '1d4', healMod: true },
  'heat-metal': { damage: '2d8', type: 'fire', upcast: '1d8', upcastBase: 2 },
  'hellish-rebuke': { damage: '2d10', type: 'fire', upcast: '1d10', upcastBase: 1 },
  'ice-storm': { damage: '2d8', type: 'bludgeoning', upcast: '1d8', upcastBase: 4 },
  'incendiary-cloud': { damage: '10d8', type: 'fire' },
  'inflict-wounds': { damage: '3d10', type: 'necrotic', upcast: '1d10', upcastBase: 1 },
  'insect-plague': { damage: '4d10', type: 'piercing', upcast: '1d10', upcastBase: 5 },
  'lightning-bolt': { damage: '8d6', type: 'lightning', upcast: '1d6', upcastBase: 3 },
  'magic-missile': { damage: '1d4', type: 'force', hitFlat: 1, bolts: 3, upcastBolts: 1 },
  'mass-cure-wounds': { upcast: '1d8', upcastBase: 5, heal: '3d8', healMod: true, healMulti: true },
  'meld-into-stone': { suppress: true },   // 仪式融合石,无伤害
  'meteor-swarm': { damage: '20d6', type: 'fire' },
  'moonbeam': { damage: '2d10', type: 'radiant' },
  'phantasmal-killer': { damage: '4d10', type: 'psychic', upcast: '1d10', upcastBase: 4 },
  'poison-spray': { damage: '1d12', type: 'poison', cantripScale: true },
  'prismatic-spray': { damage: '10d6', type: 'fire' },
  'prismatic-wall': { suppress: true },   // 穿墙 10d6=事件(穿行时 damage 工具),施放只筑墙
  'produce-flame': { damage: '1d8', type: 'fire', cantripScale: true },
  'ray-of-frost': { damage: '1d8', type: 'cold', cantripScale: true },
  'regenerate': { heal: '4d8', healFlat: 15 },
  'sacred-flame': { damage: '1d8', type: 'radiant', cantripScale: true },
  'scorching-ray': { damage: '2d6', type: 'fire', bolts: 3, upcastBolts: 1 },
  'shatter': { damage: '3d8', type: 'thunder' },
  'shocking-grasp': { damage: '1d8', type: 'lightning', cantripScale: true },
  'spike-growth': { suppress: true },   // 地形款:踏入移动伤害=事件,归 damage 工具
  'spirit-guardians': { damage: '3d8', type: 'radiant', upcast: '1d8', upcastBase: 3, save: 'wis' },   // RAW WIS 豁免半伤,FM 缺 save 键
  'storm-of-vengeance': { damage: '2d6', type: 'thunder' },
  'sunbeam': { damage: '6d8', type: 'radiant' },
  'sunburst': { damage: '12d6', type: 'radiant' },
  'teleport': { suppress: true },   // Mishap 款 3d10=事件(GM 重掷传送表),归 damage 工具
  'thunderwave': { damage: '2d8', type: 'thunder', upcast: '1d8', upcastBase: 1 },
  'vampiric-touch': { damage: '3d6', type: 'necrotic', upcast: '1d6', upcastBase: 3 },
  'vicious-mockery': { damage: '1d4', type: 'psychic', cantripScale: true },
  'wall-of-fire': { damage: '5d8', type: 'fire', upcast: '1d8', upcastBase: 4 },
  'wall-of-ice': { damage: '10d6', type: 'cold' },
  'wall-of-thorns': { damage: '7d8', type: 'piercing', upcast: '1d8', upcastBase: 6 },
  'web': { suppress: true },   // 燃网 2d4=事件(网燃时 damage 工具),施放只做束缚效果
  'weird': { damage: '4d10', type: 'psychic' },
  'wind-wall': { damage: '3d8', type: 'bludgeoning' },
  'wish': { suppress: true },   // 施法压力款(非复制品用法后每法术 1d10×环)=事件,归 damage 工具
  'spiritual-weapon': { damage: '1d8', type: 'force', attrMod: true, upcast: '1d8', upcastBase: 2, upcastStep: 2 },
  // ══ 2026-09-29 补录:三缺席形态开槽(池/断定/失败落状态)+治疗翻生族+确认读口的 buff ══
  // 新键:pool=HP 额度罩池(按当前 HP 升序罩,装不下即止;sleep/color-spray)|judge=当前 HP 阈值断定(首中低档优先;
  //   power-word 族无豁免直断,divine-word 挂豁免失败者)|onFail=豁免失败机械后果入 statuses(statuses 键=法术名)|
  //   healPool=总池逐员分配至满|hpMaxBoost=补 hp_max 再回血(aid/heroes-feast,到期回降归叙事)|stabilize=0HP 稳定(玩家面)|
  //   raise=死者翻生({hp:1|hp:'full',penalty})|healFlatPerLevel={from,per} 环位平值成长|buff 无 mods=纯 effect 记录(读口未接)
  // 读口现状(补录只收真消费键):ac(平值)/attack/attack_save/damage(attack 侧)/save(check+resolveSave)——优势类无读口不收。
  'sleep': { pool: { dice: '5d8', upcast: '2d8', upcastStep: 1, effect: '昏睡(受任何伤或动作摇醒即醒;不死与魅免无效;1 分钟)' } },
  'color-spray': { pool: { dice: '6d10', upcast: '2d10', upcastStep: 1, effect: '盲(至法术结束·1 轮)' } },
  'power-word-stun': { judge: [{ hp: 150, effect: '昏迷(无豁免;每回合 CON 豁免过大复原)' }] },
  'power-word-kill': { judge: [{ hp: 100, kill: true }] },
  'divine-word': { judge: [{ hp: 20, kill: true }, { hp: 30, effect: '盲+聋+昏(1 小时)' }, { hp: 40, effect: '盲+聋(10 分钟)' }, { hp: 50, effect: '聋(1 分钟)' }] },
  // 豁免失败落状态族(掷面照旧,失败后果不再只报布尔)
  'animal-friendship': { onFail: { effect: '魅(加害即散)' } },
  'banishment': { onFail: { effect: '放逐(被拘半位面)' } },
  'blindness-deafness': { onFail: { effect: '盲或聋(施法者择一;每回合 CON 豁免可复原)' } },
  'calm-emotions': { onFail: { effect: '镇定:敌意中止或魅/惊抑制(自择)' } },
  'charm-person': { onFail: { effect: '魅(加害即散)' } },
  'command': { onFail: { effect: '遵令(下一回合执行一字令)' } },
  'compulsion': { onFail: { effect: '受控巡行(内容归叙事)' } },
  'confusion': { onFail: { effect: '迷乱(每回合 1d10 行为表)' } },
  'dominate-beast': { onFail: { effect: '魅+受令(受令内容归叙事)' } },
  'dominate-person': { onFail: { effect: '魅+受令(受令内容归叙事)' } },
  'entangle': { onFail: { effect: '束(植物束缚)' } },
  'enthrall': { onFail: { effect: '注意被夺(察觉 −5)' } },
  'fear': { onFail: { effect: '惊+失物(弃持物而逃)' } },
  'faerie-fire': { onFail: { effect: '轮廓显光(攻其者优势)' } },
  'flesh-to-stone': { onFail: { effect: '石化进程起(灰岩僵束;每回合 CON,三败即石化)' } },
  'grease': { onFail: { effect: '仆倒' } },
  'hideous-laughter': { onFail: { effect: '仆倒+失能(笑瘫;每回合/受创可豁)' } },
  'hold-person': { onFail: { effect: '瘫(每回合 WIS 豁免可复原)' } },
  'hold-monster': { onFail: { effect: '瘫(每轮 WIS 豁免可复原)' } },
  'hypnotic-pattern': { onFail: { effect: '魅+失能(凝视失能,速 0)' } },
  'irresistible-dance': { save: 'wis', onFail: { effect: '尬舞(动锁原地,攻/豁劣势)' } },   // FM 缺 save 键,T 级覆写
  'levitate': { onFail: { effect: '悬浮(升离地面 20 尺)' } },
  'mass-suggestion': { onFail: { effect: '遵示(延迟执行,内容归叙事)' } },
  'modify-memory': { onFail: { effect: '魅+记忆改写(片段归叙事)' } },
  'planar-binding': { onFail: { effect: '拘缚(听命,过程归叙事)' } },
  'polymorph': { onFail: { effect: '变形(兽形数据适配归叙事)' } },
  'resilient-sphere': { onFail: { effect: '束(球内困锁)' } },
  'scrying': { onFail: { effect: '被窥(未察觉)' } },
  'slow': { onFail: { effect: '迟缓:速半·AC/DEX 豁免 −2·无反应·每轮一动作' } },
  'suggestion': { onFail: { effect: '遵示(合理建议内执行)' } },
  // 治疗与翻生族(此前 healFlat 70/healPool 700/稳定/翻生全无机器面)
  'heal': { healFlat: 70, healFlatPerLevel: { per: 10, from: 6 } },
  'mass-heal': { healPool: 700 },
  'prayer-of-healing': { heal: '2d8', healMod: true, healMulti: true, upcast: '1d8', upcastBase: 2 },
  'mass-healing-word': { heal: '1d4', healMod: true, healMulti: true, upcast: '1d4', upcastBase: 3 },
  'aid': { healFlat: 5, healFlatPerLevel: { per: 5, from: 2 }, hpMaxBoost: true },   // ≤3 人各 +5,8h
  'heroes-feast': { heal: '2d10', hpMaxBoost: true, healMulti: true },   // 免疫毒/惊未读口,归叙事
  'spare-the-dying': { stabilize: true },
  'revivify': { raise: { hp: 1 } },
  'raise-dead': { raise: { hp: 1, penalty: '攻/豁/检 −4,每次长休回 1' } },
  'resurrection': { raise: { hp: 'full', penalty: '攻/豁/检 −4,每次长休回 1' } },
  'true-resurrection': { raise: { hp: 'full' } },
  'delayed-blast-fireball': { damage: '12d6', type: 'fire', upcast: '1d6', upcastBase: 7 },   // 12d6 原本 FM 缺 damage 键——补回
  // buff 族(读口确认版;一次性 buff 无 mods=纯记录,掷点消费归叙事)
  'shield': { buff: { effect: 'AC +5 且免疫魔弹,至施法者下回合开始', mods: [{ stat: 'ac', magnitude: 5 }] } },
  'hunters-mark': { buff: { effect: '武器附伤 +1d6 RAW 仅对被标者——读口不分目标(与 divine-favor 同律),标记期全武器加算', mods: [{ stat: 'damage', magnitude: '1d6' }] } },
  'warding-bond': { buff: { effect: 'AC +1·豁免 +1·全伤害抗性(60 尺内,施法者 0HP 即散)', mods: [{ stat: 'ac', magnitude: 1 }, { stat: 'save', magnitude: 1 }] } },
  'resistance': { buff: { effect: '单次豁免 +1d4(一次性;读口为常驻,消费需手工下账)' } },
  'guidance': { buff: { effect: '单次检定 +1d4(一次性;check 读口未接)' } },
  'longstrider': { buff: { effect: '速度 +10 尺(speed 读口未接,归叙事)' } },
  'heroism': { buff: { effect: '免惊 + 每回合临时 HP 5(每回合补给归回合事件)' } },
  'beacon-of-hope': { buff: { effect: 'WIS/死亡豁免优势 + 治疗取最大(优势/取大无读口)' } },
  'death-ward': { buff: { effect: '免死一次:首至 0 则改 1 HP,术散' } },
  // 事件款 suppress(suppress 判据 A1 加编:数字属实但非施放时点——触发/每轮事件归 damage/check 工具)
  'glyph-of-warding': { suppress: true },   // 触发 5d8
  'symbol': { suppress: true },   // 触发逐款(死/惧/惑/乱…)
  'forbiddance': { suppress: true },   // 犯禁 5d10/轮
  'fire-shield': { suppress: true },   // 攻击挨近者 2d8 火骑手,attack 伤害侧事件
  'guardian-of-faith': { suppress: true },   // 20 HP 环卫,每轮触发
  'sleet-storm': { suppress: true },   // 入区 DEX 摔仆/专注 disruption
  'stinking-cloud': { suppress: true },   // 回合始 CON 干呕,非施放时点
  'eyebite': { suppress: true },   // 每轮逐人豁免,三模式
  'zone-of-truth': { suppress: true },   // 入区 CHA
  'gust-of-wind': { suppress: true },   // 施放首推+每轮续推(str)归叙事位移
  'detect-thoughts': { suppress: true },   // 深探 WIS 逐次
  'magic-jar': { suppress: true },   // 夺舍链,逐步 CHA
  'hallow': { suppress: true },   // 施放只落圣域,效果在后续事件
  'antipathy-sympathy': { suppress: true },   // 每轮触发
  'reincarnate': { suppress: true },   // 新身 d100 种族表归叙事
  'goodberry': { suppress: true },   // 果=物品,服食 +1 HP 走服食事件
}
