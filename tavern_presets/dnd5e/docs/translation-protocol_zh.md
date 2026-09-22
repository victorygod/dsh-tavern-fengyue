# DND5e SRD 中文译库 — 翻译协议 + 术语表（v3，2026-09-19 台版锚点定案）

**v3 锚点切换（用户裁定：术语优先采用台版 PHB/台版社区谱系）**——v2 的 BG3 锚点条款在此冲突处以台版为准，其余沿用：
- **Rogue 盗贼**（原「游荡者」17 文件已 sweep——用户点名 + 台版/社区一致）；**Paladin 圣骑士**（原「圣武士」47 文件已 sweep——用户两次示意 + 台版谱系）；**Warlock 契术师**（原「邪术师」78 文件已 sweep——台版定名，简中 wiki 谱系作邪术师，按用户台版锚点采契术师）。
- **Gnome 地侏**（原「侏儒」11 文件已 sweep，含 岩石地侏/地底地侏/Gnomish 地侏语——台版谱系定名）；**Conjuration 咒法**（原「咒唤」61 文件已 sweep——台版与简中通行皆为咒法系，原译为孤例）；**Conjure X 召唤 X**（咒唤动物→召唤动物等六条逐一映射后，其余 咒唤→咒法）。
- **Warlock 特性随动**：Eldritch Invocation 魔能祈唤（原 魔能祈恩）、Book of Shadows 影之书（原 影典藏）。
- **维持项与分歧记录**（简中/台版两谱系冲突、暂从简中现状，恢复台版只需一句话 sweep）：Frightened 恐慌（台版社区站作恐惧）/ Prone 倒地（台版社区站作伏地）/ Stunned 昏眩（台版作震慑）。

**v2 网络核查（2026-09-18，锚点：BG3 官方简中 + dnd.huijiwiki 简中社区 + 台版资料站）**：
- **Barbarian 野蛮人**（原「蛮战士」系国行 PHB 独创被弃，全库已 sweep，12 文件）；**Frightened 恐慌**（原「惊惧」，全库已 sweep，65 文件）；**Chill Touch 寒颤之触**（原「冷冽之触」）。
- **Rogue 游荡者维持**（BG3 官方简中即「游荡者」；「流氓」为词典直译非社区用法，台版作盗賊）；**Paladin 圣武士维持**（BG3 官方简中锚点；圣骑士系 WoW/台版习惯——产品口味可翻案，未翻案前不动）。
- **Warlock 邪术师**（BG3 官方；台版契术师）；其余职业名/六属性/入学动作与 BG3 及社区表逐项吻合。


**v1.1 试译批复（rules/ 切片C 自主决策，升格为全局规约）**：①技能名括注采用通行译法（Athletics→运动、Acrobatics→杂技、Perception→察觉…）；②无通行译名的专名（毒药/魔法物品等）用意译直译+英文双记，不强行造名；③Mithral→秘银、Adamantine→精金；④源文件残留的标点瑕疵（斜体错位/缺句点）按中文规范修整，不模仿 flaw；⑤attunement 同调（切片A 曾译「共鸣」已统一为「同调」）；⑥downtime 休整期；⑦GM 主持人；⑧主动技能名十八个采用通行译法（运动/特技/巧手/隐匿/奥秘/历史/调查/自然/宗教/驭兽/洞悉/医药/察觉/生存/欺瞒/威吓/表演/游说），均带英文双记。

目标：逐文件高还原翻译 `preset/setup/dnd5e-srd-lorebook/` → 平行目录 `preset/setup/dnd5e-srd-lorebook-cn/`。本文件是全部翻译批次的唯一口径。

## 一、翻译协议（硬性）

1. **镜像结构**：输出路径 = `dnd5e-srd-lorebook-cn/<与源相同的相对路径>`，文件名同步改为对应英文原名（不改名，便于路径对账；INDEX 里给出中文名对照）。
2. **frontmatter 机读层逐字节保留**：`---` 围栏内（name/description/结构化字段）**原样复制，一个字符不改**——索引扫描、脚本结算、路径 join 全靠它。
3. **正文全译**：`---` 之后的每一段、每个表格单元格都要译成中文，禁止漏段、禁止中英混排成段（专有名词双记除外）。
4. **双记式专有名词**：正文标题（##/### 层级）用「中文译名 (English Name)」；正文首次出现的重要专有名词后括注英文原名。机械数值不译：骰式（`1d8+3`、`d20`）、AC/HP/DC/XP/CR 数值、环位、距离/重量单位语义按规则（feet→呎? 见术语表③）。
5. **表格原样保结构**：Markdown 表格的列数与行数必须与原文一致，只译单元格文字。
6. **保持 Markdown 语义标记**：标题层级、加粗、斜体、列表、frontmatter 键一律不增删。
7. **质量标尺（高度还原）**：规则句子逐条对应——原文一句话对应译文一句话，允许语序调整为中语自然表达，禁止漏条件、禁止加戏、禁止概括化改写（例：原文 "at least 1 hour" 必须落成“至少 1 小时”）。

## 二、术语表（Standard 5e 中文通行译法）

### ① 核心机制

| EN | CN | EN | CN |
|---|---|---|---|
| ability check | 属性检定 | saving throw | 豁免检定（豁免） |
| advantage | 优势 | disadvantage | 劣势 |
| proficiency bonus | 熟练加值 | DC (Difficulty Class) | 难度等级（DC） |
| initiative | 先攻 | round | 轮 |
| turn | 回合 | combat round | 战斗轮 |
| action | 动作 | bonus action | 附赠动作 |
| reaction | 反应 | attack roll | 攻击检定 |
| hit points (HP) | 生命值（HP） | Armor Class (AC) | 护甲等级（AC） |
| speed | 速度 | cover | 掩护 |
| damage | 伤害 | healing | 治疗 |
| temporary hit points | 临时生命值 | damage resistance | 伤害抗性 |
| damage immunity | 伤害免疫 | damage vulnerability | 伤害易伤 |
| contested check | 对抗检定 | passive Perception | 被动察觉 |
| inspiration | 灵感 | Creature | 生物 |
| character level | 角色等级 | class level | 职业等级 |
| Hit Die | 生命骰 (Hit Die) | exhaustion | 力竭 |
| grapple | 擒抱 | shove | 推撞 |
| prone | 倒地 | unconscious | 昏迷 |
| stealth | 隐匿 | hide | 躲藏 |

### ② 动作清单（actions in combat）

Attack 攻击 / Cast a Spell 施法 / Dash 冲刺 / Disengage 撤离 / Dodge 闪避 / Help 协助 / Hide 躲藏 / Ready 准备 / Search 搜索 / Use an Object 使用物件

### ③ 单位与度量（保持 SRD 数字，单位按惯例）

feet（ft）→ **呎**（如 30 呎；如正文密集也可直用 30 feet 保留？→ 定案：**翻译为“呎”**，如 "30 feet"→“30 呎”）；mile → **哩**；pound 磅；bout 环节无此词。货币 copper/silver/gold/electrum/platinum piece → 铜/银/金/琥珀金/白金币（cp/sp/gp/ep/pp）。

### ④ 六属性

Strength 力量 (STR) / Dexterity 敏捷 (DEX) / Constitution 体质 (CON) / Intelligence 智力 (INT) / Wisdom 感知 (WIS) / Charisma 魅力 (CHA)

### ⑤ 十二职业

Barbarian 蛮战士 / Bard 吟游诗人 / Cleric 牧师 / Druid 德鲁伊 / Fighter 战士 / Monk 武僧 / Paladin 圣武士 / Ranger 游侠 / Rogue 游荡者 / Sorcerer 术士 / Warlock 邪术师 / Wizard 法师

### ⑥ 施法体系

spell 法术 / cantrip 戏法 / spell slot 法术位 / ritual 仪式 / concentration 专注 / spell save DC 法术豁免 DC / spellcasting ability 施法属性 / spell level 法术环级（环）/ higher level 升环 / component 成分 (V/S/M)（言语/姿势/材料）/ school of magic 魔法学派（见⑧）

### ⑧ 八大学派

Abjuration 防护 / Conjuration 咒唤 / Divination 预言 / Enchantment 惑控 / Evocation 塑能 / Illusion 幻术 / Necromancy 死灵 / Transmutation 变化

### ⑨ 状态（conditions）

Blinded 目盲 / Charmed 魅惑 / Deafened 耳聋 / Frightened 惊惧 / Grappled 被擒抱 / Incapacitated 失能 / Invisible 隐形 / Paralyzed 麻痹 / Petrified 石化 / Poisoned 中毒 / Prone 倒地 / Restrained 束缚 / Stunned 昏眩 / Unconscious 昏迷 / Exhaustion 力竭

### ⑩ 常见怪种（示例——非清单，按通行译法）

Goblin 哥布林 / Orc 兽人 / Kobold 狗头人 / Dragon 龙 / Zombie 僵尸 / Skeleton 骷髅 / Vampire 吸血鬼 / Owlbear 枭熊 / Beholder 眼魔 / Lich 巫妖 / Troll 巨魔 / Giant 巨人

### ⑪ 更正与补充（2026-09-18 批处理中途裁定）

- **位面名全局统一**：Feywild 妖精荒野（勿作妖精狂野）/ Shadowfell 幽影荒野（勿作影裔暗界）/ Ethereal Plane 以太位面 / Astral Plane 星界位面 / Nine Hells 九狱。spells/ 已全局消毒。
- **货币双口径定案**：摘要行/数据行价格保持 `X gp/cp/sp` 原样（机读友好）；**正文散文**（如材料成分"worth 25 gp"）译「25 金币」自然中文。二者并存是设计而非事故。
- **语言名全局定案（对齐 languages/ 库）**：Abyssal 深渊语 / Deep Speech **深语**（勿作「深渊语」///防与 Abyssal 撞名）/ Undercommon 地下通用语 / Infernal 炼狱语 / Sylvan 妖精语 / Primordial 原初语（方言：Ignan 火语 / Auran 风语 / Terran 土族语 / Aquan 水族语）/ thieves' cant 盗贼黑话。monsters/ 批1 已消毒。
- **不死生物定名（monsters 正典，spells 等引用处对齐）**：ghoul 食尸鬼 / ghast 加斯特 / wight 尸妖 / wraith 阴魂 / specter 幽灵 / ghost 幽魂 / will-o'-wisp 鬼火。create-undead、tarrasque（塔拉斯克巨兽）等跨批撞名已消毒。
- **终审裁定（2026-09-18 收敛完毕）**：pit fiend **深狱魔**（rules/what-is-a-spell 已同步）；Three-Dragon Ante **三龙赌局**（dice-set/playing-card-set 已同步）；basilisk **石化蜥蜴**（monsters/ 全量已同步，弃音译熙赛克）；Planetar 行星天使 / Solar 太阳天使（全库唯一形态，无冲突）；High Elf 高等精灵、Thieves' Tools 盗贼工具、bulette 布雷特兽（音译+双记）维持既有。

- **Gnome / Gnomish = 侏儒 / 侏儒语**（勿译「地精」——Goblin 已是哥布林，地精语名冲突）；languages/ 已全局修正。
- **Devil 魔鬼 / Demon 恶魔**：严格区分，对抗位不得互换。
- 语言类型：Standard 标准语言 / Exotic 异族语言。

## 三、批处理纪律

- 每个翻译代理领一个**类别内的连续切片**（同批术语一致）；各代理**只写自己名下的文件**，不碰别人切片与源目录。
- 批完成校验三道：(a) 文件数与源对齐（find 差集）；(b) frontmatter 与源逐字节 diff；(c) 抽样人工阅读（主会话负责）。
- INDEX.md 各目录最后一批统一重译（内容含全类别行，吸收双记式命名）。

**v4（2026-09-19 提案后撤销）**：Warlock=术士 提案连同 Sorcerer/Gnome 连带消歧**一并撤销**（撞名连锁：Sorcerer 占术士/Dwarf 占矮人）——**维持 v3 全量口径**（Rogue 盗贼/Paladin 圣骑士/Warlock 契术师/Gnome 地侏/Conjuration 咒法/Sorcerer 术士/Dwarf 矮人）。活文档已还原，cn 语料自始未动。
