# tools/ — 主代理工具脚本

每个 .sh 即一个独立工具。头部 `# @tavern-schema` 注释块（JSON：description + parameters）
注册为具名参数工具，整个参数对象作为单个 JSON 字符串传入 $1；
无标记脚本自动获得 {args} 泛化条目，参数为命令行尾字符串，`-h` 输出即用法自述（mtime 缓存）。
本目录只服务主代理；尾代理的 runtime* 工具由引擎写死。
