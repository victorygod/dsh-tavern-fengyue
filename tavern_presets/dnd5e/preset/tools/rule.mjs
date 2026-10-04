/** @tavern-schema
{
  "description": "规则原文查证器——规则边缘案件才调（常用判据里的东西都在本提示与各工具回执里，别当搜索引擎用）。何时调：罕见规则细节拿不准而叙事裁决有分量时（穿戴/调律/坐骑冲撞/水下细节等）；章枚举=全集，回执返回该章规则原文全文（超限带关键词行提取）。逐条判据＝本提示明文规则 > 章原文 > 你的记忆。",
  "agents": ["main"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：为什么此刻要查这条规则——回执把查证与结果钉在一起。" },
    "chapter": { "type": "string", "required": true, "enum": ["ability-checks", "ability-scores-and-modifiers", "actions-in-combat", "activating-an-item", "advantage-and-disadvantage", "attunement", "between-adventures", "casting-a-spell", "conditions", "cover", "damage-and-healing", "diseases", "fantasy-historical-pantheons", "madness", "making-an-attack", "mounted-combat", "movement", "movement-and-position", "objects", "poisons", "proficiency-bonus", "resting", "saving-throws", "sentient-magic-items", "standard-exchange-rates", "the-environment", "the-order-of-combat", "the-planes-of-existence", "time", "traps", "underwater-combat", "using-each-ability", "wearing-and-wielding-items", "what-is-a-spell"], "description": "规则章 slug(全集枚举,如 making-an-attack/resting/underwater-combat)。" },
    "q": { "type": "string", "description": "关键词（可选）——章文本超限时按 q 提行(命中行±2 上下文)；章短则返回全文。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { RULES_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/rules-core-data.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err2('缺必填 context(剧情梗概)')
a.chapter || err2('缺必填 chapter(规则章枚举)')
const ch = RULES_CORE[String(a.chapter).toLowerCase()]
ch || err2(`章查不到:${a.chapter}——枚举内取值(全集见工具 schema)`)
const text = String(ch.text ?? '')
const CAP = 7000
let body
if (text.length <= CAP) body = text
else if (a.q) {
  const kw = String(a.q).toLowerCase()
  const lines = text.split('\n')
  const hits = lines.map((l, i) => l.toLowerCase().includes(kw) ? i : -1).filter(i => i >= 0)
  body = hits.length
    ? [...new Set(hits.flatMap(i => lines.slice(Math.max(0, i - 2), i + 3)))].join('\n')
    : '(章内无命中关键词——换 q 或按语义另选章)'
} else {
  body = text.slice(0, CAP) + '\n…(章超限截断——传 q 关键词提取相关段)'
}
console.log(`[规则 · ${ch.name}]`)
console.log(body)
console.log(`  ◇ 出处: ${a.chapter}(SRD 5.1 章原文)`)
console.log(`  ◇ 梗概: ${a.context}`)
function err2(m) { console.log('!' + m); process.exit(1) }
