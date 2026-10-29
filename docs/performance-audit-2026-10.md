# 2026-10：性能实测与边界（仓库维护报告）

本报告、原始结果与基准脚本仅供仓库维护，不随 core/full 安装包分发。没有删减资产、降低画质、跳过校验或改变默认包 profile；没有执行浏览器渲染。

## 结论

- **实际落地**：SHA256 改用一个可复用的 **1 MiB** 同步缓冲区，仍逐次读取并计算每个文件的全部字节，无摘要/mtime 缓存。`build-editions.mjs` 与 `runtime-lib.mjs` 共享 `scripts/hash-file.mjs`，覆盖打包、源快照和媒体证据哈希。
- **实际落地**：core 构建只遍历一次完整输入树；仍记录全部被省略视频的大小与 SHA256。验证复用同一次 `lstat` 的文件类型与大小，保留 realpath 边界、符号链接、全部文件摘要和省略项检查。
- **未落地**：bundle 缓存实验有热缓存收益，但未完成并发/修改失效矩阵，因此 **`render.mjs` 仍使用 `enableCaching: false`**。没有添加持久缓存或改变渲染默认值。
- **不能声称**：这些数据不是完整视频渲染耗时、FPS、GPU/Canvas 性能或视觉 QC 结果。不能由包构建或 JS 微基准推断实际成片提速。

## 环境与方法

2026-10-29，同一原生云容器：Linux x86_64，AMD EPYC 9V74（容器暴露 9 个逻辑 CPU），Node **v24.22.1**；项目已有依赖 Remotion **4.0.507**、React **19.2.8**、TypeScript **5.9.3**。未下载/安装新的测试软件，未使用用户 Mac。

固定输入来自 `git archive c1505c5bf20ab877ee829763d65fcce6c5b4a912`。源码与输出都放在 `/workspace/shared` overlay 文件系统；不使用 tmpfs 代替实际包输出。打包 A/B 和 bundle/快照测试在协调后的安静窗口顺序执行。每个包/快照任务启动新 Node 进程；A/B 交替先后顺序，**各 5 次**，构建使用新目标目录。计时不含模块导入和清理；RSS 是整个工作进程的峰值，不是哈希缓冲区大小。

**冷/热区分**：进程均为冷启动；操作系统文件页缓存没有权限化清空，也未声称冷盘。bundle 的“冷缓存”专指独立项目中首次启用、原本为空的 webpack 缓存；“热缓存”复用该缓存但每次启动新进程、生成新 bundle。纯函数测量先执行一整批 warmup，再计 5 批；它们是基线诊断，不是优化前后对照。

包测试的候选代码先完成本地优化计时，随后把同一哈希实现提取为共享模块。最后又用最终共享模块版本对同一固定输入进行完整 core/full 构建，**两种 profile 的 package-manifest.json 均与基线逐字节相同**；该最后一轮只作正确性核验，不计入安静窗口的性能结果。

## 实测结果

### 包构建与验证

`buildPackage` 是 copy 安装使用的共同实现，已包含复制、manifest 生成和完整 `verifyPackage`。下表**不是单独测量 installer CLI 启动开销**。

| 工作负载 | 原实现中位数（最小–最大） | 优化后中位数（最小–最大） | 中位耗时变化 | 进程峰值 RSS 的中位数，前→后 |
|---|---:|---:|---:|---:|
| core 构建 | 1.428s（1.415–1.461） | 1.260s（1.234–1.298） | −11.8% | 214.9→53.2 MiB |
| full 构建 | 1.901s（1.784–1.978） | 1.723s（1.600–1.954） | −9.4% | 228.0→54.3 MiB |
| core 完整验证 | 0.265s（0.256–0.283） | 0.206s（0.199–0.207） | −22.2% | 137.0→48.3 MiB |
| full 完整验证 | 0.689s（0.637–0.742） | 0.523s（0.506–0.568） | −24.0% | 207.3→48.5 MiB |

每格 n=5。full 构建范围存在重叠，不能把单机约 9% 中位数差值当作跨机器保证；**内存下降更稳定、幅度更大**。独立文件收集本身没有加速：core 29.4→30.5ms，full 31.5→33.3ms。core 构建收益之一是减少重复调用完整遍历，而不是每次遍历更快。

### 渲染前源快照

固定 140 文件、44,639,559 字节的模板工程（src、公用字体、package 文件及最小固定 storyboard）；无 node_modules/cache 内容。`snapshotSources` 输出的 **140 个摘要在全部 10 次 A/B 中相同**。

| 工作负载 | 原实现，n=5 | 共享有界哈希，n=5 |
|---|---:|---:|
| 中位耗时（范围） | 75.1ms（67.4–85.5） | 53.2ms（50.8–55.5） |
| 整个进程最大峰值 RSS | 85.2 MiB | 46.8 MiB |

这验证渲染/QC 共用源快照路径的哈希成本；**未测量完整 render、QC 或大视频转码耗时**。1 MiB 只是哈希 scratch buffer，不能保证整个进程只使用 1 MiB。

### Bundle 缓存实验（不改变默认）

固定模板、相同已安装依赖，私有缓存目录；每次独立 Node 进程和新输出，生成 51 文件、65,909,965 字节。

| 状态 | n | 中位耗时（范围） | 整个进程最大峰值 RSS |
|---|---:|---:|---:|
| 当前默认：禁用缓存 | 3 | 3.513s（3.385–3.522） | 619.9 MiB |
| 首次启用、空缓存 | 1 | 3.913s | 735.7 MiB |
| 已有热缓存 | 3 | 1.108s（1.093–1.127） | 443.1 MiB |

热缓存约快 68%，但首次更慢、内存更高；该实验不足以证明源码、依赖、public 资产改动以及多个并发构建下都正确失效。因此本轮只记录机会，**不复用旧 bundle、不启用缓存、不宣称渲染提速 68%**。

### Catalog 和代表性纯组件基线

5 批，固定输入，先执行一批 warmup。没有修改这些代码，因为当前测量不支持冒险缓存或调整视觉算法。

| 工作负载 | 每批调用数 | 每次调用中位数（范围） |
|---|---:|---:|
| `generatedFiles()`：生成全部 catalog 输出字符串 | 100 | 1.020ms（0.951–1.107） |
| `starsAt`，默认 80 粒子，循环帧 0–359 | 3,600 | 0.0158ms（0.0157–0.0164） |
| 1280×720 RisoPaper + 单色圆形 InkPlate，React 静态 HTML/SVG 序列化 | 600 | 0.0766ms（0.0750–0.0795） |

以上不包含浏览器布局、SVG filter、Canvas、图像解码、光栅化、编码、音轨处理或多进程通讯。样例很小，不能外推所有组件/复杂场景。

## 正确性与复现

- 新增空文件、恰好 1 MiB、跨块、尾块、连续不同大小文件、同大小/同时间戳篡改、删除后重建测试；独立 `crypto.createHash(...readFileSync)` 对照全部摘要。
- 保留符号链接/路径越界/private-file/profile/省略项和覆盖保护回归测试。
- 核心包中 line-art 重建脚本缺少可选历史 MP4 时，现在在写出任何工程前明确要求完整源码/full 包。现有 `control.mp4` 的 AAC 包与解码 PCM 都不同于历史源，未擅自替代音轨、改素材或自动下载。
- 实际浏览器帧渲染未运行：当前固定 Remotion 4.0.507 的浏览器启动实现含禁用 sandbox 参数，已知安全执行边界不允许这条路径。没有改依赖、替换启动器或绕过限制；这轮只使用不启动浏览器的官方 bundler 和普通 Node/FFmpeg 检查。

[原始结果目录](../tests/benchmarks/results-2026-10-29/) 包含完整采样，不只展示最好值。包测试脚本还会逐字节比较全部构建 manifest；失败即退出。复现示例（先在外部目录准备固定基线，确保候选 checkout 已有锁定依赖）：

```sh
mkdir -p /absolute/bench/source
# 在仓库内：
git archive c1505c5bf20ab877ee829763d65fcce6c5b4a912 | tar -x -C /absolute/bench/source
node tests/benchmarks/package.mjs \
  --source /absolute/bench/source \
  --baseline /absolute/bench/source/scripts/build-editions.mjs \
  --candidate "$PWD/scripts/build-editions.mjs" \
  --work-dir /absolute/bench --runs 5 \
  --output /absolute/bench/package-results.json
node tests/benchmarks/render-chain.mjs \
  /absolute/bench/source "$PWD/template" /absolute/bench/new-render-chain-results
```

`render-chain.mjs` 只做 bundle、源快照和纯函数诊断；不调用浏览器。它在新的结果目录内创建临时项目和私有 webpack 缓存，不清空用户现有缓存。基准工具不设机器相关耗时阈值，不加入默认测试流程。

### 本轮测量代码身份

- baseline `build-editions.mjs` SHA256：`1ac0390f560f981b5c55dfb6c13b5d8fc3498be0ba9fc4c63f7c49765da4b27f`
- 首轮候选（共享模块提取前）SHA256：`056917df27f47ab1b242a3c7544ce28b344237a9d80b081648e438ce4037f5fa`
- 最后核验的 `build-editions.mjs` SHA256：`1a5785ec8bd28cf8ef9938d497abd1e578d8fc60ad5902104ba2132d80c4f23b`
- 最后核验的 `hash-file.mjs` SHA256：`39a105e7344500f4ae916f883fc23b0662855aabd2971559c6b543adae12ce18`
