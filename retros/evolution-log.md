# 进化日志

做法：每轮只挑 2–3 个参考（用户：参考太多会失去方向、变平庸），拆出可落地的做法，对照自己的 skill 和作品找差距，改进写回 skill。每条改进写清来源。

## 第 1 轮（2026-11-05）：知识科普讲解片

**参考（2 个）**
- 抖音"电子智人"《信息论》（Vibe 知识代表作，单条 137 万赞；话题 #Vibe知识大赏 播放 11.7 亿）。来源：[21 经济网 2026-10-22](https://www.21jingji.com/article/20261022/herald/fd33d9fcf3cef29800ddd927d2ad46ef.html)、[新浪评论](https://www.sina.cn/weibo/detail/5355833065474824.html)、[艾媒网](https://www.iimedia.cn/c1096/118884.html)
- Kurzgesagt 制作流程（约 1200 小时/条，写稿最慢、反复重写；固定角色代表概念）。来源：[kurzgesagt.org/youtube](https://kurzgesagt.org/youtube/)、[How to Make a Kurzgesagt Video in 1200 Hours](https://rosetta.to/u/kurzgesagt/how-to-make-a-kurzgesagt-video-in-1200-hours)

**拆出来的做法**
1. 《信息论》的结构：悬念开场 → 零散线索 → 末段汇合，把概念变成猜谜。
2. 高密度信息 + 丝滑动效 + 明快节奏 = "像看 MV 的愉悦感"。
3. 这波热潮的视觉高度同质（暗色、发光、粒子、电子乐），且用的正是"大模型写代码出动画"——和我们同一条路。
4. Kurzgesagt：写稿是瓶颈，反复重写；固定角色贯穿全片。

**对照自己的差距**
- 《AI 到底该怎么用》是清单式结构，评委说中段像 PPT → 缺谜题式结构选项。
- 配乐只是垫底，没有卡拍。
- 稿子一版就配音。
- 纸本画风正好避开了同质化，但 skill 里没写成规则，下次可能又滑回默认的暗色发光。

**写回 skill 的改动**
- `skill/references/pipeline-explainer.md`：新增「结构模板」（谜题式 / 清单式 / 旅程式）、「差异化」、「写稿」（配音前至少第 2 版）、「配乐和节奏」（BPM 网格、卡拍）。
- `skill/references/interview-checklist.md`：结构项给科普片三种结构，先推荐谜题式。
- `skill/references/review-standards.md`：科普类新增 K9 卡拍、K10 不落入同质化视觉、K11 结构有张力。

## 第 2 轮（2026-11-05）：开头钩子与留存

**参考（2 个）**
- MrBeast 内部制作手册（2024 年泄露，前员工证实）：第 1 分钟流失最多，是全片最重要的一分钟；约每 3 分钟一个 re-engagement 点；封面决定观众的期待。来源：[Tubefilter](https://www.tubefilter.com/2024/09/17/mrbeast-internal-production-guide-leaked-key-points/)、[Passionfruit](https://passionfru.it/mrbeast-leaked-document-81151/)、[OMR](https://omr.com/de/daily/mrbeast-doc-pdf-leak)
- 抖音知识类中长视频经验（第三方，非官方，只作线索）：1 分钟以上完播率普遍低；被反复回看的片段可能比完播率更有价值。来源：[B 站专栏](https://www.bilibili.com/read/cv45263020)

**对照自己的差距**
- 《AI 到底该怎么用》开头钩子（10:10）做到了，但第 1 分钟没有"小揭晓"的设计意识，中段没有刻意的再钩点；没有专门设计"值得回看"的画面；交付时没有封面和标题候选；发布后的数据不回流。

**写回 skill 的改动**
- `skill/references/pipeline-explainer.md`：新增「留存设计」（前 3 秒、第 1 分钟兑现、每 60–90 秒再钩、至少一处值得回看、3 个封面 + 3 个标题）。
- `skill/references/review-standards.md`：新增 K12 再钩节奏、K13 值得回看。
- `skill/SKILL.md` 归档步骤：发布约一周后回填平台数据到 `scores.md`，复盘里写哪个留存设计起作用。

## 第 3 轮（2026-11-05）：配乐

用户反馈："目前 AI 生成音乐效果不太好，看看有没有什么办法，可以通过其他小模型或者其他方法去生成一下。"；"不要光看抖音，去看 YouTube、国外的内容"。

**参考（3 个，均为国外）**
- ACE-Step 1.5（开源音乐模型，MIT，<4GB 显存，2026 年开源最强）。来源：[arXiv 2602.00744](https://arxiv.org/pdf/2602.00744)、[DEV 指南](https://dev.to/czmilo/ace-step-15-the-complete-2026-guide-to-open-source-ai-music-generation-522e)、[Spheron 部署对比](https://www.spheron.network/blog/deploy-open-source-ai-music-generation-gpu-cloud-2026/)
- 免版税曲库现状（YouTube 音频库、Pixabay Music；CC 曲目要署名）。来源：[Foxi Music 2026 指南](https://www.foximusic.com/blog/what-background-music-can-i-use-on-youtube-guide/)
- FluidSynth + SoundFont 渲染 MIDI（midi2audio / pyFluidSynth）。来源：[midi2audio](https://pypi.org/project/midi2audio)、[FluidSynth](https://www.fluidsynth.org/)；音色库 [GeneralUser GS](https://github.com/mrbumpy409/GeneralUser-GS)（可商用）

**实测**
- 新做 `tools/music/code_score.py`：代码写 MIDI（钢琴分解和弦 / 弦乐铺底 / 贝斯 / 轻鼓，intro→build→main→outro）→ FluidSynth + GeneralUser GS 渲染，同时导出 beats.json（每拍、每小节、段落的秒数与帧号）。
- 对比试听：`works/ai-howto/music-test/old-vs-new.mp3`（前 30 秒旧 numpy 合成，后 30 秒新版）。**听感待用户判断**。
- ACE-Step 1.5 未实测（数 GB 模型，Mac 可用性待验证）。

**写回 skill 的改动**
- 新增 `skill/references/music.md`：按需求选路（卡拍→代码作曲；真人质感→免版税曲库/平台曲库；整曲风格→ACE-Step；音效→Stable Audio Open），用法与审片。
- `deps.json` 登记 GeneralUser GS；`bootstrap.sh` 支持单文件下载，并修复空字段导致的解析错位。

## 类型卡（2026-11-05，4 个 agent 并行）

用户："不同视频的类型和题材都需要考虑……有的可能一分钟就够了，有的可能需要三分钟更好""不是说 skill 不一样，应该他们那个校验逻辑、规范之类的不一样，然后可能提示词也会不一样"；"可以开多个 Agent 去分析，一起合作搞定"。

- 4 个 agent 分组研究（科普 + 口播 / 叙事 + 氛围 / MV + 特效 / 广告 + 微缩），每张卡 ≤3 个参考、国内外各至少 1 个，产出 10 张类型卡：`skill/references/genres/`。每张卡 9 节：定位、时长与画幅、结构模板、视觉规范、声音规范、校验逻辑（含可脚本测阈值）、提示词模板、参考作品、常见坑。
- 主会话整合：选卡索引 `genres/README.md`；接进 SKILL.md 第 1 步、追问清单、评审（评委拿到类型卡）、评审标准库（基础项 + 类型卡叠加）；核对编号无撞车；写明"用户习惯优先"（抖音横版、画面不加字）。
- 按 MV/特效卡指出的问题，给 `tools/music/code_score.py` 加 `--sections`（可把 main"释放"点放在 55–65%）。
- 各卡里标【经验】/"待验证"的数字没有可靠出处，要用真片和发布数据校准。

## 第 4 轮（2026-11-06）：《最后一碗面》为什么做了六版

用户：「改版的原因是什么呢？因为比如说，明明是一个画平面、画图，就涉及到三渲二等等。总结一下规律，然后为什么做六版？」「把这个项目 skill 都优化一下」。参考就是自己的作品：复盘见 `retros/2026-11-05-last-bowl.md`。

**拆出来的规律**
1. 做法比画风重要：有手拿东西、东西压东西，平面拼形状就到顶了，要一开始就三渲二。
2. 问题一层层露出来（结构 → 做法 → 解剖 → 毫米级接触），所以每版交整片。
3. AI 会自信地看错（自检漏了 36 张穿模，目测「四分之一」实测 1.6%，agent 的对比图差一张画），只有测量和同一张画的对比算数。
4. AI 听不见：配乐由用户判断，用曲库，不用 AI 生成。
5. 幕后片要做成科普讲解，对比用同步视频。

**写回 skill 的改动**
- `skill/SKILL.md`：铁规矩 7 加「手拿东西的镜头开工就用三渲二」；新增 12「量出来才算数」、13「背景音乐从曲库来」；第 7 步加发抖音；参考表加 `publish-douyin.md`，配乐一行改成默认曲库。
- `skill/references/pipeline-style-film.md`：新增「做法先于画风：手拿东西的镜头直接三渲二」（判断时机、现成实现、肩肘、量接触、明暗翻面）；粗剪步骤加连贯性表，精修步骤加曲库配乐和复核。
- `skill/references/review.md`：新增「自检怎么复核」（数字要量、同一张画对比、复核 agent 的修法、固定自检项）。
- `skill/references/genres/making-of.md`（新类型卡，编号 B11–B17）、`genres/README.md` 选卡表。
- `skill/references/publish-douyin.md`（新）：ego lite 上传、5 个话题上限、章节、封面、定时。
- `skill/references/genres/narrative-short.md` 常见坑 12–14；`troubleshooting.md` 加 Remotion 浏览器下载、对比差一张画、三渲二明暗闪烁三条；`music.md` 写入「背景音乐不用 AI 生成」。

## 第 5 轮（2026-11-06）：《违背的青春》MV，人物怎么演、故事怎么编

用户原话：
- 「你把这个动画生成的方式，也就是之前一开始带歌词版的那个方式……记到我的方法论里面，记到我的 skill 里面沉淀和整理一下。」
- 「然后再把所有的东西，包括所有的代码库或者方法论，重新编排、重构一下，最后 push 上就可以了。」

这一轮的参考就是自己的作品，复盘见 `retros/2026-11-06-weibei-youth-mv.md`。

**拆出来的规律**
1. 人物要演大动作，就逐个画姿势：头和身子出自同一张画；骨骼只做小动作；同组几张靠模板匹配对齐，不然换张时头会跳。
2. 做法有上限：同一类问题连着两版不见好，就该换做法，别再调参数（第 6 版 v2–v4、骨骼版）。
3. 故事这一层要单独过关。三次失败都出在这一层：没读懂、逐句配图、中心放错了意象。
4. 代码画不出来的画风（真人、3D）交给 Muse，我只出文本：剧本、资产表、逐镜提示词。

**写回 skill 的改动**
- `recipes/chalk-pose-mv.md`（新）：黑板粉笔定格 MV 的完整做法和已知坑。
- `skill/references/pipeline-mv.md`：重写，新增故事梗概一关，分成路线 A（代码逐帧）和路线 B（Muse）。
- `skill/SKILL.md`：铁规矩 7 加"大动作逐个画姿势、头身同一画源"；分流表和参考表的 MV 一行改成两条路线。
- `skill/references/genres/music-video.md`：常见坑 11–13。
- `skill/references/troubleshooting.md`：豆包调试端口、代理、恢复正常启动、逐帧渲染的坑。
- `tools/doubao/README.md`（新）。
- 作品 `works/weibei-youth-mv/` 加了 `README.md` 文件地图和 `chalk/CREDITS` 署名；大图和逐帧只留本机。
