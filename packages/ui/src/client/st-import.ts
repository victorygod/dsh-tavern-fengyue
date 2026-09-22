/**
 * The tavern card importer: container probing (JSON / PNG-embedded tEXt),
 * V1/V2/V3 normalization onto the V2 canonical shape, and the five-way fold
 * onto a standard card's file table (systemPrompt sections in ST's assembly
 * order, lorebook.json world data, greetings.json opening options, meta.json
 * identity, the `preset/st-import/` translation work order carrying the import
 * report). Two JSON dialects: SillyTavern cards (spec'd V2/V3 + legacy DSH
 * pre_prompt exports) and 风月 cards (catai.wiki ecosystem: pre_prompt /
 * pre_text / post_text / world_book / HTML description). Pure data-in/data-out
 * — the preview page owns presentation, `commitImport`/`writeAsset` own disk;
 * the one network touch is the fengyue cover-URL fetch in the async entry.
 *
 * Mapping authority: docs/tavern-prototype/st-card-field-mapping_zh.md; the
 * work-order schema lives in st-import-work-order_zh.md; the fengyue dialect
 * mapping in docs/notes/feature/2026-09-18-fengyue-import.zh.md.
 * @module dsh-tavern-fengyue-ui/st-import
 */

/** One folded import: the standard file table plus the PNG cover, if any. */
export interface ParsedStImport {
  title: string
  files: Record<string, string>
  /** The PNG container's bytes as base64, landing at this workspace-relative path after commit. */
  cover: { path: string; dataBase64: string } | undefined
  error?: string
}

/** The V2-canonical card shape every accepted version normalizes onto. */
interface CanonicalCard {
  name: string
  description: string
  personality: string
  scenario: string
  firstMes: string
  mesExample: string
  creatorNotes: string
  systemPrompt: string
  postHistoryInstructions: string
  tags: string[]
  creator: string
  characterVersion: string
  alternateGreetings: string[]
  characterBook: StBook | undefined
  regexScripts: Record<string, unknown>[]
  depthPrompt: string
  worldRef: string
  /** Legacy DSH-format top-level fields (spec-less exports from earlier versions). */
  legacyPrePrompt: string
  legacyPostPrompt: string
}

/** One V2-spec character_book entry; the original rides `raw` as the re-fold source. */
interface StBookEntry {
  keys: string[]
  content: string
  constant: boolean
  probability: number
  position: string
  insertionOrder: number
  enabled: boolean
  raw: Record<string, unknown>
}

interface StBook {
  name: string
  entries: StBookEntry[]
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Shared JSON shape guard — raw reads stay on this record type. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry !== '') : []
}

/**
 * 风月（catai.wiki 生态）JSON 卡的识别特征：`pre_text` / `post_text` / `world_book`
 * 任一在场。旧 DSH 导出只有 `pre_prompt` / `post_prompt` 一对（见 legacy 分支），
 * ST 卡用 `character_book` / `world`——三方互不重叠。
 */
export function isFengyueCard(raw: unknown): boolean {
  if (!isRecord(raw)) return false
  return typeof raw.pre_text === 'string' || typeof raw.post_text === 'string'
    || (Array.isArray(raw.world_book) && raw.world_book.length > 0)
}

/** Container route: PNG magic → embedded-chunk walk; everything else → JSON text. */
export async function parseTavernCard(file: File): Promise<ParsedStImport> {
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    return { title: file.name, files: {}, cover: undefined, error: '所选文件无法读取' }
  }
  const isPng = PNG_MAGIC.every((byte, index) => bytes[index] === byte)
  if (!isPng) {
    let obj: unknown
    try {
      obj = JSON.parse(new TextDecoder().decode(bytes)) as unknown
    } catch {
      return { title: file.name, files: {}, cover: undefined, error: '不是有效的 JSON 文件' }
    }
    const fallbackTitle = file.name.replace(/\.(json|png)$/i, '')
    if (isFengyueCard(obj)) {
      // 风月封面是个远端 URL：导入在浏览器里，能抓就抓（CORS 允许与否由对方定），
      // 失败不拦导入——报告行提示 + 身份头随时可手动上传。
      const { cover, note } = await fetchRemoteCover(isRecord(obj) ? str(obj.cover) : '')
      return importFromJson(obj, fallbackTitle, cover, note)
    }
    return importFromJson(obj, fallbackTitle, undefined)
  }
  const embedded = readPngCardJson(bytes)
  if (embedded === undefined) {
    return { title: file.name, files: {}, cover: undefined, error: '不认识的 PNG 卡：tEXt 里没有内嵌角色数据（ccv3/chara）' }
  }
  const coverBase64 = toBase64(bytes)
  let obj: unknown
  try {
    obj = JSON.parse(new TextDecoder().decode(embedded.json)) as unknown
  } catch {
    return { title: file.name, files: {}, cover: undefined, error: 'PNG 内嵌的角色数据不是有效 JSON' }
  }
  const innerTitle = isRecord(obj) ? str(obj.name).trim() : ''
  return importFromJson(obj, innerTitle || file.name.replace(/\.png$/i, ''), { coverPath: 'preset/assets/cover.png', dataBase64: coverBase64 })
}

/** Base64 of the PNG bytes — computed once per card, shared by meta wiring and the cover landing. */


/**
 * Walk PNG chunks for the embedded character JSON: `tEXt` keywords `ccv3`
 * (V3) preferred over `chara` (V2), each carrying base64 JSON. No CRC
 * validation — a corrupt chunk reads the same as a missing one.
 */
function readPngCardJson(bytes: Uint8Array): { json: Uint8Array } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const latin1 = new TextDecoder('latin1')
  let foundV2: Uint8Array | undefined
  let offset = 8
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset)
    const type = latin1.decode(bytes.subarray(offset + 4, offset + 8))
    const data = bytes.subarray(offset + 8, Math.min(offset + 8 + length, bytes.byteLength))
    if (type === 'tEXt') {
      const nul = data.indexOf(0)
      const keyword = nul >= 0 ? latin1.decode(data.subarray(0, nul)) : ''
      if (keyword === 'ccv3') return { json: fromBase64(latin1.decode(data.subarray(nul + 1))) }
      if (keyword === 'chara' && foundV2 === undefined) foundV2 = fromBase64(latin1.decode(data.subarray(nul + 1)))
    }
    if (length <= 0) break
    offset += 12 + length
  }
  return foundV2 === undefined ? undefined : { json: foundV2 }
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text.trim())
  const out = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index) & 0xff
  return out
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

/**
 * Normalize any accepted version onto the V2 canonical shape.
 * @throws with a user-facing message when the JSON matches no accepted shape.
 */
export function normalizeCard(raw: unknown): { card: CanonicalCard } {
  if (!isRecord(raw)) throw new Error('不是有效的卡片 JSON')
  const spec = str(raw.spec)
  const versioned = spec === 'chara_card_v2' || spec === 'chara_card_v3'
  if (!versioned && !isRecord(raw.data) && str(raw.name) === '' && str(raw.pre_prompt) === '' && str(raw.post_prompt) === '') {
    throw new Error('不认识的卡格式：既无 spec 也缺 name / 提示词字段')
  }
  if (versioned && !isRecord(raw.data)) throw new Error(`V2/V3 卡缺少 data 对象（spec=${spec}）`)
  const data: Record<string, unknown> = isRecord(raw.data) ? raw.data : raw
  const extensions = isRecord(data.extensions) ? data.extensions : {}
  const bookRaw = data.character_book
  return {
    card: {
      name: str(data.name),
      description: str(data.description),
      personality: str(data.personality),
      scenario: str(data.scenario),
      firstMes: str(data.first_mes),
      mesExample: str(data.mes_example),
      creatorNotes: str(data.creator_notes) || str(raw.creatorcomment),
      systemPrompt: str(data.system_prompt),
      postHistoryInstructions: str(data.post_history_instructions),
      tags: strArray(data.tags),
      creator: str(data.creator),
      characterVersion: str(data.character_version),
      alternateGreetings: strArray(data.alternate_greetings),
      characterBook: isRecord(bookRaw) ? normalizeBook(bookRaw) : undefined,
      regexScripts: Array.isArray(extensions.regex_scripts) ? extensions.regex_scripts.filter(isRecord) : [],
      depthPrompt: str(isRecord(extensions.depth_prompt) ? extensions.depth_prompt.prompt : ''),
      worldRef: str(extensions.world),
      legacyPrePrompt: str(raw.pre_prompt),
      legacyPostPrompt: str(raw.post_prompt),
    },
  }
}

/** Normalize one character_book; the original entry verbatim rides `raw`. */
function normalizeBook(book: Record<string, unknown>): StBook {
  const entries: StBookEntry[] = []
  const list = Array.isArray(book.entries) ? book.entries : []
  for (const item of list) {
    if (!isRecord(item)) continue
    const extensions = isRecord(item.extensions) ? item.extensions : {}
    entries.push({
      keys: strArray(item.keys),
      content: str(item.content),
      constant: item.constant === true,
      probability: typeof extensions.probability === 'number' ? extensions.probability : 100,
      position: str(item.position) || 'before_char',
      insertionOrder: typeof item.insertion_order === 'number' ? item.insertion_order : 0,
      enabled: item.enabled !== false,
      raw: item,
    })
  }
  return { name: str(book.name), entries }
}

/** Compose the card's systemPrompt in ST's own assembly order (mapping §3). */
export function composeSystemPrompt(card: CanonicalCard): string {
  const bookEntries = card.characterBook?.entries ?? []
  const constantIn = (position: string): string =>
    bookEntries.filter(entry => entry.constant && entry.enabled && entry.position === position)
      .map(entry => entry.content.trim())
      .filter(text => text !== '')
      .join('\n\n')
  const sections: string[] = []
  const push = (heading: string, body: string): void => {
    if (body.trim() === '') return
    sections.push(`【${heading}】\n${body.trim()}`)
  }
  push('世界 · 上', constantIn('before_char'))
  push('人设', card.description)
  push('性格', card.personality)
  push('场景', card.scenario)
  push('对话示例', card.mesExample)
  push('创作者备注', card.creatorNotes)
  push('世界 · 下', constantIn('after_char'))
  push('系统指令', card.systemPrompt)
  return sections.join('\n\n')
}

/** The triggered (non-constant) entries folded into the world data file. */
export function buildLorebook(card: CanonicalCard): string | undefined {
  const triggered = (card.characterBook?.entries ?? []).filter(entry => !entry.constant && entry.enabled)
  if (triggered.length === 0) return undefined
  const entries = triggered.map((entry, index) => ({
    id: `e${index}`,
    keys: entry.keys,
    content: entry.content,
    probability: entry.probability,
    position: entry.position,
    insertionOrder: entry.insertionOrder,
    /** The original ST entry, verbatim — the re-fold source of record. */
    st: entry.raw,
  }))
  return `${JSON.stringify({ version: 1, entries }, undefined, 2)}\n`
}

/** first_mes heads the list; alternate greetings follow (ST swipe → our opening options). */
export function buildGreetings(card: CanonicalCard): string | undefined {
  const greetings = [card.firstMes, ...card.alternateGreetings].filter(text => text.trim() !== '')
  if (greetings.length === 0) return undefined
  return `${JSON.stringify({ greetings }, undefined, 2)}\n`
}

function shortDesc(description: string): string {
  const oneLine = description.replace(/\s+/g, ' ').trim()
  return oneLine.length > 140 ? `${oneLine.slice(0, 140)}…` : oneLine
}

type RegexVerdict = 'translate' | 'pending-render-hook' | 'drop'

/**
 * Pre-sort one regex script by its placement + flags (mapping §5.1):
 * `translate` rides the work order, the render-hook halves wait for PR5,
 * everything without a hook becomes an explicit report row.
 */
export function verdictRegex(entry: Record<string, unknown>): { entry: Record<string, unknown>; verdict: RegexVerdict; reason: string } {
  const placement = Array.isArray(entry.placement) ? entry.placement : []
  const promptOnly = entry.promptOnly === true
  const markdownOnly = entry.markdownOnly === true
  if (entry.disabled === true) return { entry, verdict: 'drop', reason: 'ST 内已停用' }
  const has = (value: number): boolean => placement.includes(value)
  if (has(1)) { // USER_INPUT
    if (promptOnly && !markdownOnly) return { entry, verdict: 'translate', reason: '注记式：提交期脚本改写意图随 post 注入' }
    if (markdownOnly) return { entry, verdict: 'pending-render-hook', reason: '显示半边等渲染钩子（PR5）' }
    return { entry, verdict: 'drop', reason: '落库改写需要引擎提交期改写钩子（映射 §8.11，未建）' }
  }
  if (has(2)) { // AI_OUTPUT
    if (markdownOnly) return { entry, verdict: 'pending-render-hook', reason: '显示半边等渲染钩子（PR5）' }
    return { entry, verdict: 'drop', reason: '消息准入改写 seam 未建（映射 §5.1）' }
  }
  if (has(5)) return { entry, verdict: 'translate', reason: '静态烘焙：findRegex/replace 应用到命中条目 content（ST 在注入时改写）' }
  if (has(3)) return { entry, verdict: 'drop', reason: '斜杠命令流不存在' }
  if (has(6)) return { entry, verdict: 'pending-render-hook', reason: '思考行前端聚合，随渲染钩子评估' }
  return { entry, verdict: 'drop', reason: '未知 placement' }
}

const PERSONA_MJS = [
  '// 玩家人格读取：把 {{persona}} 挖进提示词即可带入人格；文件缺席输出空。',
  '// 人格文件 = runtime/persona.md（由 setup/ 播种，玩家可编辑；随保存/载入滚动）。',
  '// cwd = runtime/；位置参数全局 argv 数组。跨平台 node 模块（.mjs）。',
  'import { existsSync, readFileSync } from "node:fs"',
  'if (existsSync("persona.md")) process.stdout.write(readFileSync("persona.md", "utf8"))',
  '',
].join('\n')

const LOREBOOK_MJS = `// 世界书扫描 v1.5（导入生成，可编辑）：条目两种匹配面——
// ① 带scan.kinds（风月卡，key_region 位码 1=system/2=user/4=assistant 折叠而来）：
//    取该种类集合「最近一条」消息做键匹配（快照没有 system 行，system 位恒不命中；
//    发送期最近一条 user 常是引擎预投影的本回合输入）。
// ② 无scan（ST 卡）：沿用最近 N 条 user/assistant 拼合窗口，argv[0] 可调（默认 12）。
// 命中（含 constant 条目）按 id 序输出 content；prob<100 掷次骰。
// 数据 ../preset/lorebook.json；文件或快照缺席时静默退出，世界书即失效。
// 不含递归/分组/预算（映射 §4 的 v1 简化）；重折叠由导入器重生成，别在本文件堆逻辑。
// cwd = runtime/；全局 argv = 位置参数数组（[窗口条数]，仅②生效）。
import { existsSync, readFileSync } from "node:fs"
const n = Number(argv[0] ?? 12) || 12
const book = "../preset/lorebook.json"
const snap = ".chat.snapshot.jsonl"
if (!existsSync(book) || !existsSync(snap)) process.exit(0)
const data = JSON.parse(readFileSync(book, "utf8"))
const rows = []
for (const line of readFileSync(snap, "utf8").trimEnd().split("\\n")) {
  try {
    const e = JSON.parse(line)
    if (e.kind === "user" || e.kind === "assistant" || e.kind === "system") rows.push(e)
  } catch {}
}
const window = rows.slice(-n).map(e => e.plain ?? "").join("")
const latest = kinds => {
  for (let i = rows.length - 1; i >= 0; i -= 1) if (kinds.includes(rows[i].kind)) return rows[i].plain ?? ""
  return ""
}
for (const entry of data.entries ?? []) {
  if (!entry.content) continue
  const kinds = entry.scan?.kinds
  const text = Array.isArray(kinds) && kinds.length > 0 ? latest(kinds) : window
  const hit = entry.constant === true || (entry.keys ?? []).some(k => text.includes(k))
  if (!hit) continue
  const prob = entry.probability ?? 100
  if (prob < 100 && Math.floor(Math.random() * 100) >= prob) continue
  console.log(String(entry.content).replaceAll("\\\\n", "\\n"))
}
`
const WORK_ORDER_DIR = 'preset/st-import/'

/**
 * Fold the canonical card into the whole file table (+ work order when there
 * is anything to report). `coverPath` pre-writes meta.cover so the PNG bytes
 * land via `writeAsset` right after `commitImport`.
 *
 * 风月卡也走这里（`isFengyueCard` 路由）：同步本层不发起网络请求，封面二进制
 * 由异步入口抓好后作 `cover` 传入；同步直呼本函数的风月卡若带封面 URL，记
 * 报告行说明未落地。
 */
export function importFromJson(
  raw: unknown,
  fallbackTitle: string,
  cover?: { coverPath: string; dataBase64: string },
  coverNote?: string,
): ParsedStImport {
  try {
    if (isFengyueCard(raw)) {
      const url = str((raw as Record<string, unknown>).cover)
      const syncNote = coverNote ?? (url !== '' && cover === undefined
        ? '- 封面：URL 未落地（本折叠路径不发起网络请求）——已留空，可在身份头手动上传'
        : undefined)
      return foldFengyueCard(raw as Record<string, unknown>, fallbackTitle, cover, syncNote)
    }
    return foldCard(raw, fallbackTitle, cover)
  } catch (error) {
    return { title: fallbackTitle, files: {}, cover: undefined, error: error instanceof Error ? error.message : String(error) }
  }
}

/** The fold proper — every throw lands as a user-facing import error. */
function foldCard(raw: unknown, fallbackTitle: string, cover?: { coverPath: string; dataBase64: string }): ParsedStImport {
  const { card } = normalizeCard(raw)
  const files: Record<string, string> = {}
  files['preset/prompt/systemPrompt'] = composeSystemPrompt(card)
  const lorebook = buildLorebook(card)
  const triggeredCount = (card.characterBook?.entries ?? []).filter(entry => !entry.constant && entry.enabled).length
  files['preset/prompt/postPrompt'] = [
    ...(lorebook !== undefined ? ['{{lorebook()}}'] : []),
    ...(card.postHistoryInstructions.trim() !== '' ? [card.postHistoryInstructions] : []),
    ...(card.legacyPrePrompt.trim() !== '' ? [card.legacyPrePrompt] : []),
    ...(card.legacyPostPrompt.trim() !== '' ? [card.legacyPostPrompt] : []),
  ].join('\n\n')
  files['preset/prompt/maintenancePrompt'] = ''
  const greetings = buildGreetings(card)
  if (greetings !== undefined) files['preset/greetings.json'] = greetings
  if (lorebook !== undefined) {
    files['preset/lorebook.json'] = lorebook
    files['preset/scripts/lorebook.mjs'] = LOREBOOK_MJS
  }
  files['preset/scripts/persona.mjs'] = PERSONA_MJS
  files['preset/setup/persona.md'] = ''
  const title = card.name.trim() || fallbackTitle
  const meta = {
    title,
    desc: shortDesc(card.description),
    cover: cover?.coverPath ?? '',
    creator: card.creator,
    version: card.characterVersion,
    tags: card.tags,
  }
  files['preset/meta.json'] = `${JSON.stringify(meta, undefined, 2)}\n`

  const verdicts = card.regexScripts.map(verdictRegex)
  const translate = verdicts.filter(item => item.verdict === 'translate')
  const drops = verdicts.filter(item => item.verdict === 'drop')
  const pending = verdicts.filter(item => item.verdict === 'pending-render-hook')
  const constantCount = (card.characterBook?.entries ?? []).filter(entry => entry.constant && entry.enabled).length
  const greetingCount = [card.firstMes, ...card.alternateGreetings].filter(text => text.trim() !== '').length
  const report: string[] = []
  for (const item of drops) {
    report.push(`- 丢弃：正则「${str(item.entry.scriptName) || '未命名'}」 — ${item.reason}`)
  }
  if (pending.length > 0) report.push(`- 待渲染钩子：正则 ${pending.length} 条（PR5 渲染钩子评估；重导入可迁移）`)
  if (card.depthPrompt !== '') report.push('- 丢弃：depth_prompt（卡自定压缩指令槽未建，映射 §8.3）')
  if (card.worldRef !== '') report.push(`- 缺失引用：extensions.world "${card.worldRef}"（共享世界书库未建，映射 §8.7）`)
  if (card.characterBook !== undefined) {
    const disabled = card.characterBook.entries.filter(entry => !entry.enabled).length
    if (disabled > 0) report.push(`- 跳过：禁用世界书条目 ${disabled} 条`)
  }
  report.push(`- 体量：恒定条目 ${constantCount} → systemPrompt；触发条目 ${triggeredCount} → lorebook.json；开场选项 ${greetingCount} → greetings.json`)
  const hasMaterial = translate.length > 0 || drops.length > 0 || pending.length > 0 || card.worldRef !== '' || card.depthPrompt !== ''
  if (hasMaterial) {
    const todos = translate.map((item, index) =>
      `| ${index + 1} | ${str(item.entry.scriptName) || `regex#${index + 1}`}（${item.reason}） | regex.json#${index + 1} | ☐ |`)
    files[`${WORK_ORDER_DIR}regex.json`] = `${JSON.stringify({ items: translate.map(item => item.entry) }, undefined, 2)}\n`
    files[`${WORK_ORDER_DIR}README.md`] = [
      '# ST 导入：翻译待办（本目录全部完成后删除）',
      '',
      '本卡由 SillyTavern 导入；以下源料无法机械折叠，需要理解后逐项翻译。',
      '',
      '## 导入报告（一次性；删除本目录即视为已阅）',
      ...report,
      '',
      '## 待办清单',
      '',
      ...(todos.length > 0
        ? ['| # | 源料 | 目标 | 状态 |', '|---|---|---|---|', ...todos]
        : ['（无翻译项 —— 读完报告即可删除本目录）']),
      '',
      '## 消化契约（每项必守）',
      '',
      '- 产物只落 `preset/` 内；runtime/ 是世界状态区，不写',
      '- 脚本自验：bash -n 过；产物里的 `{{…}}` 每个占位符必须有对应 preset/scripts 脚本',
      '- 全部完成后删除本目录（rm -rf preset/st-import）',
      '',
    ].join('\n')
  }
  return { title, files, cover: cover === undefined ? undefined : { path: cover.coverPath, dataBase64: cover.dataBase64 } }
}

/* ══════════ 风月（fengyue）方言：pre_prompt 三段 + world_book + HTML 开场页 ══════════ */

/** 抓取结果：封面二进制（或）一句已成型给报告行的失败原因。 */
interface RemoteCover { cover?: { coverPath: string; dataBase64: string }; note?: string }

/** 按魔数选引擎资产白名单内的扩展名 —— readAsset/writeAsset 都按扩展名定 MIME。 */
function imageExtOf(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return '.png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return '.jpg'
  // RIFF....WEBP
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return '.webp'
  if (bytes.length >= 2 && bytes[0] === 0x47 && bytes[1] === 0x49) return '.gif'
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return '.bmp'
  return undefined
}

/**
 * 抓风月封面的远端 URL（导入发生在浏览器里，CORS 放行与否由对方站点定）。
 * 任何失败都不拦导入：note 进报告行 + 身份头随时可手动上传。
 */
async function fetchRemoteCover(url: string): Promise<RemoteCover> {
  if (url.trim() === '') return {}
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { note: `- 封面：URL 抓取失败（HTTP ${response.status}）——已留空，可在身份头手动上传` }
    const bytes = new Uint8Array(await response.arrayBuffer())
    const ext = imageExtOf(bytes)
    if (bytes.byteLength === 0 || ext === undefined) {
      return { note: `- 封面：URL 响应不是可预览的图像${bytes.byteLength === 0 ? '（空响应）' : ''}——已留空，可在身份头手动上传` }
    }
    return { cover: { coverPath: `preset/assets/cover${ext}`, dataBase64: toBase64(bytes) } }
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    return { note: `- 封面：URL 抓取失败（${cause}）——已留空，可在身份头手动上传` }
  }
}

/** 风月世界书键解析：`_or_日本@wb@自卫队` → 键列表 + 组合模式。 */
function fengyueKeys(rawKey: string): { keys: string[]; mode: 'or' | 'and' | 'plain' } {
  const and = rawKey.startsWith('_and_')
  const or = rawKey.startsWith('_or_')
  const body = and ? rawKey.slice('_and_'.length) : or ? rawKey.slice('_or_'.length) : rawKey
  const keys = body.split('@wb@').map(key => key.trim()).filter(key => key !== '')
  return { keys, mode: and ? 'and' : or ? 'or' : 'plain' }
}

/**
 * 风月 key_region 位码 → 扫描消息种类（用户口述契约）：1=system、2=user、4=assistant，
  按位取和。0 或非数（缺失/脏数据）落默认 user+assistant，`defaulted` 供报告行计数。
 */
function fengyueScanKinds(keyRegion: unknown): { kinds: string[]; defaulted: boolean } {
  const mask = typeof keyRegion === 'number' && Number.isSafeInteger(keyRegion) ? keyRegion : 0
  const kinds: string[] = [
    ...(mask & 2 ? ['user'] : []),
    ...(mask & 4 ? ['assistant'] : []),
    ...(mask & 1 ? ['system'] : []),
  ]
  return kinds.length > 0 ? { kinds, defaulted: false } : { kinds: ['user', 'assistant'], defaulted: true }
}

/**
 * 折叠风月卡（映射契约见 docs/notes/feature/2026-09-18-fengyue-import.zh.md）：
 * pre_prompt → systemPrompt 原文；pre_text+post_text → postPrompt（有世界书时前置
 * `{{lorebook()}}`，沿用 ST 折叠的双件套 lorebook.json + lorebook.mjs）；description
 * 是自绘 HTML 开场页 → preset/setup/opening.html；opening_statement +
 * suggested_questions → greetings.json；summary → meta.desc。无对位的字段非空的
 * 一律落 `preset/st-import/` 导入报告。
 * @param coverNote - 封面未落地的原因（报告行原文）；无值且无二进制即视为干净。
 */
export function foldFengyueCard(
  raw: Record<string, unknown>,
  fallbackTitle: string,
  cover?: { coverPath: string; dataBase64: string },
  coverNote?: string,
): ParsedStImport {
  const files: Record<string, string> = {}
  const report: string[] = []
  const title = str(raw.name).trim() || fallbackTitle

  files['preset/prompt/systemPrompt'] = str(raw.pre_prompt)

  let defaultedKinds = 0
  const entries = (Array.isArray(raw.world_book) ? raw.world_book : [])
    .filter(isRecord)
    .map((item, index) => {
      const { keys, mode } = fengyueKeys(str(item.key))
      if (mode === 'and') {
        report.push(`- 世界书 #${index}：AND 组语义未迁移（我们的扫描器是 OR 触发）——原文 key：${str(item.key)}`)
      }
      if (str(item.group) !== '') {
        report.push(`- 世界书 #${index}：group「${str(item.group)}」分组语义未建，按独立条目处理`)
      }
      const scan = fengyueScanKinds(item.key_region)
      if (scan.defaulted) defaultedKinds += 1
      return {
        id: `e${index}`,
        keys,
        content: str(item.value),
        probability: 100,
        position: 'before_char',
        insertionOrder: index,
        /** key_region 位码（1=system/2=user/4=assistant）折叠的扫描面：取该
            种类集合「最近一条」消息做键匹配（lorebook.mjs v1.5 的 ① 分支）。 */
        scan: { kinds: scan.kinds },
        /** 原始风月条目 verbatim——重折叠之源（ST 卡的对应槽叫 `st`）。 */
        fy: item,
      }
    })
    .filter(entry => entry.keys.length > 0 && entry.content.trim() !== '')

  files['preset/prompt/postPrompt'] = [
    ...(entries.length > 0 ? ['{{lorebook()}}'] : []),
    str(raw.pre_text),
    str(raw.post_text),
  ].filter(text => text.trim() !== '').join('\n\n')
  files['preset/prompt/maintenancePrompt'] = ''
  if (entries.length > 0) {
    files['preset/lorebook.json'] = `${JSON.stringify({ version: 1, entries }, undefined, 2)}\n`
    files['preset/scripts/lorebook.mjs'] = LOREBOOK_MJS
    // key_region 已折叠为 scan.kinds。两个知情行：system 位在我们快照里没有
    // system 行恒不命中；位码缺落回默认扫描面。各数一次，不逐条刷屏。
    const systemBit = entries.filter(entry => entry.scan.kinds.includes('system')).length
    if (systemBit > 0) {
      report.push(`- 世界书：${systemBit} 条带 system 位（key_region bit1）——聊天快照无 system 行，该部分恒不命中`)
    }
    if (defaultedKinds > 0) {
      report.push(`- 世界书：${defaultedKinds} 条 key_region 缺位或非数，扫描面落默认 user+assistant 最近一条`)
    }
  }
  // 无键/无内容/非对象条目静默丢弃是在撒谎——数量进报告。
  const dropped = (Array.isArray(raw.world_book) ? raw.world_book.length : 0) - entries.length
  if (dropped > 0) report.push(`- 世界书：${dropped} 条源条目无键或无内容，未入 lorebook.json`)
  files['preset/scripts/persona.mjs'] = PERSONA_MJS
  files['preset/setup/persona.md'] = ''

  const desc = str(raw.description)
  if (desc.trim() !== '') files['preset/setup/opening.html'] = desc
  const greetings = [str(raw.opening_statement), ...strArray(raw.suggested_questions)]
    .filter(text => text.trim() !== '')
  if (greetings.length > 0) files['preset/greetings.json'] = `${JSON.stringify({ greetings }, undefined, 2)}\n`

  files['preset/meta.json'] = `${JSON.stringify({
    title,
    desc: shortDesc(str(raw.summary)),
    cover: cover?.coverPath ?? '',
    creator: '',
    version: '',
    tags: [],
  }, undefined, 2)}\n`

  if (coverNote !== undefined) report.push(coverNote)
  if (strArray(raw.banned_words).length > 0) report.push(`- 违禁词表 ${strArray(raw.banned_words).length} 条：无对位机制，未迁移`)
  if (Array.isArray(raw.cg_book) && raw.cg_book.length > 0) report.push(`- cg_book（CG 图鉴）${raw.cg_book.length} 条：无对位机制，未迁移`)
  if (Array.isArray(raw.shortcut_commands) && raw.shortcut_commands.length > 0) report.push(`- shortcut_commands ${raw.shortcut_commands.length} 条：斜杠命令流不存在，丢弃`)
  if (Array.isArray(raw.preset_chats) && raw.preset_chats.length > 0) report.push(`- preset_chats（预置聊天记录）${raw.preset_chats.length} 条：对话播种未建（同 ST first_mes 决策），未迁移`)
  report.push(`- 体量：世界书条目 ${entries.length} → lorebook.json（按 scan.kinds 最近一条消息匹配；值内容一律注入 postPrompt 的 {{lorebook()}} 座——value_region 不另设位）；开场选项 ${greetings.length} → greetings.json；开场页 ${desc.trim() !== '' ? '有' : '无'} → setup/opening.html`)

  // 风月卡没有 ST 那种“需要理解后手翻”的源料（映射全机械），报告即全部——
  // 无翻译清单，只有这份一次性 README（删除本目录即视为已阅）。
  const hasMaterial = report.length > 0
  if (hasMaterial) {
    files[`${WORK_ORDER_DIR}README.md`] = [
      '# 风月卡导入：报告（读完删除本目录）',
      '',
      '本卡由风月卡（catai.wiki 生态 JSON）导入；映射全部机械完成，以下为未迁移项与体量报告。',
      '',
      ...report,
      '',
      '- 全部知悉后删除本目录（rm -rf preset/st-import）',
      '',
    ].join('\n')
  }
  return { title, files, cover: cover === undefined ? undefined : { path: cover.coverPath, dataBase64: cover.dataBase64 } }
}

