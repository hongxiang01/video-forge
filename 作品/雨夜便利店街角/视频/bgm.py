# 合成一段 45 秒的 lo-fi 雨夜 BGM：电钢琴和弦 + 贝斯 + 轻鼓 + 稀疏旋律 + 雨声 + 唱片底噪
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
import sys

SR = 44100
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 45.0
BPM = 72
BEAT = 60 / BPM
N = int(SR * DUR)
rng = np.random.default_rng(7)
mix = np.zeros((N, 2))

def hz(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x, axis=0)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x, axis=0)

def add(sig, t, pan=0.0, gain=1.0):
    i = int(t * SR)
    if i >= N: return
    sig = sig[: N - i] * gain
    mix[i:i + len(sig), 0] += sig * np.sqrt(0.5 * (1 - pan))
    mix[i:i + len(sig), 1] += sig * np.sqrt(0.5 * (1 + pan))

def rhodes(m, dur, vel=1.0):
    t = np.arange(int(SR * dur)) / SR
    f = hz(m)
    env = np.exp(-t * 1.6) * (1 - np.exp(-t * 300))
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4) + 0.12 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 8)
    s *= 1 + 0.15 * np.sin(2 * np.pi * 4.5 * t)  # 颤音
    rel = np.minimum(1, (dur - t) / 0.25)
    return s * env * rel * vel

def bass(m, dur):
    t = np.arange(int(SR * dur)) / SR
    env = (1 - np.exp(-t * 80)) * np.exp(-t * 0.9) * np.minimum(1, (dur - t) / 0.1)
    return (np.sin(2 * np.pi * hz(m) * t) + 0.2 * np.sin(2 * np.pi * 2 * hz(m) * t)) * env

def kick():
    t = np.arange(int(SR * 0.4)) / SR
    f = 50 + 70 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)

def snare():
    t = np.arange(int(SR * 0.25)) / SR
    n = hp(lp(rng.standard_normal(len(t)), 3500), 900)
    return (n * 0.6 + 0.4 * np.sin(2 * np.pi * 190 * t)) * np.exp(-t * 18)

def hat():
    t = np.arange(int(SR * 0.06)) / SR
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 70)

# Fmaj7 - Em7 - Dm7 - Cmaj7(add9)
CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59, 62]]
ROOTS = [41, 40, 38, 36]
SCALE = [64, 67, 69, 72, 74, 76, 79]
bar = 4 * BEAT
nbars = int(np.ceil(DUR / bar))
for b in range(nbars):
    t0 = b * bar
    ch = CHORDS[b % 4]
    for j, m in enumerate(ch):  # 轻轻扫弦
        add(rhodes(m, bar * 0.95, 0.9), t0 + j * 0.018, pan=-0.3 + 0.15 * j, gain=0.09)
    add(rhodes(ch[1] + 12, BEAT * 1.4, 0.6), t0 + 2.5 * BEAT, pan=0.3, gain=0.05)
    add(bass(ROOTS[b % 4], BEAT * 2.6), t0, gain=0.22)
    add(bass(ROOTS[b % 4] + 7, BEAT * 1.2), t0 + 2.75 * BEAT, gain=0.14)
    if b >= 2:  # 两小节后进鼓，带一点摇摆
        for k in range(4):
            if k in (0, 2): add(kick(), t0 + k * BEAT + (0.33 * BEAT if k == 2 else 0), gain=0.38)
            if k in (1, 3): add(snare(), t0 + k * BEAT + 0.02, pan=0.1, gain=0.10)
            add(hat(), t0 + k * BEAT, pan=0.35, gain=0.05)
            add(hat(), t0 + (k + 0.58) * BEAT, pan=0.35, gain=0.03)
    if b >= 4 and b < nbars - 1:  # 稀疏旋律
        for k in range(8):
            if rng.random() < 0.32:
                add(rhodes(SCALE[rng.integers(len(SCALE))], BEAT * 1.2, 0.7), t0 + k * BEAT / 2, pan=0.2, gain=0.06)

music = lp(mix, 4200)
# 雨声：低通噪声 + 随机雨滴
rain = lp(hp(rng.standard_normal((N, 2)), 400), 5000) * 0.035
for _ in range(int(DUR * 25)):
    t = rng.random() * DUR; L = int(SR * 0.012)
    d = hp(rng.standard_normal(L), 2000) * np.exp(-np.arange(L) / (SR * 0.002))
    i = int(t * SR); p = rng.random()
    if i + L < N: rain[i:i + L, 0] += d * 0.05 * p; rain[i:i + L, 1] += d * 0.05 * (1 - p)
crackle = np.zeros((N, 2))
idx = rng.integers(0, N, int(DUR * 12)); crackle[idx, :] = rng.standard_normal((len(idx), 1)) * 0.15
crackle = lp(crackle, 3000)
out = music + rain + crackle
t = np.arange(N) / SR
out *= np.minimum(1, t / 1.5)[:, None] * np.minimum(1, (DUR - t) / 3.0)[:, None]
out /= np.max(np.abs(out)) / 0.89
wavfile.write(sys.argv[1], SR, (out * 32767).astype(np.int16))
print('ok', DUR)
