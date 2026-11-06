"""把豆包头像改成"粉笔画在黑板上"：近黑的中性色（勾线、眼镜、瞳孔）→ 透明（露出黑板）；
深棕等有色暗部 → 半透明；去掉抠图留下的绿色光晕。另外给 h0 做一张同轮廓的闭眼版（只改眼睛）。"""
import numpy as np
from PIL import Image
from scipy import ndimage as nd
BOARD = np.array([22, 40, 32])
def chalkify(src, dst):
    a = np.asarray(Image.open(src).convert('RGBA')).astype(float); rgb, al = a[..., :3], a[..., 3] / 255
    lum = rgb.mean(2); mx, mn = rgb.max(2), rgb.min(2); sat = (mx - mn) / (mx + 1)
    # 离黑板色近的（抠图光晕）去掉
    d = np.linalg.norm(rgb - BOARD, axis=2); al = al * np.clip((d - 35) / 40, 0, 1)
    # 近黑中性色 → 黑板；有色暗部保留一部分
    darkN = np.clip((95 - lum) / 45, 0, 1) * np.clip((0.35 - sat) / 0.2, 0, 1)
    darkC = np.clip((80 - lum) / 50, 0, 1) * (1 - np.clip((0.35 - sat) / 0.2, 0, 1))
    al = al * (1 - darkN) * (1 - 0.45 * darkC)
    # 亮一点、粉一点（粉笔比彩铅更粉）
    rgb = rgb * 0.92 + 255 * 0.06
    Image.fromarray(np.dstack([rgb, al * 255]).clip(0, 255).astype(np.uint8), 'RGBA').save(dst)
for who in ['kid', 'adult']:
    for k in range(6): chalkify(f'{who}_h{k}.png', f'{who}_c{k}.png')
# 闭眼版：在睁眼头像 h0 上把眼白和瞳孔盖成周围的毛色，再画一道弧线（弧线 = 露黑板）
def blink(src, dst, eyes):
    a = np.asarray(Image.open(src).convert('RGBA')).astype(float); rgb = a[..., :3].copy(); al = a[..., 3].copy()
    H, W = al.shape; yy, xx = np.mgrid[0:H, 0:W]
    for (cx, cy, rx, ry) in eyes:
        m = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
        band = (np.abs(xx - cx) < rx * 0.9) & (yy > cy - ry * 1.9) & (yy < cy - ry * 1.15) & (al > 200)
        lum = rgb.mean(2); sat = (rgb.max(2) - rgb.min(2)) / (rgb.max(2) + 1)
        fur = band & (lum > 80) & ((sat > 0.35) if sat[band].mean() > 0.25 else (lum < 220))
        col = np.median(rgb[fur], 0) if fur.sum() > 20 else np.array([230, 140, 70])
        rgb[m] = col + np.random.default_rng(3).normal(0, 6, (m.sum(), 3)); al[m] = np.maximum(al[m], 235)
        arc = (np.abs(((xx - cx) / rx) ** 2 + ((yy - cy - ry * 0.1) / (ry * 0.55)) ** 2 - 1) < 0.3) & (yy > cy) & m
        al[arc] = 0
    Image.fromarray(np.dstack([rgb, al]).clip(0, 255).astype(np.uint8), 'RGBA').save(dst)
blink('kid_c0.png', 'kid_c0b.png', [(272, 226, 26, 31), (198, 226, 20, 27)])
blink('adult_c0.png', 'adult_c0b.png', [(272, 206, 24, 14), (196, 206, 19, 13)])
print('ok')
