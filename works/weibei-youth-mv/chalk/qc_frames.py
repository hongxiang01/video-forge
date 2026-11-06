"""成片帧自查：静止段（>3s）、镜头内一帧跳变（相邻帧差 > 附近帧中位数 3 倍且绝对值够大）、黑帧。
用法：qc_frames.py 帧目录。输出 out/qc.json"""
import json, sys, glob, numpy as np
from PIL import Image
d = sys.argv[1]; fps = 30
CUTS = [5.65, 11.37, 17.09, 22.81, 28.53, 33.54, 39.26, 44.98, 50.70, 56.42, 62.14, 67.14, 72.86, 76.97, 81.44, 87.16, 90.02, 92.88, 95.74, 98.60, 104.32, 110.04, 115.76, 118.62, 122.91, 128.63, 137.21, 107.18]   # 107.18 = S21 正反打的镜头内切（卡拍）
cutF = set(); [cutF.update({round(c * fps) + k for k in (-1, 0, 1)}) for c in CUTS]
fs = sorted(glob.glob(f'{d}/f*.png')); prev = None; diffs = []; lum = []
for f in fs:
    a = np.asarray(Image.open(f).convert('L').resize((320, 180))).astype(float)
    lum.append(a.mean()); diffs.append(0 if prev is None else np.abs(a - prev).mean()); prev = a
diffs = np.array(diffs); lum = np.array(lum)
static, run = [], 0
for i, v in enumerate(diffs):
    run = run + 1 if v < 0.35 else 0
    if run == int(3 * fps): static.append(round((i - run + 1) / fps, 2))
small = lambda i: np.asarray(Image.open(fs[i]).convert('L').resize((320, 180))).astype(float)
jumps, blips = [], []
for i in range(6, len(diffs) - 6):
    if i in cutF: continue
    nb = np.concatenate([diffs[i - 6:i], diffs[i + 1:i + 7]])
    if diffs[i] > 2.0 and diffs[i] > 3 * max(np.median(nb), 0.3):
        row = [round(i / fps, 2), round(float(diffs[i]), 2), round(float(np.median(nb)), 2)]
        a = small(i - 1)   # 6 帧内又回到跳变前的样子 = 眨眼/闪一下，单列
        (blips if min(np.abs(small(j) - a).mean() for j in range(i + 1, min(i + 7, len(fs)))) < 0.4 * diffs[i] else jumps).append(row)
dark = [round(i / fps, 2) for i in range(len(lum)) if lum[i] < 8]
json.dump({'static_runs_start': static, 'in_shot_jumps': jumps, 'blips': blips, 'dark_frames': dark[:50], 'n': len(fs)}, open('out/qc.json', 'w'), indent=1)
print('静止段起点(>3s):', static); print('镜头内一帧跳变（秒, 帧差, 附近中位数）:', jumps); print('闪一下又回来（眨眼等）:', blips); print('黑帧数:', len(dark))
