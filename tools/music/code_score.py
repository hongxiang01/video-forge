#!/usr/bin/env python3
"""代码作曲：按 BPM 与段落写 MIDI → FluidSynth + GeneralUser GS 渲染 wav，并导出拍点表（画面卡点用）。

用法：
  .venv/bin/python code_score.py --bpm 96 --bars 12 --out demo   # 生成 demo.mid / demo.wav / demo.beats.json
  可选：--sf2 <音色库路径>（默认 ~/.local/share/soundfonts/GeneralUser-GS.sf2）

段落（按小节）：intro（只有钢琴）→ build（加弦乐铺底和贝斯）→ main（加轻鼓点）→ outro（收回钢琴 + 长音）。
拍点表 beats.json：每一拍、每一小节线、每个段落起点的秒数与帧号（30fps），分镜/构建时把切镜、关键词、高光对到这些点上。
"""
import argparse, json, os, subprocess
import mido

ap = argparse.ArgumentParser()
ap.add_argument('--bpm', type=float, default=96)
ap.add_argument('--bars', type=int, default=12)
ap.add_argument('--out', default='demo')
ap.add_argument('--fps', type=int, default=30)
ap.add_argument('--sf2', default=os.path.expanduser('~/.local/share/soundfonts/GeneralUser-GS.sf2'))
a = ap.parse_args()

TPB = 480
mid = mido.MidiFile(ticks_per_beat=TPB)
beat_s = 60 / a.bpm
PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
# 段落划分（小节）
n = a.bars
sec = {'intro': (0, max(2, n // 6)), 'build': (max(2, n // 6), n // 3), 'main': (n // 3, n - 2), 'outro': (n - 2, n)}
in_sec = lambda b, *names: any(sec[x][0] <= b < sec[x][1] for x in names)

def track(ch, program, name):
    t = mido.MidiTrack(); mid.tracks.append(t)
    t.append(mido.MetaMessage('track_name', name=name, time=0))
    if ch != 9:
        t.append(mido.Message('program_change', channel=ch, program=program, time=0))
    t.append(mido.Message('control_change', channel=ch, control=91, value=60, time=0))  # 混响
    return t

def notes(t, ch, evs):
    """evs: [(start_tick, dur_tick, note, vel)] → 写入 delta time"""
    msgs = []
    for s, d, nt, v in evs:
        msgs.append((s, 1, mido.Message('note_on', channel=ch, note=nt, velocity=v)))
        msgs.append((s + d, 0, mido.Message('note_off', channel=ch, note=nt, velocity=0)))
    msgs.sort(key=lambda x: (x[0], x[1]))
    now = 0
    for tick, _, m in msgs:
        m.time = tick - now; now = tick; t.append(m)

tempo = mido.MidiTrack(); mid.tracks.append(tempo)
tempo.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(a.bpm), time=0))
BAR = 4 * TPB
piano, strings, bass, drums = [], [], [], []
for b in range(n):
    ch = PROG[b % 4]; s0 = b * BAR
    last = b == n - 1
    # 钢琴：八分音符分解和弦，强拍稍重
    pat = [ch[0], ch[1], ch[2], ch[1] + 12, ch[2], ch[1], ch[0] + 12, ch[2]]
    for i, nt in enumerate(pat if not last else pat[:1]):
        piano.append((s0 + i * TPB // 2, TPB // 2 if not last else BAR, nt, 78 if i % 4 == 0 else 60))
    # 弦乐铺底：整小节长音
    if in_sec(b, 'build', 'main', 'outro'):
        for nt in ch:
            strings.append((s0, BAR, nt - 12 if nt > 60 else nt, 52 if in_sec(b, 'build') else 60))
    # 贝斯：根音，一拍、三拍
    if in_sec(b, 'build', 'main'):
        for k in (0, 2):
            bass.append((s0 + k * TPB, TPB * 2 - 40, ch[0] - 24, 70))
    # 鼓：底鼓 1、3 拍，闭镲八分，第 4 拍军鼓轻敲
    if in_sec(b, 'main'):
        for k in (0, 2):
            drums.append((s0 + k * TPB, TPB // 4, 36, 70))
        drums.append((s0 + 3 * TPB, TPB // 4, 38, 45))
        for i in range(8):
            drums.append((s0 + i * TPB // 2, TPB // 8, 42, 38 if i % 2 else 50))
notes(track(0, 0, 'piano'), 0, piano)
notes(track(1, 48, 'strings'), 1, strings)
notes(track(2, 33, 'bass'), 2, bass)
notes(track(9, 0, 'drums'), 9, drums)

mid.save(f'{a.out}.mid')
subprocess.run(['fluidsynth', '-ni', '-g', '0.7', '-r', '48000', '-F', f'{a.out}.wav', a.sf2, f'{a.out}.mid'], check=True, capture_output=True)

beats = [{'beat': i, 'bar': i // 4, 'downbeat': i % 4 == 0, 'sec': round(i * beat_s, 4), 'frame': round(i * beat_s * a.fps)} for i in range(n * 4 + 1)]
sections = {k: {'bar': v[0], 'sec': round(v[0] * 4 * beat_s, 3), 'frame': round(v[0] * 4 * beat_s * a.fps)} for k, v in sec.items()}
json.dump({'bpm': a.bpm, 'fps': a.fps, 'sections': sections, 'beats': beats}, open(f'{a.out}.beats.json', 'w'), indent=1)
print(f'{a.out}.wav  {n} 小节  {n * 4 * beat_s:.1f}s  段落:', {k: v['sec'] for k, v in sections.items()})
