// 开场页数据源:opening.html 加载后经 ui/index.js 桥委托本脚本,读当前 runtime 供预填。
// cwd = runtime/;输出 JSON {player, characters, locations, openings};失败非零退出(前端降级空态)。
import { readFileSync, readdirSync } from 'node:fs'

const read = p => { try { return readFileSync(p, 'utf8') } catch { return '' } }
const fm = (text, key) => {
  const m = text.match(new RegExp('^' + key + ':[ \\t]*(.+)$', 'm'))
  return m ? m[1].trim() : ''
}
/** 正文 = frontmatter 之后的一切(「详细设定」,可空)。 */
const body = text => {
  const m = /^---\n[\s\S]*?\n---\n?([\s\S]*)$/.exec(text)
  return m ? m[1] : ''
}

function list(cls) {
  let entries = []
  try { entries = readdirSync('lore/' + cls, { withFileTypes: true }) } catch { return [] }
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => {
      const t = read('lore/' + cls + '/' + e.name)
      return { name: fm(t, 'name') || e.name.replace(/\.md$/, ''), description: fm(t, 'description'), body: body(t) }
    })
}

const playerText = read('players/player.md')
let openings = []
try { openings = JSON.parse(read('openings.json')) } catch { openings = [] }
if (!Array.isArray(openings)) openings = []

console.log(JSON.stringify({
  player: { name: fm(playerText, 'name'), description: fm(playerText, 'description'), body: body(playerText) },
  characters: list('characters'),
  locations: list('locations'),
  openings,
}))
