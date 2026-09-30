// lint_characters.mjs — 存量 lint:扫 characters/*.json,三层校验(2026-09-30 扩):
// ①statuses 键都在临时状态枚举内(与 lib/core.mjs saveChar 当拍拦互补——扫已落盘存量,含尾代 runtimeWrite 直写);
// ②persona 人设七键形状(persona-threelayer_zh.md 定案 1):键 ⊆ 白名单/字数 ≤ PERSONA_LIMITS/alignment 9 值;
//   白名单外键=退役残留(五件 personality/ideals/bonds/flaws)——列出促迁,不自动改档;
// ③history 履历形状(定案 3):行数组、行=字符串;biography 退役键仍在=列示促迁。
// 用法:cwd=runtime 时 `node lint_characters.mjs`——全绿退出 0;有问题退出 1 并列明细。
// 跨平台:纯 node:fs/path,无 shell 构造。
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const { validateStatuses } = await import(pathToFileURL(process.cwd() + '/../preset/lib/status.mjs').href)
const { PERSONA_LIMITS, PERSONA_ALIGNMENTS } = await import(pathToFileURL(process.cwd() + '/../preset/lib/persona.mjs').href)
const P_KEYS = ['appearance', 'lens', 'reaction', 'voice', 'never', 'tension', 'alignment']

let files = []
try { files = readdirSync('characters').filter(f => f.endsWith('.json')) } catch {}
if (!files.length) { console.log('无 characters/*.json 可扫'); process.exit(0) }

let badCount = 0
for (const f of files) {
  let j
  try { j = JSON.parse(readFileSync(join('characters', f), 'utf8')) } catch { console.log(`!${f}: JSON 损坏,跳过`); continue }
  const bad = []
  const v = validateStatuses(j.statuses)
  if (!v.ok) bad.push(`非法 statuses 键 [${v.bad.join(' · ')}]`)
  if (j.persona != null) {
    if (typeof j.persona !== 'object' || Array.isArray(j.persona)) bad.push('persona 非对象')
    else for (const [k, val] of Object.entries(j.persona)) {
      if (!P_KEYS.includes(k)) { bad.push(`persona.${k}=退役键(五件时代)——迁七键`); continue }
      if (typeof val !== 'string') { bad.push(`persona.${k}=非字符串`); continue }
      if (k === 'alignment') PERSONA_ALIGNMENTS.includes(val) || bad.push(`persona.alignment='${val}' 超 9 值枚举`)
      else if (val.length > PERSONA_LIMITS[k]) bad.push(`persona.${k}=超长(${val.length}>${PERSONA_LIMITS[k]})`)
    }
  }
  if (j.biography != null) bad.push('biography 退役键仍在——迁 history 行数组')
  if (j.history != null) {
    if (!Array.isArray(j.history)) bad.push('history 须行数组(履历流水,追加式)')
    else for (const h of j.history) if (typeof h !== 'string') bad.push('history 行=非字符串')
  }
  if (bad.length) { badCount++; console.log(`!${j.name ?? f}: ${bad.join(' · ')}`) }
}
if (badCount === 0) { console.log('lint 全绿:statuses/persona 七键/history 形状合法'); process.exit(0) }
console.log(`共 ${badCount} 档需要修`); process.exit(1)
