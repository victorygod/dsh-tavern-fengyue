# 法术施放面覆盖审计与补录 · 2026-09-29

> 触发:玩家施 Sleep 只扣位不落效果,回执「无掷效果——效果归叙事/状态工具」。追因发现 spell-data 抽取字典三形态缺席,全量 triage 后补录联动落地(cast.mjs 四条新手术位 + spell-data 约 70 条)。判决理由成文本档;表内新键注释=消费口。

## 为什么当初没覆盖

`spell-data.mjs` 表头自证:2026-09-28 从 320 件语料**批量抽取**,字典槽位仅 `damage / upcast / bolts / heal / buff / temp / suppress` 六类。Sleep 的机制形态——无豁免 + HP 额度池 + 按当前 HP 升序罩 + 写昏迷——**字典里没有可填的槽**,连表都进不了;cast 派发链七连判(gates → heal → attack → save → buff → temp → bolts)全部落空,走到兜底 `else`。「机械进工具」原则对越无脑的法术越失效——这是本审计的教训句。

## 全量 triage(319 语料)

| 桶 | 数 | 判定 |
|---|---|---|
| T-mech(damage/heal/buff/temp/bolts) | 70 | 本来就覆盖 |
| suppress(A1 显式封死) | 15 → 31 | 补录事件款 16 件 |
| FM-mech(FM 直键兜底) | 3 | 本来就覆盖 |
| save-bool(掷豁免、失败只报布尔) | 42 | **机械缺口**——失败后果全靠叙事追认 |
| catch-all(兜底) | 189 | 大部正当(侦测/幻象/召唤/器用);混入真缺 |

## 补录:三形态开槽 + 两个家族

**新的三条机器面(cast.mjs):**

1. `pool`——HP 额度罩池:掷骰 = 额度,目标按当前 HP 升序罩,装不下即止,已昏迷者跳过不占额度(与_sleep_raw_原文同构)。`sleep`(5d8,+2d8/环,昏睡)、`color-spray`(6d10,+2d10/环,盲)。
2. `judge`——当前 HP 阈值断定:无豁免直断(power-word 族)或挂在豁免失败者上(divine-word);阈值首中低档优先(杀死→躲闪阶梯同序),kill 档走 hurt 单源,PC 命中补 `death_fail=3`(断定即死,非濒死)。`power-word-stun`(≤150 昏迷)、`power-word-kill`(≤100 死)、`divine-word`(20/30/40/50 四档)。
3. `onFail`——豁免失败机械后果入 statuses:此前 42 件 save-bool 只回布尔。补 31 件(hold-person→瘫、grease→仆倒、charm-person→魅…)。

**治疗翻生族整段缺席,补齐:**`heal`(70,+10/环)、`mass-heal`(总池 700 逐员分配至满)、`prayer-of-healing` / `mass-healing-word`(群疗逐人各掷)、`aid` / `heroes-feast`(hp_max 成长条目 `hpMaxBoost`,补上限再回血)、`spare-the-dying`(0HP 稳定,玩家面专享)、翻生四件(`revivify` 1 HP / `raise-dead` 1 HP+惩账 / `resurrection` · `true-resurrection` 满血)、`delayed-blast-fireball`(12d6 直伤面补回)。

**buff 族:只收有真读口的键**——statMods 消费面实证五键:`ac`(core `AC 派生侧`)/`attack`/`attack_save`/`damage`(attack 骑手)/`save`(check·resolveSave)。收:`shield`(ac+5)、`hunters-mark`(damage+1d6,RAW 目标限定但读口不分,与 divine-favor 同律,注释自曝)、`warding-bond`(ac+1·save+1,**不是** attack_save——后者连攻带豁全加,越界);`guidance/resistance/longstrider/beacon-of-hope/death-ward/heroism` 收 effect-only 记录mods(读口未接,掷点消费归叙事); tượi优势类(foresight 等)不收。

## 判决细节

- `stinking-cloud` 收 suppress 不收 onFail——save 在「回合开始」触发,非施放时点(引擎会在错误时点掷豁免)。
- `irresistible-dance` FM 缺 save 键,走 T.save 覆写(call-lightning 先例)。
- `resistance` 有 RAW 一次性语义,机器读口是常驻加算——宁记 effect 不给假 teeth。
- 事件款(glyph/symbol/forbiddance/fire-shield/sleet-storm/zone-of-truth… 16 件)收 suppress:行为不变(仍兜底),判决留痕——正文里的 5d8/5d10 数字不再误导。
- 纯叙事类(dancing-lights/派生侦测族等)不收条目——兜底回执「效果归叙事」就是它们的正确终局。

## 锚

- cast.mjs:healFlat 环位成长行 / judgeApply(阈值断定)/ onFailApply(失败落状态)/ pool 分支 / judge 分支 / 治疗翻生分医
- spell-data.mjs:表尾 2026-09-29 块 + 语义分类注释行
- 抽取裁定另存于会话;SRD 决定句已引原文核对(sleep/color-spray/power-word/divine-word/hold 族逐件)
