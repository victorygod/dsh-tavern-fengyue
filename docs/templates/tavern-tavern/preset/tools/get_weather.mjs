/** @tavern-schema
{
  "description": "查询指定城市的当前天气（样例：具名参数工具）",
  "parameters": {
    "city": { "type": "string", "required": true, "description": "城市名" },
    "days": { "type": "integer", "description": "预报天数，默认 1" }
  }
}
*/
// 具名参数工具：参数对象在全局 args（{ city, days }），由 @tavern-schema 块注册。
console.log(`城市: ${args.city ?? '未知'}`)
console.log(`预报天数: ${args.days ?? 1}`)
console.log('天气: 晴转多云（样例数据）')
