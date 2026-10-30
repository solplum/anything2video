# 按动作找 SFX：可选来源适配器

只补「去哪里找符合动作的音源」，不新增声音引擎、必选供应商或制作门禁。先按片种/材质确定音色，再用动作缩小搜索；搜索命中不等于风格合适。现有用户音源、已核许可素材、`audio-engine/mgaudio` 风格拟音和生成音效继续使用，不必经过此适配器。

许可与资产唯一合同仍是 [production-contract.md](production-contract.md#assets)，混音仍是 [sound-design.md](sound-design.md#47-工程级钉帧混音mix_sfxpy两段式第三步v370) 的 `cues → mix_sfx.py → sfx-mix.json`。没有自动选择、自动配音效、自动发布或 Workbench。

## 1. 从画面动作到搜索词

包内 [scripts/sfx_source.py](../scripts/sfx_source.py) 用 Python 3.11+ 标准库。`actions` 完全离线；`search` 只取公开页面元数据；`fetch` 才取一个明确选中的 MP3 预览。后两项都必须逐次显式 `--allow-network`，普通 init/render/mix 不调用本工具。无需新 Python 依赖、API key、登录或付费账户；如果站点要求登录、限流或页面结构变化，停止并报错，不绕过、不自动换供应商。

```sh
# 任何位置运行；不会联网或创建音频文件
python <skill>/scripts/sfx_source.py actions

# 已决定为翻页动作找素材：仅搜索，不下载声音
python <skill>/scripts/sfx_source.py search paper-turn --allow-network
# 细化材质、质感与时长，不能只看热门度
python <skill>/scripts/sfx_source.py search click \
  --query "metal mechanical switch" --max-duration 2 --limit 5 --allow-network
```

常用动作：`paper-turn / stamp / slide / impact / click / typing / reveal / riser / transition`。默认检索词是可覆盖的起点，不是音色承诺。`stamp/paper-turn/typing` 先比较现有程序拟音；产品片的 click 要分清物件拟音与游戏/UI 提示音；riser 的落点通常是末端，不是文件开头。搜索只看一页、最多返回 20 个候选，不是批量抓库。每个候选 `licenseChecked=false`：不把搜索标签或服务器过滤当成逐资产许可证据。

## 2. 选定后显式取得预览，并登记现有资产表

只对已决定加入工程、待实际试听审核的素材运行 `fetch`。`fs:12345` 是示例 ID，不是本仓推荐或已验证的真实素材：

```sh
python <skill>/scripts/sfx_source.py fetch fs:12345 \
  --project /absolute/path/to/video-project \
  --action paper-turn --usage "S03：书页翻到下一步" --allow-network
```

工程必须在 skill 包外且已有 `project.json`、`script/storyboard.json`。输出是 `audio/sfx/fs-12345-preview.mp3`，同时追加 `storyboard.assets` 的既有 `{path,sha256,source,license,usage}` 字段；原有镜头、用户/生成素材和其他字段保留。**没有第二个 audio-manifest 或替代资产注册表**。`sfxSource` 仅是该条资产的附加来源证据，包含供应商/ID、作者/标题、详情页 URL/哈希、实际许可 URL/核验时间、准确下载 URL、HQ/LQ 预览身份、解码结果、改动与署名信息。

- **默认仅接收详情页明确的 CC0-1.0**。CC BY 需要本次明确 `--license cc-by`；搜索用过该参数也不替代 fetch 的许可选择。未知、缺失、冲突、CC BY-NC、CC BY-SA、Sampling+ 等均拒收，不提供 `--force-license`。
- 每次取音都重新读取对应详情页，并在请求音频前核验音源 ID/作者/许可。许可只从音源专属侧栏的许可锚点读取，不把评论/描述/页脚中的 CC 链接拿来补缺。仅允许预期 HTTPS 主机，跨域重定向在发出下一请求前阻止；限制响应体和音频时长。页面改版宁可停线，不猜许可。
- 只使用详情页**实际给出的** MP3 预览 URL；LQ 不偷偷改成 HQ。`isPreview=true`、`originalDownloaded=false`、`rendition=mp3-preview-hq/lq` 与文件名一起区分预览/原始录音。MP3 是有损的；改扩展名、转 WAV 或提高采样率都不使它成为无损原件。下载字节的 SHA-256 不是上传者原件的哈希。
- fetch 需已有 `ffprobe/ffmpeg`，先做格式检查与解码，再把实际解码样本时长对照容器/供应商时长，超出 MP3 延迟容差就拒收，避免截断文件只靠旧头部与退出码冒充完整。记录的 `durationSeconds` 来自实际样本数，`containerDurationSeconds` 单列。技术检查**不证明听感、无瑕疵、许可全面无风险、AI 来源或最终混音通过**。`sourceReview` 与 `audioReview` 保持 `not_performed`，不会替你填通过。
- 不从托管站点猜 `ai=false`：新记录暂不填 `ai`（现有校验器允许缺省）。主控在来源审核时补实际标记；若是生成素材，按统一合同补全模型/提示词/披露等，证据不足不得伪填。授权范围、第三方权利与作品适配仍需逐项审核；不能把 CC0 标签说成「免版权」。
- 不覆盖任何已有预览、已登记同 ID 或同路径；修改过/未跟踪的文件也保留。若手工剪辑/转换，另存派生文件并登记自己的路径/哈希与改动，保留来源记录，不让再次 fetch 冒充原始下载。未采用的候选从成片 `assets` 中移除。

### CC BY 署名

工具只保留署名所需数据，不替你发布。选择 CC BY 时，把该资产 `sfxSource.title / creator / pageUrl / licenseUrl` 和实际 `changes` 写入成片片尾或发布说明；剪裁、增益或混音处理如实列明，不能永远留下空改动。CC0 也保留来源证据。许可与署名细则以 [Freesound 官方 FAQ](https://freesound.org/help/faq/#licenses) 和该资产具体许可为准。

## 3. 回到既有钉帧与混音

先实际听取预览，再使用工程原有测量工具（不是此适配器新造的分析标准）：

```sh
cd /absolute/path/to/video-project
uv run python scripts/sfx_landmarks.py audio/sfx/fs-12345-preview.mp3 --json
# 在既有 audio/sfx/cues.json 中加入选中的声音，保留 schemaVersion:1
# {"frame":121,"file":"fs-12345-preview.mp3","gain":0.2,"note":"S03 翻页命中"}
uv run python scripts/mix_audio.py
uv run python scripts/mix_sfx.py
node <skill>/scripts/check-plan.mjs /absolute/path/to/video-project
```

`frame` 是 **1 起含端点**，事件秒数 `(F-1)/fps`；不要把 onset/peak 或音频内部的前摇直接当作 frame。按 [运动语言](motion-language.md) 与 [声音设计](sound-design.md) 测量补偿、必要时另存裁剪版本后再钉整数帧。负起点不能静默截掉；分镜变化后重钉，换 BGM 重混后仍需重跑 mix_sfx。所有音源最终同走 cues 表、`sfx-mix.json` 与 `audio.wav.mix.json`，不把下载记录当混音证据。最终要实际听完整混音，测试/解码日志不能代替试听。

## 4. 失败恢复、验证范围与参考来源

只有本工具的并发写入由 `audio/sfx/.sfx-source.lock` 互斥；下载期间若分镜已变，拒绝登记。不要同时用编辑器或其他工具写同一个 storyboard。异常中断先检查锁和文件，不自动删锁/覆盖恢复。文件入库与 storyboard 替换不是跨文件事务；若登记失败可能留下明确报错的未登记预览，先检查实际字节/哈希，按既有合同手动恢复，不能反复重试覆盖。正常拒收会清理临时文件；已有资产不动。

```sh
# 仓库根：合成的离线 HTML/网络 fixture；另含本地生成短音的解码测试
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -p 'test_sfx_source.py'
```

测试覆盖默认离线、许可拒收、预览身份、重定向边界、哈希/现有 registry 兼容、不覆盖、失败清理与普通制作不接入网络。不进行真实外部声音下载，不建立账户，不证明 Freesound 当前页面永远兼容，更不构成声音质量试听。

设计参考（只读、固定版本）：[video-shotcraft 的 sfx-source.py @1266a3e](https://github.com/Vincentwei1021/video-shotcraft/blob/1266a3ec4831289c4d893d42dd5102723658039a/assets/scripts/sfx-source.py)，吸收「详情页逐资产许可、预览/原件区分、哈希、拒绝覆盖」的边界。本适配器独立实现，没有复制/执行该脚本，也不引入其独立 manifest、并发批量下载或音频分析实现。Freesound 预览与原件区分另见 [官方资源文档](https://freesound.org/docs/api/resources_apiv2.html)；本工具不是 Freesound 官方 SDK，不调用需密钥的 API。

许可锚点依据 [Freesound 官方 sound 页面模板](https://github.com/MTG/freesound/blob/master/templates/sounds/sound.html) 的 `bw-sound__sidebar` / `Go to the full license text` 标记（2026-10-30 只读核对，文件 blob `215d39014e288e42c233d0140d50679d778e7206`）；只借字段协议，不复制模板代码。标记缺失/多义即拒收，不能退回「全页找任意 CC 链接」。
