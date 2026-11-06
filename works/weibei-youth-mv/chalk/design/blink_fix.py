import numpy as np
from PIL import Image
def blink(src, dst, eyes, kid):
    a = np.asarray(Image.open(src).convert('RGBA')).astype(float); rgb = a[..., :3].copy(); al = a[..., 3].copy()
    H, W = al.shape; yy, xx = np.mgrid[0:H, 0:W]; lum = rgb.mean(2); sat = (rgb.max(2) - rgb.min(2)) / (rgb.max(2) + 1)
    R = np.random.default_rng(2)
    for (cx, cy, rx, ry) in eyes:
        m = ((xx - cx) / (rx + 3)) ** 2 + ((yy - cy) / (ry + 3)) ** 2 <= 1
        ring = (((xx - cx) / (rx * 1.7)) ** 2 + ((yy - cy) / (ry * 1.9)) ** 2 <= 1) & ~m & (al > 150)
        fur = ring & ((sat > 0.4) & (lum > 90) if kid else (lum > 95) & (lum < 200) & (sat < 0.15))
        col = np.median(rgb[fur], 0)
        rgb[m] = col + R.normal(0, 7, (m.sum(), 3)); al[m] = 238
        arc = m & (np.abs(((xx - cx) / (rx * 0.92)) ** 2 + ((yy - cy - ry * 0.05) / (ry * 0.62)) ** 2 - 1) < 0.34) & (yy > cy - 2)
        al[arc] = 0
    Image.fromarray(np.dstack([rgb, al]).clip(0, 255).astype(np.uint8), 'RGBA').save(dst)
blink('kid_c0.png', 'kid_c0b.png', [(188, 228, 32, 25), (274, 218, 15, 25)], True)
blink('adult_c0.png', 'adult_c0b.png', [(200, 210, 30, 12), (273, 205, 14, 12)], False)
