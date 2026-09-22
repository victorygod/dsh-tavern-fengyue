# scripts/ — 提示词模板脚本（前后端共用的函数库）

引用形态：提示词里 {{scriptName(args)}}（圆括号必带，参数为字面量或嵌套调用）；
前端 preset/ui/index.js 里 tavern.runScript("scriptName", "参数…")。
脚本 = node 模块（.mjs），cwd = runtime/：读世界数据用相对路径
（readFileSync('state.md')），读会话快照 readFileSync('.chat.snapshot.jsonl')，
跨区读 ../preset/…；stdout（trim）即返回值；失败时占位符原样保留；
位置参数经全局 argv 数组进入（argv[0] 起为按序参数）。
骨架已带 read.mjs（读单个文件）。
