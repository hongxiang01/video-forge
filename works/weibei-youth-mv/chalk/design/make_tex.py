"""从头像毛发里取"完全没有深色线条"的小块，随机旋转、羽化、环绕铺成 256 的可平铺笔触纹理（灰度，128 = 不变）。"""
import numpy as np
from PIL import Image
from scipy import ndimage as nd
def tex(src, dst, kid, seed):
    a = np.asarray(Image.open(src).convert('RGBA')).astype(float); rgb, al = a[..., :3], a[..., 3]
    lum = rgb.mean(2); sat = (rgb.max(2) - rgb.min(2)) / (rgb.max(2) + 1)
    ok = (al > 235) & ((lum > 110) & (sat > 0.33) if kid else (lum > 70) & (sat < 0.2) & (lum < 225))
    deep = lum < (85 if kid else 55)
    S = 28; cands = []
    for y in range(0, a.shape[0] - S, 3):
        for x in range(0, a.shape[1] - S, 3):
            if ok[y:y + S, x:x + S].mean() > 0.97 and not deep[y:y + S, x:x + S].any(): cands.append((x, y))
    print(src, 'clean patches', len(cands))
    hp = lum - nd.gaussian_filter(lum, 5)
    R = np.random.default_rng(seed); T = 256; acc = np.zeros((T, T)); wsum = np.zeros((T, T)) + 1e-6
    yy, xx = np.mgrid[0:S, 0:S]; feather = np.exp(-(((xx - S / 2) / (S * 0.32)) ** 2 + ((yy - S / 2) / (S * 0.32)) ** 2))
    for k in range(720):
        x, y = cands[R.integers(len(cands))]; p = hp[y:y + S, x:x + S]
        p = nd.rotate(p, R.uniform(-30, 30), reshape=False, mode='reflect'); ox, oy = R.integers(T), R.integers(T)
        P = np.zeros((T, T)); Wt = np.zeros((T, T)); P[:S, :S] = p * feather; Wt[:S, :S] = feather
        acc += np.roll(np.roll(P, oy, 0), ox, 1); wsum += np.roll(np.roll(Wt, oy, 0), ox, 1)
    t = acc / wsum; t = t / (np.std(t) + 1e-6)
    Image.fromarray(np.clip(128 + t * 30, 0, 255).astype(np.uint8), 'L').save(dst)
tex('kid_h0.png', 'tex_kid.png', True, 1); tex('adult_h0.png', 'tex_adult.png', False, 2)
