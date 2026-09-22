# typert 生成物的再生成

`lib/typert.host.*` 与 `lib/typert.remote-client.*` 是 typert 生成物（2026-09-17
快照，源点 tavern-extraction-2026-09-17 / 078257c）。`Remote` 方法签名未变时
无需再生成；若新增/修改 RPC，回到 deepseek-harness-master monorepo 执行：

    pnpm run build:lib:host          # 根目录（typertPlugin workspace 模式）
    把 packages/api/tavern/lib/typert.* 四件拷回本包 lib/
    sed -i '' 's|@deepseek-ai/dsh-api-tavern|dsh-tavern-fengyue-api|g' lib/typert.*
    （生成物内部烙着生成时的包名；typert-loader 校验 manifest 所有权必须
    与承载包一致，漏掉这步宿主启动即 fail loud）
并把 `tests/wire-face.spec.ts` 的 conforms 断言跑绿（生成物与 prototype 门禁
互证）。
