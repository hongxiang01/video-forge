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
