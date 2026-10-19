# 480px 可读性探针：检测范围与用法

probe_readability.mjs 接收视频，不接收工程目录或单张图片。它从真实 ffprobe 元数据生成移动端缩略图，可选审计显式图元清单；它不做 OCR，不从像素自动发现文字或图元，也不检测运动质量。

```sh
node <skill>/scripts/probe_readability.mjs renders/film.mp4 \
  --elements research/readability-elements.json \
  --mobile-width 480 --sample-rate 2 --safe-bottom 170 \
  --out qc/readability --json > qc/readability-report.json
```

每次运行在 --out 目录下新建 run-* 子目录，避免旧缩略图掩盖抽帧失败。抽样从 0 秒开始；单次最多 10,000 帧，超限须增大间隔。只接受方形像素、未旋转视频；旋转/非方形像素视频须先规范化后再按最终像素填清单。

--sample-rate 单位秒；--mobile-width 单位显示像素；--safe-bottom 单位源视频像素。未指定 safe-bottom 时按视频高度 × 170/1080 折算字幕保留带。它是项目约定的字幕带，不是任何平台固定 UI 尺寸；竖屏发布区以实际平台预览为准。输出建议最小字号为 ceil(12 × 原宽 / 显示宽)，不能把所有分辨率都写成 48px。

图元清单使用渲染后/变换后的屏幕空间 bounds 和有效字号，不用未缩放的组件局部坐标。对关键帧中的每个文字与前景图元登记；背景不充当字幕区侵入对象。多状态布局可分开清单逐次跑探针并记录对应帧/时窗，不能声称一张清单自动覆盖全片。示例：

```json
{
  "schemaVersion": 1,
  "width": 1920,
  "height": 1080,
  "elements": [
    {"id":"title","type":"text","text":"同一请求，复用结果","fontSize":64,"x":120,"y":120,"width":900,"height":90,"isSubtitle":false},
    {"id":"diagram","type":"graphic","x":120,"y":300,"width":900,"height":400},
    {"id":"subtitle","type":"text","text":"命中缓存后直接返回结果","fontSize":52,"x":240,"y":940,"width":1440,"height":70,"isSubtitle":true}
  ]
}
```

width / height 必须匹配视频元数据；text 必须给文字与 fontSize，graphic 不推断字号。x/y/width/height 均为源像素。isSubtitle 仅豁免字幕带侵入，不豁免字号/越界检查。空清单不证明无文字；不完整清单无法证明全片安全。

## 如何读结果

- failed：输入/元数据错误、ffmpeg/ffprobe 不可用、部分抽帧失败，或声明图元未通过检查。修复后重跑，不得沿用旧输出宣称成功。
- not_performed：某项检查没有必要输入或没有执行，如未传图元清单、OCR/运动分析。它不是通过。
- needs_review：缩略图已生成，或声明图元数值检查已完成，但实际字体形状、对比度、遮挡、动画过程与足够阅读时间仍待看片。顶层 passed 不会因抽帧成功而变为 true。
- passed：只可出现在已执行且通过的数值子检查中；其范围限所提供清单，不等于整片可读性验收。

CLI 失败退出 1，待审退出 2；0 保留给完整通过或 --help。自动化须显式处理 2 并保留报告，不能用 `|| true` 把失败改成通过。

生成后实际查看 480px 图片，复看标题出现、复杂中段、字幕切换、结尾的运动片段。记录能否读完、遮挡、唯一焦点与静止区间；把报告和看片记录接入原有 visual / motion 审核。与 probe_subtitle_band.py 的像素疑点定位互补，不能用二者之一替代完整播放。已知坏例应包括小字和侵入字幕带，确保探针确实失败。
