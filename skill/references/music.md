# 配乐

用户反馈（2026-11-05）："目前 AI 生成音乐效果不太好，看看有没有什么办法，可以通过其他小模型或者其他方法去生成一下。"
第一条片子用 numpy 正弦波拼的钢琴，听感粗糙、没有节拍感，画面也没卡拍。

## 选哪条路

| 需求 | 首选 | 说明 |
|---|---|---|
| **画面要卡拍**（科普、卡点、MV 式剪辑） | **代码作曲**：`tools/music/code_score.py` | 写 MIDI → FluidSynth + GeneralUser GS 采样音色渲染，同时导出 `beats.json`（每拍、每小节、每段落的秒数和帧号）。BPM、段落、乐器层次完全可控，许可干净（音色库可商用）。分镜时把切镜、关键词、高光对到拍点上 |
| 要真人作曲的质感、不需要精确卡拍 | 免版税曲库 | Pixabay Music（可商用，保存许可页）、YouTube 音频库（发 YouTube 用）。发抖音时也可以发布时在 App 里选平台正版曲库（画面不卡拍，交付时说明）。CC 授权的曲子要在描述里署名 |
| 要风格化的整首曲子（某种流派、带人声） | 开源模型 ACE-Step 1.5（MIT，显存 <4GB，2026 年开源里最强） | **未在本机实测**：模型数 GB，Mac 上能否跑待验证。用之前先跑一段 30 秒样曲给用户听 |
| 音效、氛围质感（风声、电流、环境底） | Stable Audio Open（≤47 秒） | 许可是 Stability 社区许可，商用前先核对 |
| 用户愿意付费、要最高质量 | 商用 API（Suno、MiniMax 等） | 用户说过 AI 生成效果不好，不作为默认 |

## 代码作曲用法

```bash
cd ~/video-forge/tools/music
.venv/bin/python code_score.py --bpm 96 --bars 12 --out <输出前缀>   # → .mid / .wav / .beats.json
```
- 段落：intro（只钢琴）→ build（加弦乐、贝斯）→ main（加轻鼓）→ outro（收回）。按片长调 `--bars`：片长秒数 × BPM / 240 ≈ 小节数。
- 想换情绪就改脚本里的和弦进行 `PROG`、乐器 program（GM 编号）和 BPM。思考类 80–100，明快类 110–128。
- 依赖：`brew install fluid-synth`；音色库 `bash ~/video-forge/bootstrap.sh generaluser-gs`；Python 依赖 `uv venv .venv && uv pip install mido`。
- 片子里用：配乐在人声段压低约 6dB（`works/ai-howto/video/src/paper/Film.tsx` 的 `musicVol` 是现成写法），成片统一 -15 LUFS。

## 审片

- 科普 K9：章节切换、关键词、高光落在拍点或小节线上（±2 帧，对照 beats.json）。
- 声音好不好听由用户判断，评委只测量（见 review.md）。交付前把配乐单独导出一段给用户听。
