# 芋案:芙宁娜卡 galgame 化——多命令指令协议 + v2 声明面板

状态:已实现 | 日期:2026-09-22 | Surface:tavern_presets/芙宁娜 + packages/ui(挂载面加法)

## 决策

1. **通用指令协议(用户拍板)**:回复末尾输出一个 HTML 注释命令块,行式「命令: 值」,多命令并存——cg 是第一个注册命令,后续(好感度等)继续注册。解析=hooks main.after 机械写手(apply_directives.mjs 分发表);无 argv、幂等原子写、不在册 warn 保现值。
2. **CG 菜单挂 postPrompt**(用户定案):菜单+当前态每回合新鲜(mid-run 增 CG 可见;代价是整菜单逐回合重发,CG 库大后再权衡 systemPrompt />);
3. 面板=v2 声明形态(gal_data.mjs 数据泵/ view.mjs 纯函数/ runtime.mjs 拷自 dnd5e;avatars→readAsset 泛化)。层模型:manifest 层栈(z 序=数组序,cover/center/left/right 锚);台词=快照最近 assistant(数据侧剥注释);角落=最近 player。
4. **readAsset 通达挂载面**(宿主加法):卡前端图像走宿主资产通道(封面同款,10MB 级),彻底绕开 runScript stdout 的 64KB 上限——这是层图可行的关键。
5. 尾代维持关闭(维护空)——本机制不依赖尾代。

## 证据

- 引擎 REAL 用例(loader-composition galgame):真卡脚本逐字节进真组合——post 渲染出菜单、回合末指令块→钩子落盘 cg.json、幂等、gal_data 三件契约 + 剥离。
- 浏览器(CDP):初始画面(CG dataUrl 层+金饰对话框+角落小字+composer 可用);手写 cg.json 翻 2 号右锚→面板 rev 重绘证明「文件→刷新」链。
- 未决(独立立案):真宿主活回合挂起——env 已带 mock base url 但 LLM 零外连(疑真实凭据库覆盖 env+请求悬空);与卡无关,卡链已按上法分别钉死。
