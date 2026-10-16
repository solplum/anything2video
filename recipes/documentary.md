# 配方：documentary（真实影像历史档案纪录片）

面向历史事件、科学发现史、人物传记、工程复盘与文化档案制作有文献真实性、文献存证与历史厚度的纪录片。**核心原则：以公有领域与合规授权的一手历史档案、原稿、古籍、老照片和真实胶片为主干，代码承担移轴扫描（Rostrum Camera）、时间线地图、版式排印与存证标注**。画幅、宿主、授权与音频规则以本包 `SKILL.md` 和 `reference/production-contract.md` 为准。

## 适用场景

- **历史大事件与文明演变**：重大战役、条约签署、政权更替、城市变迁。
- **科学史与工业文明**：太空探索、计算机发展史、重工业突破、医学攻坚。
- **人物传记与思想史**：学术巨擘、历史人物、艺术家生平与代表文献。
- **古籍与非遗档案**：传世孤本、碑帖拓片、考古档案、器物溯源。

以虚构动效为主、现代商业产品展示、代码架构教学不是本配方主场（转用 `promo` 或 `explainer`）。

---

## 档案真实性与版权存证

纪录片的文献价值建立在「无伪造、无虚标、来源可溯」的基础之上。严禁以 AI 伪造老照片冒充真实历史影像。

### 1. 档案准入清单与许可判例

| 档案类型 | 许可来源判例 | 典型机构与公共藏馆 |
|---|---|---|
| **公有领域（Public Domain）** | 创作或发布时间满足所在法域保护期届满（如美国 1929 年前公开发布的著作；中国作者去世 50 年后作品） | 国会图书馆（LOC）、国家档案馆（NARA）、Internet Archive、Prelinger Archives、大英图书馆 |
| **政府与公共机构无版权声明** | 政府雇员履行职务制作的作品无版权保护（如 US Federal Government works） | NASA、USGS、NOAA、美国国防部历史影像池 |
| **开放访问与知识共享（Open Access / CC）** | 明确标有 CC0、CC-BY-4.0 等允许商用与二次创作的馆藏开放协议 | 大都会艺术博物馆（The Met Open Access）、维基共享资源（Wikimedia Commons）、Smithsonian Open Access |
| **用户自有历史资料** | 用户持有一手版权或已获馆藏合法数字化授权 | 标注 `source: user_archive`，附文件哈希与授权说明 |

### 2. 档案存证台账 `research/archival-rights.json`

凡采用真实档案素材的工程，分镜排定前必须在工程根目录生成存证台账：

```json
{
  "schemaVersion": 1,
  "film_title": "片名",
  "audit_date": "2026-10-16",
  "archives": [
    {
      "id": "arch-01",
      "title": "阿波罗11号土星五号升空原底照片",
      "year": 1969,
      "source_institution": "NASA",
      "source_url": "https://images.nasa.gov/details/...",
      "license": "Public Domain (NASA Guideline)",
      "file_path": "assets/archives/saturn_v_liftoff.jpg",
      "sha256": "4a7b...",
      "used_in_shots": [2, 3]
    }
  ]
}
```

未登记来源与许可的图片/视频素材，`check-plan.mjs` 门禁将予以拦截。交付时 `finalize_delivery.mjs` 将自动据此生成 `delivery/CREDITS.md` 来源与致谢名单。

---

## 视听与导演语言

纪录片的观感取决于克制、专注与时间分量，严禁浮夸的无理由翻转与机枪式跳切。

### 1. 移动扫描摄影术（Rostrum Camera / Ken Burns）

利用 `template/src/common/kit/RostrumStage.tsx`（v5.0.0 新增）再现专业纪录片摄影棚的翻拍机动效：
- **微推拉（Slow Push/Pull）**：在 4–8 秒的长持镜中，画面缩放幅度严控在 `1.0 → 1.08~1.15`，以匀速（linear）或极缓阻尼沉浸推向档案焦点（如手稿某行朱批、照片中人物的眼神）。
- **视线导轨扫描（Eye-line Pan）**：沿着文书逻辑或长卷横向移动，配合轻微相机微晃（Handheld 振幅 ≤ 1.5px），模拟实体翻拍镜头的光学呼吸感。
- **光学暗角与年代微质感**：老照片配合柔和的光学暗角（Vignette 0.15~0.25）与轻微纤维胶片颗粒，禁止添加过载的抖音老电视故障特效破坏历史尊严。

### 2. 动效四阶段与解说咬合

严格遵循四段动效模型：
- **进场（0.4–0.8s）**：档案文书平滑滑入视野，或通过光影聚光灯聚焦（Spotlight Reveal）点亮。
- **主动作（卡点口播关键事实）**：当旁白提到年份、名字或关键转折时，画面对应位置出现规矩的**朱红印章盖下**、**半透明墨色高亮框选**或**坐标针刺入**。
- **次要动作（全程）**：纸纹微动、光影微晃或微尘漂浮（`DustDrift`），绝不让高分辨率档案静止死锁。
- **转场**：淡化溶解（Crossfade 0.5–1.0s）或以地图/文书边缘作为物理遮挡转场，严禁花哨翻页或卡通撕裂。

### 3. 声音设计与解说基调

- **配音音色**：严格执行 `reference/voice-bakeoff.md` 规范，选用沉稳、克制、叙事感强的纪录片级音色（如云扬原速、云希原速，严禁调高语速硬凑时长）。
- **音乐设计**：选用低沉弦乐、大提琴独奏、环境 Drone 或历史古典管弦乐；每段音乐进出严格依据 `reference/music-plan.md` 进行等功率淡化交接。
- **拟音（Foley）**：当文书翻动、印章落印、旧胶片放映机转动时，在混音第三步（`mix_sfx.py`）精准钉入对应的低频纸张声或机械咔哒声。

---

## 工程模板接线

在工程 `project.json` 中声明：
```json
{
  "recipe": "documentary",
  "fps": 30,
  "width": 1920,
  "height": 1080
}
```

在 `src/config.ts` 中配置：
```ts
export const VIDEO = {
  recipe: 'documentary',
  slug: 'apollo-mission',
  lang: 'zh'
};
```

渲染时调用主包统一流水线 `node scripts/render.mjs`，并可通过 `--export-jianying` 直接生成剪映原生工程，方便创作者在时间线上进行精细调色与声音微调。
