# assets/ — 媒体资产(封面/背景/立绘/音频/视频)

卡内引用一律走 preset 相对路径:meta.json 的 cover、
卡 CSS/JS 经 runScript 的 ../preset/assets/…(上传封面自动落入本目录并回写 meta.cover)。
