/** @tavern-schema
{
  "description": "掷一枚骰子并返回点数（测试用样例工具）",
  "parameters": {
    "sides": { "type": "integer", "description": "骰子面数，默认 6" },
    "count": { "type": "integer", "description": "掷骰次数，默认 1，最多 10" }
  }
}
*/
// 具名参数工具：参数对象在全局 args（{ sides, count }），由 @tavern-schema 块注册。
const sides = Math.max(2, Number(args.sides ?? 6))
const count = Math.max(1, Math.min(10, Number(args.count ?? 1)))
const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
console.log(`掷 ${count}d${sides}: ${rolls.join(' ')}`)
