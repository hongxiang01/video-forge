"""从角色定稿里抠出 3/4 侧身（去米色底），输出 RGBA。用法：cutout.py"""
import numpy as np
from PIL import Image
from scipy import ndimage as nd
BOX = {'kid': (860, 80, 1580, 1540), 'adult': (860, 80, 1460, 1560)}
TEX = 1.6
for n, box in BOX.items():
    im = Image.open(f'../characters/{n}-final-design.png').convert('RGB').crop(box)
    a = np.asarray(im).astype(float)
    # 背景色：取四角中位数
    bg = np.median(np.concatenate([a[:20, :20].reshape(-1, 3), a[:20, -20:].reshape(-1, 3), a[-20:, :20].reshape(-1, 3), a[-20:, -20:].reshape(-1, 3)]), 0)
    # 背景和纸投影：色相接近底色（投影只是更暗更暖），且不比底色更冷、更亮
    f = a / (a.sum(2, keepdims=True) + 1e-6); fb = bg / bg.sum()
    near = np.linalg.norm(f - fb, axis=2) < 0.07
    cool = (a[..., 2] - a[..., 0]) - (bg[2] - bg[0])   # 白纸比米色底偏冷
    bright = a.sum(2) - bg.sum()
    fg = ~(near & (cool < 9) & (bright < 22))
    # 纸面有纤维纹理，底色和投影是平的：局部亮度标准差
    L = a.mean(2); hp = L - nd.gaussian_filter(L, 1.5)          # 只留高频：纸纤维有，投影渐变没有
    tex = np.sqrt(nd.uniform_filter(hp * hp, 11))
    ref = np.percentile(tex[near & (cool < 9) & (bright < 22) & (np.abs(bright) < 15)], 95)
    print('  tex bg95', ref.round(2))
    fg |= nd.binary_opening(tex > ref * TEX, iterations=4)
    fg = nd.binary_opening(fg, iterations=2)
    fg = nd.binary_closing(fg, iterations=4)
    fg = nd.binary_fill_holes(fg)
    lab, k = nd.label(fg)
    sizes = nd.sum(fg, lab, range(1, k + 1))
    keep = np.isin(lab, 1 + np.where(sizes > 3000)[0])
    alpha = nd.gaussian_filter(keep.astype(float), 0.8)
    out = np.dstack([a, alpha * 255]).clip(0, 255).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(f'{n}_cut.png')
    # 预览：放在深色底上检查边缘
    pv = Image.new('RGBA', im.size, (40, 60, 90, 255)); pv.alpha_composite(Image.fromarray(out, 'RGBA'))
    pv.convert('RGB').save(f'{n}_cut_preview.jpg')
    print(n, bg.round(), im.size)
