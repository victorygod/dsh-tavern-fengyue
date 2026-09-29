// lint_characters.mjs — 存量 lint:扫 characters/*.json,校验每档 statuses 键都在临时状态枚举内。
// 与 lib/core.mjs saveChar 的当拍拦(层 1)互补:本件扫已落盘存量(含维护代理 runtimeWrite 直写的坏键)。
// 用法:cwd=runtime 时 `node lint_characters.mjs`——全绿退出 0;有非法键退出 1 并列明细。
// 跨平台:纯 node:fs/path,无 shell 构造。
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const { validateStatuses } = await import(pathToFileURL(process.cwd() + '/../preset/lib/status.mjs').href)

let files = []
try { files = readdirSync('characters').filter(f => f.endsWith('.json')) } catch {}
if (!files.length) { console.log('无 characters/*.json 可扫'); process.exit(0) }

let badCount = 0
for (const f of files) {
  let j
  try { j = JSON.parse(readFileSync(join('characters', f), 'utf8')) } catch { console.log(`!${f}: JSON 损坏,跳过`); continue }
  const v = validateStatuses(j.statuses)
  if (!v.ok) { badCount++; console.log(`!${j.name ?? f}: 非法 statuses 键 [${v.bad.join(' · ')}]`) }
}
if (badCount === 0) { console.log('statuses 键全合法'); process.exit(0) }
console.log(`共 ${badCount} 档含非法 statuses 键`); process.exit(1)