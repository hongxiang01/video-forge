"""从黑板底的粉笔头像表里抠出每个头：alpha = 和黑板底色的色差；按连通块切开，锚点 = 下沿中点。"""
import json, sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
def key(src, name, expect):
    a = np.asarray(Image.open(src).convert('RGB')).astype(float); H, W, _ = a.shape
    a[int(H * 0.93):, int(W * 0.8):] = np.median(a.reshape(-1, 3), 0)          # 去水印角
    board = nd.median_filter(a, size=(1, 1, 1))
    bg = np.median(a.reshape(-1, 3), 0)
    big = nd.uniform_filter(a, size=(61, 61, 1))                                   # 局部板色（缓变）
    d = np.linalg.norm(a - np.where(np.linalg.norm(big - bg, axis=2, keepdims=True) < 25, big, bg), axis=2)
    alpha = np.clip((d - 14) / 46, 0, 1)
    m = nd.binary_closing(alpha > 0.15, iterations=6); m = nd.binary_fill_holes(m)
    lab, k = nd.label(nd.binary_dilation(m, iterations=10)); sz = nd.sum(m, lab, range(1, k + 1))
    keep = [i + 1 for i in np.argsort(-sz)[:expect]]
    boxes = []
    for i in keep:
        ys, xs = np.where((lab == i) & m); boxes.append((xs.min(), ys.min(), xs.max(), ys.max(), i))
    boxes.sort(key=lambda b: (round(b[1] / (H / 4)), b[0]))   # 先按行再按列
    meta = []
    for j, (x0, y0, x1, y1, i) in enumerate(boxes):
        reg = (lab == i)
        al = np.where(reg, alpha, 0)
        al = np.where(nd.binary_fill_holes(reg & m), np.maximum(al, 0.0), al)
        x0, y0, x1, y1 = max(x0 - 6, 0), max(y0 - 6, 0), min(x1 + 7, W), min(y1 + 7, H)
        rgba = np.dstack([a, al * 255])[y0:y1, x0:x1].clip(0, 255).astype(np.uint8)
        Image.fromarray(rgba, 'RGBA').save(f'{name}_h{j}.png'); meta.append({'file': f'design/{name}_h{j}.png', 'w': int(x1 - x0), 'h': int(y1 - y0)})
    json.dump(meta, open(f'{name}_heads.json', 'w'), indent=1); print(name, [(m['w'], m['h']) for m in meta])
key('kid_heads.png', 'kid', 6); key('adult_heads_4.png', 'adult', 6)
