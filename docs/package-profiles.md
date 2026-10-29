# 安装体积：core 与 full

两种配置都是同一个 `anything2video` Skill，不是两套制作规则或不同风格版本。

| 配置 | 保留 | 不复制 |
|---|---|---|
| `full` | 既有完整发行内容，包括本地样片视频 | 原有缓存、私密文件、测试和非公开工作工程排除项 |
| `core` | 同一制作规则、所有风格 ID/图元/运行时素材、模板、脚本、配方、许可、完整可搜索画廊、poster、样片来源与哈希、公开示例 | 在 full 基础上，仅省略 `samples/` 下的 `.mp4` |

**core 是轻量资源配置，不是最小引擎。** 它仍带所有风格资产与公开示例；不改变 API、导入路径、随机种子、用户确认关口或 QC 要求。示例目录自身的 MP4 不在本轮拆分范围内。仓库保留所有样片；克隆仓库的下载体积不因本选项自动减少。

## 选择安装配置

从完整 checkout 运行，目标安装目录须不存在：

```sh
# 推荐给无需离线播放全部样片的用户
node scripts/install.mjs --profile core
node scripts/install.mjs --claude --profile core

# 明确带齐原有样片
node scripts/install.mjs --profile full

# 手动导入宿主也使用同一开关
node scripts/install.mjs --export-dir ../a2v-core-export --profile core
```

**兼容默认不变**：从仓库或 full 包执行旧的无参数安装命令，仍安装 full；从新生成的 core 包重新安装，默认继承 core。已有安装不会自动瘦身或被覆盖。`--symlink` 指向整个源目录，不能筛选资源；不能把完整源目录软链安装伪称 core。若要软链 core，先构建 core，再从该 core 包运行安装器。

## 构建可搬迁的包

```sh
node scripts/build-editions.mjs ../a2v-core --profile core
node scripts/build-editions.mjs ../a2v-full --profile full
```

分别生成 `<输出目录>/anything2video`。输出必须与源目录不重叠；只有明确传 `--overwrite` 才替换已有构建目录。不要把这个覆盖选项当作安装升级策略。安装器继续保护已有目录。

包可以搬到另一目录，再运行包内的 `scripts/init.mjs` 或 `scripts/install.mjs`。它不依赖原 checkout 的绝对路径，亦不会联网下载遗漏资源。

JS 调用方可向 `buildPackage`、`buildEditions`、`collectCoreFiles` 传 `{profile: 'core'}` / `{profile: 'full'}`。旧 `buildPackage` / `collectCoreFiles` 的 `includeSamples: false` 现作为 core 的兼容别名：保留样片页、poster 和来源记录，只排除样片 MP4；`true` 表示 full。矛盾选项会报错。`collectCoreFiles` 保留旧导出名，不表示默认自动采用 core。

## Optional sample videos

<a id="optional-sample-videos"></a>

core 的 `samples/index.html` / `all.html` 仍展示全部风格、家族、搜索、筛选与深链接。已有样片显示真实 poster 和“可选视频未安装”；真正没有样片的风格仍显示“暂无渲染样片”。README 中对应的播放链接转到本说明，不打开缺失文件。没有隐藏风格，也没有用静态图冒充视频。

需要离线播放视频时，从**同一版本的完整 checkout 或 full 包**执行 `--profile full`，安装/导出到一个新的目录。验证新包后，备份自己的改动，再按宿主更新流程明确替换旧目录。不要直接从 core 包请求 full：安装器会解释媒体缺失并拒绝，不假装下载完成。仅往 core 中手工拷入 MP4 不会自动更新画廊和包清单，应重新构建 full。

`samples/manifest.json` 一直是完整的样片来源/规格/哈希目录；存在记录不代表该视频安装在本机。各包的 `package-manifest.json` 另记 `profile`、`sampleMedia`、实际文件清单（相对路径/字节数/SHA-256）与省略媒体清单，不覆盖来源记录。

## 检查与体积口径

构建会验证文件哈希、完整包样片存在性和 core 排除项；可重复检查：

```sh
node --input-type=module -e "import {verifyPackage} from './scripts/build-editions.mjs'; console.log(verifyPackage('.'))"
node scripts/style-catalog.mjs --check
```

`package-manifest.json` 的 `payloadBytes` 是该包文件字节总和，**不含清单本身**；`omittedSampleMediaBytes` 是被省略视频的原始字节数。实际目录大小还包括清单，压缩包/文件系统占用会不同。比较 core/full 应使用同一源版本，不将仓库历史或依赖缓存计为本轮收益。

首次安装依赖、配音、生图及渲染的网络/权限/费用边界仍见[上手指南](getting-started.md)。选择 core 不会替代任何环境验证或成片验收。
