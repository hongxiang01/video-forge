#!/usr/bin/env python3
"""v3 配乐：调 tools/music/code_score.py 代码作曲（96 BPM，90 小节 = 225 秒，段落对齐章节），
再把响度对齐 v2 旧钢琴（增益 ×1.905，约 +5.6 dB）、末尾 3 秒淡出，写到 public/assets/ai-howto/music.wav。
人声压低仍由 Film.tsx 的 musicVol 负责（无人声 0.24 / 人声段 0.12）。

段落：intro 0（钢琴）→ build 8 小节 20s（加弦乐、贝斯）→ main 25 小节 62.5s（第二章章节卡出现时加轻鼓）
      → outro 67 小节 167.5s（第三章，收回钢琴 + 弦乐，最后一句后落长音）。
用法：.venv/bin/python scripts/make_music.py（需 ~/video-forge/tools/music/.venv 和 fluidsynth）
"""
import os, subprocess, wave
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOL = os.path.expanduser('~/video-forge/tools/music')
GAIN = 1.905
os.makedirs(f'{ROOT}/audio/v3', exist_ok=True)
base = f'{ROOT}/audio/v3/music_v3'
subprocess.run([f'{TOOL}/.venv/bin/python', f'{TOOL}/code_score.py', '--bpm', '96', '--bars', '90',
                '--sections', 'intro:0,build:8,main:25,outro:67', '--out', base], check=True)
with wave.open(f'{base}.wav') as w:
    sr, ch = w.getframerate(), w.getnchannels()
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, ch).astype(np.float64) / 32767
x = x * GAIN
fo = int(3 * sr); x[-fo:] *= np.linspace(1, 0, fo)[:, None]
d = (np.clip(x, -1, 1) * 32767).astype(np.int16)
with wave.open(f'{ROOT}/public/assets/ai-howto/music.wav', 'wb') as w:
    w.setnchannels(ch); w.setsampwidth(2); w.setframerate(sr); w.writeframes(d.tobytes())
print('music.wav', round(len(x) / sr, 1), 's')
