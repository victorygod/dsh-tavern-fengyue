// ST 宏兼容标准库(导入生成,可编辑):argv = [子命令, ...参数]。cwd = runtime/。
// 值源:runtime/persona.md(YAML frontmatter 的 name: + 正文=人格描述;无 frontmatter 整文即描述)、
// ../preset/meta.json(title)、runtime/vars.json(set/get 存档)、.chat.snapshot.jsonl(对话快照)。
// 家法:与 lorebook.mjs 同等待遇——引擎不认识本文件,调用失败走常规脚本失败行;
// 玩家可编辑可删除,删除后对应 {{st(...)}} 调用即报 missing。
// 语义偏差(记档于 card-presentation):同 token 同装配同值,random/pick 一装配内恒定。
import { existsSync, readFileSync, writeFileSync } from "node:fs"
const cmd = String(argv[0] ?? "")
const rest = argv.slice(1).map(a => String(a))
const personaPair = () => {
  if (!existsSync("persona.md")) return ["", ""]
  const raw = readFileSync("persona.md", "utf8")
  const fence = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (fence === null) return ["", raw]
  const name = /^name:\s*(.*?)\s*$/m.exec(fence[1])
  return [name === null ? "" : name[1], fence[2].replace(/^\r?\n/, "")]
}
const metaTitle = () => {
  try { return String(JSON.parse(readFileSync("../preset/meta.json", "utf8")).title ?? "") }
  catch { return "" }
}
const readVars = () => { try { return JSON.parse(readFileSync("vars.json", "utf8")) } catch { return {} } }
const snapRows = () => {
  if (!existsSync(".chat.snapshot.jsonl")) return []
  return readFileSync(".chat.snapshot.jsonl", "utf8").trimEnd().split("\n")
    .map(line => { try { return JSON.parse(line) } catch { return null } })
    .filter(row => row !== null && (row.kind === "user" || row.kind === "assistant"))
    .map(row => ({ kind: row.kind, text: String(row.plain ?? "") }))
}
const choice = (list) => {
  const items = String(list ?? "").split(";").map(item => item.trim()).filter(item => item !== "")
  return items[Math.floor(Math.random() * items.length)] ?? ""
}
const doRoll = (expr) => {
  const m = /^(\d*)d(\d+)([+-]\d+)?$/.exec(String(expr ?? "").trim().toLowerCase())
  if (m === null) return null
  const times = m[1] === undefined || m[1] === "" ? 1 : Math.max(1, Math.min(20, Number(m[1])))
  const faces = Math.max(2, Math.min(1000, Number(m[2])))
  let sum = 0
  for (let i = 0; i < times; i += 1) sum += 1 + Math.floor(Math.random() * faces)
  return sum + (m[3] === undefined ? 0 : Number(m[3]))
}
const clock = (which) => {
  const now = new Date()
  const two = (n) => String(n).padStart(2, "0")
  if (which === "time") return two(now.getHours()) + ":" + two(now.getMinutes())
  if (which === "isotime") return two(now.getHours()) + ":" + two(now.getMinutes()) + ":" + two(now.getSeconds())
  if (which === "date") return now.getFullYear() + "-" + two(now.getMonth() + 1) + "-" + two(now.getDate())
  if (which === "isodate") return now.toISOString().slice(0, 10)
  if (which === "weekday") return ["日", "一", "二", "三", "四", "五", "六"][now.getDay()]
  return null
}
if (cmd === "user") { process.stdout.write(personaPair()[0]); process.exit(0) }
if (cmd === "persona") { process.stdout.write(personaPair()[1]); process.exit(0) }
if (cmd === "char") { process.stdout.write(metaTitle()); process.exit(0) }
if (cmd === "time" || cmd === "date" || cmd === "isotime" || cmd === "isodate" || cmd === "weekday") {
  const value = clock(cmd)
  if (value === null) process.exit(1)
  process.stdout.write(value)
  process.exit(0)
}
if (cmd === "roll") {
  const value = doRoll(rest[0])
  if (value === null) process.exit(1)
  process.stdout.write(String(value))
  process.exit(0)
}
if (cmd === "random" || cmd === "pick") { process.stdout.write(choice(rest[0])); process.exit(0) }
if (cmd === "set") {
  if (rest.length < 2) process.exit(1)
  const vars = readVars()
  vars[rest[0]] = rest.slice(1).join(",")
  writeFileSync("vars.json", JSON.stringify(vars, undefined, 1) + "\n")
  process.exit(0)
}
if (cmd === "get") { process.stdout.write(String(readVars()[rest[0]] ?? "")); process.exit(0) }
const rows = snapRows()
if (cmd === "last") { for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i].kind === "assistant") { process.stdout.write(rows[i].text); break } process.exit(0) }
if (cmd === "lastUser" || cmd === "pending") { for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i].kind === "user") { process.stdout.write(rows[i].text); break } process.exit(0) }
process.exit(1)
