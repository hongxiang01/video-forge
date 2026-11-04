#!/usr/bin/env python3
"""轻钢琴（Am F C G，每和弦 4 秒）+ 每秒一下很轻的时钟滴答。长度跟 script/timeline.json 的 total_frames。"""
import json, os, wave
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
T = json.load(open(f'{ROOT}/script/timeline.json'))['total_frames'] / 30 + 1
n = int(SR * T); out = np.zeros(n)
def note(freq, t0, dur, amp):
    i0 = int(t0 * SR); m = min(int(dur * SR), n - i0)
    if m <= 0: return
    t = np.arange(m) / SR
    env = np.exp(-t * 1.6) * (1 - np.exp(-t * 80))
    w = np.sin(2*np.pi*freq*t) + 0.35*np.sin(2*np.pi*2*freq*t)*np.exp(-t*2) + 0.12*np.sin(2*np.pi*3*freq*t)*np.exp(-t*3)
    out[i0:i0+m] += amp * env * w
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
prog = [[57,60,64],[53,57,60],[48,52,55],[55,59,62]]
t = 0.0; k = 0
while t < T - 6:
    ch = prog[k % 4]
    note(hz(ch[0]-12), t, 4.5, 0.20)
    for j, m in enumerate(ch + [ch[1]+12]): note(hz(m), t + j*0.5, 3.0, 0.10)
    if k % 2 == 1: note(hz(ch[2]+12), t + 2.5, 2.5, 0.07)
    t += 4.0; k += 1
for s in np.arange(0.5, T - 3, 1.0):
    i0 = int(s * SR); m = int(0.03 * SR); tt = np.arange(m) / SR
    out[i0:i0+m] += np.sin(2*np.pi*3200*tt) * np.exp(-tt*300) * (0.05 if int(s) % 2 == 0 else 0.035)
fi = int(0.3*SR); out[:fi] *= np.linspace(0, 1, fi); fo = int(5*SR); out[-fo:] *= np.linspace(1, 0, fo)
out = out / np.max(np.abs(out)) * 0.35
d = (np.stack([out, out], 1) * 32767).astype(np.int16)
with wave.open(f'{ROOT}/public/assets/ai-howto/music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())
print('music', round(T, 1), 's')
