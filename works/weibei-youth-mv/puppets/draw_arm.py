"""画纸袖子 + 手爪（替代从设计稿里抠的胳膊）：沿骨骼链画管子，带纸纤维、撕纸白边，配色取自设计稿。"""
import numpy as np
from PIL import Image
from scipy import ndimage as nd
CLOTH = {
 'sleeve_kid':   dict(base=(52, 104, 178), stripe=(238, 236, 228), cuff=(40, 86, 155), paw=(92, 52, 36), shirt=None),
 'sleeve_adult': dict(base=(122, 121, 118), stripe=None, cuff=(98, 97, 95), paw=(78, 50, 38), shirt=(236, 232, 224)),
}
def seg_dist(P, A, B):
    d = B - A; L2 = (d ** 2).sum(); t = np.clip(((P - A) @ d) / L2, 0, 1)
    return np.linalg.norm(P - (A + t[..., None] * d), axis=-1), t
def draw_arm(H, W, chain, spec, seed, src_rgb=None, src_valid=None):
    rng = np.random.default_rng(seed); C = CLOTH[spec['cloth']]
    pts = [np.array(c[1:], float) for c in chain]   # 肩、肘、腕、手尖
    yy, xx = np.mgrid[0:H, 0:W]; P = np.dstack([xx, yy]).astype(float)
    w0, w1 = spec['w']; pw, pl = spec['paw']
    # 袖子：肩→肘→腕，宽度渐变；肩头圆
    d1, t1 = seg_dist(P, pts[0], pts[1]); d2, t2 = seg_dist(P, pts[1], pts[2])
    jit = nd.gaussian_filter(rng.normal(0, 1, (H, W)), 2) * 2.2
    sleeve = (d1 < (w0 / 2 + jit)) | (d2 < ((w0 + (w1 - w0) * t2) / 2 + jit))
    # 手爪：腕→手尖的椭圆，带一个拇指
    a, b = pts[2], pts[3]; ax = (b - a) / np.linalg.norm(b - a); nx = np.array([-ax[1], ax[0]])
    rel = P - (a + (b - a) * 0.55); u = rel @ ax; v = rel @ nx
    paw = (u / (pl * 0.55)) ** 2 + (v / (pw / 2)) ** 2 < 1
    th = rel - (ax * (-pl * 0.05) + nx * (-spec['side'] * pw * 0.45)); paw |= ((th @ ax) / 20) ** 2 + ((th @ nx) / 13) ** 2 < 1
    cuff_band = sleeve & (np.abs((P - a) @ ax + 6) < 9)
    shirt_band = (C['shirt'] is not None) & ~sleeve & (np.abs((P - a) @ ax - 8) < 6) & (np.abs((P - a) @ nx) < w1 / 2 - 2)
    shape = sleeve | paw | shirt_band
    rim = nd.binary_dilation(shape, iterations=3) & ~shape & (np.linalg.norm(P - pts[0], axis=-1) > w0 * 0.9)   # 肩头藏在身子下，不要白边
    img = np.zeros((H, W, 3)); img[:] = C['base']
    img[paw & ~sleeve] = C['paw']; img[cuff_band] = C['cuff']
    if C['shirt'] is not None: img[shirt_band] = C['shirt']
    if C['stripe'] is not None:   # 外侧白条
        for (A_, B_) in [(pts[0], pts[1]), (pts[1], pts[2])]:
            ax2 = (B_ - A_) / np.linalg.norm(B_ - A_); n2 = np.array([-ax2[1], ax2[0]]) * spec['side'] * -1
            off = (P - A_) @ n2; along = (P - A_) @ ax2
            m = sleeve & ~cuff_band & (off > w1 * 0.18) & (off < w1 * 0.34) & (along > -10) & (along < np.linalg.norm(B_ - A_) + 10)
            img[m] = C['stripe']
    # 肘部折痕
    # 纸纤维
    img = img + nd.gaussian_filter(rng.normal(0, 7, (H, W)), 0.7)[..., None]
    if src_rgb is not None:   # 颜色和纹理取自原图袖子/手爪，缺的地方用最近的有效像素补
        idx = nd.distance_transform_edt(~src_valid, return_distances=False, return_indices=True)
        img = src_rgb[idx[0], idx[1]].astype(float)
    img[rim] = (238, 230, 214)
    alpha = (shape | rim).astype(float)
    alpha = nd.gaussian_filter(alpha, 0.6)
    return img.clip(0, 255), alpha
