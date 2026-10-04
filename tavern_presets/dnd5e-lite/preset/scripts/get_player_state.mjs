// {{get_player_state()}} — 【玩家面板】:characters/player.json 过叙事投影(panel-view)注入——
// 只留演绎需要的事实,机械数值与规则原文由工具读盘/回执供,面板不教怎么用(2026-10-02)。
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { panelView } = await import(pathToFileURL(process.cwd() + '/../preset/lib/panel-view.mjs').href)
try {
  const j = JSON.parse(readFileSync('characters/player.json', 'utf8'))
  console.log(JSON.stringify(panelView(j), null, 1))
} catch {
  console.log('（玩家面板缺失——开局未完成或文件损坏；勿臆造任何数值，提醒玩家重新开局）')
}
