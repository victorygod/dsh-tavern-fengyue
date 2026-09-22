**What / 改动内容**

**Why / 动机**

**Scope / 影响范围**

Which layer does this touch — kernel-adjacent adapter / engine / UI / presets / docs? Remind yourself of the boundary: nothing under `lib/` or the harness kernel changes here. / 动的是哪一层——内核邻接适配 / 引擎 / UI / 预设 / 文档?边界自查:本仓库不改动 `lib/` 与 harness 内核。

**Checks / 自查**(keep the suite green before requesting review / 请 review 前保持全绿)

- [ ] `pnpm lint` / `pnpm build` / `pnpm test` 全绿
- [ ] 脚本跨平台——未引入 POSIX-only 写法(`node:path`、Node API)
- [ ] 文档同步(README / docs)
