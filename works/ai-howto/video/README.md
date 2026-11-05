# 《AI 到底该怎么用》源码

纸本风格科普短片（3:46，1920×1080，30fps）。画面全部用 Remotion 代码绘制，配音是 edge-tts 云健 +20%，配乐 v3 用 `tools/music/code_score.py` 代码作曲（钢琴→弦乐贝斯→轻鼓→收尾，段落对齐章节），由 `scripts/make_music.py` 生成；成片 `final_v3.mp4`。

本目录只收我们自己写的部分：

| 路径 | 内容 |
|---|---|
| `src/paper/kit.tsx` | 纸本风格图元库：色板、流水线、机械臂、钟、工单、吊牌、手绘圈、标注线 |
| `src/paper/Film.tsx` | 主合成：镜头窗口、先出后进转场、章名卡、底部进度条、配乐避让 |
| `src/paper/shots/SC01–SC17.tsx` | 17 个镜头 |
| `src/styleframe/` | 选画风时用的 3 张风格帧 |
| `src/common/timeline.ts`、`subs.ts` | 配音时间轴（由 tts_build.py 生成） |
| `script/` | 口播稿 `narration.txt`、分镜 `storyboard.md`、时间轴 |
| `research/research.md` | 事实出处 |
| `review/` | 两轮评审的联系表和意见 |
| `scripts/` | 出静帧、拼审片联系表、合成配乐 |

## 重建可渲染的工程

工程骨架来自 [anything2explainer](https://github.com/hongxiang01/anything2explainer) 的模板（PolyForm Noncommercial 许可，所以不收进本仓库）：

```bash
bash ~/video-forge/bootstrap.sh anything2explainer
zsh ~/video-forge/vendor/anything2explainer/template/scripts/new_project.sh /tmp/ai-howto ai-howto
cp -R src/paper src/styleframe /tmp/ai-howto/src/
cp src/common/timeline.ts src/common/subs.ts /tmp/ai-howto/src/common/
cp -R script scripts /tmp/ai-howto/
# 在 /tmp/ai-howto/src/Root.tsx 里注册：
#   import {Film} from './paper/Film';
#   <Composition id="Film" component={Film} defaultProps={{audio: true}} durationInFrames={TOTAL_FRAMES} fps={30} width={1920} height={1080} />
#   <Composition id="FilmSilent" component={Film} defaultProps={{audio: false}} durationInFrames={TOTAL_FRAMES} fps={30} width={1920} height={1080} />
# 配音（会重新生成 timeline/subs 与 audio.wav）：
VOICE=zh-CN-YunjianNeural RATE=+20% LEAD=-37 python3 scripts/tts_build.py
.venv/bin/python scripts/make_music.py   # 需 ~/video-forge/tools/music/.venv 与 fluidsynth
npx remotion render src/index.ts Film out.mp4
```
