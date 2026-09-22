# Agent Note：酒馆侧栏收起到零宽，toggle 常驻聊天头部

Status: implemented

[English](2026-09-14-tavern-sidebar-collapse-toggle.md) | 中文

## 问题

酒馆页的会话侧栏固定 264px，没有任何腾出空间的办法。默认 web UI 的收起机制在 `ui-layout`/`ui-sidebar` 里，而酒馆页经 root-slot shadow 整页替换了这些部件——tavern profile 下那套机制根本不可达。

## 决策

**收起止于 width 0，不是 rail。** dsh 侧栏收起后是 56px 图标 rail，因为它的收起态控件本来就是图标；酒馆侧栏的控件全是文字按钮，一个 rail 只会剩几个孤零零的字形。因此 toggle 放在聊天头部，且**两种状态下都必须常驻**——列宽归 0 之后它是唯一的唤回点。收起态在其右保留一颗「＋ 开启酒馆会话」，新会话主操作不随侧栏一起消失。

**过渡动画沿用默认侧栏的冻结宽技巧。** 内层列钉死在 264px、原地淡出，外层 aside 滑到 0——滑动过程是裁剪而不是 reflow；`visibility` 在 0.22s 落定之后才翻转，这就是键盘焦点与读屏树的撤走时机（`SidebarRoot` settle 后卸载宽内容的等价做法，且不需要定时器状态）。偏好持久在 localStorage（`tavern.sidebar.open`），与 last-line 缓存同一直写模式。

**toggle 字形是内联 SVG，不引 `ui-primitives`。** 酒馆页以运行时 fetch 的动态 bundle 交付、受 client bundle purity gate 约束，`@deepseek-ai/dsh-client-ui-primitives` 不是它的 module-table 行（静态装配通道的包可以裸引；酒馆不是）。包内单色字形也贴合本页的图标口径。

## 已否决的替代方案

- **dsh 式 56px rail**：否决——没有哪个酒馆控件能缩成有语义的图标，rail 上只会剩 toggle 自己。
- **import `IconPanelLeftOutline16`**：否决——对 `ui-primitives` 的值导入会触发动态 bundle 的 purity gate；为一个图标声明 module-table 行等于白背一个 loader 依赖。

## 后果

`packages/client/ui-tavern` 之外零源码改动：不碰 layout store、外壳、bundle、引擎装配。偏好的作用域是每个浏览器（同 last-line 缓存），不是每个会话。收起后 aside 保持挂载，工作空间行与封面拉取照常在背后刷新；`visibility: hidden` 使其按钮在收起期间脱离焦点序。
