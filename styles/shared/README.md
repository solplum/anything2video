# 共享风格代码与手动复用

`shared/` 是实现依赖，不是可选择的风格 ID，也不是新的 `config.style` 皮肤。

## 油画笔触底座

`paint/strokes.ts` 是 `light-dabs`、`lily-pond`、`swirl-oil`、`scream-warp` 共用的唯一实现。四个旧路径的 `strokes.ts` 保留为 `export * from '../shared/paint/strokes'` 兼容入口；所有导出、调用签名、默认值与随机种子保留。各风格自己的 `world.ts`、`motion.ts`、`flow.ts`、`kit.tsx` 和材质参数继续独立。

本轮只收束逐字节相同的实现。共享源的 SHA-256：

```text
e65318de5cd6f2099096dffb6c3bf67e951207b7f5332a47fa4b0696dd7a0c1d
```

来源仍是文件头登记的 huashu-art-motion 笔触方法的 TypeScript 重写；保留文件头与 [`MIT-huashu-art-motion.txt`](../../LICENSE-THIRDPARTY/MIT-huashu-art-motion.txt)。其他风格归入同一选择家族，不表示它们共享这个实现。

## 新工程必须复制共享兄弟目录

仅复制 `styles/light-dabs/`（或另三个目录）会留下失效的相对导入。请连同共享实现复制，并保留兼容入口与共享目录的相对关系。例如，把一个风格放进 `src/style/` 时，目录应为：

```text
src/
  style/
    kit.tsx
    strokes.ts              # 兼容入口，仍导入 ../shared/paint/strokes
    world.ts                # 以及该风格需要的其他文件
  shared/
    paint/
      strokes.ts            # 从 styles/shared/paint/strokes.ts 复制
```

若在 `src/styles/` 下保留多个原风格目录，则使用 `src/styles/<id>/strokes.ts` 和 `src/styles/shared/paint/strokes.ts`。移动目录时，要同步检查全部相对导入；不能只复制两行包装文件并声称图元已完整接入。各风格的预烘焙图片、字体及 `staticFile` 引用仍按其 SPEC 逐项准备。

已经独立复制了旧版完整 `strokes.ts` 的外部工程不会被这次仓库整理改变，也不需要为了使用旧片而迁移。新工程采用上述布局后，先 typecheck，再对固定 seed 的签名帧和连续片段做回归。

## 验证边界

源码仓库的 `tests/style-system.test.mjs` 比对四个旧入口的完整导出和固定 seed 的 Canvas 命令轨迹，并检查共享源哈希。它不等于四张卡的完整像素、运动或声音回归。共享文件若要改变行为，应另起有明确范围的改动并补相应证据。
