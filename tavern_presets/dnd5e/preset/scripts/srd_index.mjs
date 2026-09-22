// {{srd_index()}} — SRD 根索引入 systemPrompt：读 runtime/dnd5e-srd-lorebook/INDEX.md 原样输出（assemble.mjs 生成）。
import { readFileSync } from 'node:fs'
try {
  console.log(readFileSync('dnd5e-srd-lorebook/INDEX.md', 'utf8').trim())
} catch {
  console.log('（SRD 索引缺失——语料未播种？检查 setup/dnd5e-srd-lorebook）')
}
