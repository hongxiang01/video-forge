"""全身设定图 → 透明底粉笔图（和头像同一套处理：alpha = 和黑板底色的色差；近黑中性色 → 透明露出黑板）。
用法：key_body.py 输入.png 输出.png"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
src, dst = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(float); H, W, _ = a.shape
a[int(H * 0.9):, int(W * 0.75):] = np.median(a.reshape(-1, 3), 0)          # 去水印角
bg = np.median(a.reshape(-1, 3), 0)
big = nd.uniform_filter(a, size=(61, 61, 1))                                   # 局部板色（缓变）
d = np.linalg.norm(a - np.where(np.linalg.norm(big - bg, axis=2, keepdims=True) < 25, big, bg), axis=2)
alpha = np.clip((d - 14) / 46, 0, 1)
m = nd.binary_closing(alpha > 0.15, iterations=6); m = nd.binary_fill_holes(m)
lab, k = nd.label(nd.binary_dilation(m, iterations=10)); sz = nd.sum(m, lab, range(1, k + 1))
keep = lab == (np.argmax(sz) + 1)                                              # 只留最大的一块（角色）
al = np.where(keep, alpha, 0)
# 粉笔化（chalkify_heads.py 同参数）
BOARD = np.array([22, 40, 32]); rgb = a
lum = rgb.mean(2); mx, mn = rgb.max(2), rgb.min(2); sat = (mx - mn) / (mx + 1)
dd = np.linalg.norm(rgb - BOARD, axis=2); al = al * np.clip((dd - 35) / 40, 0, 1)
darkN = np.clip((95 - lum) / 45, 0, 1) * np.clip((0.35 - sat) / 0.2, 0, 1)
darkC = np.clip((80 - lum) / 50, 0, 1) * (1 - np.clip((0.35 - sat) / 0.2, 0, 1))
al = al * (1 - darkN) * (1 - 0.45 * darkC)
rgb = rgb * 0.92 + 255 * 0.06
Image.fromarray(np.dstack([rgb, al * 255]).clip(0, 255).astype(np.uint8), 'RGBA').save(dst)
ys, xs = np.where(al > 0.1); print(dst, 'bbox', xs.min(), ys.min(), xs.max(), ys.max())
