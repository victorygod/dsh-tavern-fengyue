// {{get_player_state()}} — 【玩家面板】:characters/player.json 原样注入(机件+叙事一人一文件)。
import { readFileSync } from 'node:fs'
try {
  const j = JSON.parse(readFileSync('characters/player.json', 'utf8'))
  console.log(JSON.stringify(j, null, 1))
} catch {
  console.log('（玩家面板缺失——开局未完成或文件损坏；勿臆造任何数值，提醒玩家重新开局）')
}
