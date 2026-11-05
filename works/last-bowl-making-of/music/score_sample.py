#!/usr/bin/env python3
"""《最后一碗面》配乐重写 · 30 秒样曲。代码作曲：mido 写 MIDI → FluidSynth + GeneralUser GS 渲染（做法同 tools/music/code_score.py）。

情绪：温暖、治愈，像深夜面馆里的一盏灯。D♭ 大调，80 bpm，4/4（一拍 0.75 s，一小节 3.0 s），10 小节 = 30 s；
小节线和片子一致，主题从第 2 小节（3.0 s）进，和旧配乐同一位置，以后对拍点不用挪。
和声只用三和弦、七和弦（不叠 add9 / maj9，不停在挂留上），两个乐句都落回主和弦 D♭：
   1 D♭ | 2 A♭ | 3 D♭ | 4 B♭m | 5 G♭ → D♭ ‖ 6 Fm7 | 7 B♭m | 8 G♭ | 9 E♭m7 → A♭7 | 10 D♭
     I      V      I      vi       IV → I       iii7     vi     IV     ii7  → V7        I
乐器（GM）：钢琴（0）主旋律；尼龙弦吉他（24）八分音符分解和弦；弦乐（49）低音量铺底，第 3 小节起慢慢进来；
大提琴（42）第 6 小节起对位；原声贝斯（32）第 6 小节起很轻地托根音。不用颤音琴、钟琴、钢片琴、八音盒，不用鼓。
前 2 小节只有钢琴和吉他；第 10 小节全体落在 D♭ 大三和弦上自然衰减，中间没有静音段。

用法（mido 装在 tools/music 的 venv 里）：
  ~/video-forge/tools/music/.venv/bin/python score_sample.py
  → sample30.mid / sample30.wav / sample30.mp3（-16 LUFS，真峰值 ≤ -1 dBTP）
    ab.mp3（旧配乐 0–15 s | 1 s 静音 | 新样曲 0–15 s，两段都对齐到 -16 LUFS）
"""
import argparse, os, random, re, subprocess, tempfile
import mido

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--sf2', default=os.path.expanduser('~/.local/share/soundfonts/GeneralUser-GS.sf2'))
ap.add_argument('--old', default=os.path.expanduser('~/video-forge/films/last-bowl/audio/music.wav'), help='旧配乐（只读），做 ab.mp3 用')
ap.add_argument('--lufs', type=float, default=-16.0)
a = ap.parse_args()
OUT = os.path.join(HERE, 'sample30')

TPB = 480; BEAT = TPB; BAR = 4 * TPB; BPM = 80; SEC = 60 / BPM; LEN = 30.0
def T(b, k=1.0): return round((b - 1) * BAR + (k - 1) * BEAT)    # 第 b 小节第 k 拍 → tick（都从 1 数，k=2.5 = 第 2 拍后半）
def S(sec): return round(sec / SEC * TPB)                           # 秒 → tick
random.seed(7)
def jit(n): return random.randint(-n, n)                            # 轻微的人手误差（1 tick ≈ 1.6 ms）

# —— 和声：(小节, 拍, 拍数, 和弦, 吉他低音, 吉他上方三音, 弦乐铺底, 贝斯) ——
HARM = [
    (1, 1, 4, 'D♭',   49, (56, 61, 65), None,         None),
    (2, 1, 4, 'A♭',   44, (56, 60, 63), None,         None),
    (3, 1, 4, 'D♭',   49, (56, 61, 65), (56, 61, 65), None),    # 弦乐从这里慢慢进来
    (4, 1, 4, 'B♭m',  46, (53, 58, 61), (58, 61, 65), None),
    (5, 1, 2, 'G♭',   42, (54, 58, 61), (58, 61, 66), None),
    (5, 3, 2, 'D♭',   49, (56, 61, 65), (56, 61, 65), None),    # 第一句落回主和弦
    (6, 1, 4, 'Fm7',  41, (56, 60, 63), (56, 60, 65), 29),
    (7, 1, 4, 'B♭m',  46, (53, 58, 61), (58, 61, 65), 34),
    (8, 1, 4, 'G♭',   42, (54, 58, 61), (58, 61, 66), 30),
    (9, 1, 2, 'E♭m7', 51, (54, 58, 61), (58, 61, 66), 39),
    (9, 3, 2, 'A♭7',  44, (54, 60, 63), (60, 63, 66), 32),
]
END = S(29.6)                                                       # 第 10 小节 D♭ 大三和弦（27.0 起）按到 29.6 s，之后自然放掉

# —— 主题动机（沿用片子原主题，节奏「长-短-长 / 二-一-一」）：C5 D♭5 E♭5 | F5 E♭5 D♭5 | B♭4 C5 D♭5 | D♭5 E♭5 F5 ——
# (小节偏移, 拍, 音, 拍数)
MOTIF = [(0, 1, 72, 1.5), (0, 2.5, 73, .5), (0, 3, 75, 2),
         (1, 1, 77, 2), (1, 3, 75, 1), (1, 4, 73, 1),
         (2, 1, 70, 1.5), (2, 2.5, 72, .5), (2, 3, 73, 2),
         (3, 1, 73, 1.5), (3, 2.5, 75, .5), (3, 3, 77, 2)]
# 第二遍最后一小节改成终止式 E♭5 D♭5 C5（还是长-短-长），配 E♭m7 → A♭7，第 10 小节落到主音 D♭5
MOTIF2 = MOTIF[:9] + [(3, 1, 75, 1.5), (3, 2.5, 73, .5), (3, 3, 72, 2)]

# 声部: (通道, GM 音色, 音量 CC7, 声像 CC10, 混响 CC91)
# 分轨实测（第 6–9 小节）：吉他比钢琴低约 5 dB，弦乐低约 9 dB，大提琴低约 6.5 dB，贝斯低约 17 dB
CH = dict(piano=(0, 0, 110, 64, 45), guitar=(1, 24, 90, 46, 40), strings=(2, 49, 59, 82, 65),
          cello=(3, 42, 75, 88, 55), bass=(4, 32, 70, 64, 25))
ev = {k: [] for k in CH}                                            # 声部 → [(起 tick, 长 tick, 音, 力度)]
cc = {k: [] for k in CH}                                            # 声部 → [(tick, 控制器, 值)]


def ramp(part, t0, t1, v0, v1, step=40):                            # 表情 CC11 渐变（进来 / 收掉）
    for t in range(t0, t1 + 1, step):
        cc[part].append((t, 11, round(v0 + (v1 - v0) * (t - t0) / (t1 - t0))))


# 钢琴主旋律：第 2–5、6–9 小节两遍主题，第二遍略响；高音略响、短经过音略轻；音与音轻轻连着
def melody(motif, bar0, base):
    for db, k, m, beats in motif:
        ev['piano'].append((T(bar0 + db, k) + (0 if k == 1 else jit(4)), round(beats * BEAT) + 40, m, base + (m - 72) - (6 if beats < 1 else 0)))
melody(MOTIF, 2, 70)
melody(MOTIF2, 6, 76)
# 钢琴左手只在开头一小节轻按低音 D♭2 + A♭2；第 10 小节钢琴落一个 D♭ 大三和弦（D♭2 A♭2 | F4 A♭4 D♭5）
ev['piano'] += [(T(1), BAR, 37, 44), (T(1) + 20, BAR - 20, 44, 40)]
ev['piano'] += [(T(10), END - T(10), m, v) for m, v in ((37, 46), (44, 42), (65, 48), (68, 50), (73, 72))]

# 吉他：八分音符分解和弦（低音、上行、回落），指弹每个音一直响到换和弦；第 10 小节慢慢扫一个 D♭ 大三和弦
PAT = [0, 1, 2, 3, 2, 1, 2, 1]
for b, k, n, _, bass, up, _, _ in HARM:
    t0 = T(b, k); t1 = t0 + n * BEAT
    for i in range(2 * n):
        j = PAT[i]; s = t0 + i * BEAT // 2 + (0 if i == 0 else jit(8))
        ev['guitar'].append((s, t1 - s + 60, bass if j == 0 else up[j - 1], (60 if j == 0 else 46) + (5 if i % 4 == 0 else 0) + jit(3)))
ev['guitar'] += [(T(10) + 30 * i, END - T(10) - 30 * i, m, 58 - 2 * i) for i, m in enumerate((49, 56, 61, 65))]

# 弦乐铺底：相邻和弦的共同音连着拉（不重新起弓）；第 3 小节起表情从 20 慢慢推到 100，第二遍再暖一点，最后一小节收掉
held, pad = {}, []
for t0, t1, notes in [(T(b, k), T(b, k) + n * BEAT, p) for b, k, n, _, _, _, p, _ in HARM if p] + [(T(10), END, (56, 61, 65))]:
    nxt = {}
    for m in notes:
        if m in held and pad[held[m]][1] == t0: pad[held[m]][1] = t1; nxt[m] = held[m]
        else: pad.append([t0, t1, m]); nxt[m] = len(pad) - 1
    held = nxt
ev['strings'] += [(t0, t1 - t0 + 30, m, 62) for t0, t1, m in pad]
cc['strings'].append((0, 11, 20))
ramp('strings', T(3), T(5), 20, 100); ramp('strings', T(6), T(7), 100, 112); ramp('strings', S(27.75), END, 112, 0)

# 大提琴对位（第 6–10 小节）：和主旋律走十度 / 反向；第 9 小节 G♭3 是 E♭m7 的三音、A♭7 的七音，第 10 小节往下解决到 F3
CELLO = [(6, 1, 60, 2), (6, 3, 56, 2), (7, 1, 61, 2), (7, 3, 58, 2), (8, 1, 54, 2), (8, 3, 58, 2), (9, 1, 54, 4)]
ev['cello'] += [(T(b, k), round(beats * BEAT) + 20, m, 64) for b, k, m, beats in CELLO] + [(T(10), END - T(10), 53, 60)]
cc['cello'].append((0, 11, 70))
ramp('cello', T(6), T(6, 3), 70, 100); ramp('cello', S(27.75), END, 100, 0)

# 原声贝斯（第 6–10 小节）：很轻，只托根音
ev['bass'] += [(T(b, k), n * BEAT - 30, bs, 52) for b, k, n, *_, bs in HARM if bs] + [(T(10), END - T(10), 37, 50)]
cc['bass'].append((0, 11, 100))
ramp('bass', S(27.75), END, 100, 0)


def clip(evs):
    """同一声部同一个音再响之前先收掉上一个（FluidSynth 的 note_off 会把同键的声音全关掉）"""
    out, nxt = [], {}
    for s, d, m, v in sorted(evs, reverse=True):
        e = min(s + d, nxt.get(m, s + d)); nxt[m] = s
        out.append((s, max(e - s, 1), m, max(1, min(127, v))))
    return out[::-1]


mid = mido.MidiFile(ticks_per_beat=TPB)
meta = mido.MidiTrack(); mid.tracks.append(meta)
meta += [mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM), time=0), mido.MetaMessage('time_signature', numerator=4, denominator=4, time=0),
         mido.MetaMessage('key_signature', key='Db', time=0), mido.MetaMessage('end_of_track', time=S(LEN + 1.0))]   # 多渲 1 s，之后裁到 30.0 s
for part, (ch, prog, vol, pan, rev) in CH.items():
    t = mido.MidiTrack(); mid.tracks.append(t)
    msgs = [(0, 0, mido.MetaMessage('track_name', name=part)), (0, 0, mido.Message('program_change', channel=ch, program=prog))]
    msgs += [(0, 0, mido.Message('control_change', channel=ch, control=c, value=v)) for c, v in ((7, vol), (10, pan), (91, rev), (93, 0))]
    msgs += [(tk, 0, mido.Message('control_change', channel=ch, control=c, value=v)) for tk, c, v in cc[part]]
    for s, d, m, v in clip(ev[part]):
        msgs += [(s, 2, mido.Message('note_on', channel=ch, note=m, velocity=v)), (s + d, 1, mido.Message('note_off', channel=ch, note=m, velocity=0))]
    msgs.sort(key=lambda x: (x[0], x[1]))
    now = 0
    for tk, _, msg in msgs:
        msg.time = tk - now; now = tk; t.append(msg)
mid.save(OUT + '.mid')


def ff(*args): subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def measure(path, pre=''):
    """ffmpeg ebur128=peak=true → (整体响度 LUFS, 真峰值 dBTP)"""
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', pre + 'ebur128=peak=true', '-f', 'null', '-'],
                         capture_output=True, text=True, check=True).stderr
    s = err[err.rindex('Summary:'):]
    return float(re.search(r'I:\s+(\S+) LUFS', s).group(1)), float(re.search(r'Peak:\s+(\S+) dBFS', s).group(1))


def loudnorm(src, dst, pre, codec='pcm_f32le'):
    """pre 处理后增益到 --lufs；真峰值会超过 -1.5 dBTP 时才挂限幅器（-2 dBFS，只削峰、不自动拉电平），最多迭代 4 次"""
    I, tp = measure(src, pre + ',')
    g = a.lufs - I
    for _ in range(4):
        af = f'{pre},volume={g:.2f}dB' + (f',alimiter=limit={10 ** (-2 / 20):.4f}:attack=5:release=60:level=0:latency=1' if tp + g > -1.5 else '')
        ff('-i', src, '-af', af, '-c:a', codec, dst)
        I2, tp2 = measure(dst)
        if abs(I2 - a.lufs) <= .2: break
        g += a.lufs - I2
    return I2, tp2


with tempfile.TemporaryDirectory() as tmp:
    raw = os.path.join(tmp, 'raw.wav')
    subprocess.run(['fluidsynth', '-ni', '-g', '0.6', '-r', '48000', '-O', 'float', '-F', raw, a.sf2, OUT + '.mid'], check=True, capture_output=True)
    loudnorm(raw, OUT + '.wav', f'atrim=0:{LEN},afade=t=out:st={LEN - 1}:d=1', codec='pcm_s24le')
    ff('-i', OUT + '.wav', '-c:a', 'libmp3lame', '-b:a', '192k', OUT + '.mp3')
    for p in (OUT + '.wav', OUT + '.mp3'):
        print(f'{os.path.basename(p):14s} I {measure(p)[0]:6.1f} LUFS  真峰值 {measure(p)[1]:5.1f} dBTP')

    # 新旧对比：两段各取 0–15 s（末尾 0.5 s 淡出免得咔哒），各自对齐到 -16 LUFS，中间 1 s 静音
    seg = 'atrim=0:15,afade=t=out:st=14.5:d=0.5,aformat=sample_fmts=flt:sample_rates=48000:channel_layouts=stereo'
    old15, new15 = os.path.join(tmp, 'old15.wav'), os.path.join(tmp, 'new15.wav')
    loudnorm(a.old, old15, seg); loudnorm(OUT + '.wav', new15, seg)
    ab = os.path.join(HERE, 'ab.mp3')
    ff('-i', old15, '-f', 'lavfi', '-t', '1', '-i', 'anullsrc=r=48000:cl=stereo', '-i', new15,
       '-filter_complex', '[0:a][1:a][2:a]concat=n=3:v=0:a=1', '-c:a', 'libmp3lame', '-b:a', '192k', ab)
    for name, pre in (('ab 旧 0–15', 'atrim=0:15,'), ('ab 新 16–31', 'atrim=16:31,')):
        I, tp = measure(ab, pre)
        print(f'{name:14s} I {I:6.1f} LUFS  真峰值 {tp:5.1f} dBTP')
