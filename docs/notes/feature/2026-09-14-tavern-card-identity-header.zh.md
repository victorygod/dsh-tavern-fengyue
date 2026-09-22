# Agent Note：酒馆卡片身份头（封面 + 标题/简介）与 writeAsset RPC

Status: implemented

[English](2026-09-14-tavern-card-identity-header.md) | 中文

## 问题

卡片创作页（编辑卡页、制作卡页、设置模态工作空间页、导入预览页）对卡片身份——标题、简介、封面——的唯一暴露方式是文件编辑器里 `preset/meta.json` 的原始 JSON 文本。身份在每个创作页顶部都不可见，而且根本没有二进制资产的写入通道：所有资产 RPC（`readAsset`、`readLibraryAsset`）都是只读的。

## 决策

**身份头在所有有磁盘工作空间的创作页顶替原页标题行。** 左侧固定 120×82 封面（卡库书架约 19:13 比例的缩小版，一条共享 CSS 注释钉住两处比例的同步），右侧标题与简介是两行点击行内编辑的文本；页面动作按钮与尾代理 chip 移入身份头右侧动作区。导入预览页编辑的是内存表里的 meta，不带封面上传——`commitImport` 之前不存在磁盘工作空间可写，且预览文件表只承载文本。

**`meta.json` 保持唯一写路径。** 客户端解析已经经 `readText` 读到的 meta 文本、重新序列化被编辑的字段、经既有 `writeText` 保存。引擎不加 meta 校验——引擎的读取器本就容忍坏档，而第二条结构化写路径还需要在 `editDirty`/`saveEdit` 之外自建一套脏语义。解析失败的 meta 文件让身份头转只读并给出修复提示，不阻塞编辑器。

**封面上传是唯一新增 wire 方法：`tavern.writeAsset`。** 引擎解码 base64、执行读取路径同源的扩展名白名单、限制解码后大小（`editWriteCap` 配置，默认 1 MB）、围栏限制在 `preset/` 下——封面是卡片内容，`runtime/` 与 `savings/` 不得写入。客户端经 tree 列表选一个空闲的 `preset/<name>` 路径（碰撞加数字后缀，`commitImport` 先例——固定 `cover.png` 名会静默覆盖用户同名文件），上传后经普通 meta 写把 `meta.cover` 指向新路径。清除封面只解除引用，文件留在磁盘上。

## 已否决的替代方案

- **结构化 `updateMeta` RPC**（引擎解析并校验 JSON）：否决——它会给同一个文件开第二条失败语义不同的写路径，而编辑器的文本视图与 `presetDiffers` 本就把 meta.json 当字节处理。
- **固定封面文件名**：因上述覆盖问题否决；还会丢掉原始文件名——卡目录被分享或再导入时那是有用上下文。

## 后果

大小上限由引擎唯一权威：`editWriteCap` 与 `editReadCap`（默认均 10 MB）共同管住写入与预览读取——两者必须同步动，否则大图传得上去、各渲染点却拒绝预览。客户端不做字节预检；被拒的上传把引擎的错误信息弹出来。wire 新增一个方法，typert host 清单与 api-tavern client bundle 已在同批重生成。坏 meta 时身份头只读、但有意不指出哪个字段错了——JSON 错误没有字段定位。
