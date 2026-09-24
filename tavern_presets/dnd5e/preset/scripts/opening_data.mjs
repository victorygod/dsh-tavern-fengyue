// opening_data — 开场页数据源（前端 runScript 调用,供创角表单预填）。
// 输入:无 → 读 openings.json → 返回场景数组+创角 meta(2026-09-25 成长流定案:roll 要有逻辑,
// 技能白名单/子职清单/法术池全部**单源语料**,现场解析后整包下发——表单零内嵌规则副本)。
// 契约:docs/design_zh.md §6 · ui/index.js 桥 opening-init → 本脚本 → opening-init-data。
import { readFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const fail = (m, h) => { console.log(JSON.stringify({ ok: false, error: m, hint: h ?? '' })); process.exit(1) }

const { OPENING_META, CASTERS, parseSkillChoices, CANTRIPS_L1, KNOWN_L1 } = await import(pathToFileURL(process.cwd() + '/../preset/lib/opening-meta.mjs').href)

function readFM(rel) {
  try {
    const raw = readFileSync(`dnd5e-srd-lorebook/${rel}`, 'utf8')
    const m = /^---\n([\s\S]*?)\n---/.exec(raw)
    if (!m) return {}
    const fm = {}; let cur = null
    for (const line of m[1].split('\n')) {
      const li = /^  - (.*)$/.exec(line)
      if (li && cur) { fm[cur] = [...(fm[cur] ?? []), li[1].replace(/^"|"$/g, '')]; continue }
      const kv = /^([a-z_]+):\s*(.*)$/.exec(line)
      if (kv) { cur = kv[1]; fm[cur] = kv[2] === '' ? [] : (kv[2] === 'true' ? true : kv[2] === 'false' ? false : (/^-?\d+(\.\d+)?$/.test(kv[2]) ? Number(kv[2]) : kv[2].replace(/^"|"$/g, ''))) }
    }
    return fm
  } catch { return {} }
}

// 12 职业的技能白名单/选数(解析语料 *Proficiencies* 行)+ 子职清单 + 施法者法术池(戏法/首环)
const classes = {}
for (const cls of Object.keys(OPENING_META.CLASS_CN)) {
  const md = readFileSync(`dnd5e-srd-lorebook/classes/${cls}.md`, 'utf8')
  const fm = readFM(`classes/${cls}.md`)
  const parsed = parseSkillChoices(/\*Proficiencies:\*\s*(.+)/.exec(md)?.[1] ?? null)
  if (!parsed) fail(`classes/${cls}.md 缺可解析的 Skill Proficiencies 行`, '语料 *Proficiencies* 形状须为「Choose N from A, B, and C」')
  const subclasses = Array.isArray(fm.subclass) ? fm.subclass : []
  classes[cls] = { skills: parsed.skills, count: parsed.count, anySkill: parsed.anySkill, subclasses: CLEAN(subclasses) }
}
// 法术池:caster 的 level 0/1 且 classes 含本职业(单源语料——319 卡现筛,开销一次一调用可忽略)
const pools = { cantrips: {}, lv1: {} }
for (const cls of CASTERS) { pools.cantrips[cls] = []; pools.lv1[cls] = [] }
try {
  for (const f of readdirSync('dnd5e-srd-lorebook/spells').filter(f => f.endsWith('.md'))) {
    const fm = readFM(`spells/${f}`)
    if (!fm.name || fm.level == null || !Array.isArray(fm.classes)) continue
    for (const raw of fm.classes) {
      const cls = String(raw).toLowerCase()
      if (!(cls in pools.cantrips)) continue
      if (fm.level === 0) pools.cantrips[cls].push(String(fm.name))
      else if (fm.level === 1) pools.lv1[cls].push(String(fm.name))
    }
  }
} catch { }
for (const cls of CASTERS) {
  pools.cantrips[cls].sort()
  pools.lv1[cls].sort()
}

// 种子把 openings.json 复制在 runtime 根（与 state.md 同层）；旧布局（preset/setup/）兜底。
let OPENINGS = null
try { OPENINGS = JSON.parse(readFileSync('openings.json', 'utf8')) } catch { }
if (!OPENINGS) { try { OPENINGS = JSON.parse(readFileSync('../preset/setup/openings.json', 'utf8')) } catch { } }
if (!Array.isArray(OPENINGS?.scenarios)) fail('openings.json 缺 scenarios 数组（runtime/ 与 preset/setup/ 均无或损坏）')

okR({ scenarios: OPENINGS.scenarios, meta: { ...OPENING_META, classes, pools, cantripsL1: CANTRIPS_L1, knownL1: KNOWN_L1 } })
function okR(r) { console.log(JSON.stringify({ ok: true, ...r })) }
function CLEAN(list) { return list.map(x => String(x)).filter(Boolean) }
