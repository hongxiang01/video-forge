---
name: video-forge
description: 成片工坊总入口：画风视频、音乐 MV、科普动画、三维微缩场景都从这里进。先追问到每个细节（场景、人物、情绪、结构、声音、禁忌），不知道选什么就给样片墙和内容点子；画风写成数值卡让用户确认，分镜联系表确认后才生产；做完交给独立子 agent 评委打分迭代，最后归档到 ~/video-forge。用户说「做个视频」「做个动画」「做 MV」「画风视频」「做个微缩场景」「用 XX 方案做」「不知道做什么画风」时用。
---

# 成片工坊（video-forge）

好作品不是一句话生成的。这个 skill 管住三件事：

1. **问清楚**：需求模糊就一直问，直到场景、人物、情绪、每个细节都落到具体画面上。
2. **先确认，再生产**：画风、设定、分镜都要用户点头，才进入耗时的制作。
3. **别人来审**：成片交给独立评委，按用户确认过的「评审标准卡」逐条判定，不拿自检代替审片。

生产本身交给已有的产线（lemo-opuscar、mv-director、Remotion、three.js 微缩），这个 skill 只做导演和关卡。代码画不出来的画风（真人、3D），我出剧本、资产表和逐镜提示词，用户自己交给生成式视频工具 Muse（`references/pipeline-mv.md` 路线 B）。

## 铁规矩

1. **不许一句话开工**。追问清单（`references/interview-checklist.md`）的必填项没问齐，不进入生产。用户说「你定」的项，给出具体默认值写进需求卡，让用户看到。
2. **模糊词换成画面**：「温馨」「高级」「有感觉」不算答案；给 2–4 个具体画面选项让用户挑。
3. **每轮追问后贴需求卡**（`references/card-templates.md`），用户能一眼看到已定和未定。
4. **关卡顺序不能跳**：需求卡 + 评审标准卡 → 画风（样片）→ 风格卡/风格帧 → 设定卡 → 分镜联系表 → 草稿 → 评委循环 → 归档。产线可以声明跳过某关（如微缩没有分镜），但要写明。
5. **分镜默认要确认**（lemo 默认不确认，这里改成默认确认）。
6. **评委是独立子 agent**，只给作品和用户确认的评审标准卡，不给我的结论。评委要看全片（每 2 秒抽 1 帧），只能测量声音、不评价好不好听。用户的话优先于评委。
7. **人物不演戏**：代码画的表情、手部动作必僵。除非产线有角色绑定能力，人物只做小、远、静止或简单循环。**手要拿东西、东西压着东西的镜头，开工就用三渲二**（三维骨骼手 + 三维道具 + 卡通渲染，`references/pipeline-style-film.md`「做法先于画风」），不用平面拼手：《最后一碗面》平面画的手改了三版还像机器，擀面杖擀到了桌上。**人物要演大动作（走、跳、跪、起身、伸手），就一个姿势一个姿势地画**：豆包照同一张全身设定图，一张图画同一个动作的 4 个瞬间，切开后按拍子换张（`~/video-forge/recipes/chalk-pose-mv.md`）。头和身子必须出自同一个画源，骨骼只做小动作：《违背的青春》头是豆包画的、身子是代码拼的，修了四版还是"头是头，身是身"；改成骨骼去掰，肩膀裂开、脚尖乱指。
8. **用户原话进卡片**：用户说过的具体要求（比如「灯光不要拍扁」）原文写进需求卡的禁区或硬要求。
9. **大任务按职责分给多个 agent**（`references/division-of-labor.md`）：先定骨架文件，各职责只引用编号，算术用脚本校验；不靠降低思考强度来避免超时。
10. **作品归档到 `~/video-forge`**，不放临时目录；临时目录重启会丢。
11. 网络：这台机器的代理极慢，大下载用 `curl --noproxy '*'`、`env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY` 绕开；shell 里 `grep` 坏了时用 `/usr/bin/grep`。
12. **量出来才算数**：接触（穿模）、遮挡、对齐、响度交付前用脚本量，交付说明里写测量值；改前改后对比必须是同一张画；我和 agent 报的数字没量过不说（`references/review.md`「自检怎么复核」）。《最后一碗面》自检说只剩三个小毛病，实际 36 张画拇指全插在擀面杖里。
13. **背景音乐从曲库来**：免费曲库或发布平台曲库，不用 AI、代码生成（用户 2026-11-05 定，`references/music.md`）。

## 步骤

### 0. 分流

先看 `~/video-forge/recipes/`：用户点名方案（「用三渲二微缩方案做个车站」），读方案文件，追问只问方案没定的项。

否则按需求选产线：

| 需求 | 产线 | 文件 |
|---|---|---|
| 某个画风的短片（30–90 秒），主题自定 | 画风视频 | `references/pipeline-style-film.md` |
| 给一首歌做 MV | MV：先读歌词、编故事；生产时代码逐帧画（粉笔定格方案、mv-director），或者出文本交给 Muse | `references/pipeline-mv.md` |
| 讲清一件事、历史、数据 | 科普 | `references/pipeline-explainer.md` |
| 可以拖拽旋转的三维小场景 | 微缩 | `references/pipeline-diorama.md` |

用户什么都没想好：走 `references/style-picker.md` 的新手引导（先看样片墙，再给内容点子）。

### 1. 追问 → 需求卡

先定**视频类型和时长档**，加载 `references/genres/` 里对应的类型卡（选卡表见 genres/README.md），后面的追问、结构、字数预算、评审标准卡都以这张卡为起点。

按 `references/interview-checklist.md` 一轮一轮问。用 `AskUserQuestion`，每轮 ≤ 4 个问题，选项写成具体画面。每轮后贴需求卡。必填项齐了，让用户确认需求卡。

### 2. 画风

用户没选：按 `references/style-picker.md` 推荐 2–3 个并附样片链接，同时给出全部 66 种列表（纯文字提问，不用 `AskUserQuestion`，选项太少会把列表藏起来）。
选定后读该画风的 `STYLE.md`，整理成**风格卡**（数值：色值、线宽、光比、字体、镜头语法、声音），贴给用户确认。

### 3. 风格帧

用真实的绘制代码出 1–3 张风格帧（一个镜头/一个角落，光和色定好）。用户确认后再铺开。

### 4. 设定卡

有人物、地点、物件时，每个一张设定卡：长相、比例、配色、服装、关键道具、不能出现的东西。出设定图，用户确认。

### 5. 分镜联系表

6–9 格缩略图拼一张（每格：时间、画面、镜头、声音、字幕），用户确认后才做动画。

### 6. 草稿 → 评委循环

按产线做出草稿，按 `references/review.md` 开两个评委，按评审标准卡逐条判定（通过 / 部分 / 不通过 + 证据帧）。只改不通过的项，每轮都给用户看。
停止：必须项全部通过且用户满意，或满 3 轮，或用户喊停。

### 7. 归档

在 `~/video-forge/works/<slug>/` 放：源码或项目链接、成片/截图、需求卡、风格卡、分镜、`scores.md`；在 `~/video-forge/retros/` 写复盘；路子可复用就从 `recipes/_template.md` 写一份新方案，并在 `~/video-forge/README.md` 的「🎞 作品」表加一行；用到新的外部库就登记进 `deps.json` 并重建 `index/`。

发抖音按 `references/publish-douyin.md`：用户确认成片后由我上传，填标题、简介、话题、章节、封面、AI 声明，用户定时间。

发布后约一周，请用户从平台后台（如抖音创作者服务中心）看一眼完播率、平均观看时长、在哪几秒流失最多、哪段被回看，回填到这个作品的 `scores.md`「发布数据」一节，并在复盘里写一句：哪个留存设计起了作用、哪里流失了。下次写稿和分镜参考这些真实数据，而不是只凭评委意见。

## 参考文件

| 阶段 | 文件 | 什么时候看 |
|---|---|---|
| 1 追问 | [references/interview-checklist.md](references/interview-checklist.md) | 每次开工；每轮追问前对照还缺什么 |
| 1–5 卡片 | [references/card-templates.md](references/card-templates.md) | 贴需求卡、风格卡、设定卡、分镜联系表时 |
| 2 画风 | [references/style-picker.md](references/style-picker.md) | 用户没选画风、不知道做什么内容 |
| 3–6 生产 | [references/pipeline-style-film.md](references/pipeline-style-film.md) | 用 lemo-opuscar 画风做短片 |
| | [references/pipeline-mv.md](references/pipeline-mv.md) | 做音乐 MV：读歌词 → 故事梗概 → 路线 A 代码逐帧（角色要演戏就用 `recipes/chalk-pose-mv.md`）或路线 B 交给 Muse |
| | [references/pipeline-explainer.md](references/pipeline-explainer.md) | 用 Remotion 做信息、科普视频 |
| | [references/pipeline-diorama.md](references/pipeline-diorama.md) | 做 three.js 三维微缩场景 |
| 3–6 分工 | [references/division-of-labor.md](references/division-of-labor.md) | 用多个 agent 写 Treatment 或做生产时：职责划分、骨架文件、校验脚本 |
| 类型卡（按类型 / 时长档） | [references/genres/README.md](references/genres/README.md) | 追问时定下类型和时长档后加载对应的卡：时长预算、结构、视觉声音规范、校验逻辑、提示词模板都从卡里取 |
| 配乐 | [references/music.md](references/music.md) | 选配乐：默认免费曲库或平台曲库（不用 AI 生成）；代码作曲、开源模型只在用户点名时用 |
| 发布 | [references/publish-douyin.md](references/publish-douyin.md) | 发抖音：上传、话题、章节、封面、定时，和踩过的坑 |
| 选画风 / 选动效 | `~/video-forge/index/catalog.md`（`index.json` 机读） | 所有画风库、动效卡、解说语法、自己的画风合在一张表；缺库运行 `bash ~/video-forge/bootstrap.sh <id>` |
| 1 / 6 评审 | [references/review-standards.md](references/review-standards.md) | 追问时按视频类型给默认检查项，和用户一起定评审标准卡 |
| 6 评审 | [references/review.md](references/review.md) | 开评委、逐条判定、决定停不停 |
| 排错 | [references/troubleshooting.md](references/troubleshooting.md) | 装依赖、渲染、截图、网络出问题 |
| 归档 | `~/video-forge/README.md`、`~/video-forge/recipes/_template.md` | 做完以后 |
