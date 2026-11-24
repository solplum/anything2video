# BGM 已验证曲库（Mixkit 免费许可）

> **安装范围**：下述录音与 profiles 是源 checkout 的曲库记录；core 与 full 发行包都不携带 `assets/audio/bgm/`，只带许可记录和查询/制作脚本。full 仅表示样片视频齐全，不表示原始音乐已安装。先核实实际可读音源/档案与本次用途许可；可用授权音轨放入工程，不自动下载或扩大再分发范围。

> 选曲纪律：**不贴题材、贴气质**——曲子的作用是托画面抬质感，不是描述主题（2026-10-01 用户定调）。2026-10-02 补充定调（云开 bake-off 两轮实测）：「科技感」≠ DJ/club/EDM，「电影氛围」≠ 空旷悲凉；冷峻自信 + 中性精密是"高级感"的有效描述，提名纪律详见 `bgm-bakeoff.md`。六首内置录音曲来自 Mixkit，许可与来源 URL 逐曲登记；下表的用户自加/提取曲不属于 Mixkit 授权，发布前需单独确权。
>
> **响度床双档（v5.1.0 相对响度为主，绝对 RMS 为退回兼容）**：非 epic 缺省走 `--bed-lu`（相对旁白综合响度 `narration_lufs + bed_lu`，`pyloudnorm` 实测参考片旁白 `-18.12 LUFS`、Mixkit `tapis-615` `-1.14 LU` 与 `vertigo-597` `-1.69 LU` @ RMS `0.08` 均值取整为 `-1.5`）——`--bed-lu -1.5`（标准默认，再经人声闪避 `-8.5/-3.0 dB`）｜`--bed-lu -5.0`（保守，比标准低 3.3+ LU 取整；信息密集片用）。显式传 `--bed 0.08|0.055`（或 `--epic` 默认 `0.12`）保持原绝对 RMS 语义。A/B 对比样例见 `_a2v-opt-20260930/样例-音色与音乐/bgm/AB-*.mp3`。
>
> **实体化落库与逐曲档案（2026-10-11）**：曲库音频实体在 `assets/audio/bgm/`（`曲名-slug-ID.mp3`，授权与 URL 见 `assets/audio/ATTRIBUTION.md`）；逐曲客观层档案在 `assets/audio/bgm/profiles/*.json`——能量曲线、结构分段、入点候选（steady/hook）、出点候选（自然收尾/干净切点/能量落点）、响度、BPM，由 `scripts/bgm_analyze.py` 生成（自测已过）。档案口径：level 1-5 是**本曲内相对档**不跨曲可比；BPM 置信 <3.0 不可靠（本批全部如此，氛围曲拍点成分弱，卡点仍逐工程跑 beat_grid）；`human_reviewed=false` 时档案只作参考、**不得自动定切点**，主观层（段落命名/气质/适用片型）经用户试听标注轮校准回写后才可被机制消费。曲内进出点、多段接力 playlist、音乐编排表（机制侧）为 v4.2.0 第二步，落 `mix_audio.py` 与 `bgm-bakeoff.md`。

## 曲目与片型映射

| 曲 | Mixkit ID | 时长 | 气质 | 题材标签 | 用法映射 |
|---|---|---|---|---|---|
| Vertigo | 597 | 3:11 | 冷峻潜行：低音+电吉他，stealth/investigation 定性 | 商业品牌·科技未来·悬疑紧张 | **冷峻高级感 promo 首选**——云开宣传片 v4 纯音乐版主轴实战定稿（2026-10-02，无人声全电平 -15 LUFS）；能量最稳区在 112s 起 |
| Tapis | 615 | 2:43 | 极简垫乐（本意「地毯」） | 知识科普·商业品牌 | **贯穿垫底首选**：托画面走，适合科普陈述/史诗感 |
| Classical Vibes 2 | 684 | 2:17 | 古典系、微欢乐 | 欢快活力·知识科普 | promo 轻快主题、结论段 |
| Staring at the Night Sky | 168 | 2:22 | 夜空凝视、A24 式氛围 | 沉静冥想·情感抒情 | 夜城/宇宙/收尾、情绪段 |
| Echoes | 188 | 3:46 | 氛围回响、空间层次最丰富 | 科技未来·沉静冥想 | 长片章节呼吸、科技/未来题材 |
| Miss You | 592 | 3:58 | 情感弦乐、缓慢治愈 | 情感抒情·人文叙事 | 人物故事、抒情收尾 |
| singal（用户自加曲） | — | 0:30 | 暗、稳、全程高能（30s 短打） | **国风古典·史诗宏大**（用户选定 2026-10-11） | 高能短打：钩子/hero 段、接力尾段；尾部无自然衰减需淡出 |
| wx-hotel-night（用户自加曲） | — | 0:30 | 全程 L5 高能铺满，29.5s 淡出收尾（已切末尾 click；画面：loft 酒店夜景） | 情感抒情（用户选定 2026-10-12） | 30s 短打：情绪段/收尾段候选 |
| wx-night-drive（用户自加曲） | — | 0:30 | 全程 L5 一段到底，无段落起伏（画面：蓝调时刻行车窗外城市） | **情感抒情·黑色生命力**（用户选定 2026-10-12；气质原话：励志、自强） | 30s 短打：励志/情绪向 hero、钩子 |
| wx-cos-walk（用户自加曲） | — | 0:30 | 全程按 15.9s L3→L5 跳变，后半高能（画面：建筑前人物展示） | **都市高级感**（用户选定 2026-10-12；气质原话：高贵场景、外滩纸醉金迷、城市内透的高级） | 30s 短打：都市/奢华质感 hero；前半 L3 可当垫底进 |
| wx-meme-clip（用户自加曲） | — | 0:07 | L5 一段到底约 7.4s，**已切 8.05s 起的抖音片尾音效**（画面：梗图文字视频） | **黑色生命力**（用户选定 2026-10-12；气质原话：咬牙向上） | 仅 7s 只够钩子位 |
| Sonor 03 | 561 | 4:59 | Electronic，节拍弱（未试听预标） | 科技未来·商业品牌 | 本地按需下载；垫底/hero/收尾 |
| Focus on Yourself | 568 | 4:46 | Electronica，节拍弱（未试听预标） | 科技未来·商业品牌 | 本地按需下载；钩子/垫底/hero/收尾 |
| Your Breath | 634 | 3:56 | Corporate Music，节拍弱（未试听预标） | 科技未来·商业品牌 | 本地按需下载；钩子/垫底/hero/收尾 |
| Atoms in Peace | 107 | 3:47 | Electronica，节拍弱（未试听预标） | 科技未来·商业品牌 | 本地按需下载；垫底/hero/收尾 |
| Night Sky Hip Hop | 970 | 4:17 | Pop，节拍弱（未试听预标） | 欢快活力·商业品牌 | 本地按需下载；垫底/hero/收尾 |
| I Believe in Us | 1030 | 2:48 | Pop，节拍弱（未试听预标） | 欢快活力·商业品牌 | 本地按需下载；垫底/hero/收尾 |
| Old Letter | 854 | 2:45 | Pop，节拍弱（未试听预标） | 欢快活力·商业品牌 | 本地按需下载；垫底/hero/收尾 |
| Me and You | 851 | 2:38 | Rock，节拍弱（未试听预标） | 欢快活力·商业品牌 | 本地按需下载；垫底/hero/收尾 |
| River Flow | 594 | 4:30 | Electronica，节拍弱（未试听预标） | 知识科普·人文叙事 | 本地按需下载；钩子/垫底/hero/收尾 |
| Nield Grohm Hanging 1 | 538 | 3:42 | World Fusion，节拍弱（未试听预标） | 知识科普·人文叙事 | 本地按需下载；垫底/hero/收尾 |
| Masking the Masters | 552 | 3:40 | Orchestral Hybrid，节拍弱（未试听预标） | 知识科普·人文叙事 | 本地按需下载；钩子/垫底/hero/收尾 |
| Skyline | 601 | 3:26 | Classical，节拍弱（未试听预标） | 知识科普·人文叙事 | 本地按需下载；垫底/hero/收尾 |
| We Will Get It | 598 | 4:29 | Film Score，节拍弱（未试听预标） | 史诗宏大·情感抒情 | 本地按需下载；钩子/垫底/hero/收尾 |
| Classical 10 | 717 | 3:32 | Film Score，节拍弱（未试听预标） | 史诗宏大·情感抒情 | 本地按需下载；垫底/收尾 |
| Drawing the Sky | 606 | 3:27 | Orchestral Pop，节拍弱（未试听预标） | 史诗宏大·情感抒情 | 本地按需下载；垫底/hero/收尾 |
| Classical 4 | 711 | 3:09 | Film Score，节拍弱（未试听预标） | 史诗宏大·情感抒情 | 本地按需下载；全段平缓可用作收尾 |

> 微信提取批（2026-10-12 入库，同日题材标注完成）：以上 4 首 `wx-*` 为用户经微信传输的抖音视频内背景音乐提取轨，题材由用户**对话内亲选**（新扩词表见约定 4），`human_reviewed=true` 已入反查池；功能轴为程序预建议未逐条确认（翻案随时可改），曲名仍为按画面临时命名可改；许可状态与源视频反查信息见 `assets/audio/ATTRIBUTION.md` 外部曲表。**尾部处理（10-12）**：meme-clip 切除 8.05–8.45s 孤立抖音片尾音效（止于 7.5s）；hotel-night 切除末尾 0.2s click（止于 29.9s，带 0.4s 淡出）；night-drive/cos-walk 频谱核验音乐铺满全片、无可分离抖音音，未切——若试听仍闻抖音音报秒数再切。

题材标签为逐段标注的整曲摘要，逐段明细（同曲不同段可挂不同主题）与功能轴（钩子/垫底/hero/收尾）、入出点候选见 `assets/audio/bgm/profiles/*.json`。

来源：`https://assets.mixkit.co/music/<ID>/<ID>.mp3`（ID 见上表）。曲池扩展：`mixkit.co/free-stock-music/tag/{minimal,piano,documentary,ambient}/`（页面 JSON-LD 含 name/genre/duration 可脚本解析）。

## 本地音源获取（第二批按需拉取，防独立音频再分发）

Mixkit 免费许可仅覆盖合成配入视频等同步使用，禁止将原始音频文件单独打包分发。因此第二批 16 首只将 `assets/audio/bgm/profiles/*.json`（含 `source_url` 与 `sha256`）纳入 Git，`.mp3` 本身不入仓（`.git/info/exclude` 忽略）；**新克隆仓库在未下载本地音源前，`bgm_query.py --use release` 会跳过本地缺失音频的条目**。需要拉齐本地音源时，在仓库根执行：

```bash
uv run --project template python -c "
import hashlib, json, pathlib, urllib.request
for p in sorted(pathlib.Path('assets/audio/bgm/profiles').glob('*.json')):
    prof = json.loads(p.read_text(encoding='utf-8'))
    url = prof.get('source_url') or prof.get('url')
    rel = prof.get('file')
    if not url or not rel:
        continue
    dst = pathlib.Path(rel)
    if not dst.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        print('Fetching', rel, '<-', url)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        dst.write_bytes(urllib.request.urlopen(req, timeout=30).read())
    got = hashlib.sha256(dst.read_bytes()).hexdigest()
    assert got == prof['sha256'], f'SHA256 mismatch for {rel}: {got} != {prof[\"sha256\"]}'
print('OK: all external BGM tracks verified')"
```

## 🔥 热点配乐参考（市面爆款风向）

| 参考原声 | 出处 | 复用方式 |
|---|---|---|
| opus小曲（OPUS 品牌片原声，177s；2026-10-06 用户试听确认并命名） | 《OPUS — A family history of making》，当今市面爆款品牌片 🔥 | 要同款气质时按 `bgm-bakeoff.md` 提名同气质可商用曲（上方曲池优先）；本机参考音轨：`科普视频/yunkai-promo/research/OPUS品牌片-音频提取.mp3`（仅本机参考，不随包分发） |

## 使用约定

1. 双曲结构允许：贯穿垫底（G1 型）+ 收尾换曲（G5/G3 型）——换曲点放在章节卡或压黑段。
2. 所有片型默认录音曲优先。程序编曲（score_gen / bgm_generate）只在明确选择后使用：可复现、易对齐，不等于音质或审美合格；候选不足不自动生成。
3. 新曲入库纪律：试听定性 → 登记本表（曲名/ID/时长/气质/映射）→ 许可确认（Mixkit 免费许可类直接入库，其他许可逐案核）→ **入库即跑** `uv run python scripts/bgm_analyze.py assets/audio/bgm/<新曲> --out-dir assets/audio/bgm/profiles` 生成客观层档案；主观层标注回写（`human_reviewed=true`）后方可用作机制侧切点真值。标注轮走 `scripts/bgm_review.py`（试听页只管听 + stdout 对话提问清单）：题材/功能/曲名/气质由主控**在当前对话内以 2–3 个候选让用户点选**（2026-10-12 用户两连定调：题材必须给候选、禁只丢词表凭空填；标注在对话内问、禁把表单做进 HTML），细则见 `bgm-bakeoff.md` 标注轮交互。**用户自加曲必须带 `--owner user`**（写入 profile 顶层 `owner` 硬字段，反查置顶铁律依据）；skill 曲池默认 `skill`。
4. **主题反查（2026-10-11 总定案）**：做片时视频题材/文章/风格已定 → 按「视频题材 × 落位功能（钩子/垫底/hero/收尾）」读 profiles 逐段 `theme_tags`/`func` 提名命中曲与段落（可跨多曲），出音乐编排表（哪段曲、曲内进出点、视频落位、crossfade）给用户拍板。题材轴词表（受控，可扩）：科技未来/人文叙事/情感抒情/国风古典/悬疑紧张/欢快活力/史诗宏大/沉静冥想/商业品牌/知识科普/黑色生命力/都市高级感（后两个 2026-10-12 用户标注自加曲时新扩：黑色生命力=咬牙向上/励志自强向，都市高级感=外滩纸醉金迷式城市奢华质感）。用户自加曲的题材由**用户亲选**；skill 自带曲池可由主控按实战映射+结构数据定标（`theme_annotations.by` 记录来源）。**用户曲库优先权重（用户两度定调「用户的音乐一定要放在最前面」）**：profile 顶层 `owner` 硬字段标记权属（user/skill）；反查时**用户曲永远出现在候选最前**——题材命中排最前，题材未命中也照常展示（标注「仅参考」），绝不从候选里消失；skill 曲池曲/程序编曲只排其后作补充位。用户曲未命中时供参考不硬凑，最终落位由用户拍板（细则见 `bgm-bakeoff.md` 选曲交互规范）。

5. **发布候选与参考分离（2026-10-19）**：用户曲置顶指参考展示和合格候选排序，不代表 owner=user 自带版权。默认 bgm_query 只让实际音源可用且 release_use 许可/证据已登记的匹配曲占发布候选位；缺音源/未确权用户曲仍置顶单列。现有六首 Mixkit 的 release_use 来自 ATTRIBUTION 既有登记，仍需按实际发布用途复核条款；wx-* 未确权，singal/OPUS 缺音源时不伪装可播放。每曲默认一段、可按参考标签和近期使用降权；详见 bgm-bakeoff「录音优先反查」。
