// {{world_lore()}} — 世界设定根注入 systemPrompt：读 runtime/world.md 原样输出（setup/world.md 由 seedRuntime 播种）。
import { readFileSync } from 'node:fs'
try {
  console.log(readFileSync('world.md', 'utf8').trim())
} catch {
  console.log('（世界设定缺失——setup/world.md 未播种？）')
}