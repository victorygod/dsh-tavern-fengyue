// {{lore_index()}}:扫 runtime/lore/** 的 frontmatter 拼实体索引(名称+描述+路径),
// 挂 postPrompt——随每回合发送重扫并整体替换(会变的数据挂 post:旧值随消息退场,
// 新补登的实体下一回合即入索引;systemPrompt 只放恒定内容,A#1 反转定案)。
// 路径口径 = 相对 runtime/,与主代理 runtimeRead 工具的 path 参数同口径,可直接照抄。
// cwd = runtime/;lore/ 不存在或为空时输出占位说明(占位符失败会原样保留,故自愈降级)。
// v2:node 模块(.mjs);位置参数经全局 argv 数组。
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const CAP = 200
if (!existsSync('lore')) {
  console.log('(世界设定尚未播种:实体卡的索引将出现在这里)')
  process.exit(0)
}
const files = []
const walk = (dir, rel) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`
    if (entry.isDirectory()) walk(join(dir, entry.name), childRel)
    else if (entry.name.endsWith('.md')) files.push(childRel)
  }
}
walk('lore', '')
files.sort()
let count = 0
for (const rel of files) {
  if (count >= CAP) break
  count += 1
  const text = readFileSync(join('lore', rel), 'utf8')
  const name = /^name:[ \t]*(.+)$/m.exec(text)?.[1] ?? rel.replace(/\.md$/, '')
  const desc = /^description:[ \t]*(.+)$/m.exec(text)?.[1] ?? ''
  console.log(`- ${name}:${desc}(runtimeRead: lore/${rel})`)
}
if (count === 0) console.log('(runtime/lore/ 暂无实体文件)')
else if (files.length > CAP) console.log(`(索引只列 ${CAP} 项,共 ${files.length} 个实体)`)
