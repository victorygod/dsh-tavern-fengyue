# tools/ — 主代理工具脚本

每个 .mjs 即一个独立工具（node 模块，stdout 即回执）。头部 /** @tavern-schema … */
注释块（JSON：description + parameters）注册为具名参数工具，参数对象在全局 `args`；
无标记脚本自动获得 {args} 泛化条目，参数收作字符串数组 `argv`。
本目录只服务主代理；尾代理的 runtime* 工具由引擎写死。
