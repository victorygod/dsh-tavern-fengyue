// 冒险手簿数据源:ui/index.js 轮询本脚本,输出整册 JSON。
// cwd = runtime/;任何失败直接非零退出(前端保留上一次数据);全局 argv=位置参数数组。
import { readdirSync, readFileSync } from 'node:fs'

const read = p => { try { return readFileSync(p, 'utf8') } catch { return '' } }
const fm = (text, key) => {
  const m = text.match(new RegExp('^' + key + ':[ \\t]*(.+)$', 'm'))
  return m ? m[1].trim() : ''
}
// 正文视图:剥掉 frontmatter、首个 H1 与行首井号,余下一字不动交付——面板原文直出,不做任何结构化解析。
const body = text => text
  .replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, '')
  .replace(/^#\s+[^\n]*\r?\n/, '')
  .replace(/^#{1,6}\s+/gm, '')
  .trim()
const entities = cls => {
  let entries = []
  try { entries = readdirSync('lore/' + cls, { withFileTypes: true }) } catch { return [] }
  return entries.filter(e => e.isFile() && e.name.endsWith('.md')).map(e => {
    const t = read('lore/' + cls + '/' + e.name)
    return { name: fm(t, 'name') || e.name.replace(/\.md$/, ''), desc: fm(t, 'description'), body: body(t) }
  })
}
const playerText = read('players/player.md')
const stateText = read('state.md')
console.log(JSON.stringify({
  ok: playerText !== '' || stateText !== '',
  player: { name: fm(playerText, 'name') || '你', body: body(playerText) },
  state: { body: body(stateText) },
  npcs: entities('characters'),
  quests: entities('quests'),
  items: entities('items'),
  skills: entities('skills'),
  places: entities('locations'),
}))
