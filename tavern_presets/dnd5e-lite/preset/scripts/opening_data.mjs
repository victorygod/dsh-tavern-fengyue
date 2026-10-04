// opening_data — 开场页数据源（前端 runScript 调用,供创角表单预填）。
// 输入:无 → 读 openings.json → 返回场景数组+创角 meta(2026-09-25 成长流定案:roll 要有逻辑,
// 技能白名单/子职清单/法术池全部**单源语料**,现场解析后整包下发——表单零内嵌规则副本;
// 2026-09-30 数据面批:池/职业面单源=SPELL_CORE/CLASS_CORE 数据快照,零 lorebook fs)。
// 契约:docs/design_zh.md §6 · ui/index.js 桥 opening-init → 本脚本 → opening-init-data。
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const fail = (m, h) => { console.log(JSON.stringify({ ok: false, error: m, hint: h ?? '' })); process.exit(1) }

const { OPENING_META, CASTERS, parseSkillChoices, CANTRIPS_L1, KNOWN_L1, CANTRIPS_BY_LEVEL, KNOWN_BY_LEVEL } = await import(pathToFileURL(process.cwd() + '/../preset/lib/opening-meta.mjs').href)
const { SPELL_CN, SUBCLASS_CN } = await import(pathToFileURL(process.cwd() + '/../preset/lib/glossary-cn.mjs').href)
const { slotsFor } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { SPELL_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-core-data.mjs').href)
const { CLASS_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/class-core-data.mjs').href)

// 12 职业的技能白名单/选数(解析 *Proficiencies* 行)+ 子职清单 + 施法者法术池(戏法/首环)
// 职业面单源=CLASS_CORE 数据快照(2026-09-30 零 lorebook fs)
const classes = {}
for (const cls of Object.keys(OPENING_META.CLASS_CN)) {
  const core = CLASS_CORE[cls] ?? fail(`classes/${cls}.md 缺 CLASS_CORE 快照(重跑 extract-class-core.mjs)`)
  const parsed = parseSkillChoices(core.prof_line)
  if (!parsed) fail(`classes/${cls}.md 缺可解析的 Skill Proficiencies 行`, '语料 *Proficiencies* 形状须为「Choose N from A, B, and C」')
  const subclasses = Array.isArray(core.fm.subclass) ? core.fm.subclass : []
  classes[cls] = { skills: parsed.skills, count: parsed.count, anySkill: parsed.anySkill, subclasses: CLEAN(subclasses) }
}
// 法术池:caster 的 level 0/1(双键沿旧)+ 按环位全文分桶 byLevel(高等级出生抽 1..maxSlot 用;
// 单源=SPELL_CORE 数据快照(2026-09-30 零 lorebook fs),语义与旧目录扫描逐式同源)
const pools = { cantrips: {}, lv1: {}, byLevel: {} }
for (const cls of CASTERS) { pools.cantrips[cls] = []; pools.lv1[cls] = []; pools.byLevel[cls] = {} }
for (const [, e] of Object.entries(SPELL_CORE)) {
  const fm = e.fm ?? e
  if (!fm.name || fm.level == null || !Array.isArray(fm.classes)) continue
  for (const raw of fm.classes) {
    const cls = String(raw).toLowerCase()
    if (!(cls in pools.cantrips)) continue
    if (fm.level === 0) pools.cantrips[cls].push(String(fm.name))
    else if (fm.level === 1) pools.lv1[cls].push(String(fm.name))
    const lv = +fm.level; if (lv >= 1) (pools.byLevel[cls][lv] ??= []).push(String(fm.name))   // byLevel 正数环与 lv1 同收——双面供不同消费口
  }
}
for (const cls of CASTERS) {
  pools.cantrips[cls].sort()
  pools.lv1[cls].sort()
  for (const k of Object.keys(pools.byLevel[cls])) pools.byLevel[cls][k].sort()
}

// slotMax:施法者 1..20 级的「最高可施环位」(由 core 三族位表派生)——表单按选中等级圈定法术环位上限
const slotMax = {}
for (const cls of CASTERS) {
  slotMax[cls] = Array.from({ length: 20 }, (_, i) => {
    const st = slotsFor(cls, i + 1) ?? []
    return Math.max(0, ...st.map((v, j) => (v > 0 ? j + 1 : 0)))
  })
}

// 种子把 openings.json 复制在 runtime 根（与 state.md 同层）；旧布局（preset/setup/）兜底。
let OPENINGS = null
try { OPENINGS = JSON.parse(readFileSync('openings.json', 'utf8')) } catch { }
if (!OPENINGS) { try { OPENINGS = JSON.parse(readFileSync('../preset/setup/openings.json', 'utf8')) } catch { } }
if (!Array.isArray(OPENINGS?.scenarios)) fail('openings.json 缺 scenarios 数组（runtime/ 与 preset/setup/ 均无或损坏）')

okR({ scenarios: OPENINGS.scenarios, meta: { ...OPENING_META, classes, pools, cantripsL1: CANTRIPS_L1, knownL1: KNOWN_L1, cantripsBy: CANTRIPS_BY_LEVEL, knownBy: KNOWN_BY_LEVEL, slotMax, spellCN: SPELL_CN, subclassCN: SUBCLASS_CN } })
function okR(r) { console.log(JSON.stringify({ ok: true, ...r })) }
function CLEAN(list) { return list.map(x => String(x)).filter(Boolean) }
