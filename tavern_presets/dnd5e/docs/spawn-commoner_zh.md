# Spawn 双制补正 · 普通人类（class）出生——设计定案

> 状态：**设计已裁，未施工**（2026-09-29）。定案三则 + 施工清单；本文锚已逐条对码，动手照单走，改码后同步勾销。
> **2026-09-30 取代标注**：定案 3（四要素 ideals/bonds/flaws 进 spawn_npc）作废，由 [persona-threelayer_zh.md](persona-threelayer_zh.md) 定案 1/4 取代（persona 七键+分极闸）；定案 1/2（commoner 双通道分界、钱包）维持有效。

## 背景：9dbffd1 双制拆分留下的三个缺口

spawn_monster（statblock 制）建成后实际兼任了「纯场景人物创建器」——`spawn_npc.mjs:3` 的 description 明文「纯场景者照 commoner 走 spawn_monster」，镇长/店小二这类无职业 NPC 全从怪物工具出口。由此三个缺口：

1. **四要素死格**：档结构与面板认识 `persona.ideals/bonds/flaws`（`view.mjs:397-399` 渲染、玩家 opening 有输入框 `opening.html:141-144`），但 spawn 两工具都只收一句 personality（`spawn_monster.mjs:72` / `spawn_npc.mjs:132`），14 个工具无任何出生后补写通道——NPC 三格永远显「无」。
2. **钱包出生即空**：statblock 卡无钱包数据，spawn_monster 落档体无 gp/sp/cp（收入只能等首次 `gain_money`）；spawn_npc 按职业起装表落（`spawn_npc.mjs:131`）。
3. **成长面缺失**：spawn_monster 卡无 exp 字段，`gain_exp.mjs:54` 直接拒（「怪/纯场景 NPC 不挣 XP」）——纯场景平民若转同伴，永远无法吃 XP 升级。

## 定案

### 1 · 分界：武装照 statblock，纯场景照 commoner 类

「任何可交流 NPC 都走 spawn_npc」**过宽，不采纳**。战果通道按 level→XP 表换算（`gain_exp.mjs:37`，`xpOf(fj.level)`；Σ 均分 :41-42）：guard statblock = CR 1/8 = 25 XP，同一条巡卫若画成 fighter L2 = 450 XP——武装 humanoid 全 class 化等于预算通胀 10~20×，也等于把怪物图鉴人形一章重建一遍。

- **武装/将参与战斗的 humanoid**（guard/bandit/priest……）→ 照旧 `spawn_monster(from)`，CR 供遭遇预算。
- **纯场景平民**（镇长/店小二/村民……）→ `spawn_npc(commoner)`，成长族出生：exp 字段落档（`spawn_npc.mjs:115`）即解锁 `gain_exp`（:54 闸自动放行）——**「允许经验成长」零新代码，档位一落闸就开**。

### 2 · 无名成群留 spawn_monster 批量

酒馆客人×5、村民一群：无独立人格，不配占「一调用一档」的粒度。批量通道保留 `spawn_monster(from=commoner)` 天干编号。**因此 `monsters/commoner.md` 语料不删**——平民双通道同源：无名走图鉴，有名走职业。

### 3 · 四要素进 spawn_npc（不进 spawn_monster）

spawn_npc 加 `ideals/bonds/flaws` 三个可选 string 参数（override 语义，不传=不落），落位进 `persona` 对象；spawn_monster 保持一句 personality（杂兵语义，`persona` 参数注释「杂兵不填」不变）。三格死格随 No.4 一并修复。

## 施工清单

1. **语料** `dnd5e-srd-lorebook/classes/commoner.md`：FM `hit_die: 8`、`saves` 空（感悟/体魄全无熟练）、非施法；MD 含 `*Proficiencies:*` 可解析空档行（`skillCount=0`，`class-build.mjs:52`）+ 等级表一行 `| 1st | +2 | — | {} |`（`classRow` 兼容：`core.mjs:308` 命中表行才返，缺席自保）。`buildClass` 双读同文件（`class-build.mjs:34-35`），一份语料两处消费。
2. **opening-meta.mjs**：`CLASS_CN` 加 `commoner: '普通人'`（spawn_npc:40 白名单闸即视）；`EQUIP_BY_CLASS`（:77 起）加 commoner 起装行（weapon: club、armor: null、gear: 便装、零钱若干）——钱包出生即落（`spawn_npc.mjs:131`）。
3. **class-build.mjs**：`PROF_ARMOR`/`PROF_WEAPON`（:12/:17）补 commoner 空档（甲武全不熟）。
4. **spawn_npc.mjs**：加 `ideals/bonds/flaws` 三可选参数，落 `persona`（:132 处展开）；description「纯场景者照 commoner 走 spawn_monster」改口新分界（定案 1/2）。
5. **spawn_monster.mjs**：description 同步（保留无名批量通道措辞）。
6. **docs/tools_zh.md:103-104** 两条 spawn 记录同步。
7. **engine tests**：commoner spawn 用例——出生 `exp=0/hd_available=1`、钱包起装落档、四要素落位、`gain_exp` 可入账（同伴转正路径）。

## 机械事实（照码录，预期即此，非偏差）

- L1 普通人 hp = 8 + con 调（d8 满骰起手，`class-build.mjs:68` 公式），图鉴平民 4——语义从「图鉴模板」迁「有点底子的人」，接受。
- spawn_npc:41 `level ≥ 1`——镇长 = LV1 普通人，无敌 0 档。
- 平民 class 化后若被列入战果 `foes`：XP 按 LV 换算不再 10xp；要精确请走 `gain_exp` 的 `exp` 直值通道。
- 子职/位表全经缺席键自保：`isCaster=false` 不落 slots；`SUBCLASS_HP_BONUS[cls]?.[subclass] ?? 0` 可选链；`ASI[cls] ?? ASI.default` 落默认表（L1 无用）。
- 技能：commoner `skillCount=0`，agent 传 skills 即白名单报错——普通人无技能熟练，正确。

## 不做的事

- spawn_monster **不加**钱包/四要素字段——杂兵批量通道保持最低建档成本。
- 不删 `monsters/commoner.md`——无名批量仍靠它（定案 2）。
- 不给 spawn_npc 加 `count`——成群即「无名」，无名不进 class 制（与定案 2 同一条逻辑，不做半吊子批量）。
