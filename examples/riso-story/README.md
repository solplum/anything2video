# 留一条路 · Riso narrative study

36 秒、1280×720、24fps、无旁白的原创故事。蓝色甲虫推动一片粉色折纸，被河道挡住。纸片展开成桥；第二版在桥面上印出深色通路。甲虫过河后回头等待，另一只甲虫沿它留下的桥走来。

这是一支视觉与功能草稿，不宣称通过完整正常速度观看或完整混音试听。实测范围和缺口见 verification.json。既有 `riso-print` ID、SPEC 的历史机台配方、`film.tsx`、`kit.tsx`、`world.ts` 和原样片保持兼容。

## 看成片

- [36 秒带录音混音预览](preview.mp4)
- [480px 编码后画面](preview-480.png)
- [动作窗口抽帧](action-windows.jpg)

## 复现

在仓库根目录：

```sh
npm --prefix template ci
npm --prefix template run typecheck
cd template
npx remotion render src/index.ts RisoStoryDemo /absolute/new/silent.mp4 --codec h264
cd ..
node examples/riso-story/mix-preview.mjs /absolute/new/silent.mp4 /absolute/new/preview.mp4
```

`Video` 仍是 Studio 默认合成，新增 `RisoStoryDemo` 是可选示例。临时 `silent.mp4` 没有音轨；混音脚本仅为该叙事视频嵌入已有授权录音，不生成或分发独立音乐文件。支持的 Chromium 依环境选择，不关闭沙箱或系统隔离。

## 可复用部分

`template/src/common/riso` 提供 `RisoPaper`、`InkPlate` 和纯时间函数。艺术内容是调用方传入的 SVG children，和纸、专色、网点、套印、显墨分开；不导入甲虫、河流、折纸或36秒时间表。详见 [riso-print SPEC](../../styles/riso-print/SPEC.md#叙事扩展可复用分版)。

`template/src/shots/riso-story/timing.ts` 使用现有 named cues，不再造第二套时间轴。事件秒数是这支无对白视觉练习的导演时点，不冒称测得音乐拍点。摄影每帧采样；步态12fps；套色平时固定，只在接岸与叠印时触发短暂 kick。结尾有2秒静止，保留桥与两位角色的关系。

## 镜头与动作

| 秒 | 因果 | 图像/材质变化 |
|---|---|---|
| 0–8 | 甲虫推纸前进，被河道截住 | 两个可辨认主体；镜头轻拉开建立缺口 |
| 8–13 | 停住、看纸、把纸推到岸边 | 镜头靠近阅读，纸转向并压成折叠形 |
| 13–18 | 折纸逐节展开，够到对岸 | 粉色纸材从紧折变成连续拱桥 |
| 18–22 | 桥落定，蓝版扫过 | 粉×蓝叠印出第三色，路连通 |
| 23–28 | 甲虫沿桥过河 | 同一身份沿桥面中心路径连续通过；身体沿桥面倾斜，足端按曲面修正；仍是简化步态，非真实昆虫运动学 |
| 29–34 | 它回头，第二只甲虫走来 | 桥被继续使用，不收回成道具 |
| 34–36 | 两只甲虫相遇 | 因果完成，静止留读 |

## 来源与许可

方法研究参考 [Lemo-Opuscar risograph STYLE.md](https://github.com/lemomo-ai/lemo-opuscar/blob/main/styles/risograph/STYLE.md)：用版的到来、叠印与套准事件推动叙事。未复制其代码、人物、构图、故事、音轨或素材。这里是独立 SVG/Remotion 实现，没有引入其 WebGL 引擎。素材为原创几何，无外部字体。

录音：Mixkit `Classical Vibes 2` (684)，原曲文件和来源见 [既有授权记录](../../assets/audio/ATTRIBUTION.md)。混音取曲内0–36秒并做首尾电平淡变；同期纸声使用已登记的 `paper-page-turn.mp3`、`paper-move-quick.mp3`。2026-10-22复核 [Music Free License](https://mixkit.co/license/modal/musicFree/) 与 [SFX Free License](https://mixkit.co/license/modal/sfxFree/)：本在线视频嵌入用途在许可范围，原始录音权利仍属其权利人，不因仓库代码MIT而开放独立素材再分发。该音乐不得用于电视/电台、CD/DVD、游戏或注册版权管理。本次不新增任何原始音乐素材副本。

预览的曲目选择根据已有曲库气质记录，不是新一次试听结论。无法取得听音通道时必须保留 listening=not_performed，技术响度/解码检查不可替代听感。
