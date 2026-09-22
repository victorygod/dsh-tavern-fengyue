// cg_brief — 提示词面(postPrompt 占位坑):视觉演出指令契约 + CG 菜单 + 当前态。
// 单一事实源 = preset/assets/cg/manifest.json;本脚本只做渲染,不落数据。
// 指令协议(通用多命令块):回复末尾输出一个 HTML 注释块,每行「命令: 值」;
//   现支持: cg: <id>。新增命令 = 注册进 apply_directives.mjs 的分发表 + 在此登记契约。
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync('../preset/assets/cg/manifest.json', 'utf8'))
let current = manifest.default
try { current = JSON.parse(readFileSync('cg.json', 'utf8')).id ?? current } catch {}

const menu = Object.entries(manifest.cgs)
  .map(([id, cg]) => `  ${id} — ${cg.intro}`)
  .join('\n')

process.stdout.write(`[视觉演出·指令协议]
每条回复的末尾,输出一个 HTML 注释命令块(不可见的机器指令,每个命令一行「命令: 值」):
 cg: <CG序号> —— 按当前场景选择背景演出。每回合都输出(不变也输出,保持同步)。
可用CG(id — 简介):
${menu}
当前CG:${current}
矩阵纪律:注释块必须在正文结尾;一个块内可含多行命令;玩家不感知此块的存在。`)
