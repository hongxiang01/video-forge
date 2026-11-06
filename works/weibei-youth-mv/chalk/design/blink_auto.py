"""闭眼版（自动找眼睛）：眼镜框 = 最大的一块近黑线条；镜片 = 框里面；眼睛 = 镜片里的眼白+瞳孔。
眼睛那块盖成镜片里的毛色，再画一道下弯的闭眼弧（弧线 = 露黑板，透明）。"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
def run(orig, chalk, dst):
    o = np.asarray(Image.open(orig).convert('RGBA')).astype(float); c = np.asarray(Image.open(chalk).convert('RGBA')).astype(float)
    rgb = o[..., :3]; al = o[..., 3]; lum = rgb.mean(2); sat = (rgb.max(2) - rgb.min(2)) / (rgb.max(2) + 1)
    dark = (lum < 75) & (sat < 0.35) & (al > 120)
    lab, k = nd.label(nd.binary_dilation(dark, iterations=1)); sz = nd.sum(dark, lab, range(1, k + 1))
    frame = lab == 1 + np.argmax(sz)
    lens = nd.binary_fill_holes(frame) & ~nd.binary_dilation(frame, iterations=2)
    ll, kk = nd.label(lens); lsz = nd.sum(lens, ll, range(1, kk + 1))
    out = c.copy(); H, W = lum.shape; yy, xx = np.mgrid[0:H, 0:W]
    for i in np.argsort(-lsz)[:2]:
        L = ll == i + 1
        eye = L & (((lum > 175) & (sat < 0.25)) | ((lum < 120) & ~((sat > 0.45) & (lum > 90))))
        eye = nd.binary_fill_holes(nd.binary_closing(eye, iterations=3)) & L
        if eye.sum() < 30: continue
        ys, xs = np.where(eye); cy, cx, ry, rx = ys.mean(), xs.mean(), (ys.max() - ys.min()) / 2 + 2, (xs.max() - xs.min()) / 2 + 2
        fur = L & ~nd.binary_dilation(eye, iterations=2) & (lum > 80)
        col = np.median(c[..., :3][fur], 0) if fur.sum() > 20 else np.array([200, 200, 200])
        cover = nd.binary_dilation(eye, iterations=2) & L
        out[cover, :3] = col + np.random.default_rng(1).normal(0, 5, (cover.sum(), 3)); out[cover, 3] = 235
        arc = cover & (np.abs(((xx - cx) / (rx * 0.95)) ** 2 + ((yy - cy - ry * 0.05) / (ry * 0.6)) ** 2 - 1) < 0.32) & (yy > cy - ry * 0.05)
        out[arc, 3] = 0
        print(dst, 'eye', int(cx), int(cy), int(rx), int(ry))
    Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGBA').save(dst)
run('kid_h0.png', 'kid_c0.png', 'kid_c0b.png'); run('adult_h0.png', 'adult_c0.png', 'adult_c0b.png')
