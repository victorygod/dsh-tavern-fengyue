// {{srd_index()}} — SRD 全量索引注入 systemPrompt：读 runtime/srd/INDEX.md 原样输出
// （setup/srd/INDEX.md 由 seedRuntime 播种，内容由卡根 scripts/export-srd.mjs 生成）。
// cwd=runtime（与 world_lore 同律）；文件缺失=提示重生成，不硬崩。
import { readFileSync } from 'node:fs'
try {
  console.log(readFileSync('srd/INDEX.md', 'utf8').trim())
} catch {
  console.log('（SRD 索引缺失——setup/srd/INDEX.md 未播种？跑 node scripts/export-srd.mjs 重新生成）')
}
