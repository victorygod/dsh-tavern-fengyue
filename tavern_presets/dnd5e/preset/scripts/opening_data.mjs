// opening_data — 开场页数据源（前端 runScript 调用,供创角表单预填）。
// 输入:无 → 读 openings.json → 返回场景数组(单源 openings.json,创角页不再自维护场景副本)。
// 契约:docs/design_zh.md §6 · ui/index.js 桥 opening-init → 本脚本 → opening-init-data。
import { readFileSync } from 'node:fs'
const fail = (m, h) => { console.log(JSON.stringify({ ok: false, error: m, hint: h ?? '' })); process.exit(1) }

// 种子把 openings.json 复制在 runtime 根（与 state.md 同层）；旧布局（preset/setup/）兜底。
let OPENINGS = null
try { OPENINGS = JSON.parse(readFileSync('openings.json', 'utf8')) } catch { }
if (!OPENINGS) { try { OPENINGS = JSON.parse(readFileSync('../preset/setup/openings.json', 'utf8')) } catch { } }
if (!Array.isArray(OPENINGS?.scenarios)) fail('openings.json 缺 scenarios 数组（runtime/ 与 preset/setup/ 均无或损坏）')

okR({ scenarios: OPENINGS.scenarios })
function okR(r) { console.log(JSON.stringify({ ok: true, ...r })) }
